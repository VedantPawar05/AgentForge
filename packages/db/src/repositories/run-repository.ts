import { RunStatus } from "@agentforge/shared";
import { prisma } from "../index.js";
import { randomUUID } from "crypto";

export interface RunRecord {
  id: string;
  taskId: string;
  workspaceId: string;
  attemptNumber: number;
  status: RunStatus;
  workerId?: string | null;
  leaseExpiresAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  exitCode?: number | null;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  costCents?: number | null;
  createdAt: Date;
}

export interface IRunRepository {
  createRun(data: {
    taskId: string;
    workspaceId: string;
    attemptNumber: number;
  }): Promise<RunRecord>;

  findById(id: string): Promise<RunRecord | null>;
  listRunsForTask(taskId: string): Promise<RunRecord[]>;
  countActiveRunsInWorkspace(workspaceId: string): Promise<number>;

  acquireLease(
    runId: string,
    workerId: string,
    leaseDurationSeconds: number,
  ): Promise<boolean>;

  renewLease(
    runId: string,
    workerId: string,
    leaseDurationSeconds: number,
  ): Promise<boolean>;

  completeRun(
    runId: string,
    data: {
      exitCode: number;
      durationMs: number;
      promptTokens?: number;
      completionTokens?: number;
      costCents?: number;
    },
  ): Promise<RunRecord>;

  failRun(runId: string, errorMessage: string): Promise<RunRecord>;
  cancelRun(runId: string): Promise<RunRecord>;

  findStaleRuns(cutoff: Date): Promise<RunRecord[]>;
}

export class PrismaRunRepository implements IRunRepository {
  public async createRun(data: {
    taskId: string;
    workspaceId: string;
    attemptNumber: number;
  }): Promise<RunRecord> {
    const run = await prisma.run.create({
      data: {
        taskId: data.taskId,
        workspaceId: data.workspaceId,
        attemptNumber: data.attemptNumber,
        status: "PENDING",
      },
    });

    return {
      ...run,
      status: run.status as RunStatus,
    };
  }

  public async findById(id: string): Promise<RunRecord | null> {
    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) return null;
    return {
      ...run,
      status: run.status as RunStatus,
    };
  }

  public async listRunsForTask(taskId: string): Promise<RunRecord[]> {
    const runs = await prisma.run.findMany({
      where: { taskId },
      orderBy: { attemptNumber: "desc" },
    });
    return runs.map((r) => ({
      ...r,
      status: r.status as RunStatus,
    }));
  }

  public async countActiveRunsInWorkspace(
    workspaceId: string,
  ): Promise<number> {
    return prisma.run.count({
      where: {
        workspaceId,
        status: { in: ["ALLOCATED", "RUNNING"] },
      },
    });
  }

  public async acquireLease(
    runId: string,
    workerId: string,
    leaseDurationSeconds: number,
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + leaseDurationSeconds * 1000);
    const updated = await prisma.run.updateMany({
      where: {
        id: runId,
        status: "PENDING",
      },
      data: {
        status: "ALLOCATED",
        workerId,
        leaseExpiresAt: expiresAt,
        startedAt: new Date(),
      },
    });
    return updated.count > 0;
  }

  public async renewLease(
    runId: string,
    workerId: string,
    leaseDurationSeconds: number,
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + leaseDurationSeconds * 1000);
    const updated = await prisma.run.updateMany({
      where: {
        id: runId,
        workerId,
        status: { in: ["ALLOCATED", "RUNNING"] },
      },
      data: {
        leaseExpiresAt: expiresAt,
        status: "RUNNING",
      },
    });
    return updated.count > 0;
  }

  public async completeRun(
    runId: string,
    data: {
      exitCode: number;
      durationMs: number;
      promptTokens?: number;
      completionTokens?: number;
      costCents?: number;
    },
  ): Promise<RunRecord> {
    const run = await prisma.run.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        exitCode: data.exitCode,
        durationMs: data.durationMs,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        costCents: data.costCents,
        completedAt: new Date(),
      },
    });
    return {
      ...run,
      status: run.status as RunStatus,
    };
  }

  public async failRun(
    runId: string,
    errorMessage: string,
  ): Promise<RunRecord> {
    const run = await prisma.run.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });
    return {
      ...run,
      status: run.status as RunStatus,
    };
  }

  public async cancelRun(runId: string): Promise<RunRecord> {
    const run = await prisma.run.update({
      where: { id: runId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });
    return {
      ...run,
      status: run.status as RunStatus,
    };
  }

  public async findStaleRuns(cutoff: Date): Promise<RunRecord[]> {
    const runs = await prisma.run.findMany({
      where: {
        status: { in: ["ALLOCATED", "RUNNING"] },
        leaseExpiresAt: { lte: cutoff },
      },
    });
    return runs.map((r) => ({
      ...r,
      status: r.status as RunStatus,
    }));
  }
}

export class InMemoryRunRepository implements IRunRepository {
  public runs = new Map<string, RunRecord>();

  public async createRun(data: {
    taskId: string;
    workspaceId: string;
    attemptNumber: number;
  }): Promise<RunRecord> {
    const run: RunRecord = {
      id: randomUUID(),
      taskId: data.taskId,
      workspaceId: data.workspaceId,
      attemptNumber: data.attemptNumber,
      status: RunStatus.PENDING,
      createdAt: new Date(),
    };
    this.runs.set(run.id, run);
    return run;
  }

  public async findById(id: string): Promise<RunRecord | null> {
    return this.runs.get(id) ?? null;
  }

  public async listRunsForTask(taskId: string): Promise<RunRecord[]> {
    return Array.from(this.runs.values())
      .filter((r) => r.taskId === taskId)
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
  }

  public async countActiveRunsInWorkspace(
    workspaceId: string,
  ): Promise<number> {
    return Array.from(this.runs.values()).filter(
      (r) =>
        r.workspaceId === workspaceId &&
        (r.status === RunStatus.ALLOCATED || r.status === RunStatus.RUNNING),
    ).length;
  }

  public async acquireLease(
    runId: string,
    workerId: string,
    leaseDurationSeconds: number,
  ): Promise<boolean> {
    const run = this.runs.get(runId);
    if (!run || run.status !== RunStatus.PENDING) {
      return false;
    }
    run.status = RunStatus.ALLOCATED;
    run.workerId = workerId;
    run.startedAt = new Date();
    run.leaseExpiresAt = new Date(Date.now() + leaseDurationSeconds * 1000);
    return true;
  }

  public async renewLease(
    runId: string,
    workerId: string,
    leaseDurationSeconds: number,
  ): Promise<boolean> {
    const run = this.runs.get(runId);
    if (!run || run.workerId !== workerId) return false;
    if (run.status !== RunStatus.ALLOCATED && run.status !== RunStatus.RUNNING)
      return false;

    run.status = RunStatus.RUNNING;
    run.leaseExpiresAt = new Date(Date.now() + leaseDurationSeconds * 1000);
    return true;
  }

  public async completeRun(
    runId: string,
    data: {
      exitCode: number;
      durationMs: number;
      promptTokens?: number;
      completionTokens?: number;
      costCents?: number;
    },
  ): Promise<RunRecord> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found");
    run.status = RunStatus.COMPLETED;
    run.exitCode = data.exitCode;
    run.durationMs = data.durationMs;
    run.promptTokens = data.promptTokens;
    run.completionTokens = data.completionTokens;
    run.costCents = data.costCents;
    run.completedAt = new Date();
    return run;
  }

  public async failRun(
    runId: string,
    errorMessage: string,
  ): Promise<RunRecord> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found");
    run.status = RunStatus.FAILED;
    run.errorMessage = errorMessage;
    run.completedAt = new Date();
    return run;
  }

  public async cancelRun(runId: string): Promise<RunRecord> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found");
    run.status = RunStatus.CANCELLED;
    run.completedAt = new Date();
    return run;
  }

  public async findStaleRuns(cutoff: Date): Promise<RunRecord[]> {
    return Array.from(this.runs.values()).filter(
      (r) =>
        (r.status === RunStatus.ALLOCATED || r.status === RunStatus.RUNNING) &&
        r.leaseExpiresAt &&
        r.leaseExpiresAt <= cutoff,
    );
  }

  public clear(): void {
    this.runs.clear();
  }
}
