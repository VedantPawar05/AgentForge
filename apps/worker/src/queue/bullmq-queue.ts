import { Queue, QueueOptions, JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { IJobQueue } from "./outbox-relay.js";
import { logger } from "@agentforge/shared";

export interface BullMQConfig {
  redisUrl?: string;
  defaultJobOptions?: JobsOptions;
  connection?: Redis;
}

export class BullMQJobQueue implements IJobQueue {
  private queues = new Map<string, Queue>();
  private redisConnection: Redis;
  private isOwnedConnection = false;

  constructor(private readonly config: BullMQConfig = {}) {
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

      this.redisConnection.on("error", (err) => {
        logger.error(
          { err: err.message },
          "[BullMQJobQueue] Redis connection error",
        );
      });
    }
  }

  public getQueue(queueName: string): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      const queueOpts: QueueOptions = {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: { count: 500 },
          removeOnFail: false, // Retain failed jobs for dead-letter analysis & inspection
          ...this.config.defaultJobOptions,
        },
      };

      queue = new Queue(queueName, queueOpts);
      this.queues.set(queueName, queue);
      logger.info({ queueName }, "[BullMQJobQueue] Initialized BullMQ queue");
    }
    return queue;
  }

  public async addJob(
    queueName: string,
    data: Record<string, unknown>,
    opts?: JobsOptions,
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    const jobId = (data.runId as string) || (data.id as string) || undefined;

    await queue.add("execute-task", data, {
      jobId, // Use runId as jobId to prevent duplicate job insertion at the queue layer
      ...opts,
    });

    logger.debug(
      { queueName, jobId },
      "[BullMQJobQueue] Enqueued job successfully",
    );
  }

  public async getFailedJobs(queueName: string, start = 0, end = 50) {
    const queue = this.getQueue(queueName);
    return queue.getFailed(start, end);
  }

  public async retryFailedJob(
    queueName: string,
    jobId: string,
  ): Promise<boolean> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job && (await job.isFailed())) {
      await job.retry();
      return true;
    }
    return false;
  }

  public async close(): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      logger.info({ queue: name }, "[BullMQJobQueue] Queue closed");
    }
    this.queues.clear();

    if (this.isOwnedConnection) {
      await this.redisConnection.quit().catch(() => {});
    }
  }
}
