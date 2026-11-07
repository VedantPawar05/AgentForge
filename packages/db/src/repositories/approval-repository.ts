import { prisma } from "../index.js";
import { ApprovalStatus } from "@prisma/client";
import { randomUUID } from "crypto";

export interface ApprovalRecord {
  id: string;
  taskId: string;
  runId: string;
  workspaceId: string;
  reviewerId: string;
  status: ApprovalStatus;
  reviewNotes?: string | null;
  mergeCommitSha?: string | null;
  reviewedAt: Date;
}

export interface IApprovalRepository {
  createApproval(data: {
    taskId: string;
    runId: string;
    workspaceId: string;
    reviewerId: string;
    status: ApprovalStatus;
    reviewNotes?: string | null;
    mergeCommitSha?: string | null;
  }): Promise<ApprovalRecord>;

  listApprovalsForTask(taskId: string): Promise<ApprovalRecord[]>;
  findLatestApproval(taskId: string): Promise<ApprovalRecord | null>;
}

export class PrismaApprovalRepository implements IApprovalRepository {
  public async createApproval(data: {
    taskId: string;
    runId: string;
    workspaceId: string;
    reviewerId: string;
    status: ApprovalStatus;
    reviewNotes?: string | null;
    mergeCommitSha?: string | null;
  }): Promise<ApprovalRecord> {
    const record = await prisma.approval.create({
      data: {
        taskId: data.taskId,
        runId: data.runId,
        workspaceId: data.workspaceId,
        reviewerId: data.reviewerId,
        status: data.status,
        reviewNotes: data.reviewNotes,
        mergeCommitSha: data.mergeCommitSha,
      },
    });

    return {
      id: record.id,
      taskId: record.taskId,
      runId: record.runId,
      workspaceId: record.workspaceId,
      reviewerId: record.reviewerId,
      status: record.status as ApprovalStatus,
      reviewNotes: record.reviewNotes,
      mergeCommitSha: record.mergeCommitSha,
      reviewedAt: record.reviewedAt,
    };
  }

  public async listApprovalsForTask(taskId: string): Promise<ApprovalRecord[]> {
    const records = await prisma.approval.findMany({
      where: { taskId },
      orderBy: { reviewedAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      runId: r.runId,
      workspaceId: r.workspaceId,
      reviewerId: r.reviewerId,
      status: r.status as ApprovalStatus,
      reviewNotes: r.reviewNotes,
      mergeCommitSha: r.mergeCommitSha,
      reviewedAt: r.reviewedAt,
    }));
  }

  public async findLatestApproval(
    taskId: string,
  ): Promise<ApprovalRecord | null> {
    const record = await prisma.approval.findFirst({
      where: { taskId },
      orderBy: { reviewedAt: "desc" },
    });

    if (!record) return null;

    return {
      id: record.id,
      taskId: record.taskId,
      runId: record.runId,
      workspaceId: record.workspaceId,
      reviewerId: record.reviewerId,
      status: record.status as ApprovalStatus,
      reviewNotes: record.reviewNotes,
      mergeCommitSha: record.mergeCommitSha,
      reviewedAt: record.reviewedAt,
    };
  }
}

export class InMemoryApprovalRepository implements IApprovalRepository {
  public approvals: ApprovalRecord[] = [];

  public async createApproval(data: {
    taskId: string;
    runId: string;
    workspaceId: string;
    reviewerId: string;
    status: ApprovalStatus;
    reviewNotes?: string | null;
    mergeCommitSha?: string | null;
  }): Promise<ApprovalRecord> {
    const record: ApprovalRecord = {
      id: randomUUID(),
      taskId: data.taskId,
      runId: data.runId,
      workspaceId: data.workspaceId,
      reviewerId: data.reviewerId,
      status: data.status,
      reviewNotes: data.reviewNotes,
      mergeCommitSha: data.mergeCommitSha,
      reviewedAt: new Date(),
    };

    this.approvals.push(record);
    return record;
  }

  public async listApprovalsForTask(taskId: string): Promise<ApprovalRecord[]> {
    return this.approvals
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime());
  }

  public async findLatestApproval(
    taskId: string,
  ): Promise<ApprovalRecord | null> {
    const list = await this.listApprovalsForTask(taskId);
    return list[0] ?? null;
  }

  public clear(): void {
    this.approvals = [];
  }
}
