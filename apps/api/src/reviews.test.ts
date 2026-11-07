import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryRunRepository,
  InMemoryOutboxRepository,
  InMemoryAuditRepository,
  InMemoryApprovalRepository,
  InMemoryArtifactRepository,
} from "@agentforge/db";
import { AuthService } from "./auth/auth-service.js";
import { MockGitHubService } from "./integrations/github/github-service.js";
import { TaskStatus, WorkspaceRole } from "@agentforge/shared";

describe("Phase 9: Human-in-the-Loop Review & Merge Workflow", () => {
  let userRepo: InMemoryUserRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let projectRepo: InMemoryProjectRepository;
  let taskRepo: InMemoryTaskRepository;
  let runRepo: InMemoryRunRepository;
  let outboxRepo: InMemoryOutboxRepository;
  let auditRepo: InMemoryAuditRepository;
  let approvalRepo: InMemoryApprovalRepository;
  let artifactRepo: InMemoryArtifactRepository;
  let authService: AuthService;
  let githubService: MockGitHubService;
  let app: any;

  let owner: any;
  let reviewer: any;
  let outsider: any;
  let workspace: any;
  let project: any;
  let task: any;
  let run: any;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    projectRepo = new InMemoryProjectRepository();
    taskRepo = new InMemoryTaskRepository();
    runRepo = new InMemoryRunRepository();
    outboxRepo = new InMemoryOutboxRepository();
    auditRepo = new InMemoryAuditRepository();
    approvalRepo = new InMemoryApprovalRepository();
    artifactRepo = new InMemoryArtifactRepository();
    authService = new AuthService(userRepo);
    githubService = new MockGitHubService();

    // Authenticate test users
    owner = await authService.authenticateToken("owner@agentforge.dev");
    reviewer = await authService.authenticateToken("reviewer@agentforge.dev");
    outsider = await authService.authenticateToken("outsider@other.org");

    // Create workspace
    workspace = await workspaceRepo.createWorkspace({
      name: "Review Workflow Workspace",
      slug: "review-workspace",
      ownerId: owner.id,
    });

    // Add reviewer to workspace
    await workspaceRepo.addMember(
      workspace.id,
      reviewer.id,
      WorkspaceRole.REVIEWER,
    );

    // Create project
    project = await projectRepo.createProject({
      workspaceId: workspace.id,
      name: "Core Engine",
      repoOwner: "agentforge",
      repoName: "core-engine",
      defaultBranch: "main",
    });

    // Create task
    task = await taskRepo.createTask({
      workspaceId: workspace.id,
      projectId: project.id,
      createdById: owner.id,
      title: "Implement OAuth refresh token rotation",
      targetBranch: "main",
    });

    // Create run
    run = await runRepo.createRun({
      taskId: task.id,
      workspaceId: workspace.id,
      attemptNumber: 1,
    });

    // Save diff artifact
    await artifactRepo.saveArtifact({
      runId: run.id,
      workspaceId: workspace.id,
      type: "DIFF",
      storagePath: "/artifacts/diff-1.patch",
      content: "diff --git a/auth.ts b/auth.ts\n+export function rotate() {}",
      fileSizeBytes: 64,
      checksumSha256: "sha256-mock-diff",
    });

    app = createApp({
      userRepo,
      workspaceRepo,
      projectRepo,
      taskRepo,
      runRepo,
      outboxRepo,
      auditRepo,
      approvalRepo,
      artifactRepo,
      authService,
      githubService,
    });
  });

  describe("Diff Viewer", () => {
    it("retrieves unified git diff for completed run", async () => {
      const res = await request(app)
        .get(
          `/v1/workspaces/${workspace.id}/tasks/${task.id}/runs/${run.id}/diff`,
        )
        .set("Authorization", `Bearer ${reviewer.email}`);

      expect(res.status).toBe(200);
      expect(res.body.diff).toContain("+export function rotate() {}");
      expect(res.body.runId).toBe(run.id);
    });

    it("rejects cross-tenant diff inspection", async () => {
      const res = await request(app)
        .get(
          `/v1/workspaces/${workspace.id}/tasks/${task.id}/runs/${run.id}/diff`,
        )
        .set("Authorization", `Bearer ${outsider.email}`);

      expect(res.status).toBe(403);
    });
  });

  describe("Approvals & State Transitions", () => {
    it("rejects review submission when task is not in AWAITING_REVIEW state", async () => {
      // Task is currently QUEUED
      const res = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/approvals`)
        .set("Authorization", `Bearer ${reviewer.email}`)
        .send({
          status: "APPROVED",
          reviewNotes: "Looks good",
        });

      expect(res.status).toBe(412);
      expect(res.body.error.message).toContain(
        "Reviews require task in 'AWAITING_REVIEW' state",
      );
    });

    it("allows reviewer to request changes when task is AWAITING_REVIEW", async () => {
      // Transition task to AWAITING_REVIEW
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.AWAITING_REVIEW,
      });

      const res = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/approvals`)
        .set("Authorization", `Bearer ${reviewer.email}`)
        .send({
          status: "CHANGES_REQUESTED",
          reviewNotes: "Please add unit tests for token expiration",
        });

      expect(res.status).toBe(201);
      expect(res.body.approval.status).toBe("CHANGES_REQUESTED");

      // Verify task status transitioned to CHANGES_REQUESTED
      const updated = await taskRepo.findById(task.id);
      expect(updated?.status).toBe(TaskStatus.CHANGES_REQUESTED);
    });

    it("allows reviewer to approve task when AWAITING_REVIEW", async () => {
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.AWAITING_REVIEW,
      });

      const res = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/approvals`)
        .set("Authorization", `Bearer ${reviewer.email}`)
        .send({
          status: "APPROVED",
          reviewNotes: "Verified all test suites pass",
        });

      expect(res.status).toBe(201);
      expect(res.body.approval.status).toBe("APPROVED");

      const updated = await taskRepo.findById(task.id);
      expect(updated?.status).toBe(TaskStatus.APPROVED);
    });
  });

  describe("Merge Execution Gate", () => {
    it("strictly forbids merging unapproved tasks (Precondition Failed)", async () => {
      // Task is in AWAITING_REVIEW (not yet APPROVED)
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.AWAITING_REVIEW,
      });

      const res = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/merge`)
        .set("Authorization", `Bearer ${owner.email}`);

      expect(res.status).toBe(412);
      expect(res.body.error.message).toContain(
        "Task must be explicitly APPROVED before merging",
      );
    });

    it("merges branch and records commit SHA when task is APPROVED", async () => {
      // Advance task to APPROVED
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.APPROVED,
        branchName: "agentforge/task-oauth-01",
      });

      const res = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/merge`)
        .set("Authorization", `Bearer ${owner.email}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.commitSha).toBeDefined();
      expect(res.body.branchMerged).toBe("agentforge/task-oauth-01");

      // Verify task state is now MERGED
      const updated = await taskRepo.findById(task.id);
      expect(updated?.status).toBe(TaskStatus.MERGED);

      // Verify audit log recorded
      const logs = await auditRepo.listByWorkspace(workspace.id);
      expect(logs.some((l) => l.action === "TASK_MERGED")).toBe(true);
    });

    it("Scenario 7: rejects replayed approval on an already APPROVED task", async () => {
      // 1. Advance task to AWAITING_REVIEW
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.AWAITING_REVIEW,
      });

      // 2. Submit initial approval (succeeds)
      const res1 = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/approvals`)
        .set("Authorization", `Bearer ${reviewer.email}`)
        .send({ status: "APPROVED", reviewNotes: "First valid approval" });
      expect(res1.status).toBe(201);

      // Task is now APPROVED
      const approvedTask = await taskRepo.findById(task.id);
      expect(approvedTask?.status).toBe(TaskStatus.APPROVED);

      // 3. Replay approval on already APPROVED task (must be rejected!)
      const res2 = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/approvals`)
        .set("Authorization", `Bearer ${reviewer.email}`)
        .send({
          status: "APPROVED",
          reviewNotes: "Replayed duplicate approval",
        });

      expect(res2.status).toBe(412);
      expect(res2.body.error.message).toContain(
        "Reviews require task in 'AWAITING_REVIEW' state",
      );
    });

    it("Scenario 7: rejects replayed merge execution on an already MERGED task", async () => {
      // Advance to APPROVED
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.APPROVED,
        branchName: "agentforge/task-oauth-01",
      });

      // 1st merge succeeds
      const mergeRes1 = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/merge`)
        .set("Authorization", `Bearer ${owner.email}`);
      expect(mergeRes1.status).toBe(200);

      // 2nd merge (replay attack) must be rejected
      const mergeRes2 = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/merge`)
        .set("Authorization", `Bearer ${owner.email}`);

      expect(mergeRes2.status).toBe(412);
      expect(mergeRes2.body.error.message).toContain(
        "Task must be explicitly APPROVED before merging",
      );
    });

    it("Scenario 7: strictly rejects unauthorized actions (unauthenticated, outsider, or role violations)", async () => {
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.AWAITING_REVIEW,
      });

      // 1. Unauthenticated request
      const unauthRes = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/approvals`)
        .send({ status: "APPROVED" });
      expect(unauthRes.status).toBe(401);

      // 2. Outsider tenant request
      const outsiderRes = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/approvals`)
        .set("Authorization", `Bearer ${outsider.email}`)
        .send({ status: "APPROVED" });
      expect(outsiderRes.status).toBe(403);

      // 3. Reviewer role attempting merge without authorization
      await taskRepo.updateTask(task.id, task.version, {
        status: TaskStatus.APPROVED,
      });
      const reviewerMergeRes = await request(app)
        .post(`/v1/workspaces/${workspace.id}/tasks/${task.id}/merge`)
        .set("Authorization", `Bearer ${reviewer.email}`);
      expect(reviewerMergeRes.status).toBe(403);
    });
  });
});
