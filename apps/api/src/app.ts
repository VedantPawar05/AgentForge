import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.js";
import { createRateLimiter } from "./middleware/rate-limiter.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";

import { healthRouter } from "./routes/health.js";
import { createAuthRouter } from "./routes/auth.js";
import { createWorkspaceRouter } from "./routes/workspaces.js";
import { createProjectRouter } from "./routes/projects.js";
import { createTaskRouter } from "./routes/tasks.js";
import { createRunRouter } from "./routes/runs.js";
import { createGitHubRouter } from "./routes/github.js";
import { createReviewRouter } from "./routes/reviews.js";
import { createRunnerRouter } from "./routes/runners.js";
import {
  IGitHubService,
  MockGitHubService,
} from "./integrations/github/github-service.js";
import {
  IUserRepository,
  PrismaUserRepository,
  IWorkspaceRepository,
  PrismaWorkspaceRepository,
  IAuditRepository,
  PrismaAuditRepository,
  IProjectRepository,
  PrismaProjectRepository,
  ITaskRepository,
  PrismaTaskRepository,
  IRunRepository,
  PrismaRunRepository,
  IOutboxRepository,
  PrismaOutboxRepository,
  IRunEventRepository,
  PrismaRunEventRepository,
  IApprovalRepository,
  PrismaApprovalRepository,
  IArtifactRepository,
  PrismaArtifactRepository,
  IRunnerRepository,
  InMemoryRunnerRepository,
} from "@agentforge/db";
import { IAuthService, AuthService } from "./auth/auth-service.js";
import { WorkspaceService } from "./services/workspace-service.js";
import { ProjectService } from "./services/project-service.js";
import { TaskService } from "./services/task-service.js";
import { RunService } from "./services/run-service.js";
import { ReviewService } from "./services/review-service.js";

export interface AppDependencies {
  userRepo?: IUserRepository;
  workspaceRepo?: IWorkspaceRepository;
  auditRepo?: IAuditRepository;
  projectRepo?: IProjectRepository;
  taskRepo?: ITaskRepository;
  runRepo?: IRunRepository;
  outboxRepo?: IOutboxRepository;
  runEventRepo?: IRunEventRepository;
  approvalRepo?: IApprovalRepository;
  artifactRepo?: IArtifactRepository;
  authService?: IAuthService;
  workspaceService?: WorkspaceService;
  projectService?: ProjectService;
  taskService?: TaskService;
  runService?: RunService;
  reviewService?: ReviewService;
  githubService?: IGitHubService;
  runnerRepo?: IRunnerRepository;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();

  // Instantiate repositories with defaults if not injected
  const userRepo = deps.userRepo ?? new PrismaUserRepository();
  const workspaceRepo = deps.workspaceRepo ?? new PrismaWorkspaceRepository();
  const auditRepo = deps.auditRepo ?? new PrismaAuditRepository();
  const projectRepo = deps.projectRepo ?? new PrismaProjectRepository();
  const taskRepo = deps.taskRepo ?? new PrismaTaskRepository();
  const runRepo = deps.runRepo ?? new PrismaRunRepository();
  const outboxRepo = deps.outboxRepo ?? new PrismaOutboxRepository();
  const runEventRepo = deps.runEventRepo ?? new PrismaRunEventRepository();
  const approvalRepo = deps.approvalRepo ?? new PrismaApprovalRepository();
  const artifactRepo = deps.artifactRepo ?? new PrismaArtifactRepository();
  const runnerRepo = deps.runnerRepo ?? new InMemoryRunnerRepository();

  // Instantiate services
  const authService = deps.authService ?? new AuthService(userRepo);
  const workspaceService =
    deps.workspaceService ??
    new WorkspaceService(workspaceRepo, userRepo, auditRepo);
  const projectService =
    deps.projectService ?? new ProjectService(projectRepo, auditRepo);
  const taskService =
    deps.taskService ?? new TaskService(taskRepo, projectRepo, auditRepo);
  const runService =
    deps.runService ??
    new RunService(runRepo, taskRepo, outboxRepo, auditRepo, runEventRepo);
  const githubService = deps.githubService ?? new MockGitHubService();
  const reviewService =
    deps.reviewService ??
    new ReviewService(
      taskRepo,
      runRepo,
      projectRepo,
      approvalRepo,
      artifactRepo,
      outboxRepo,
      auditRepo,
      githubService,
    );

  // Security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.WEB_BASE_URL || "http://localhost:3000",
      credentials: true,
    }),
  );

  // Request correlation & body parsing
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Sliding window rate limiter
  app.use(createRateLimiter({ windowMs: 60 * 1000, maxRequests: 200 }));

  // Root probes and Prometheus metrics
  app.use(healthRouter);

  // Mount API Routes under /v1
  app.use("/v1", healthRouter);

  app.use("/v1", createAuthRouter(authService, workspaceRepo));
  app.use(
    "/v1",
    createWorkspaceRouter(workspaceService, authService, workspaceRepo),
  );
  app.use(
    "/v1",
    createProjectRouter(projectService, authService, workspaceRepo),
  );
  app.use("/v1", createTaskRouter(taskService, authService, workspaceRepo));
  app.use("/v1", createRunRouter(runService, authService, workspaceRepo));
  app.use("/v1", createGitHubRouter(githubService, authService, workspaceRepo));
  app.use("/v1", createReviewRouter(reviewService, authService, workspaceRepo));
  app.use(
    "/v1",
    createRunnerRouter(
      runnerRepo,
      authService,
      workspaceRepo,
      taskRepo,
      runRepo,
    ),
  );

  // Centralized Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}
