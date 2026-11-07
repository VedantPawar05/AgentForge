import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../apps/api/src/app.js";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryAuditRepository,
  InMemoryRunRepository,
  InMemoryOutboxRepository,
  InMemoryRunEventRepository,
  InMemoryApprovalRepository,
  InMemoryArtifactRepository,
} from "@agentforge/db";
import { AuthService } from "../apps/api/src/auth/auth-service.js";
import { WorkspaceService } from "../apps/api/src/services/workspace-service.js";
import { ProjectService } from "../apps/api/src/services/project-service.js";
import { TaskService } from "../apps/api/src/services/task-service.js";
import { RunService } from "../apps/api/src/services/run-service.js";

describe("Phase 12: Deployment & Release — End-to-End Staging Smoke Tests", () => {
  const targetUrl = process.env.TARGET_URL;

  let app: any;

  beforeEach(() => {
    if (targetUrl) {
      app = targetUrl;
    } else {
      const userRepo = new InMemoryUserRepository();
      const workspaceRepo = new InMemoryWorkspaceRepository();
      const projectRepo = new InMemoryProjectRepository();
      const taskRepo = new InMemoryTaskRepository();
      const auditRepo = new InMemoryAuditRepository();
      const runRepo = new InMemoryRunRepository();
      const outboxRepo = new InMemoryOutboxRepository();
      const runEventRepo = new InMemoryRunEventRepository();
      const approvalRepo = new InMemoryApprovalRepository();
      const artifactRepo = new InMemoryArtifactRepository();

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

      app = createApp({
        userRepo,
        workspaceRepo,
        auditRepo,
        projectRepo,
        taskRepo,
        runRepo,
        outboxRepo,
        runEventRepo,
        approvalRepo,
        artifactRepo,
        authService,
        workspaceService,
        projectService,
        taskService,
        runService,
      });
    }
  });

  it("verifies /health liveness probe responds with 200 OK and uptime", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });

  it("verifies /ready readiness probe responds with 200 and healthy services", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.services.api).toBe("healthy");
  });

  it("verifies /metrics exposes valid Prometheus text metrics", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("# HELP http_requests_total");
    expect(res.text).toContain("# HELP process_uptime_seconds");
  });

  it("executes full tenant lifecycle: auth -> workspace -> project -> task creation", async () => {
    // 1. Authenticate user
    const authRes = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer smoke_tester@agentforge.dev");
    expect(authRes.status).toBe(200);
    const user = authRes.body.user;
    expect(user.email).toBe("smoke_tester@agentforge.dev");

    // 2. Create Workspace
    const wsRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer smoke_tester@agentforge.dev")
      .send({ name: "Smoke Test Workspace", slug: `smoke-ws-${Date.now()}` });
    expect(wsRes.status).toBe(201);
    const workspaceId = wsRes.body.workspace.id;

    // 3. Create Project
    const projRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", "Bearer smoke_tester@agentforge.dev")
      .set("x-workspace-id", workspaceId)
      .send({
        name: "Smoke Test Project",
        repoOwner: "agentforge",
        repoName: "smoke-repo",
        defaultBranch: "main",
      });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.project.id;

    // 4. Create Task
    const taskRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer smoke_tester@agentforge.dev")
      .set("x-workspace-id", workspaceId)
      .send({
        title: "Smoke Test Automated Task",
        description: "Verify end-to-end task pipeline in staging",
      });
    expect(taskRes.status).toBe(201);
    expect(taskRes.body.task.status).toBe("QUEUED");
    expect(taskRes.body.task.version).toBe(1);
  });
});
