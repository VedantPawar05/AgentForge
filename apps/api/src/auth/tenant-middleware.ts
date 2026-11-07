import { Request, Response, NextFunction } from "express";
import { IWorkspaceRepository } from "@agentforge/db";
import {
  WorkspaceRole,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@agentforge/shared";

/**
 * Validates that the authenticated user belongs to the requested workspace.
 * Sets req.membership if valid. Blocks cross-tenant access.
 */
export function createTenantMiddleware(workspaceRepo: IWorkspaceRepository) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError(
          "User authentication required before tenant authorization",
        );
      }

      // Extract workspaceId from params or headers
      const workspaceId =
        req.params.workspaceId ||
        (req.headers["x-workspace-id"] as string | undefined);

      if (!workspaceId) {
        throw new NotFoundError("Workspace", "unspecified");
      }

      // Check if workspace exists
      const workspace = await workspaceRepo.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError("Workspace", workspaceId);
      }

      // Check user membership
      const membership = await workspaceRepo.findMembership(
        workspaceId,
        req.user.id,
      );
      if (!membership) {
        // Cross-tenant attempt rejected: user is not a member of this workspace
        throw new ForbiddenError(
          `You do not have access to workspace '${workspaceId}'. Cross-tenant access denied.`,
        );
      }

      req.membership = {
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        role: membership.role,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Enforces Role-Based Access Control (RBAC) on endpoints.
 * Example: requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER])
 */
export function requireRole(allowedRoles: WorkspaceRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.membership) {
      return next(new ForbiddenError("Tenant membership context missing"));
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return next(
        new ForbiddenError(
          `Action requires one of the following roles: [${allowedRoles.join(
            ", ",
          )}]. Your current role is '${req.membership.role}'.`,
        ),
      );
    }

    next();
  };
}
