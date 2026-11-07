import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryRunRepository,
  InMemoryTaskRepository,
  InMemoryOutboxRepository,
} from "@agentforge/db";
import { OutboxRelay, InMemoryJobQueue } from "./queue/outbox-relay.js";
import { QueueWorker, ExecutionPayload } from "./queue/queue-worker.js";
import { StaleRunReaper } from "./queue/stale-run-reaper.js";
import { MockAgentAdapter } from "@agentforge/agent-adapters";
import { MockSandboxDriver } from "@agentforge/sandbox";
import { TaskStatus, RunStatus } from "@agentforge/shared";

describe("Phase 4: Reliable Job Processing, Outbox, Leases & Recovery", () => {
  let runRepo: InMemoryRunRepository;
  let taskRepo: InMemoryTaskRepository;
  let outboxRepo: InMemoryOutboxRepository;
  let jobQueue: InMemoryJobQueue;
  let outboxRelay: OutboxRelay;

  const workspaceId = "ws-reliability-test";
  const projectId = "proj-reliability-test";
  const actorId = "user-alice";

  async function triggerRunHelper(taskId: string, attemptNumber = 1) {
    const run = await runRepo.createRun({
      taskId,
      workspaceId,
      attemptNumber,
    });

    await outboxRepo.createEvent({
      eventType: "TASK_RUN_REQUESTED",
      aggregateType: "Run",
      aggregateId: run.id,
      payload: {
        runId: run.id,
        taskId,
        workspaceId,
        attemptNumber,
        targetBranch: "main",
      },
    });

    return run;
  }

  beforeEach(() => {
    runRepo = new InMemoryRunRepository();
    taskRepo = new InMemoryTaskRepository();
    outboxRepo = new InMemoryOutboxRepository();
    jobQueue = new InMemoryJobQueue();
    outboxRelay = new OutboxRelay(outboxRepo, jobQueue);
  });

  it("reliably records outbox events and dispatches via OutboxRelay", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Task 1",
    });

    // 1. Trigger Run
    const run = await triggerRunHelper(task.id, 1);
    expect(run.status).toBe(RunStatus.PENDING);
    expect(run.attemptNumber).toBe(1);

    // Verify Outbox Event created
    const pendingEvents = await outboxRepo.fetchPending();
    expect(pendingEvents.length).toBe(1);
    expect(pendingEvents[0].eventType).toBe("TASK_RUN_REQUESTED");
    expect(pendingEvents[0].aggregateId).toBe(run.id);

    // 2. Outbox Relay sweep
    const dispatched = await outboxRelay.processPendingEvents();
    expect(dispatched).toBe(1);
    expect(jobQueue.jobs.length).toBe(1);
    expect(jobQueue.jobs[0].data.runId).toBe(run.id);

    // Outbox event should now be marked PUBLISHED
    const remainingPending = await outboxRepo.fetchPending();
    expect(remainingPending.length).toBe(0);
  });

  it("enforces worker lease acquisition and prevents duplicate concurrent execution (idempotency)", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Task Idempotency",
    });

    const run = await triggerRunHelper(task.id, 1);

    const worker1 = new QueueWorker(
      "worker-alpha",
      runRepo,
      taskRepo,
      new MockAgentAdapter(),
      new MockSandboxDriver(),
      30,
      1000,
    );

    const worker2 = new QueueWorker(
      "worker-beta",
      runRepo,
      taskRepo,
      new MockAgentAdapter(),
      new MockSandboxDriver(),
      30,
      1000,
    );

    const payload = {
      runId: run.id,
      taskId: task.id,
      workspaceId,
      attemptNumber: 1,
    };

    // Both workers attempt to execute the exact same run simultaneously
    const [result1, result2] = await Promise.all([
      worker1.executeJob(payload),
      worker2.executeJob(payload),
    ]);

    // Exactly ONE worker must succeed; the other must detect lease failure and skip!
    const executedWorkers = [result1, result2].filter(
      (r) => r.executed && r.status === RunStatus.COMPLETED,
    );
    const skippedWorkers = [result1, result2].filter(
      (r) => !r.executed && r.reason === "LEASE_NOT_ACQUIRED",
    );

    expect(executedWorkers.length).toBe(1);
    expect(skippedWorkers.length).toBe(1);

    // Task reached AWAITING_REVIEW
    const updatedTask = await taskRepo.findById(task.id);
    expect(updatedTask?.status).toBe(TaskStatus.AWAITING_REVIEW);
  });

  it("detects dead worker crashes and schedules automatic retry via StaleRunReaper", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Crash Recovery Test",
    });

    // Create Attempt 1
    const run1 = await triggerRunHelper(task.id, 1);

    // Simulate Worker crashing after acquiring lease
    await runRepo.acquireLease(run1.id, "worker-crashed", 1); // 1s lease
    await taskRepo.updateTask(task.id, task.version, {
      status: TaskStatus.RUNNING,
    });

    // Wait 1.1s so lease expires
    await new Promise((r) => setTimeout(r, 1100));

    // Stale Run Reaper sweeps
    const reaper = new StaleRunReaper(runRepo, taskRepo, outboxRepo, 2);
    const reaped = await reaper.reapStaleRuns(0); // 0s grace period for test
    expect(reaped).toBe(1);

    // Attempt 1 should be FAILED
    const failedRun1 = await runRepo.findById(run1.id);
    expect(failedRun1?.status).toBe(RunStatus.FAILED);
    expect(failedRun1?.errorMessage).toContain(
      "Worker lease heartbeat expired",
    );

    // Attempt 2 should be automatically scheduled!
    const allRuns = await runRepo.listRunsForTask(task.id);
    expect(allRuns.length).toBe(2);
    const attempt2 = allRuns.find((r) => r.attemptNumber === 2);
    expect(attempt2).toBeDefined();
    expect(attempt2?.status).toBe(RunStatus.PENDING);

    // Task is back to QUEUED
    const resetTask = await taskRepo.findById(task.id);
    expect(resetTask?.status).toBe(TaskStatus.QUEUED);

    // Verify Outbox Event created for Attempt 2
    const pendingOutbox = await outboxRepo.fetchPending();
    expect(pendingOutbox.some((e) => e.aggregateId === attempt2!.id)).toBe(
      true,
    );
  });

  it("accurately tracks active runs for workspace concurrency quota checks", async () => {
    const task1 = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "T1",
    });
    const task2 = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "T2",
    });

    const run1 = await triggerRunHelper(task1.id, 1);
    const run2 = await triggerRunHelper(task2.id, 1);

    expect(await runRepo.countActiveRunsInWorkspace(workspaceId)).toBe(0);

    // Set run 1 to active (lease acquired)
    await runRepo.acquireLease(run1.id, "worker-1", 60);
    expect(await runRepo.countActiveRunsInWorkspace(workspaceId)).toBe(1);

    // Set run 2 to active
    await runRepo.acquireLease(run2.id, "worker-2", 60);
    expect(await runRepo.countActiveRunsInWorkspace(workspaceId)).toBe(2);

    // Completing run 1 decrements active count
    await runRepo.completeRun(run1.id, { exitCode: 0, durationMs: 1200 });
    expect(await runRepo.countActiveRunsInWorkspace(workspaceId)).toBe(1);
  });

  it("handles user cancellation of in-flight run", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Cancel Me",
    });
    const run = await triggerRunHelper(task.id, 1);

    // User cancels run
    const cancelled = await runRepo.cancelRun(run.id);
    expect(cancelled.status).toBe(RunStatus.CANCELLED);

    await taskRepo.updateTask(task.id, task.version, {
      status: TaskStatus.CANCELLED,
    });
    const updatedTask = await taskRepo.findById(task.id);
    expect(updatedTask?.status).toBe(TaskStatus.CANCELLED);
  });

  it("Scenario 1: rejects duplicate queue redelivery after run completion", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Task Duplicate Delivery",
    });
    const run = await triggerRunHelper(task.id, 1);

    const worker = new QueueWorker(
      "worker-primary",
      runRepo,
      taskRepo,
      new MockAgentAdapter(),
      new MockSandboxDriver(),
      30,
      1000,
    );

    const payload = {
      runId: run.id,
      taskId: task.id,
      workspaceId,
      attemptNumber: 1,
    };

    // 1st delivery executes successfully
    const firstResult = await worker.executeJob(payload);
    expect(firstResult.executed).toBe(true);
    expect(firstResult.status).toBe(RunStatus.COMPLETED);

    // 2nd delivery (replayed message from queue) must be rejected idempotently
    const secondResult = await worker.executeJob(payload);
    expect(secondResult.executed).toBe(false);
    expect(secondResult.reason).toBe("LEASE_NOT_ACQUIRED");

    // Run remains COMPLETED and task remains AWAITING_REVIEW
    const finalRun = await runRepo.findById(run.id);
    expect(finalRun?.status).toBe(RunStatus.COMPLETED);
    const finalTask = await taskRepo.findById(task.id);
    expect(finalTask?.status).toBe(TaskStatus.AWAITING_REVIEW);
  });

  it("Scenario 3: handles cancellation racing during in-flight execution without corrupting terminal state", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Racing Cancellation Task",
    });
    const run = await triggerRunHelper(task.id, 1);

    // Agent adapter with artificial delay so cancellation can race mid-flight
    const slowAgent = new MockAgentAdapter({ simulatedDelayMs: 250 });
    const sandbox = new MockSandboxDriver();

    const worker = new QueueWorker(
      "worker-race",
      runRepo,
      taskRepo,
      slowAgent,
      sandbox,
      30,
      1000,
    );

    const payload = {
      runId: run.id,
      taskId: task.id,
      workspaceId,
      attemptNumber: 1,
    };

    // Launch worker execution asynchronously
    const workerPromise = worker.executeJob(payload);

    // Race: User cancels task while agent is simulating work (after 50ms)
    await new Promise((r) => setTimeout(r, 50));
    await runRepo.cancelRun(run.id);
    const currentTask = (await taskRepo.findById(task.id))!;
    await taskRepo.updateTask(task.id, currentTask.version, {
      status: TaskStatus.CANCELLED,
    });

    const result = await workerPromise;

    // Worker detected cancellation and cleanly yielded CANCELLED
    expect(result.status).toBe(RunStatus.CANCELLED);
    expect(result.reason).toBe("USER_CANCELLED");

    // Final states must remain CANCELLED; never overwritten with AWAITING_REVIEW or FAILED
    const persistedTask = await taskRepo.findById(task.id);
    expect(persistedTask?.status).toBe(TaskStatus.CANCELLED);
    const persistedRun = await runRepo.findById(run.id);
    expect(persistedRun?.status).toBe(RunStatus.CANCELLED);
    expect(sandbox.isDestroyed).toBe(true);
  });

  it("Scenario 4: enforces task timeout, safely contains execution, and records TIMED_OUT outcome", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Slow Task for Timeout",
    });
    const run = await triggerRunHelper(task.id, 1);

    // Sandbox configured to simulate command timing out
    const timeoutSandbox = new MockSandboxDriver({ shouldTimeout: true });
    const worker = new QueueWorker(
      "worker-timeout",
      runRepo,
      taskRepo,
      new MockAgentAdapter(),
      timeoutSandbox,
      30,
      1000,
    );

    const result = await worker.executeJob({
      runId: run.id,
      taskId: task.id,
      workspaceId,
      attemptNumber: 1,
    });

    expect(result.executed).toBe(true);
    expect(result.reason).toBe("TIMED_OUT");
    expect(result.status).toBe(RunStatus.FAILED);

    // Sandbox container was safely destroyed
    expect(timeoutSandbox.isDestroyed).toBe(true);

    // Task transitioned to TIMED_OUT
    const finalTask = await taskRepo.findById(task.id);
    expect(finalTask?.status).toBe(TaskStatus.TIMED_OUT);

    // Run records timeout failure
    const finalRun = await runRepo.findById(run.id);
    expect(finalRun?.status).toBe(RunStatus.FAILED);
    expect(finalRun?.errorMessage).toContain("timed out");
  });

  it("Scenario 5: terminates predictably upon retry exhaustion without infinite loop", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Retry Exhaustion Task",
    });

    // Simulate Run Attempt 2 (which is already the maxRetries = 2 attempt)
    const run2 = await runRepo.createRun({
      taskId: task.id,
      workspaceId,
      attemptNumber: 2,
    });

    // Worker claimed attempt 2 but crashed (expired lease)
    await runRepo.acquireLease(run2.id, "worker-dead-2", 1);
    await taskRepo.updateTask(task.id, task.version, {
      status: TaskStatus.RUNNING,
    });

    // Expire lease
    await new Promise((r) => setTimeout(r, 1100));

    // Reaper runs with maxRetries = 2
    const reaper = new StaleRunReaper(runRepo, taskRepo, outboxRepo, 2);
    const reapedCount = await reaper.reapStaleRuns(0);

    expect(reapedCount).toBe(1);

    // Attempt 2 marked FAILED
    const finalRun2 = await runRepo.findById(run2.id);
    expect(finalRun2?.status).toBe(RunStatus.FAILED);
    expect(finalRun2?.errorMessage).toContain("Worker lease heartbeat expired");

    // No attempt 3 created!
    const allRuns = await runRepo.listRunsForTask(task.id);
    expect(allRuns.length).toBe(1); // Only attempt 2 exists

    // Task must be permanently marked FAILED (not re-queued)
    const finalTask = await taskRepo.findById(task.id);
    expect(finalTask?.status).toBe(TaskStatus.FAILED);

    // Outbox must NOT have any new TASK_RUN_REQUESTED events
    const pendingEvents = await outboxRepo.fetchPending();
    expect(pendingEvents.length).toBe(0);
  });

  it("Scenario 6: expired leases recover and execute successfully on subsequent attempt", async () => {
    const task = await taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: "Recovery and Completion Task",
    });

    // Attempt 1 created
    const run1 = await triggerRunHelper(task.id, 1);
    await runRepo.acquireLease(run1.id, "worker-crashed", 1);
    await taskRepo.updateTask(task.id, task.version, {
      status: TaskStatus.RUNNING,
    });

    // Wait for lease to expire
    await new Promise((r) => setTimeout(r, 1100));

    // Reaper recovers stale attempt 1 and creates attempt 2
    const reaper = new StaleRunReaper(runRepo, taskRepo, outboxRepo, 2);
    await reaper.reapStaleRuns(0);

    // OutboxRelay delivers attempt 2 to the queue
    const dispatched = await outboxRelay.processPendingEvents();
    expect(dispatched).toBe(2); // Attempt 1 + Attempt 2 outbox events
    expect(jobQueue.jobs.length).toBe(2);

    const retryJob = jobQueue.jobs[1];
    const retryJobData = retryJob.data as unknown as ExecutionPayload;
    expect(retryJobData.attemptNumber).toBe(2);

    // Healthy worker picks up Attempt 2 and completes it
    const healthyWorker = new QueueWorker(
      "worker-healthy-2",
      runRepo,
      taskRepo,
      new MockAgentAdapter(),
      new MockSandboxDriver(),
      30,
      1000,
    );

    const execResult = await healthyWorker.executeJob(retryJobData);
    expect(execResult.executed).toBe(true);
    expect(execResult.status).toBe(RunStatus.COMPLETED);

    // Final states: Task is AWAITING_REVIEW, Attempt 2 is COMPLETED, Attempt 1 is FAILED
    const finalTask = await taskRepo.findById(task.id);
    expect(finalTask?.status).toBe(TaskStatus.AWAITING_REVIEW);

    const run2 = await runRepo.findById(retryJobData.runId);
    expect(run2?.status).toBe(RunStatus.COMPLETED);

    const run1Final = await runRepo.findById(run1.id);
    expect(run1Final?.status).toBe(RunStatus.FAILED);
  });
});
