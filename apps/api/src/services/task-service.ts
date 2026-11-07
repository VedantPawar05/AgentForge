import {
  ITaskRepository,
  TaskRecord,
  TaskFilterOptions,
  IProjectRepository,
  IAuditRepository,
} from "@agentforge/db";
import {
  TaskPriority,
  TaskStatus,
  WorkspaceRole,
  NotFoundError,
  assertUserCanTransitionTask,
  assertNoDependencyCycle,
} from "@agentforge/shared";

export class TaskService {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly auditRepo: IAuditRepository,
  ) {}

  public async createTask(
    workspaceId: string,
    projectId: string,
    actorId: string,
    input: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      targetBranch?: string;
      dependencyTaskIds?: string[];
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TaskRecord> {
    // Validate project belongs to workspace
    const project = await this.projectRepo.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new NotFoundError("Project", projectId);
    }

    // Validate dependency tasks exist and belong to same workspace
    if (input.dependencyTaskIds && input.dependencyTaskIds.length > 0) {
      for (const depId of input.dependencyTaskIds) {
        const depTask = await this.taskRepo.findById(depId);
        if (!depTask || depTask.workspaceId !== workspaceId) {
          throw new NotFoundError("Dependency Task", depId);
        }
      }
    }

    const task = await this.taskRepo.createTask({
      workspaceId,
      projectId,
      createdById: actorId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      targetBranch: input.targetBranch ?? project.defaultBranch,
      dependencies: input.dependencyTaskIds,
    });

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "TASK_CREATED",
      targetType: "Task",
      targetId: task.id,
      ipAddress,
      userAgent,
      metadata: { title: task.title, priority: task.priority },
    });

    return task;
  }

  public async getTask(
    workspaceId: string,
    taskId: string,
  ): Promise<TaskRecord> {
    const task = await this.taskRepo.findById(taskId);
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundError("Task", taskId);
    }
    return task;
  }

  public async listTasks(
    workspaceId: string,
    projectId?: string,
    filters?: TaskFilterOptions,
  ): Promise<{ tasks: TaskRecord[]; totalCount: number }> {
    return this.taskRepo.listTasks(workspaceId, projectId, filters);
  }

  public async updateTask(
    workspaceId: string,
    taskId: string,
    actor: { id: string; role: WorkspaceRole },
    input: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      version: number;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TaskRecord> {
    const current = await this.getTask(workspaceId, taskId);

    // If status is changing, enforce state machine transition rules and RBAC permissions!
    if (input.status && input.status !== current.status) {
      assertUserCanTransitionTask(actor.role, current.status, input.status);
    }

    // Atomic update with optimistic concurrency control
    const updated = await this.taskRepo.updateTask(taskId, input.version, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
    });

    await this.auditRepo.record({
      workspaceId,
      actorId: actor.id,
      action:
        input.status && input.status !== current.status
          ? "TASK_STATUS_CHANGED"
          : "TASK_UPDATED",
      targetType: "Task",
      targetId: taskId,
      ipAddress,
      userAgent,
      metadata: {
        previousStatus: current.status,
        newStatus: input.status ?? current.status,
        version: updated.version,
      },
    });

    return updated;
  }

  public async addDependency(
    workspaceId: string,
    taskId: string,
    dependsOnTaskId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // 1. Verify both tasks belong to workspace
    const task = await this.getTask(workspaceId, taskId);
    const depTask = await this.getTask(workspaceId, dependsOnTaskId);

    if (task.projectId !== depTask.projectId) {
      throw new NotFoundError(
        "Dependency Task must belong to the same project",
      );
    }

    // 2. Fetch all existing dependencies in workspace and validate cycle prevention
    const depsMap = await this.taskRepo.getAllDependenciesMap(workspaceId);
    assertNoDependencyCycle(depsMap, { taskId, dependsOnId: dependsOnTaskId });

    // 3. Persist dependency
    await this.taskRepo.addDependency(taskId, dependsOnTaskId);

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "TASK_DEPENDENCY_ADDED",
      targetType: "Task",
      targetId: taskId,
      ipAddress,
      userAgent,
      metadata: { dependsOnTaskId },
    });
  }

  public async deleteTask(
    workspaceId: string,
    taskId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const task = await this.getTask(workspaceId, taskId);
    await this.taskRepo.deleteTask(task.id);
    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "TASK_DELETED",
      targetType: "Task",
      targetId: taskId,
      ipAddress,
      userAgent,
    });
  }
}
