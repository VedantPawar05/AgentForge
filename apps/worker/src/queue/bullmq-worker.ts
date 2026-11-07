import { Worker, WorkerOptions, Job } from "bullmq";
import { Redis } from "ioredis";
import { QueueWorker, ExecutionPayload } from "./queue-worker.js";
import { logger } from "@agentforge/shared";

export interface BullMQWorkerConfig {
  queueName?: string;
  redisUrl?: string;
  concurrency?: number;
  connection?: Redis;
  onDeadLetter?: (
    job: Job<ExecutionPayload>,
    err: Error,
  ) => Promise<void> | void;
}

export class BullMQExecutionWorker {
  private worker: Worker<ExecutionPayload>;
  private redisConnection: Redis;
  private isOwnedConnection = false;

  constructor(
    private readonly queueWorker: QueueWorker,
    private readonly config: BullMQWorkerConfig = {},
  ) {
    const queueName = config.queueName || "task-execution";

    if (config.connection) {
      this.redisConnection = config.connection;
    } else {
      const url =
        config.redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
      this.redisConnection = new Redis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
      });
      this.isOwnedConnection = true;
    }

    const workerOpts: WorkerOptions = {
      connection: this.redisConnection,
      concurrency:
        config.concurrency ||
        parseInt(process.env.BULLMQ_CONCURRENCY || "2", 10),
    };

    this.worker = new Worker<ExecutionPayload>(
      queueName,
      async (job: Job<ExecutionPayload>) => {
        logger.info(
          { jobId: job.id, attempt: job.attemptsMade + 1, data: job.data },
          "[BullMQWorker] Received job from queue",
        );

        const result = await this.queueWorker.executeJob(job.data);
        return result;
      },
      workerOpts,
    );

    this.setupListeners();
  }

  private setupListeners(): void {
    this.worker.on("completed", (job: Job<ExecutionPayload>, result: any) => {
      logger.info(
        { jobId: job.id, runId: job.data.runId, result },
        "[BullMQWorker] Job execution completed successfully",
      );
    });

    this.worker.on(
      "failed",
      async (job: Job<ExecutionPayload> | undefined, err: Error) => {
        if (!job) {
          logger.error(
            { err: err.message },
            "[BullMQWorker] Unhandled job failure without job context",
          );
          return;
        }

        const maxAttempts = job.opts.attempts || 3;
        const isDeadLetter = job.attemptsMade >= maxAttempts;

        logger.warn(
          {
            jobId: job.id,
            runId: job.data.runId,
            attempt: job.attemptsMade,
            maxAttempts,
            isDeadLetter,
            err: err.message,
          },
          `[BullMQWorker] Job attempt failed: ${err.message}`,
        );

        // Dead Letter Handling: Retries exhausted
        if (isDeadLetter) {
          logger.error(
            { jobId: job.id, runId: job.data.runId, taskId: job.data.taskId },
            "[BullMQWorker] CRITICAL: Job reached Dead-Letter Queue (retries exhausted)",
          );

          if (this.config.onDeadLetter) {
            try {
              await this.config.onDeadLetter(job, err);
            } catch (dlqErr: any) {
              logger.error(
                { err: dlqErr?.message },
                "[BullMQWorker] Error in onDeadLetter callback",
              );
            }
          }
        }
      },
    );

    this.worker.on("error", (err) => {
      logger.error({ err: err.message }, "[BullMQWorker] Worker engine error");
    });
  }

  public async close(): Promise<void> {
    logger.info("[BullMQWorker] Closing worker...");
    await this.worker.close();

    if (this.isOwnedConnection) {
      await this.redisConnection.quit().catch(() => {});
    }
    logger.info("[BullMQWorker] Worker stopped cleanly");
  }

  public get isRunning(): boolean {
    return this.worker.isRunning();
  }
}
