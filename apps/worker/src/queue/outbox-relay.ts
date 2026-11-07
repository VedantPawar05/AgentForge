import { IOutboxRepository } from "@agentforge/db";

export interface IJobQueue {
  addJob(queueName: string, data: Record<string, unknown>): Promise<void>;
}

export class InMemoryJobQueue implements IJobQueue {
  public jobs: { queueName: string; data: Record<string, unknown> }[] = [];

  public async addJob(
    queueName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.jobs.push({ queueName, data });
  }

  public clear(): void {
    this.jobs = [];
  }
}

export class OutboxRelay {
  private isRunning = false;

  constructor(
    private readonly outboxRepo: IOutboxRepository,
    private readonly jobQueue: IJobQueue,
  ) {}

  public async processPendingEvents(batchSize = 25): Promise<number> {
    const pending = await this.outboxRepo.fetchPending(batchSize);
    let dispatched = 0;

    for (const event of pending) {
      try {
        if (event.eventType === "TASK_RUN_REQUESTED") {
          await this.jobQueue.addJob("task-execution", event.payload);
        }

        await this.outboxRepo.markPublished(event.id);
        dispatched++;
      } catch (err) {
        console.error(
          `[OutboxRelay] Failed to publish event ${event.id}:`,
          err,
        );
        await this.outboxRepo.markFailed(event.id);
      }
    }

    return dispatched;
  }

  public startPolling(pollIntervalMs = 500): () => void {
    this.isRunning = true;

    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      await this.processPendingEvents();
    }, pollIntervalMs);

    return () => {
      this.isRunning = false;
      clearInterval(interval);
    };
  }
}
