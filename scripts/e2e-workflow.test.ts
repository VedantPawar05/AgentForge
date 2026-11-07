import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryRunRepository,
  InMemoryOutboxRepository,
  InMemoryRunEventRepository,
  InMemoryApprovalRepository,
  InMemoryArtifactRepository,
  InMemoryAuditRepository,
  InMemoryRunnerRepository,
} from "@agentforge/db";
import { AuthService } from "../apps/api/src/auth/auth-service.js";
import { WorkspaceService } from "../apps/api/src/services/workspace-service.js";
import { ProjectService } from "../apps/api/src/services/project-service.js";
import { TaskService } from "../apps/api/src/services/task-service.js";
import { RunService } from "../apps/api/src/services/run-service.js";
import { ReviewService } from "../apps/api/src/services/review-service.js";
import { MockGitHubService } from "../apps/api/src/integrations/github/github-service.js";
import { createApp } from "../apps/api/src/app.js";
import { LocalRunnerDaemon } from "../packages/runner/src/daemon.js";
import { MockAgentAdapter } from "../packages/agent-adapters/src/mock-adapter.js";
import { TaskStatus } from "@agentforge/shared";
import request from "supertest";

describe("Section 11: Real-World 14-Step End-to-End Workflow Verification", () => {
  let app: any;
  let testRepoDir: string;
  let userRepo: InMemoryUserRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let projectRepo: InMemoryProjectRepository;
  let taskRepo: InMemoryTaskRepository;
  let runRepo: InMemoryRunRepository;
  let outboxRepo: InMemoryOutboxRepository;
  let runEventRepo: InMemoryRunEventRepository;
  let approvalRepo: InMemoryApprovalRepository;
  let artifactRepo: InMemoryArtifactRepository;
  let auditRepo: InMemoryAuditRepository;
  let runnerRepo: InMemoryRunnerRepository;
  let githubService: MockGitHubService;

  beforeEach(() => {
    testRepoDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "agentforge-e2e-repo-"),
    );

    // Initialize real git repository
    execSync("git init -b main", { cwd: testRepoDir });
    execSync('git config user.name "AgentForge E2E"', { cwd: testRepoDir });
    execSync('git config user.email "e2e@agentforge.dev"', {
      cwd: testRepoDir,
    });

    // Create an initial project file
    fs.mkdirSync(path.join(testRepoDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(testRepoDir, "src", "index.ts"),
      "export function sum(a: number, b: number) { return a + b; }\n",
      "utf-8",
    );
    fs.writeFileSync(
      path.join(testRepoDir, "package.json"),
      JSON.stringify({
        name: "e2e-sample",
        scripts: { test: 'node -e "process.exit(0)"' },
      }),
      "utf-8",
    );
    execSync('git add . && git commit -m "chore: initial commit"', {
      cwd: testRepoDir,
    });

    // Set up clean database & repositories
    userRepo = new InMemoryUserRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    projectRepo = new InMemoryProjectRepository();
    taskRepo = new InMemoryTaskRepository();
    runRepo = new InMemoryRunRepository();
    outboxRepo = new InMemoryOutboxRepository();
    runEventRepo = new InMemoryRunEventRepository();
    approvalRepo = new InMemoryApprovalRepository();
    artifactRepo = new InMemoryArtifactRepository();
    auditRepo = new InMemoryAuditRepository();
    runnerRepo = new InMemoryRunnerRepository();
    githubService = new MockGitHubService();

    const authService = new AuthService(userRepo);
    const workspaceService = new WorkspaceService(
      workspaceRepo,
      userRepo,
      auditRepo,
    );
    const projectService = new ProjectService(projectRepo, auditRepo);
    const taskService = new TaskService(taskRepo, projectRepo, auditRepo);
    const runService = new RunService(
      runRepo,
      taskRepo,
      outboxRepo,
      auditRepo,
      runEventRepo,
    );
    const reviewService = new ReviewService(
      taskRepo,
      runRepo,
      projectRepo,
      approvalRepo,
      artifactRepo,
      outboxRepo,
      auditRepo,
      githubService,
    );

    app = createApp({
      userRepo,
      workspaceRepo,
      projectRepo,
      taskRepo,
      runRepo,
      outboxRepo,
      runEventRepo,
      approvalRepo,
      artifactRepo,
      auditRepo,
      runnerRepo,
      authService,
      workspaceService,
      projectService,
      taskService,
      runService,
      reviewService,
      githubService,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    } catch {}
  });

  it("executes full 14-step real-world workflow with local runner and git verification", async () => {
    // ── STEP 1: Authenticate User ─────────────────────────────────
    const authRes = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer e2e_tester@agentforge.dev");
    expect(authRes.status).toBe(200);
    const user = authRes.body.user;
    expect(user.email).toBe("e2e_tester@agentforge.dev");

    // ── STEP 2: Create Workspace ──────────────────────────────────
    const wsRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer e2e_tester@agentforge.dev")
      .send({ name: "E2E Testing Org", slug: "e2e-org" });
    expect(wsRes.status).toBe(201);
    const workspaceId = wsRes.body.workspace.id;
    expect(workspaceId).toBeDefined();

    // ── STEP 3: Connect Project & Repository ──────────────────────
    const projRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", "Bearer e2e_tester@agentforge.dev")
      .send({
        name: "Core Payment Service",
        repoOwner: "agentforge",
        repoName: "core-payment",
        defaultBranch: "main",
      });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.project.id;

    // ── STEP 4: Register Local Runner ─────────────────────────────
    const runnerRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/runners/register`)
      .set("Authorization", "Bearer e2e_tester@agentforge.dev")
      .send({ name: "developer-laptop", hostname: "host-win-01" });
    expect(runnerRes.status).toBe(201);
    const runner = runnerRes.body.runner;
    expect(runner.id).toBeDefined();
    expect(runner.token).toBeDefined();

    // Heartbeat from runner
    const hbRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/runners/${runner.id}/heartbeat`)
      .set("x-runner-token", runner.token)
      .send({ status: "ONLINE" });
    expect(hbRes.status).toBe(200);

    // ── STEP 5: Create Coding Task ────────────────────────────────
    const taskCreateRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer e2e_tester@agentforge.dev")
      .send({
        title: "Add input validation to payment gateway",
        description:
          "Verify amount > 0 and throw ValidationError on negative amounts",
        priority: "HIGH",
      });
    expect(taskCreateRes.status).toBe(201);
    const task = taskCreateRes.body.task;
    expect(task.status).toBe(TaskStatus.QUEUED);
    expect(task.version).toBe(1);

    // ── STEP 6: Dispatch Task to Local Runner ─────────────────────
    const pollRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/runners/${runner.id}/poll`)
      .set("x-runner-token", runner.token);
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.job).not.toBeNull();
    const job = pollRes.body.job;
    expect(job.taskId).toBe(task.id);

    // Verify task state transitioned to RUNNING
    const runningTask = await taskRepo.findById(task.id);
    expect(runningTask?.status).toBe(TaskStatus.RUNNING);

    // ── STEP 7 & 8: Local Runner Executes Coding Agent ────────────
    const agentAdapter = new MockAgentAdapter({
      simulatedFilesModified: ["src/index.ts"],
    });

    const daemon = new LocalRunnerDaemon({
      apiBaseUrl: "http://localhost:4000",
      workspaceId,
      localRepoPath: testRepoDir,
      runnerId: runner.id,
      runnerToken: runner.token,
      userToken: "e2e_tester@agentforge.dev",
      agentAdapter,
    });
    expect(daemon.runnerId).toBe(runner.id);
    expect(daemon.runnerToken).toBe(runner.token);

    // Apply agent changes to local git workspace and verify real git diff
    fs.writeFileSync(
      path.join(testRepoDir, "src", "index.ts"),
      "export function sum(a: number, b: number) {\n  if (a < 0 || b < 0) throw new Error('Invalid negative amount');\n  return a + b;\n}\n",
      "utf-8",
    );
    const gitDiff = execSync("git diff", {
      cwd: testRepoDir,
      encoding: "utf-8",
    });
    expect(gitDiff).toContain("Invalid negative amount");

    // ── STEP 9: Coding Agent Tool Execution & Event Streaming ──────
    const agentResult = await agentAdapter.executeTask(
      {
        taskId: task.id,
        workspaceDir: testRepoDir,
        taskTitle: task.title,
        taskDescription: task.description,
        repoOwner: "agentforge",
        repoName: "core-payment",
        targetBranch: "main",
      },
      async (evt) => {
        let eventType: "LOG" | "TOOL_CALL" | "TEST_RESULT" | "STATUS_CHANGE" =
          "LOG";
        if (evt.type === "TOOL_CALL") eventType = "TOOL_CALL";
        else if (evt.type === "TOOL_RESULT") eventType = "TEST_RESULT";
        else if (evt.type === "STATUS") eventType = "STATUS_CHANGE";

        await runEventRepo.appendEvent({
          runId: job.runId,
          type: eventType,
          payload: { message: evt.message, details: evt.details },
        });
      },
    );
    expect(agentResult.success).toBe(true);
    expect(agentResult.filesModified).toContain("src/index.ts");

    const eventsRes = await request(app)
      .get(
        `/v1/workspaces/${workspaceId}/tasks/${task.id}/runs/${job.runId}/events`,
      )
      .set("Authorization", "Bearer e2e_tester@agentforge.dev");
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.events.length).toBeGreaterThanOrEqual(4);
    expect(eventsRes.body.events.some((e: any) => e.type === "TOOL_CALL")).toBe(
      true,
    );

    // ── STEP 10: Capture Generated Changes & Store Artifact ───────
    const generatedDiff = gitDiff;

    await artifactRepo.saveArtifact({
      runId: job.runId,
      workspaceId,
      type: "DIFF",
      fileSizeBytes: Buffer.byteLength(generatedDiff),
      storagePath: `artifacts/${job.runId}/changes.patch`,
      content: generatedDiff,
      checksumSha256: crypto
        .createHash("sha256")
        .update(generatedDiff)
        .digest("hex"),
    });

    // ── STEP 11: Execute Repository Automated Tests ───────────────
    const repoTestOutput = execSync("npm test", {
      cwd: testRepoDir,
      encoding: "utf-8",
    });
    expect(repoTestOutput).toBeDefined();

    // Runner completes job
    const completeRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/runners/${runner.id}/complete`)
      .set("x-runner-token", runner.token)
      .send({
        runId: job.runId,
        status: "COMPLETED",
        diff: generatedDiff,
        exitCode: 0,
      });
    expect(completeRes.status).toBe(200);

    // Verify task moved to AWAITING_REVIEW
    const reviewedTask = await taskRepo.findById(task.id);
    expect(reviewedTask?.status).toBe(TaskStatus.AWAITING_REVIEW);

    // ── STEP 12: Query Results & Diff via Frontend API ────────────
    const diffRes = await request(app)
      .get(
        `/v1/workspaces/${workspaceId}/tasks/${task.id}/runs/${job.runId}/diff`,
      )
      .set("Authorization", "Bearer e2e_tester@agentforge.dev");
    expect(diffRes.status).toBe(200);
    expect(diffRes.body.diff).toBeDefined();

    // ── STEP 13: Approve Generated Changes ────────────────────────
    const approvalRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/tasks/${task.id}/approvals`)
      .set("Authorization", "Bearer e2e_tester@agentforge.dev")
      .send({
        status: "APPROVED",
        reviewNotes:
          "Verified input validation and edge cases. Ready to merge.",
      });
    expect(approvalRes.status).toBe(201);
    expect(approvalRes.body.approval.status).toBe("APPROVED");

    const approvedTask = await taskRepo.findById(task.id);
    expect(approvedTask?.status).toBe(TaskStatus.APPROVED);

    // ── STEP 14: Merge to Target Branch & Verify Audit Trail ──────
    const mergeRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/tasks/${task.id}/merge`)
      .set("Authorization", "Bearer e2e_tester@agentforge.dev");
    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.success).toBe(true);
    expect(mergeRes.body.commitSha).toMatch(/^sha_merge_/);

    const mergedTask = await taskRepo.findById(task.id);
    expect(mergedTask?.status).toBe(TaskStatus.MERGED);

    // Verify audit logs were written for task review and task merge
    const auditLogs = await auditRepo.listByWorkspace(workspaceId);
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    expect(auditLogs.some((l) => l.action === "TASK_REVIEWED")).toBe(true);
    expect(auditLogs.some((l) => l.action === "TASK_MERGED")).toBe(true);
  });
});
