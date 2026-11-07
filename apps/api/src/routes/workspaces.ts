import { Router, Request, Response, NextFunction } from "express";
import { WorkspaceService } from "../services/workspace-service.js";
import { IAuthService } from "../auth/auth-service.js";
import { IWorkspaceRepository } from "@agentforge/db";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import {
  createTenantMiddleware,
  requireRole,
} from "../auth/tenant-middleware.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  WorkspaceRole,
} from "@agentforge/shared";
import { z } from "zod";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export function createWorkspaceRouter(
  workspaceService: WorkspaceService,
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);
  const requireTenant = createTenantMiddleware(workspaceRepo);

  /**
   * POST /v1/workspaces
   * Create new workspace (authenticated user becomes OWNER)
   */
  router.post(
    "/workspaces",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createWorkspaceSchema.parse(req.body);
        const ws = await workspaceService.createWorkspace(
          req.user!.id,
          parsed,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(201).json({ workspace: ws });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces
   * List workspaces user belongs to
   */
  router.get(
    "/workspaces",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const workspaces = await workspaceService.listUserWorkspaces(
          req.user!.id,
        );
        res.status(200).json({ workspaces });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId
   * Get workspace details (requires membership)
   */
  router.get(
    "/workspaces/:workspaceId",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ws = await workspaceService.getWorkspace(req.params.workspaceId);
        res.status(200).json({ workspace: ws, membership: req.membership });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /v1/workspaces/:workspaceId
   * Update workspace metadata (requires ADMIN or OWNER)
   */
  router.patch(
    "/workspaces/:workspaceId",
    requireAuth,
    requireTenant,
    requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = updateWorkspaceSchema.parse(req.body);
        const ws = await workspaceService.updateWorkspace(
          req.params.workspaceId,
          req.user!.id,
          parsed,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(200).json({ workspace: ws });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/members
   * List members within workspace (requires membership)
   */
  router.get(
    "/workspaces/:workspaceId/members",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const members = await workspaceService.listMembers(
          req.params.workspaceId,
        );
        res.status(200).json({ members });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/invitations
   * Invite member to workspace (requires ADMIN or OWNER)
   */
  router.post(
    "/workspaces/:workspaceId/invitations",
    requireAuth,
    requireTenant,
    requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = inviteMemberSchema.parse(req.body);
        const invitation = await workspaceService.inviteMember(
          req.params.workspaceId,
          req.user!.id,
          parsed,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(201).json({ invitation });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/invitations/accept
   * Accept invitation via secure token
   */
  router.post(
    "/invitations/accept",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = acceptInviteSchema.parse(req.body);
        const membership = await workspaceService.acceptInvitation(
          token,
          req.user!,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(200).json({ membership });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /v1/workspaces/:workspaceId/members/:memberId
   * Update member role (requires ADMIN or OWNER)
   */
  router.patch(
    "/workspaces/:workspaceId/members/:memberId",
    requireAuth,
    requireTenant,
    requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = updateMemberRoleSchema.parse(req.body);
        const updated = await workspaceService.updateMemberRole(
          req.params.workspaceId,
          req.user!.id,
          req.params.memberId,
          parsed.role,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(200).json({ membership: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /v1/workspaces/:workspaceId/members/:memberId
   * Remove member from workspace (requires ADMIN or OWNER)
   */
  router.delete(
    "/workspaces/:workspaceId/members/:memberId",
    requireAuth,
    requireTenant,
    requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await workspaceService.removeMember(
          req.params.workspaceId,
          req.user!.id,
          req.params.memberId,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/audit-logs
   * Retrieve workspace audit trail (requires ADMIN or OWNER)
   */
  router.get(
    "/workspaces/:workspaceId/audit-logs",
    requireAuth,
    requireTenant,
    requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const logs = await workspaceService.getAuditLogs(
          req.params.workspaceId,
        );
        res.status(200).json({ logs });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
