import { prisma } from "../index.js";
import { randomUUID } from "crypto";

export interface OutboxRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  retryCount: number;
  scheduledFor: Date;
  createdAt: Date;
  publishedAt?: Date | null;
}

export interface IOutboxRepository {
  createEvent(data: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    scheduledFor?: Date;
  }): Promise<OutboxRecord>;

  fetchPending(limit?: number): Promise<OutboxRecord[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, maxRetries?: number): Promise<void>;
}

export class PrismaOutboxRepository implements IOutboxRepository {
  public async createEvent(data: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    scheduledFor?: Date;
  }): Promise<OutboxRecord> {
    const record = await prisma.outboxEvent.create({
      data: {
        eventType: data.eventType,
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        payload: data.payload as any,
        scheduledFor: data.scheduledFor ?? new Date(),
      },
    });

    return {
      id: record.id,
      eventType: record.eventType,
      aggregateType: record.aggregateType,
      aggregateId: record.aggregateId,
      payload: record.payload as Record<string, unknown>,
      status: record.status as any,
      retryCount: record.retryCount,
      scheduledFor: record.scheduledFor,
      createdAt: record.createdAt,
      publishedAt: record.publishedAt,
    };
  }

  public async fetchPending(limit = 50): Promise<OutboxRecord[]> {
    const records = await prisma.outboxEvent.findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: new Date() },
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    return records.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      aggregateType: r.aggregateType,
      aggregateId: r.aggregateId,
      payload: r.payload as Record<string, unknown>,
      status: r.status as any,
      retryCount: r.retryCount,
      scheduledFor: r.scheduledFor,
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
    }));
  }

  public async markPublished(id: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }

  public async markFailed(id: string, maxRetries = 5): Promise<void> {
    const current = await prisma.outboxEvent.findUnique({ where: { id } });
    if (!current) return;

    const nextRetry = current.retryCount + 1;
    const isExhausted = nextRetry >= maxRetries;

    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: isExhausted ? "FAILED" : "PENDING",
        retryCount: nextRetry,
        scheduledFor: new Date(Date.now() + Math.pow(2, nextRetry) * 1000),
      },
    });
  }
}

export class InMemoryOutboxRepository implements IOutboxRepository {
  public events = new Map<string, OutboxRecord>();

  public async createEvent(data: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    scheduledFor?: Date;
  }): Promise<OutboxRecord> {
    const now = new Date();
    const event: OutboxRecord = {
      id: randomUUID(),
      eventType: data.eventType,
      aggregateType: data.aggregateType,
      aggregateId: data.aggregateId,
      payload: data.payload,
      status: "PENDING",
      retryCount: 0,
      scheduledFor: data.scheduledFor ?? now,
      createdAt: now,
    };
    this.events.set(event.id, event);
    return event;
  }

  public async fetchPending(limit = 50): Promise<OutboxRecord[]> {
    const now = new Date();
    return Array.from(this.events.values())
      .filter((e) => e.status === "PENDING" && e.scheduledFor <= now)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }

  public async markPublished(id: string): Promise<void> {
    const ev = this.events.get(id);
    if (ev) {
      ev.status = "PUBLISHED";
      ev.publishedAt = new Date();
    }
  }

  public async markFailed(id: string, maxRetries = 5): Promise<void> {
    const ev = this.events.get(id);
    if (!ev) return;
    ev.retryCount += 1;
    if (ev.retryCount >= maxRetries) {
      ev.status = "FAILED";
    } else {
      ev.scheduledFor = new Date(
        Date.now() + Math.pow(2, ev.retryCount) * 1000,
      );
    }
  }

  public clear(): void {
    this.events.clear();
  }
}
