import { Router, Request, Response, NextFunction } from "express";
import { ReviewService } from "../services/review-service.js";
import { IAuthService } from "../auth/auth-service.js";
import { IWorkspaceRepository } from "@agentforge/db";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import {
  createTenantMiddleware,
  requireRole,
} from "../auth/tenant-middleware.js";
import { WorkspaceRole, ApprovalStatus } from "@agentforge/shared";
import { z } from "zod";

const approvalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const),
  reviewNotes: z.string().max(2000).optional(),
  runId: z.string().uuid().optional(),
});

export function createReviewRouter(
  reviewService: ReviewService,
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);
  const requireTenant = createTenantMiddleware(workspaceRepo);

  /**
   * GET /v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId/diff
   * View unified git diff generated during execution run
   */
  router.get(
    "/workspaces/:workspaceId/tasks/:taskId/runs/:runId/diff",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.getRunDiff(
          req.params.workspaceId,
          req.params.taskId,
          req.params.runId,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/tasks/:taskId/approvals
   * Submit review decision (requires REVIEWER, ADMIN, OWNER)
   */
  router.post(
    "/workspaces/:workspaceId/tasks/:taskId/approvals",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.REVIEWER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = approvalSchema.parse(req.body);
        const approval = await reviewService.submitReview(
          req.params.workspaceId,
          req.params.taskId,
          req.user!.id,
          {
            status: body.status as ApprovalStatus,
            reviewNotes: body.reviewNotes,
            runId: body.runId,
          },
          req.ip,
          req.headers["user-agent"],
        );
        res.status(201).json({ approval });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/tasks/:taskId/merge
   * Merge approved task branch into target base branch
   */
  router.post(
    "/workspaces/:workspaceId/tasks/:taskId/merge",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.mergeTask(
          req.params.workspaceId,
          req.params.taskId,
          req.user!.id,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
