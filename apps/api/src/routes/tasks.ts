import { Router, Request, Response, NextFunction } from "express";
import { TaskService } from "../services/task-service.js";
import { IAuthService } from "../auth/auth-service.js";
import { IWorkspaceRepository } from "@agentforge/db";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import {
  createTenantMiddleware,
  requireRole,
} from "../auth/tenant-middleware.js";
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  uuidSchema,
  WorkspaceRole,
} from "@agentforge/shared";
import { z } from "zod";

const addDependencySchema = z.object({
  dependsOnTaskId: uuidSchema,
});

export function createTaskRouter(
  taskService: TaskService,
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);
  const requireTenant = createTenantMiddleware(workspaceRepo);

  /**
   * POST /v1/workspaces/:workspaceId/projects/:projectId/tasks
   * Create new task under project (requires DEVELOPER, ADMIN, OWNER)
   */
  router.post(
    "/workspaces/:workspaceId/projects/:projectId/tasks",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createTaskSchema.parse(req.body);
        const task = await taskService.createTask(
          req.params.workspaceId,
          req.params.projectId,
          req.user!.id,
          parsed,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(201).json({ task });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/projects/:projectId/tasks
   * List tasks for a specific project
   */
  router.get(
    "/workspaces/:workspaceId/projects/:projectId/tasks",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = taskQuerySchema.parse(req.query);
        const result = await taskService.listTasks(
          req.params.workspaceId,
          req.params.projectId,
          query,
        );
        res.status(200).json({
          tasks: result.tasks,
          pagination: {
            page: query.page,
            limit: query.limit,
            totalCount: result.totalCount,
            totalPages: Math.ceil(result.totalCount / query.limit),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/tasks
   * List tasks across the workspace (Kanban feed)
   */
  router.get(
    "/workspaces/:workspaceId/tasks",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = taskQuerySchema.parse(req.query);
        const result = await taskService.listTasks(
          req.params.workspaceId,
          undefined,
          query,
        );
        res.status(200).json({
          tasks: result.tasks,
          pagination: {
            page: query.page,
            limit: query.limit,
            totalCount: result.totalCount,
            totalPages: Math.ceil(result.totalCount / query.limit),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/tasks/:taskId
   * Retrieve single task details
   */
  router.get(
    "/workspaces/:workspaceId/tasks/:taskId",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const task = await taskService.getTask(
          req.params.workspaceId,
          req.params.taskId,
        );
        res.status(200).json({ task });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /v1/workspaces/:workspaceId/tasks/:taskId
   * Update task metadata or status (optimistic concurrency with version, RBAC & state machine)
   */
  router.patch(
    "/workspaces/:workspaceId/tasks/:taskId",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = updateTaskSchema.parse(req.body);
        const updated = await taskService.updateTask(
          req.params.workspaceId,
          req.params.taskId,
          { id: req.user!.id, role: req.membership!.role },
          parsed,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(200).json({ task: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/tasks/:taskId/dependencies
   * Add task dependency with cycle detection
   */
  router.post(
    "/workspaces/:workspaceId/tasks/:taskId/dependencies",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dependsOnTaskId } = addDependencySchema.parse(req.body);
        await taskService.addDependency(
          req.params.workspaceId,
          req.params.taskId,
          dependsOnTaskId,
          req.user!.id,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(201).json({ message: "Dependency added successfully" });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /v1/workspaces/:workspaceId/tasks/:taskId
   * Delete a task
   */
  router.delete(
    "/workspaces/:workspaceId/tasks/:taskId",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.DEVELOPER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await taskService.deleteTask(
          req.params.workspaceId,
          req.params.taskId,
          req.user!.id,
          req.ip,
          req.headers["user-agent"],
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
