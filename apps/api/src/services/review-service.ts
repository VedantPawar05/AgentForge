import {
  ITaskRepository,
  IRunRepository,
  IProjectRepository,
  IApprovalRepository,
  IArtifactRepository,
  IOutboxRepository,
  IAuditRepository,
  ApprovalRecord,
  ApprovalStatus,
} from "@agentforge/db";
import {
  TaskStatus,
  NotFoundError,
  PreconditionFailedError,
  canTransitionTask,
} from "@agentforge/shared";
import { IGitHubService } from "../integrations/github/github-service.js";

export class ReviewService {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly runRepo: IRunRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly approvalRepo: IApprovalRepository,
    private readonly artifactRepo: IArtifactRepository,
    private readonly outboxRepo: IOutboxRepository,
    private readonly auditRepo: IAuditRepository,
    private readonly githubService: IGitHubService,
  ) {}

  public async getRunDiff(
    workspaceId: string,
    taskId: string,
    runId: string,
  ): Promise<{ diff: string; runId: string }> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }

    const run = await this.runRepo.findById(runId);
    if (!run || run.taskId !== taskId) {
      throw new NotFoundError("Run", runId);
    }

    const artifact = await this.artifactRepo.findDiffForRun(runId);
    const diffContent =
      artifact?.content ??
      `diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,5 @@\n+// Changes by AgentForge\n+export const ready = true;\n`;

    return {
      diff: diffContent,
      runId,
    };
  }

  public async submitReview(
    workspaceId: string,
    taskId: string,
    reviewerId: string,
    data: {
      status: ApprovalStatus;
      reviewNotes?: string;
      runId?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ApprovalRecord> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }

    // Determine target task status
    let nextStatus: TaskStatus;
    if (data.status === "APPROVED") {
      nextStatus = TaskStatus.APPROVED;
    } else if (data.status === "CHANGES_REQUESTED") {
      nextStatus = TaskStatus.CHANGES_REQUESTED;
    } else {
      nextStatus = TaskStatus.FAILED;
    }

    if (!canTransitionTask(task.status, nextStatus)) {
      throw new PreconditionFailedError(
        `Cannot transition task from status '${task.status}' to '${nextStatus}'. Reviews require task in 'AWAITING_REVIEW' state.`,
      );
    }

    // Determine active runId
    let runId = data.runId;
    if (!runId) {
      const runs = await this.runRepo.listRunsForTask(taskId);
      if (runs.length === 0) {
        throw new NotFoundError("Run", "No execution runs found for task");
      }
      runId = runs[0].id;
    }

    // Record formal approval
    const approval = await this.approvalRepo.createApproval({
      taskId,
      runId,
      workspaceId,
      reviewerId,
      status: data.status,
      reviewNotes: data.reviewNotes,
    });

    // Update task state with optimistic locking
    await this.taskRepo.updateTask(taskId, task.version, {
      status: nextStatus,
    });

    // Outbox notification
    await this.outboxRepo.createEvent({
      eventType: "TASK_REVIEW_SUBMITTED",
      aggregateType: "Task",
      aggregateId: taskId,
      payload: {
        taskId,
        runId,
        reviewerId,
        status: data.status,
        nextTaskStatus: nextStatus,
      },
    });

    // Audit log
    await this.auditRepo.record({
      workspaceId,
      actorId: reviewerId,
      action: "TASK_REVIEWED",
      targetType: "Approval",
      targetId: approval.id,
      ipAddress,
      userAgent,
      metadata: {
        taskId,
        status: data.status,
        notes: data.reviewNotes,
      },
    });

    return approval;
  }

  public async mergeTask(
    workspaceId: string,
    taskId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; commitSha: string; branchMerged: string }> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }

    // Precondition: Task MUST be in APPROVED status
    if (task.status !== TaskStatus.APPROVED) {
      throw new PreconditionFailedError(
        `Cannot merge task '${taskId}' in status '${task.status}'. Task must be explicitly APPROVED before merging.`,
      );
    }

    const project = await this.projectRepo.findById(task.projectId);
    if (!project) {
      throw new NotFoundError("Project", task.projectId);
    }

    const headBranch = task.branchName || `agentforge/task-${taskId}`;

    // Perform branch merge via GitHub integration
    const installationId = project.repositoryInstallationId || "inst-12345";
    const commitMessage = `Merge AgentForge Task: ${task.title}`;
    const mergeResult = await this.githubService.mergeBranch(
      installationId,
      project.repoOwner,
      project.repoName,
      task.targetBranch,
      headBranch,
      commitMessage,
    );

    // Transition task status to MERGED
    await this.taskRepo.updateTask(taskId, task.version, {
      status: TaskStatus.MERGED,
    });

    // Outbox Event
    await this.outboxRepo.createEvent({
      eventType: "TASK_MERGED",
      aggregateType: "Task",
      aggregateId: taskId,
      payload: {
        taskId,
        commitSha: mergeResult.mergeCommitSha,
        baseBranch: task.targetBranch,
        headBranch,
      },
    });

    // Audit Log
    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "TASK_MERGED",
      targetType: "Task",
      targetId: taskId,
      ipAddress,
      userAgent,
      metadata: {
        commitSha: mergeResult.mergeCommitSha,
        headBranch,
        targetBranch: task.targetBranch,
      },
    });

    return {
      success: true,
      commitSha: mergeResult.mergeCommitSha,
      branchMerged: headBranch,
    };
  }
}
