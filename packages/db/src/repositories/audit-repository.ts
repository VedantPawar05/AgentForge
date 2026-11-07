import { prisma } from "../index.js";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export interface AuditRecord {
  id: string;
  workspaceId: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IAuditRepository {
  record(data: {
    workspaceId: string;
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AuditRecord>;

  listByWorkspace(workspaceId: string, limit?: number): Promise<AuditRecord[]>;
}

export class PrismaAuditRepository implements IAuditRepository {
  public async record(data: {
    workspaceId: string;
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AuditRecord> {
    const record = await prisma.auditLog.create({
      data: {
        workspaceId: data.workspaceId,
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonObject,
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      actorId: record.actorId,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      metadata: record.metadata as Record<string, unknown>,
      createdAt: record.createdAt,
    };
  }

  public async listByWorkspace(
    workspaceId: string,
    limit = 50,
  ): Promise<AuditRecord[]> {
    const records = await prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      actorId: r.actorId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      metadata: r.metadata as Record<string, unknown>,
      createdAt: r.createdAt,
    }));
  }
}

export class InMemoryAuditRepository implements IAuditRepository {
  public logs: AuditRecord[] = [];

  public async record(data: {
    workspaceId: string;
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AuditRecord> {
    const log: AuditRecord = {
      id: randomUUID(),
      workspaceId: data.workspaceId,
      actorId: data.actorId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata ?? {},
      createdAt: new Date(),
    };
    this.logs.push(log);
    return log;
  }

  public async listByWorkspace(
    workspaceId: string,
    limit = 50,
  ): Promise<AuditRecord[]> {
    return this.logs
      .filter((l) => l.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  public clear(): void {
    this.logs = [];
  }
}
