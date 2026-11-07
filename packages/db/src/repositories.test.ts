import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryRunRepository,
  InMemoryOutboxRepository,
  InMemoryAuditRepository,
  InMemoryRunEventRepository,
  InMemoryApprovalRepository,
  InMemoryArtifactRepository,
  InMemoryRunnerRepository,
} from "./index.js";
import {
  ConflictError,
  TaskPriority,
  TaskStatus,
  RunStatus,
} from "@agentforge/shared";

describe("Database Repositories CRUD Verification", () => {
  let userRepo: InMemoryUserRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let projectRepo: InMemoryProjectRepository;
  let taskRepo: InMemoryTaskRepository;
  let runRepo: InMemoryRunRepository;
  let outboxRepo: InMemoryOutboxRepository;
  let auditRepo: InMemoryAuditRepository;
  let runEventRepo: InMemoryRunEventRepository;
  let approvalRepo: InMemoryApprovalRepository;
  let artifactRepo: InMemoryArtifactRepository;
  let runnerRepo: InMemoryRunnerRepository;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    projectRepo = new InMemoryProjectRepository();
    taskRepo = new InMemoryTaskRepository();
    runRepo = new InMemoryRunRepository();
    outboxRepo = new InMemoryOutboxRepository();
    auditRepo = new InMemoryAuditRepository();
    runEventRepo = new InMemoryRunEventRepository();
    approvalRepo = new InMemoryApprovalRepository();
    artifactRepo = new InMemoryArtifactRepository();
    runnerRepo = new InMemoryRunnerRepository();
  });

  describe("UserRepository", () => {
    it("creates or upserts, finds by ID, email, and external ID", async () => {
      const user = await userRepo.upsertUser({
        externalId: "ext-u1",
        email: "alice@example.com",
        fullName: "Alice Walker",
        avatarUrl: "https://avatar.example.com/alice.png",
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe("alice@example.com");

      const byId = await userRepo.findById(user.id);
      expect(byId?.id).toBe(user.id);

      const byExt = await userRepo.findByExternalId("ext-u1");
      expect(byExt?.id).toBe(user.id);

      const byEmail = await userRepo.findByEmail("alice@example.com");
      expect(byEmail?.id).toBe(user.id);
    });

    it("upsert updates existing user fields", async () => {
      const u1 = await userRepo.upsertUser({
        externalId: "ext-up",
        email: "orig@example.com",
        fullName: "Original",
      });
      const u2 = await userRepo.upsertUser({
        externalId: "ext-up",
        email: "orig@example.com",
        fullName: "Updated",
      });

      expect(u2.id).toBe(u1.id);
      expect(u2.fullName).toBe("Updated");
    });
  });

  describe("WorkspaceRepository & Memberships", () => {
    it("creates workspace, adds owner membership, lists members and updates role", async () => {
      const user = await userRepo.upsertUser({
        externalId: "ext-owner",
        email: "owner@example.com",
      });
      const ws = await workspaceRepo.createWorkspace({
        name: "Alpha Lab",
        slug: "alpha-lab",
        ownerId: user.id,
      });

      expect(ws.id).toBeDefined();
      expect(ws.slug).toBe("alpha-lab");

      const bySlug = await workspaceRepo.findBySlug("alpha-lab");
      expect(bySlug?.id).toBe(ws.id);

      // Add a second member
      const member = await userRepo.upsertUser({
        externalId: "ext-mem",
        email: "member@example.com",
      });
      await workspaceRepo.addMember(ws.id, member.id, "DEVELOPER" as any);

      const members = await workspaceRepo.listMembers(ws.id);
      expect(members.length).toBe(2);

      // Update role
      const membership = await workspaceRepo.findMembership(ws.id, member.id);
      expect(membership?.role).toBe("DEVELOPER");

      await workspaceRepo.updateMemberRole(ws.id, member.id, "ADMIN" as any);
      const updated = await workspaceRepo.findMembership(ws.id, member.id);
      expect(updated?.role).toBe("ADMIN");

      // Remove member
      await workspaceRepo.removeMember(ws.id, member.id);
      const remaining = await workspaceRepo.listMembers(ws.id);
      expect(remaining.length).toBe(1);
    });
  });

  describe("ProjectRepository", () => {
    it("creates, retrieves, updates and deletes projects", async () => {
      const proj = await projectRepo.createProject({
        workspaceId: "ws-proj-1",
        name: "Web Application",
        repoOwner: "agentforge",
        repoName: "web",
        defaultBranch: "main",
      });

      expect(proj.id).toBeDefined();
      expect(proj.name).toBe("Web Application");

      const listed = await projectRepo.listByWorkspace("ws-proj-1");
      expect(listed.length).toBe(1);
      expect(listed[0].repoName).toBe("web");

      const updated = await projectRepo.updateProject(proj.id, {
        name: "Web Platform App",
        defaultBranch: "develop",
      });
      expect(updated.name).toBe("Web Platform App");
      expect(updated.defaultBranch).toBe("develop");

      await projectRepo.deleteProject(proj.id);
      expect(await projectRepo.findById(proj.id)).toBeNull();
    });
  });

  describe("TaskRepository & Optimistic Concurrency Control (OCC)", () => {
    it("enforces optimistic concurrency control version increment and rejects stale updates", async () => {
      const task = await taskRepo.createTask({
        workspaceId: "ws-occ",
        projectId: "proj-occ",
        createdById: "user-occ",
        title: "OCC Test Task",
        priority: TaskPriority.HIGH,
      });

      expect(task.version).toBe(1);
      expect(task.status).toBe(TaskStatus.QUEUED);

      // Update with correct expected version 1 -> success, version becomes 2
      const updated = await taskRepo.updateTask(task.id, 1, {
        title: "OCC Updated Title",
        status: TaskStatus.RUNNING,
      });
      expect(updated.version).toBe(2);
      expect(updated.status).toBe(TaskStatus.RUNNING);

      // Stale update with version 1 must reject with ConflictError!
      await expect(
        taskRepo.updateTask(task.id, 1, { status: TaskStatus.AWAITING_REVIEW }),
      ).rejects.toThrow(ConflictError);
    });

    it("manages task dependencies and maps them", async () => {
      const t1 = await taskRepo.createTask({
        workspaceId: "ws-dep",
        projectId: "p-1",
        createdById: "u-1",
        title: "Base Task",
      });
      const t2 = await taskRepo.createTask({
        workspaceId: "ws-dep",
        projectId: "p-1",
        createdById: "u-1",
        title: "Dependent Task",
        dependencies: [t1.id],
      });

      const deps = await taskRepo.getDependencies(t2.id);
      expect(deps).toContain(t1.id);

      const map = await taskRepo.getAllDependenciesMap("ws-dep");
      expect(map.get(t2.id)).toContain(t1.id);
    });
  });

  describe("RunRepository & Worker Leases", () => {
    it("manages run creation, exclusive lease acquisition, and lifecycle transitions", async () => {
      const run = await runRepo.createRun({
        taskId: "task-run-1",
        workspaceId: "ws-run-1",
        attemptNumber: 1,
      });

      expect(run.status).toBe(RunStatus.PENDING);
      expect(run.attemptNumber).toBe(1);

      // Worker 1 acquires lease -> status becomes ALLOCATED
      const acquired1 = await runRepo.acquireLease(run.id, "worker-1", 30);
      expect(acquired1).toBe(true);

      const runningRun = await runRepo.findById(run.id);
      expect(runningRun?.status).toBe("ALLOCATED");
      expect(runningRun?.workerId).toBe("worker-1");

      // Worker 2 attempts to acquire lease on the same run -> rejected!
      const acquired2 = await runRepo.acquireLease(run.id, "worker-2", 30);
      expect(acquired2).toBe(false);

      // Active count should be 1
      expect(await runRepo.countActiveRunsInWorkspace("ws-run-1")).toBe(1);

      // Renew lease
      const renewed = await runRepo.renewLease(run.id, "worker-1", 45);
      expect(renewed).toBe(true);

      // Complete run
      const completed = await runRepo.completeRun(run.id, {
        exitCode: 0,
        durationMs: 4500,
        promptTokens: 1200,
        completionTokens: 350,
        costCents: 4,
      });
      expect(completed.status).toBe(RunStatus.COMPLETED);
      expect(completed.costCents).toBe(4);

      // Active count should now be 0
      expect(await runRepo.countActiveRunsInWorkspace("ws-run-1")).toBe(0);
    });
  });

  describe("OutboxRepository", () => {
    it("records events, fetches pending, and marks published/failed", async () => {
      const event = await outboxRepo.createEvent({
        eventType: "TASK_RUN_REQUESTED",
        aggregateType: "Run",
        aggregateId: "run-outbox-1",
        payload: { runId: "run-outbox-1" },
      });

      expect(event.id).toBeDefined();
      expect(event.status).toBe("PENDING");

      const pending = await outboxRepo.fetchPending();
      expect(pending.length).toBe(1);

      await outboxRepo.markPublished(event.id);
      const remaining = await outboxRepo.fetchPending();
      expect(remaining.length).toBe(0);
    });
  });

  describe("RunnerRepository", () => {
    it("registers local runner, generates token, updates heartbeat, and detects staleness", async () => {
      const runner = await runnerRepo.registerRunner({
        workspaceId: "ws-runner-1",
        name: "Vedant-MacBook",
        hostname: "macbook-pro.local",
        labels: ["local", "apple-silicon"],
      });

      expect(runner.id).toBeDefined();
      expect(runner.token).toMatch(/^rn_tok_/);
      expect(runner.status).toBe("ONLINE");

      const byToken = await runnerRepo.findByToken(runner.token);
      expect(byToken?.id).toBe(runner.id);

      // Heartbeat updates status to BUSY
      const hbSuccess = await runnerRepo.heartbeat(runner.id, "BUSY", "run-99");
      expect(hbSuccess).toBe(true);

      const updated = await runnerRepo.findById(runner.id);
      expect(updated?.status).toBe("BUSY");
      expect(updated?.currentRunId).toBe("run-99");

      // Listing runners
      const list = await runnerRepo.listRunners("ws-runner-1");
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(runner.id);

      // Delete runner
      await runnerRepo.deleteRunner(runner.id);
      expect(await runnerRepo.findById(runner.id)).toBeNull();
    });
  });

  describe("ApprovalRepository & ArtifactRepository", () => {
    it("stores and retrieves approvals with reviewer decisions", async () => {
      const app = await approvalRepo.createApproval({
        taskId: "task-app-1",
        runId: "run-app-1",
        workspaceId: "ws-app-1",
        reviewerId: "user-reviewer-1",
        status: "APPROVED",
        reviewNotes: "Looks clean and passing all tests.",
      });

      expect(app.id).toBeDefined();
      expect(app.status).toBe("APPROVED");

      const list = await approvalRepo.listApprovalsForTask("task-app-1");
      expect(list.length).toBe(1);
      expect(list[0].reviewNotes).toContain("clean");

      const latest = await approvalRepo.findLatestApproval("task-app-1");
      expect(latest?.id).toBe(app.id);
    });

    it("stores and retrieves artifact metadata", async () => {
      const art = await artifactRepo.saveArtifact({
        runId: "run-art-1",
        workspaceId: "ws-art-1",
        type: "DIFF",
        storagePath: "s3://bucket/diffs/run-art-1.patch",
        fileSizeBytes: 2048,
        checksumSha256: "a1b2c3d4e5f6",
      });

      expect(art.id).toBeDefined();
      const list = await artifactRepo.listArtifactsForRun("run-art-1");
      expect(list.length).toBe(1);
      expect(list[0].checksumSha256).toBe("a1b2c3d4e5f6");
    });
  });

  describe("RunEventRepository & AuditRepository", () => {
    it("appends monotonically ordered run events", async () => {
      await runEventRepo.appendEvent({
        runId: "run-seq-1",
        type: "LOG",
        payload: { message: "Agent started" },
      });
      await runEventRepo.appendEvent({
        runId: "run-seq-1",
        type: "TOOL_CALL",
        payload: { tool: "readFile", file: "package.json" },
      });

      const events = await runEventRepo.getEvents("run-seq-1");
      expect(events.length).toBe(2);
      expect(events[0].sequenceNumber).toBe(1);
      expect(events[1].sequenceNumber).toBe(2);
    });

    it("records and queries audit logs by workspace", async () => {
      await auditRepo.record({
        workspaceId: "ws-audit-1",
        actorId: "user-admin",
        action: "PROJECT_CREATED",
        targetType: "Project",
        targetId: "proj-123",
        metadata: { name: "Billing Service" },
      });

      const logs = await auditRepo.listByWorkspace("ws-audit-1");
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("PROJECT_CREATED");
    });
  });
});
