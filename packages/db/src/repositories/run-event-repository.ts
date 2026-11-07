import { prisma } from "../index.js";
import { randomUUID } from "crypto";
import { Prisma, RunEventType } from "@prisma/client";

export interface RunEventRecord {
  id: string;
  runId: string;
  sequenceNumber: number;
  type: RunEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface IRunEventRepository {
  appendEvent(data: {
    runId: string;
    type: RunEventType;
    payload: Record<string, unknown>;
  }): Promise<RunEventRecord>;

  getEvents(
    runId: string,
    options?: { sinceSeq?: number; limit?: number },
  ): Promise<RunEventRecord[]>;
}

export class PrismaRunEventRepository implements IRunEventRepository {
  public async appendEvent(data: {
    runId: string;
    type: RunEventType;
    payload: Record<string, unknown>;
  }): Promise<RunEventRecord> {
    // Find next monotonic sequence number for this run
    const lastEvent = await prisma.runEvent.findFirst({
      where: { runId: data.runId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });

    const nextSeq = (lastEvent?.sequenceNumber ?? 0n) + 1n;

    const event = await prisma.runEvent.create({
      data: {
        runId: data.runId,
        sequenceNumber: nextSeq,
        type: data.type,
        payload: data.payload as Prisma.InputJsonObject,
      },
    });

    return {
      id: event.id,
      runId: event.runId,
      sequenceNumber: Number(event.sequenceNumber),
      type: event.type as RunEventType,
      payload: event.payload as Record<string, unknown>,
      createdAt: event.createdAt,
    };
  }

  public async getEvents(
    runId: string,
    options?: { sinceSeq?: number; limit?: number },
  ): Promise<RunEventRecord[]> {
    const where: Prisma.RunEventWhereInput = { runId };
    if (options?.sinceSeq !== undefined) {
      where.sequenceNumber = { gt: BigInt(options.sinceSeq) };
    }

    const events = await prisma.runEvent.findMany({
      where,
      orderBy: { sequenceNumber: "asc" },
      take: options?.limit ?? 500,
    });

    return events.map((e) => ({
      id: e.id,
      runId: e.runId,
      sequenceNumber: Number(e.sequenceNumber),
      type: e.type as RunEventType,
      payload: e.payload as Record<string, unknown>,
      createdAt: e.createdAt,
    }));
  }
}

export class InMemoryRunEventRepository implements IRunEventRepository {
  public events: RunEventRecord[] = [];

  public async appendEvent(data: {
    runId: string;
    type: RunEventType;
    payload: Record<string, unknown>;
  }): Promise<RunEventRecord> {
    const runEvents = this.events.filter((e) => e.runId === data.runId);
    const maxSeq = runEvents.reduce(
      (max, e) => Math.max(max, e.sequenceNumber),
      0,
    );
    const nextSeq = maxSeq + 1;

    const record: RunEventRecord = {
      id: randomUUID(),
      runId: data.runId,
      sequenceNumber: nextSeq,
      type: data.type,
      payload: data.payload,
      createdAt: new Date(),
    };

    this.events.push(record);
    return record;
  }

  public async getEvents(
    runId: string,
    options?: { sinceSeq?: number; limit?: number },
  ): Promise<RunEventRecord[]> {
    let filtered = this.events.filter((e) => e.runId === runId);
    if (options?.sinceSeq !== undefined) {
      filtered = filtered.filter((e) => e.sequenceNumber > options.sinceSeq!);
    }
    filtered.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }

  public clear(): void {
    this.events = [];
  }
}
