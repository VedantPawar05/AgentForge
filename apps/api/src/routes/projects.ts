import { Router, Request, Response, NextFunction } from "express";
import { ProjectService } from "../services/project-service.js";
import { IAuthService } from "../auth/auth-service.js";
import { IWorkspaceRepository } from "@agentforge/db";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import {
  createTenantMiddleware,
  requireRole,
} from "../auth/tenant-middleware.js";
import {
  createProjectSchema,
  updateProjectSchema,
  WorkspaceRole,
} from "@agentforge/shared";

export function createProjectRouter(
  projectService: ProjectService,
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);
  const requireTenant = createTenantMiddleware(workspaceRepo);

  /**
   * POST /v1/workspaces/:workspaceId/projects
   * Creates project under workspace (requires DEVELOPER, ADMIN, or OWNER)
   */
  router.post(
    "/workspaces/:workspaceId/projects",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createProjectSchema.parse(req.body);
        const project = await projectService.createProject(
          req.params.workspaceId,
          req.user!.id,
          parsed,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(201).json({ project });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/projects
   * List projects in workspace (requires workspace membership)
   */
  router.get(
    "/workspaces/:workspaceId/projects",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projects = await projectService.listProjects(
          req.params.workspaceId,
        );
        res.status(200).json({ projects });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/projects/:projectId
   * Retrieve project details (requires workspace membership)
   */
  router.get(
    "/workspaces/:workspaceId/projects/:projectId",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const project = await projectService.getProject(
          req.params.workspaceId,
          req.params.projectId,
        );
        res.status(200).json({ project });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /v1/workspaces/:workspaceId/projects/:projectId
   * Update project settings (requires ADMIN or OWNER)
   */
  router.patch(
    "/workspaces/:workspaceId/projects/:projectId",
    requireAuth,
    requireTenant,
    requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = updateProjectSchema.parse(req.body);
        const updated = await projectService.updateProject(
          req.params.workspaceId,
          req.params.projectId,
          req.user!.id,
          parsed,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(200).json({ project: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
