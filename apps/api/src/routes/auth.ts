import { Router, Request, Response, NextFunction } from "express";
import { IAuthService } from "../auth/auth-service.js";
import { IWorkspaceRepository } from "@agentforge/db";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import { z } from "zod";

const syncUserSchema = z.object({
  externalId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export function createAuthRouter(
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  /**
   * POST /v1/auth/sync
   * Synchronizes external identity provider profile to local User entity
   */
  router.post(
    "/auth/sync",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = syncUserSchema.parse(req.body);
        const user = await authService.syncUser(parsed);
        res.status(200).json({ user });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/auth/me
   * Retrieves currently authenticated user and workspace memberships
   */
  router.get(
    "/auth/me",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const workspaces = await workspaceRepo.listUserWorkspaces(user.id);
        res.status(200).json({
          user,
          workspaces,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
