import { Router, Request, Response, NextFunction } from "express";
import { RunService } from "../services/run-service.js";
import { IAuthService } from "../auth/auth-service.js";
import { IWorkspaceRepository } from "@agentforge/db";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import {
  createTenantMiddleware,
  requireRole,
} from "../auth/tenant-middleware.js";
import { WorkspaceRole } from "@agentforge/shared";

export function createRunRouter(
  runService: RunService,
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);
  const requireTenant = createTenantMiddleware(workspaceRepo);

  /**
   * POST /v1/workspaces/:workspaceId/tasks/:taskId/runs
   * Trigger execution attempt (requires DEVELOPER, ADMIN, OWNER)
   */
  router.post(
    "/workspaces/:workspaceId/tasks/:taskId/runs",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const run = await runService.triggerTaskRun(
          req.params.workspaceId,
          req.params.taskId,
          req.user!.id,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(202).json({ run });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/tasks/:taskId/runs
   * List execution attempts for task
   */
  router.get(
    "/workspaces/:workspaceId/tasks/:taskId/runs",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const runs = await runService.listRuns(
          req.params.workspaceId,
          req.params.taskId,
        );
        res.status(200).json({ runs });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId
   * Get single execution run attempt
   */
  router.get(
    "/workspaces/:workspaceId/tasks/:taskId/runs/:runId",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const run = await runService.getRun(
          req.params.workspaceId,
          req.params.taskId,
          req.params.runId,
        );
        res.status(200).json({ run });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId/events
   * Query execution events with optional monotonic catch-up parameter `sinceSeq`
   */
  router.get(
    "/workspaces/:workspaceId/tasks/:taskId/runs/:runId/events",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sinceSeq = req.query.sinceSeq
          ? Number(req.query.sinceSeq)
          : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const events = await runService.getRunEvents(
          req.params.workspaceId,
          req.params.taskId,
          req.params.runId,
          { sinceSeq, limit },
        );
        res.status(200).json({ events });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId/cancel
   * Cancel in-flight run attempt
   */
  router.post(
    "/workspaces/:workspaceId/tasks/:taskId/runs/:runId/cancel",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const run = await runService.cancelRun(
          req.params.workspaceId,
          req.params.taskId,
          req.params.runId,
          req.user!.id,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(200).json({ run });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
