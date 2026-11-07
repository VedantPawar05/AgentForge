import { Router, Request, Response, NextFunction } from "express";
import {
  IRunnerRepository,
  IWorkspaceRepository,
  ITaskRepository,
  IRunRepository,
} from "@agentforge/db";
import { IAuthService } from "../auth/auth-service.js";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import {
  createTenantMiddleware,
  requireRole,
} from "../auth/tenant-middleware.js";
import {
  WorkspaceRole,
  UnauthorizedError,
  TaskStatus,
} from "@agentforge/shared";
import { z } from "zod";

const registerRunnerSchema = z.object({
  name: z.string().min(1).max(100),
  hostname: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

const heartbeatSchema = z.object({
  status: z.enum(["ONLINE", "BUSY"]).optional(),
  currentRunId: z.string().nullable().optional(),
});

const completeJobSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(["COMPLETED", "FAILED"]),
  diff: z.string().optional(),
  exitCode: z.number().int().optional(),
});

export function createRunnerRouter(
  runnerRepo: IRunnerRepository,
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
  taskRepo?: ITaskRepository,
  runRepo?: IRunRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);
  const requireTenant = createTenantMiddleware(workspaceRepo);

  /**
   * POST /v1/workspaces/:workspaceId/runners/register
   * Register a new local runner for the workspace
   */
  router.post(
    "/workspaces/:workspaceId/runners/register",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
      WorkspaceRole.DEVELOPER,
    ]),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const body = registerRunnerSchema.parse(req.body);
        const runner = await runnerRepo.registerRunner({
          workspaceId: req.params.workspaceId,
          name: body.name,
          hostname: body.hostname || req.ip,
          labels: body.labels,
        });
        res.status(201).json({ runner });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/runners
   * List all runners in workspace
   */
  router.get(
    "/workspaces/:workspaceId/runners",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const runners = await runnerRepo.listRunners(req.params.workspaceId);
        res.json({ runners });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/runners/:runnerId/heartbeat
   * Keep-alive ping from local runner
   */
  router.post(
    "/workspaces/:workspaceId/runners/:runnerId/heartbeat",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const runnerToken = (req.headers["x-runner-token"] as string) || "";
        const runner = await runnerRepo.findById(req.params.runnerId);
        if (!runner || runner.token !== runnerToken) {
          throw new UnauthorizedError("Invalid runner authentication token");
        }
        const body = heartbeatSchema.parse(req.body);
        await runnerRepo.heartbeat(runner.id, body.status, body.currentRunId);
        res.json({ success: true, timestamp: new Date().toISOString() });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /v1/workspaces/:workspaceId/runners/:runnerId
   * De-register a runner
   */
  router.delete(
    "/workspaces/:workspaceId/runners/:runnerId",
    requireAuth,
    requireTenant,
    requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await runnerRepo.deleteRunner(req.params.runnerId);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/runners/:runnerId/poll
   * Local runner checks for an available pending execution job
   */
  router.post(
    "/workspaces/:workspaceId/runners/:runnerId/poll",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const runnerToken = (req.headers["x-runner-token"] as string) || "";
        const runner = await runnerRepo.findById(req.params.runnerId);
        if (!runner || runner.token !== runnerToken) {
          throw new UnauthorizedError("Invalid runner authentication token");
        }

        // Update heartbeat
        await runnerRepo.heartbeat(runner.id, "ONLINE");

        if (!runRepo || !taskRepo) {
          res.json({ job: null });
          return;
        }

        // Fetch queued tasks
        const taskListing = await taskRepo.listTasks(
          req.params.workspaceId,
          undefined,
          { status: TaskStatus.QUEUED, limit: 10 },
        );
        const queuedTask = taskListing.tasks[0];

        if (!queuedTask) {
          res.json({ job: null });
          return;
        }

        // Create or find run for task
        const existingRuns = await runRepo.listRunsForTask(queuedTask.id);
        let run = existingRuns[existingRuns.length - 1];
        if (!run || run.status === "COMPLETED" || run.status === "FAILED") {
          run = await runRepo.createRun({
            taskId: queuedTask.id,
            workspaceId: req.params.workspaceId,
            attemptNumber: (existingRuns.length || 0) + 1,
          });
        }

        // Try acquiring lease for local runner
        const acquired = await runRepo.acquireLease(run.id, runner.id, 60);
        if (!acquired) {
          res.json({ job: null });
          return;
        }

        await runnerRepo.heartbeat(runner.id, "BUSY", run.id);
        await taskRepo.updateTask(queuedTask.id, queuedTask.version, {
          status: TaskStatus.RUNNING,
        });

        res.json({
          job: {
            runId: run.id,
            taskId: queuedTask.id,
            workspaceId: req.params.workspaceId,
            taskTitle: queuedTask.title,
            taskDescription: queuedTask.description,
            targetBranch: queuedTask.targetBranch,
            priority: queuedTask.priority,
            attemptNumber: run.attemptNumber,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/runners/:runnerId/complete
   * Local runner reports task completion and diff
   */
  router.post(
    "/workspaces/:workspaceId/runners/:runnerId/complete",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const runnerToken = (req.headers["x-runner-token"] as string) || "";
        const runner = await runnerRepo.findById(req.params.runnerId);
        if (!runner || runner.token !== runnerToken) {
          throw new UnauthorizedError("Invalid runner authentication token");
        }

        const body = completeJobSchema.parse(req.body);

        if (runRepo && taskRepo) {
          const run = await runRepo.findById(body.runId);
          if (run) {
            if (body.status === "COMPLETED") {
              await runRepo.completeRun(body.runId, {
                exitCode: body.exitCode ?? 0,
                durationMs: 1500,
              });
            } else {
              await runRepo.failRun(
                body.runId,
                "Local runner execution failed",
              );
            }

            const finalTaskStatus =
              body.status === "COMPLETED"
                ? TaskStatus.AWAITING_REVIEW
                : TaskStatus.FAILED;
            const task = await taskRepo.findById(run.taskId);
            if (task) {
              await taskRepo.updateTask(task.id, task.version, {
                status: finalTaskStatus,
              });
            }
          }
        }

        await runnerRepo.heartbeat(runner.id, "ONLINE", null);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
