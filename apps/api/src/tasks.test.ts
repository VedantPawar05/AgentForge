import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryAuditRepository,
} from "@agentforge/db";
import { AuthService } from "./auth/auth-service.js";
import { WorkspaceService } from "./services/workspace-service.js";
import { ProjectService } from "./services/project-service.js";
import { TaskService } from "./services/task-service.js";
import { TaskPriority, TaskStatus, WorkspaceRole } from "@agentforge/shared";

describe("Phase 3: Projects, Tasks, State Machine & Optimistic Concurrency", () => {
  let userRepo: InMemoryUserRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let projectRepo: InMemoryProjectRepository;
  let taskRepo: InMemoryTaskRepository;
  let auditRepo: InMemoryAuditRepository;
  let authService: AuthService;
  let workspaceService: WorkspaceService;
  let projectService: ProjectService;
  let taskService: TaskService;
  let app: ReturnType<typeof createApp>;

  let workspaceId: string;
  let projectId: string;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    projectRepo = new InMemoryProjectRepository();
    taskRepo = new InMemoryTaskRepository();
    auditRepo = new InMemoryAuditRepository();

    authService = new AuthService(userRepo);
    workspaceService = new WorkspaceService(workspaceRepo, userRepo, auditRepo);
    projectService = new ProjectService(projectRepo, auditRepo);
    taskService = new TaskService(taskRepo, projectRepo, auditRepo);

    app = createApp({
      userRepo,
      workspaceRepo,
      auditRepo,
      projectRepo,
      taskRepo,
      authService,
      workspaceService,
      projectService,
      taskService,
    });

    // Create a base workspace with Alice as OWNER
    const wsRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer alice@example.com")
      .send({ name: "Alpha Org", slug: "alpha-org" });
    workspaceId = wsRes.body.workspace.id;

    // Create a base project
    const projRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        name: "Backend API",
        repoOwner: "agentforge",
        repoName: "backend-core",
        defaultBranch: "main",
        testCommand: "vitest run",
      });
    projectId = projRes.body.project.id;
  });

  it("creates tasks under a project and returns with QUEUED status and version 1", async () => {
    const res = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        title: "Implement Redis rate limiting",
        description: "Prevent DDoS on auth endpoint",
        priority: TaskPriority.HIGH,
      });

    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe("Implement Redis rate limiting");
    expect(res.body.task.status).toBe(TaskStatus.QUEUED);
    expect(res.body.task.priority).toBe(TaskPriority.HIGH);
    expect(res.body.task.version).toBe(1);
    expect(res.body.task.targetBranch).toBe("main");
  });

  it("filters and paginates tasks correctly", async () => {
    // Create 3 tasks with different priorities
    await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ title: "Task Low", priority: TaskPriority.LOW });

    await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ title: "Task High", priority: TaskPriority.HIGH });

    await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ title: "Task Critical", priority: TaskPriority.CRITICAL });

    // Filter by priority=HIGH
    const highRes = await request(app)
      .get(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?priority=HIGH`,
      )
      .set("Authorization", "Bearer alice@example.com");

    expect(highRes.status).toBe(200);
    expect(highRes.body.tasks.length).toBe(1);
    expect(highRes.body.tasks[0].title).toBe("Task High");
    expect(highRes.body.pagination.totalCount).toBe(1);

    // Search query
    const searchRes = await request(app)
      .get(
        `/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?search=Critical`,
      )
      .set("Authorization", "Bearer alice@example.com");

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks.length).toBe(1);
    expect(searchRes.body.tasks[0].title).toBe("Task Critical");
  });

  it("enforces task state machine transitions and rejects invalid state hops", async () => {
    const taskRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ title: "State Machine Test" });
    const taskId = taskRes.body.task.id;

    // Invalid transition: QUEUED -> MERGED (not allowed directly)
    const invalidRes = await request(app)
      .patch(`/v1/workspaces/${workspaceId}/tasks/${taskId}`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        status: TaskStatus.MERGED,
        version: 1,
      });

    expect(invalidRes.status).toBe(409);
    expect(invalidRes.body.error.code).toBe("CONFLICT");
    expect(invalidRes.body.error.message).toContain(
      "Invalid task transition from 'QUEUED' to 'MERGED'",
    );

    // Valid transition: QUEUED -> PROVISIONING
    const validRes = await request(app)
      .patch(`/v1/workspaces/${workspaceId}/tasks/${taskId}`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        status: TaskStatus.PROVISIONING,
        version: 1,
      });

    expect(validRes.status).toBe(200);
    expect(validRes.body.task.status).toBe(TaskStatus.PROVISIONING);
    expect(validRes.body.task.version).toBe(2);
  });

  it("enforces optimistic concurrency control and rejects stale version updates with 409 Conflict", async () => {
    const taskRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ title: "Concurrency Test" });
    const taskId = taskRes.body.task.id;

    // Client 1 updates task with version 1 -> succeeds, version becomes 2
    const update1 = await request(app)
      .patch(`/v1/workspaces/${workspaceId}/tasks/${taskId}`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        title: "Title Updated by Client 1",
        version: 1,
      });

    expect(update1.status).toBe(200);
    expect(update1.body.task.version).toBe(2);

    // Client 2 attempts update using stale version 1 -> ConflictError (409)
    const staleUpdate = await request(app)
      .patch(`/v1/workspaces/${workspaceId}/tasks/${taskId}`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        title: "Title Overwrite Attempt by Client 2",
        version: 1,
      });

    expect(staleUpdate.status).toBe(409);
    expect(staleUpdate.body.error.code).toBe("CONFLICT");
    expect(staleUpdate.body.error.message).toContain(
      "was modified concurrently",
    );

    // Updating with matching version 2 succeeds
    const update2 = await request(app)
      .patch(`/v1/workspaces/${workspaceId}/tasks/${taskId}`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        title: "Title Correctly Updated by Client 2",
        version: 2,
      });

    expect(update2.status).toBe(200);
    expect(update2.body.task.version).toBe(3);
  });

  it("validates task dependencies and rejects circular dependency cycles", async () => {
    // Task A
    const resA = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ title: "Task A" });
    const taskAId = resA.body.task.id;

    // Task B
    const resB = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ title: "Task B" });
    const taskBId = resB.body.task.id;

    // B depends on A (Valid)
    const depRes1 = await request(app)
      .post(`/v1/workspaces/${workspaceId}/tasks/${taskBId}/dependencies`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ dependsOnTaskId: taskAId });

    expect(depRes1.status).toBe(201);

    // Attempt: A depends on B (Creates cycle A -> B -> A) -> 400 Validation Error
    const cycleRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/tasks/${taskAId}/dependencies`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ dependsOnTaskId: taskBId });

    expect(cycleRes.status).toBe(400);
    expect(cycleRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(cycleRes.body.error.message).toContain(
      "Circular task dependency detected",
    );
  });

  it("rejects cross-tenant project and task access", async () => {
    // Bob creates Workspace B
    const wsBRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer bob@example.com")
      .send({ name: "Beta Org", slug: "beta-org" });
    const wsBId = wsBRes.body.workspace.id;

    // Bob attempts to create task under Alice's workspace -> 403 Forbidden
    const crossRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", "Bearer bob@example.com")
      .send({ title: "Cross Tenant Hack" });

    expect(crossRes.status).toBe(403);

    // Alice attempts to list tasks in Bob's workspace -> 403 Forbidden
    const crossRes2 = await request(app)
      .get(`/v1/workspaces/${wsBId}/tasks`)
      .set("Authorization", "Bearer alice@example.com");

    expect(crossRes2.status).toBe(403);
  });
});
