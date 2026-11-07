import { prisma } from "../index.js";
import { ArtifactType } from "@prisma/client";
import { randomUUID } from "crypto";

export interface ArtifactRecord {
  id: string;
  runId: string;
  workspaceId: string;
  type: ArtifactType;
  storagePath: string;
  content?: string;
  fileSizeBytes: number;
  checksumSha256: string;
  createdAt: Date;
}

export interface IArtifactRepository {
  saveArtifact(data: {
    runId: string;
    workspaceId: string;
    type: ArtifactType;
    storagePath: string;
    content?: string;
    fileSizeBytes: number;
    checksumSha256: string;
  }): Promise<ArtifactRecord>;

  findDiffForRun(runId: string): Promise<ArtifactRecord | null>;
  listArtifactsForRun(runId: string): Promise<ArtifactRecord[]>;
}

export class PrismaArtifactRepository implements IArtifactRepository {
  public async saveArtifact(data: {
    runId: string;
    workspaceId: string;
    type: ArtifactType;
    storagePath: string;
    content?: string;
    fileSizeBytes: number;
    checksumSha256: string;
  }): Promise<ArtifactRecord> {
    const record = await prisma.artifact.create({
      data: {
        runId: data.runId,
        workspaceId: data.workspaceId,
        type: data.type,
        storagePath: data.storagePath,
        fileSizeBytes: BigInt(data.fileSizeBytes),
        checksumSha256: data.checksumSha256,
      },
    });

    return {
      id: record.id,
      runId: record.runId,
      workspaceId: record.workspaceId,
      type: record.type as ArtifactType,
      storagePath: record.storagePath,
      content: data.content,
      fileSizeBytes: Number(record.fileSizeBytes),
      checksumSha256: record.checksumSha256,
      createdAt: record.createdAt,
    };
  }

  public async findDiffForRun(runId: string): Promise<ArtifactRecord | null> {
    const record = await prisma.artifact.findFirst({
      where: {
        runId,
        type: "DIFF",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) return null;

    return {
      id: record.id,
      runId: record.runId,
      workspaceId: record.workspaceId,
      type: record.type as ArtifactType,
      storagePath: record.storagePath,
      fileSizeBytes: Number(record.fileSizeBytes),
      checksumSha256: record.checksumSha256,
      createdAt: record.createdAt,
    };
  }

  public async listArtifactsForRun(runId: string): Promise<ArtifactRecord[]> {
    const records = await prisma.artifact.findMany({
      where: { runId },
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      runId: r.runId,
      workspaceId: r.workspaceId,
      type: r.type as ArtifactType,
      storagePath: r.storagePath,
      fileSizeBytes: Number(r.fileSizeBytes),
      checksumSha256: r.checksumSha256,
      createdAt: r.createdAt,
    }));
  }
}

export class InMemoryArtifactRepository implements IArtifactRepository {
  public artifacts: ArtifactRecord[] = [];

  public async saveArtifact(data: {
    runId: string;
    workspaceId: string;
    type: ArtifactType;
    storagePath: string;
    content?: string;
    fileSizeBytes: number;
    checksumSha256: string;
  }): Promise<ArtifactRecord> {
    const record: ArtifactRecord = {
      id: randomUUID(),
      runId: data.runId,
      workspaceId: data.workspaceId,
      type: data.type,
      storagePath: data.storagePath,
      content: data.content,
      fileSizeBytes: data.fileSizeBytes,
      checksumSha256: data.checksumSha256,
      createdAt: new Date(),
    };

    this.artifacts.push(record);
    return record;
  }

  public async findDiffForRun(runId: string): Promise<ArtifactRecord | null> {
    const diffs = this.artifacts
      .filter((a) => a.runId === runId && a.type === "DIFF")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return diffs[0] ?? null;
  }

  public async listArtifactsForRun(runId: string): Promise<ArtifactRecord[]> {
    return this.artifacts.filter((a) => a.runId === runId);
  }

  public clear(): void {
    this.artifacts = [];
  }
}
