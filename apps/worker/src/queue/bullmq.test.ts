import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BullMQJobQueue } from "./bullmq-queue.js";
import { BullMQExecutionWorker } from "./bullmq-worker.js";
import { OutboxRelay } from "./outbox-relay.js";
import {
  InMemoryOutboxRepository,
  InMemoryRunRepository,
  InMemoryTaskRepository,
} from "@agentforge/db";
import { QueueWorker } from "./queue-worker.js";
import { MockAgentAdapter } from "@agentforge/agent-adapters";
import { MockSandboxDriver } from "@agentforge/sandbox";
import { RunStatus } from "@agentforge/shared";

// Mock BullMQ Queue and Worker classes
vi.mock("bullmq", () => {
  class MockQueue {
    public name: string;
    public jobs: any[] = [];
    public defaultJobOptions: any;

    constructor(name: string, opts: any = {}) {
      this.name = name;
      this.defaultJobOptions = opts.defaultJobOptions;
    }

    public async add(name: string, data: any, opts: any = {}) {
      const job = {
        id: opts.jobId || `job-${Math.random()}`,
        name,
        data,
        opts,
      };
      this.jobs.push(job);
      return job;
    }

    public async getFailed(start = 0, end = 50) {
      return this.jobs.filter((j) => j.failed);
    }

    public async getJob(id: string) {
      const job = this.jobs.find((j) => j.id === id);
      if (!job) return null;
      return {
        ...job,
        isFailed: async () => !!job.failed,
        retry: async () => {
          job.failed = false;
        },
      };
    }

    public async close() {
      this.jobs = [];
    }
  }

  class MockWorker {
    public name: string;
    public processor: any;
    public listeners: Record<string, Array<(...args: any[]) => any>> = {};
    private _isRunning = true;

    constructor(name: string, processor: any, _opts: any = {}) {
      this.name = name;
      this.processor = processor;
    }

    public on(event: string, cb: (...args: any[]) => any) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
      return this;
    }

    public emit(event: string, ...args: any[]) {
      const cbs = this.listeners[event] || [];
      for (const cb of cbs) {
        cb(...args);
      }
    }

    public async simulateJob(job: any) {
      try {
        const result = await this.processor(job);
        this.emit("completed", job, result);
        return result;
      } catch (err) {
        this.emit("failed", job, err);
        throw err;
      }
    }

    public isRunning() {
      return this._isRunning;
    }

    public async close() {
      this._isRunning = false;
    }
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
  };
});

// Mock ioredis
vi.mock("ioredis", () => {
  class MockRedis {
    public on() {}
    public quit() {
      return Promise.resolve();
    }
  }
  return { Redis: MockRedis };
});

describe("BullMQJobQueue & OutboxRelay Integration", () => {
  let queue: BullMQJobQueue;
  let outboxRepo: InMemoryOutboxRepository;

  beforeEach(() => {
    queue = new BullMQJobQueue({ redisUrl: "redis://localhost:6379" });
    outboxRepo = new InMemoryOutboxRepository();
  });

  afterEach(async () => {
    await queue.close();
  });

  it("enqueues job with deduplication key (jobId = runId)", async () => {
    const payload = {
      runId: "run-alpha",
      taskId: "task-123",
      workspaceId: "ws-1",
      attemptNumber: 1,
    };

    await queue.addJob("task-execution", payload);

    const bq = queue.getQueue("task-execution") as any;
    expect(bq.jobs.length).toBe(1);
    expect(bq.jobs[0].id).toBe("run-alpha");
    expect(bq.jobs[0].data.taskId).toBe("task-123");
  });

  it("OutboxRelay dispatches pending events into BullMQ", async () => {
    await outboxRepo.createEvent({
      eventType: "TASK_RUN_REQUESTED",
      aggregateType: "Run",
      aggregateId: "run-999",
      payload: {
        runId: "run-999",
        taskId: "task-outbox",
        workspaceId: "ws-test",
        attemptNumber: 1,
      },
    });

    const relay = new OutboxRelay(outboxRepo, queue);
    const count = await relay.processPendingEvents();

    expect(count).toBe(1);
    const bq = queue.getQueue("task-execution") as any;
    expect(bq.jobs.length).toBe(1);
    expect(bq.jobs[0].id).toBe("run-999");

    // Event in outbox is now marked PUBLISHED
    const pending = await outboxRepo.fetchPending();
    expect(pending.length).toBe(0);
  });
});

describe("BullMQExecutionWorker", () => {
  let runRepo: InMemoryRunRepository;
  let taskRepo: InMemoryTaskRepository;
  let queueWorker: QueueWorker;

  beforeEach(() => {
    runRepo = new InMemoryRunRepository();
    taskRepo = new InMemoryTaskRepository();
    queueWorker = new QueueWorker(
      "worker-bullmq-test",
      runRepo,
      taskRepo,
      new MockAgentAdapter(),
      new MockSandboxDriver(),
      30,
      1000,
    );
  });

  it("processes execution job from BullMQ worker and acquires lease", async () => {
    const task = await taskRepo.createTask({
      workspaceId: "ws-1",
      projectId: "p-1",
      createdById: "u-1",
      title: "BullMQ Execution Task",
    });

    const run = await runRepo.createRun({
      taskId: task.id,
      workspaceId: "ws-1",
      attemptNumber: 1,
    });

    const worker = new BullMQExecutionWorker(queueWorker, {
      queueName: "task-execution",
    });

    const mockJob = {
      id: run.id,
      data: {
        runId: run.id,
        taskId: task.id,
        workspaceId: "ws-1",
        attemptNumber: 1,
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    const internalWorker = (worker as any).worker;
    const result = await internalWorker.simulateJob(mockJob);

    expect(result.executed).toBe(true);
    expect(result.status).toBe(RunStatus.COMPLETED);

    // Verify lease was acquired and run completed
    const completedRun = await runRepo.findById(run.id);
    expect(completedRun?.status).toBe(RunStatus.COMPLETED);

    await worker.close();
  });

  it("triggers Dead-Letter handler when attemptsMade >= maxAttempts", async () => {
    const onDeadLetterSpy = vi.fn();
    const worker = new BullMQExecutionWorker(queueWorker, {
      queueName: "task-execution",
      onDeadLetter: onDeadLetterSpy,
    });

    const failedJob = {
      id: "run-dead-letter",
      data: {
        runId: "run-dead-letter",
        taskId: "task-dlq",
        workspaceId: "ws-1",
        attemptNumber: 3,
      },
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    const internalWorker = (worker as any).worker;
    internalWorker.emit(
      "failed",
      failedJob,
      new Error("Container crashed with exit code 137 (OOMKilled)"),
    );

    expect(onDeadLetterSpy).toHaveBeenCalledWith(
      failedJob,
      expect.objectContaining({
        message: expect.stringContaining("OOMKilled"),
      }),
    );

    await worker.close();
  });
});
