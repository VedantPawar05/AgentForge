import {
  IRunRepository,
  ITaskRepository,
  IOutboxRepository,
} from "@agentforge/db";
import { TaskStatus } from "@agentforge/shared";

export class StaleRunReaper {
  constructor(
    private readonly runRepo: IRunRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly outboxRepo: IOutboxRepository,
    private readonly maxRetries = 2,
  ) {}

  public async reapStaleRuns(gracePeriodSeconds = 15): Promise<number> {
    const cutoff = new Date(Date.now() - gracePeriodSeconds * 1000);
    const staleRuns = await this.runRepo.findStaleRuns(cutoff);
    let reapedCount = 0;

    for (const run of staleRuns) {
      console.warn(
        `[StaleRunReaper] Found stale run ${run.id} (last lease: ${run.leaseExpiresAt}). Reaping...`,
      );

      // 1. Mark stale run as FAILED
      await this.runRepo.failRun(
        run.id,
        `Worker lease heartbeat expired. Presumed dead worker: ${run.workerId ?? "unknown"}`,
      );

      // 2. Fetch task
      const task = await this.taskRepo.findById(run.taskId);
      if (!task) continue;

      // 3. Check if retryable
      if (run.attemptNumber < this.maxRetries) {
        const nextAttempt = run.attemptNumber + 1;
        console.log(
          `[StaleRunReaper] Automatically scheduling retry attempt ${nextAttempt} for task ${task.id}`,
        );

        // Create new attempt
        const retryRun = await this.runRepo.createRun({
          taskId: task.id,
          workspaceId: task.workspaceId,
          attemptNumber: nextAttempt,
        });

        // Set task status back to QUEUED
        await this.taskRepo.updateTask(task.id, task.version, {
          status: TaskStatus.QUEUED,
        });

        // Emit outbox event
        await this.outboxRepo.createEvent({
          eventType: "TASK_RUN_REQUESTED",
          aggregateType: "Run",
          aggregateId: retryRun.id,
          payload: {
            runId: retryRun.id,
            taskId: task.id,
            workspaceId: task.workspaceId,
            attemptNumber: nextAttempt,
            targetBranch: task.targetBranch,
          },
        });
      } else {
        // Retries exhausted: mark logical task as FAILED
        console.warn(
          `[StaleRunReaper] Retries exhausted for task ${task.id}. Marking task as FAILED.`,
        );
        await this.taskRepo.updateTask(task.id, task.version, {
          status: TaskStatus.FAILED,
        });
      }

      reapedCount++;
    }

    return reapedCount;
  }
}
