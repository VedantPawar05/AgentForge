import { randomUUID, randomBytes } from "crypto";
import { prisma } from "../index.js";

export interface RunnerRecord {
  id: string;
  workspaceId: string;
  name: string;
  hostname?: string;
  status: "ONLINE" | "OFFLINE" | "BUSY";
  token: string;
  lastHeartbeatAt: Date;
  registeredAt: Date;
  labels?: string[];
  currentRunId?: string | null;
}

export interface IRunnerRepository {
  registerRunner(data: {
    workspaceId: string;
    name: string;
    hostname?: string;
    labels?: string[];
  }): Promise<RunnerRecord>;
  findById(id: string): Promise<RunnerRecord | null>;
  findByToken(token: string): Promise<RunnerRecord | null>;
  listRunners(workspaceId: string): Promise<RunnerRecord[]>;
  heartbeat(
    id: string,
    status?: "ONLINE" | "BUSY",
    currentRunId?: string | null,
  ): Promise<boolean>;
  deleteRunner(id: string): Promise<void>;
}

export class InMemoryRunnerRepository implements IRunnerRepository {
  private runners: Map<string, RunnerRecord> = new Map();

  public async registerRunner(data: {
    workspaceId: string;
    name: string;
    hostname?: string;
    labels?: string[];
  }): Promise<RunnerRecord> {
    const id = `runner-${randomUUID()}`;
    const token = `rn_tok_${randomBytes(24).toString("hex")}`;
    const now = new Date();
    const record: RunnerRecord = {
      id,
      workspaceId: data.workspaceId,
      name: data.name,
      hostname: data.hostname || "localhost",
      status: "ONLINE",
      token,
      lastHeartbeatAt: now,
      registeredAt: now,
      labels: data.labels || ["local", "default"],
      currentRunId: null,
    };
    this.runners.set(id, record);
    return record;
  }

  public async findById(id: string): Promise<RunnerRecord | null> {
    return this.runners.get(id) || null;
  }

  public async findByToken(token: string): Promise<RunnerRecord | null> {
    for (const runner of this.runners.values()) {
      if (runner.token === token) return runner;
    }
    return null;
  }

  public async listRunners(workspaceId: string): Promise<RunnerRecord[]> {
    const results: RunnerRecord[] = [];
    const now = Date.now();
    for (const runner of this.runners.values()) {
      if (runner.workspaceId === workspaceId) {
        // Mark as OFFLINE if no heartbeat in last 60 seconds
        const isStale = now - runner.lastHeartbeatAt.getTime() > 60000;
        results.push({
          ...runner,
          status: isStale ? "OFFLINE" : runner.status,
        });
      }
    }
    return results;
  }

  public async heartbeat(
    id: string,
    status: "ONLINE" | "BUSY" = "ONLINE",
    currentRunId: string | null = null,
  ): Promise<boolean> {
    const runner = this.runners.get(id);
    if (!runner) return false;
    runner.lastHeartbeatAt = new Date();
    runner.status = status;
    runner.currentRunId = currentRunId;
    return true;
  }

  public async deleteRunner(id: string): Promise<void> {
    this.runners.delete(id);
  }
}

export class PrismaRunnerRepository implements IRunnerRepository {
  public async registerRunner(data: {
    workspaceId: string;
    name: string;
    hostname?: string;
    labels?: string[];
  }): Promise<RunnerRecord> {
    const token = `rn_tok_${randomBytes(24).toString("hex")}`;
    const runner = await prisma.runner.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        hostname: data.hostname || "localhost",
        status: "ONLINE",
        token,
        labels: data.labels || ["local", "default"],
      },
    });

    return {
      id: runner.id,
      workspaceId: runner.workspaceId,
      name: runner.name,
      hostname: runner.hostname ?? undefined,
      status: runner.status as "ONLINE" | "OFFLINE" | "BUSY",
      token: runner.token,
      lastHeartbeatAt: runner.lastHeartbeatAt,
      registeredAt: runner.registeredAt,
      labels: (runner.labels as string[]) || [],
      currentRunId: runner.currentRunId,
    };
  }

  public async findById(id: string): Promise<RunnerRecord | null> {
    const runner = await prisma.runner.findUnique({ where: { id } });
    if (!runner) return null;
    return {
      id: runner.id,
      workspaceId: runner.workspaceId,
      name: runner.name,
      hostname: runner.hostname ?? undefined,
      status: runner.status as "ONLINE" | "OFFLINE" | "BUSY",
      token: runner.token,
      lastHeartbeatAt: runner.lastHeartbeatAt,
      registeredAt: runner.registeredAt,
      labels: (runner.labels as string[]) || [],
      currentRunId: runner.currentRunId,
    };
  }

  public async findByToken(token: string): Promise<RunnerRecord | null> {
    const runner = await prisma.runner.findUnique({ where: { token } });
    if (!runner) return null;
    return {
      id: runner.id,
      workspaceId: runner.workspaceId,
      name: runner.name,
      hostname: runner.hostname ?? undefined,
      status: runner.status as "ONLINE" | "OFFLINE" | "BUSY",
      token: runner.token,
      lastHeartbeatAt: runner.lastHeartbeatAt,
      registeredAt: runner.registeredAt,
      labels: (runner.labels as string[]) || [],
      currentRunId: runner.currentRunId,
    };
  }

  public async listRunners(workspaceId: string): Promise<RunnerRecord[]> {
    const runners = await prisma.runner.findMany({
      where: { workspaceId },
      orderBy: { registeredAt: "desc" },
    });
    const now = Date.now();
    return runners.map((runner) => {
      const isStale = now - runner.lastHeartbeatAt.getTime() > 60000;
      return {
        id: runner.id,
        workspaceId: runner.workspaceId,
        name: runner.name,
        hostname: runner.hostname ?? undefined,
        status: isStale
          ? "OFFLINE"
          : (runner.status as "ONLINE" | "OFFLINE" | "BUSY"),
        token: runner.token,
        lastHeartbeatAt: runner.lastHeartbeatAt,
        registeredAt: runner.registeredAt,
        labels: (runner.labels as string[]) || [],
        currentRunId: runner.currentRunId,
      };
    });
  }

  public async heartbeat(
    id: string,
    status: "ONLINE" | "BUSY" = "ONLINE",
    currentRunId: string | null = null,
  ): Promise<boolean> {
    try {
      await prisma.runner.update({
        where: { id },
        data: {
          lastHeartbeatAt: new Date(),
          status,
          currentRunId,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  public async deleteRunner(id: string): Promise<void> {
    await prisma.runner.delete({ where: { id } }).catch(() => {});
  }
}
