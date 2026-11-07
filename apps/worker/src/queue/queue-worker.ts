import { IRunRepository, ITaskRepository } from "@agentforge/db";
import { IAgentAdapter } from "@agentforge/agent-adapters";
import { ISandboxDriver } from "@agentforge/sandbox";
import {
  TaskStatus,
  RunStatus,
  logger,
  activeRunsGauge,
  queueJobsTotal,
  jobDurationSeconds,
  workerLeaseRenewalsTotal,
} from "@agentforge/shared";

export interface ExecutionPayload {
  runId: string;
  taskId: string;
  workspaceId: string;
  attemptNumber: number;
  targetBranch?: string;
}

export class QueueWorker {
  constructor(
    public readonly workerId: string,
    private readonly runRepo: IRunRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly agentAdapter: IAgentAdapter,
    private readonly sandboxDriver: ISandboxDriver,
    private readonly leaseDurationSeconds = 30,
    private readonly heartbeatIntervalMs = 5000,
    private readonly taskTimeoutMs?: number,
  ) {}

  public async executeJob(payload: ExecutionPayload): Promise<{
    executed: boolean;
    status: RunStatus;
    reason?: string;
  }> {
    const { runId, taskId, targetBranch = "main" } = payload;
    const workerLogger = logger.child({
      service: "agentforge-worker",
      workerId: this.workerId,
      runId,
      taskId,
      workspaceId: payload.workspaceId,
    });

    // 1. Idempotency Check: Acquire worker lease in database
    const acquired = await this.runRepo.acquireLease(
      runId,
      this.workerId,
      this.leaseDurationSeconds,
    );
    if (!acquired) {
      console.warn(
        `[QueueWorker] Worker ${this.workerId} failed to acquire lease for run ${runId}. Duplicate delivery or already claimed. Skipping.`,
      );
      return {
        executed: false,
        status: RunStatus.PENDING,
        reason: "LEASE_NOT_ACQUIRED",
      };
    }

    activeRunsGauge.inc();
    workerLogger.info("Worker acquired lease. Starting execution...");

    // 2. Start heartbeat daemon
    let heartbeatTimer: NodeJS.Timeout | null = setInterval(async () => {
      try {
        await this.runRepo.renewLease(
          runId,
          this.workerId,
          this.leaseDurationSeconds,
        );
        workerLeaseRenewalsTotal.inc();
      } catch (err) {
        workerLogger.error({ err }, "Heartbeat renewal failed");
      }
    }, this.heartbeatIntervalMs);

    const cleanupHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const abortController = new AbortController();
    let isTimedOut = false;
    let taskTimeoutTimer: NodeJS.Timeout | null = null;
    if (this.taskTimeoutMs && this.taskTimeoutMs > 0) {
      taskTimeoutTimer = setTimeout(() => {
        isTimedOut = true;
        abortController.abort(new Error("Task execution timed out"));
      }, this.taskTimeoutMs);
    }

    const cleanupTimers = () => {
      cleanupHeartbeat();
      if (taskTimeoutTimer) {
        clearTimeout(taskTimeoutTimer);
        taskTimeoutTimer = null;
      }
    };

    const startTime = Date.now();

    try {
      const task = await this.taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Check for user cancellation before heavy operations
      const runCheck = await this.runRepo.findById(runId);
      if (
        runCheck?.status === RunStatus.CANCELLED ||
        task.status === TaskStatus.CANCELLED
      ) {
        cleanupTimers();
        activeRunsGauge.dec();
        queueJobsTotal.inc({ status: "CANCELLED" });
        await this.sandboxDriver.destroy().catch(() => {});
        return {
          executed: true,
          status: RunStatus.CANCELLED,
          reason: "USER_CANCELLED",
        };
      }

      // 3. State: PROVISIONING
      await this.taskRepo.updateTask(taskId, task.version, {
        status: TaskStatus.PROVISIONING,
      });

      await this.sandboxDriver.provision({
        sandboxId: `sb-${runId}`,
        workspaceDir: `/tmp/agentforge/${runId}`,
      });

      // Cancellation check after provisioning
      const taskAfterProv = await this.taskRepo.findById(taskId);
      const runAfterProv = await this.runRepo.findById(runId);
      if (
        taskAfterProv?.status === TaskStatus.CANCELLED ||
        runAfterProv?.status === RunStatus.CANCELLED
      ) {
        cleanupTimers();
        activeRunsGauge.dec();
        queueJobsTotal.inc({ status: "CANCELLED" });
        await this.sandboxDriver.destroy().catch(() => {});
        return {
          executed: true,
          status: RunStatus.CANCELLED,
          reason: "USER_CANCELLED",
        };
      }

      // 4. State: RUNNING (Agent Loop)
      const currentTask = (await this.taskRepo.findById(taskId))!;
      await this.taskRepo.updateTask(taskId, currentTask.version, {
        status: TaskStatus.RUNNING,
      });

      const agentResult = await this.agentAdapter.executeTask(
        {
          taskId,
          taskTitle: task.title,
          taskDescription: task.description ?? "",
          repoOwner: "agentforge",
          repoName: "repo",
          targetBranch,
          workspaceDir: `/tmp/agentforge/${runId}`,
        },
        (ev) => {
          workerLogger.info(
            { eventType: ev.type },
            `[Run ${runId}] [${ev.type}] ${ev.message}`,
          );
        },
        abortController.signal,
      );

      // Cancellation check after agent execution
      const taskAfterAgent = await this.taskRepo.findById(taskId);
      const runAfterAgent = await this.runRepo.findById(runId);
      if (
        taskAfterAgent?.status === TaskStatus.CANCELLED ||
        runAfterAgent?.status === RunStatus.CANCELLED
      ) {
        cleanupTimers();
        activeRunsGauge.dec();
        queueJobsTotal.inc({ status: "CANCELLED" });
        await this.sandboxDriver.destroy().catch(() => {});
        return {
          executed: true,
          status: RunStatus.CANCELLED,
          reason: "USER_CANCELLED",
        };
      }

      if (!agentResult.success) {
        throw new Error(agentResult.errorMessage ?? "Agent execution failed");
      }

      // 5. State: TESTING (Run test suite inside isolated sandbox)
      const taskBeforeTesting = (await this.taskRepo.findById(taskId))!;
      await this.taskRepo.updateTask(taskId, taskBeforeTesting.version, {
        status: TaskStatus.TESTING,
      });

      const testResult = await this.sandboxDriver.executeCommand("npm", [
        "test",
      ]);
      await this.sandboxDriver.getDiff(targetBranch);

      const durationMs = Date.now() - startTime;
      const durationSec = durationMs / 1000;

      if (testResult.exitCode !== 0) {
        // Tests failed or timed out
        const failedTask = (await this.taskRepo.findById(taskId))!;
        const nextTaskStatus = testResult.timedOut
          ? TaskStatus.TIMED_OUT
          : TaskStatus.FAILED;
        await this.taskRepo.updateTask(taskId, failedTask.version, {
          status: nextTaskStatus,
        });
        await this.runRepo.failRun(
          runId,
          testResult.timedOut
            ? "Execution timed out"
            : `Test suite failed with exit code ${testResult.exitCode}`,
        );

        cleanupTimers();
        activeRunsGauge.dec();
        queueJobsTotal.inc({ status: "FAILED" });
        jobDurationSeconds.observe(durationSec, { status: "FAILED" });

        await this.sandboxDriver.destroy().catch(() => {});
        return {
          executed: true,
          status: RunStatus.FAILED,
          reason: testResult.timedOut ? "TIMED_OUT" : "TESTS_FAILED",
        };
      }

      // Cancellation check before completing
      const taskBeforeSuccess = (await this.taskRepo.findById(taskId))!;
      const runBeforeSuccess = await this.runRepo.findById(runId);
      if (
        taskBeforeSuccess.status === TaskStatus.CANCELLED ||
        runBeforeSuccess?.status === RunStatus.CANCELLED
      ) {
        cleanupTimers();
        activeRunsGauge.dec();
        queueJobsTotal.inc({ status: "CANCELLED" });
        await this.sandboxDriver.destroy().catch(() => {});
        return {
          executed: true,
          status: RunStatus.CANCELLED,
          reason: "USER_CANCELLED",
        };
      }

      // 6. Success: Transition to AWAITING_REVIEW
      await this.taskRepo.updateTask(taskId, taskBeforeSuccess.version, {
        status: TaskStatus.AWAITING_REVIEW,
      });

      await this.runRepo.completeRun(runId, {
        exitCode: 0,
        durationMs,
        promptTokens: agentResult.usage.promptTokens,
        completionTokens: agentResult.usage.completionTokens,
        costCents: agentResult.usage.estimatedCostCents,
      });

      cleanupTimers();
      activeRunsGauge.dec();
      queueJobsTotal.inc({ status: "COMPLETED" });
      jobDurationSeconds.observe(durationSec, { status: "COMPLETED" });

      await this.sandboxDriver.destroy().catch(() => {});

      workerLogger.info({ durationMs }, "Execution completed successfully.");
      return { executed: true, status: RunStatus.COMPLETED };
    } catch (err: any) {
      cleanupTimers();
      activeRunsGauge.dec();
      queueJobsTotal.inc({ status: "FAILED" });
      const durationSec = (Date.now() - startTime) / 1000;
      jobDurationSeconds.observe(durationSec, { status: "FAILED" });

      await this.sandboxDriver.destroy().catch(() => {});

      const errorMsg = err?.message ?? "Execution error";
      workerLogger.error({ err }, `Run failed: ${errorMsg}`);

      // If already cancelled, do not overwrite status with FAILED
      const t = await this.taskRepo.findById(taskId);
      const r = await this.runRepo.findById(runId);
      if (
        t?.status === TaskStatus.CANCELLED ||
        r?.status === RunStatus.CANCELLED
      ) {
        return {
          executed: true,
          status: RunStatus.CANCELLED,
          reason: "USER_CANCELLED",
        };
      }

      const isTimeout =
        isTimedOut ||
        errorMsg.toLowerCase().includes("timed out") ||
        errorMsg.toLowerCase().includes("timeout");

      await this.runRepo.failRun(runId, errorMsg);

      if (t) {
        const nextStatus = isTimeout ? TaskStatus.TIMED_OUT : TaskStatus.FAILED;
        await this.taskRepo
          .updateTask(taskId, t.version, { status: nextStatus })
          .catch(() => {});
      }

      return {
        executed: true,
        status: RunStatus.FAILED,
        reason: isTimeout ? "TIMED_OUT" : errorMsg,
      };
    }
  }
}
