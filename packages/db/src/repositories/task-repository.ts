import { TaskPriority, TaskStatus, ConflictError } from "@agentforge/shared";
import { prisma } from "../index.js";
import { randomUUID } from "crypto";

export interface TaskRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  createdById: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  branchName?: string | null;
  targetBranch: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  dependencies?: string[];
}

export interface TaskFilterOptions {
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ITaskRepository {
  createTask(data: {
    workspaceId: string;
    projectId: string;
    createdById: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    targetBranch?: string;
    dependencies?: string[];
  }): Promise<TaskRecord>;

  findById(id: string): Promise<TaskRecord | null>;
  listTasks(
    workspaceId: string,
    projectId?: string,
    filters?: TaskFilterOptions,
  ): Promise<{ tasks: TaskRecord[]; totalCount: number }>;
  updateTask(
    id: string,
    expectedVersion: number,
    data: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      branchName?: string;
      targetBranch?: string;
    },
  ): Promise<TaskRecord>;
  addDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
  getDependencies(taskId: string): Promise<string[]>;
  getAllDependenciesMap(workspaceId: string): Promise<Map<string, string[]>>;
  deleteTask(id: string): Promise<void>;
}

export class PrismaTaskRepository implements ITaskRepository {
  public async createTask(data: {
    workspaceId: string;
    projectId: string;
    createdById: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    targetBranch?: string;
    dependencies?: string[];
  }): Promise<TaskRecord> {
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          workspaceId: data.workspaceId,
          projectId: data.projectId,
          createdById: data.createdById,
          title: data.title,
          description: data.description,
          priority: data.priority ?? "MEDIUM",
          status: "QUEUED",
          targetBranch: data.targetBranch ?? "main",
          version: 1,
        },
      });

      if (data.dependencies && data.dependencies.length > 0) {
        await tx.taskDependency.createMany({
          data: data.dependencies.map((depId) => ({
            taskId: created.id,
            dependsOnTaskId: depId,
          })),
        });
      }

      return created;
    });

    return {
      ...task,
      priority: task.priority as TaskPriority,
      status: task.status as TaskStatus,
      dependencies: data.dependencies ?? [],
    };
  }

  public async findById(id: string): Promise<TaskRecord | null> {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        dependencies: {
          select: { dependsOnTaskId: true },
        },
      },
    });
    if (!task) return null;
    return {
      ...task,
      priority: task.priority as TaskPriority,
      status: task.status as TaskStatus,
      dependencies: task.dependencies.map((d) => d.dependsOnTaskId),
    };
  }

  public async listTasks(
    workspaceId: string,
    projectId?: string,
    filters: TaskFilterOptions = {},
  ): Promise<{ tasks: TaskRecord[]; totalCount: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };
    if (projectId) where.projectId = projectId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [tasks, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          dependencies: { select: { dependsOnTaskId: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks: tasks.map((t) => ({
        ...t,
        priority: t.priority as TaskPriority,
        status: t.status as TaskStatus,
        dependencies: t.dependencies.map((d) => d.dependsOnTaskId),
      })),
      totalCount,
    };
  }

  public async updateTask(
    id: string,
    expectedVersion: number,
    data: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      branchName?: string;
      targetBranch?: string;
    },
  ): Promise<TaskRecord> {
    const updated = await prisma.task.updateMany({
      where: {
        id,
        version: expectedVersion,
      },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      const current = await this.findById(id);
      throw new ConflictError(
        `Task update conflict: Task '${id}' was modified concurrently (expected version ${expectedVersion}, actual version ${current?.version ?? "deleted"})`,
        { id, expectedVersion, actualVersion: current?.version },
      );
    }

    return (await this.findById(id))!;
  }

  public async addDependency(
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<void> {
    await prisma.taskDependency.create({
      data: {
        taskId,
        dependsOnTaskId,
      },
    });
  }

  public async getDependencies(taskId: string): Promise<string[]> {
    const deps = await prisma.taskDependency.findMany({
      where: { taskId },
      select: { dependsOnTaskId: true },
    });
    return deps.map((d) => d.dependsOnTaskId);
  }

  public async getAllDependenciesMap(
    workspaceId: string,
  ): Promise<Map<string, string[]>> {
    const tasks = await prisma.task.findMany({
      where: { workspaceId },
      include: { dependencies: { select: { dependsOnTaskId: true } } },
    });

    const map = new Map<string, string[]>();
    for (const t of tasks) {
      map.set(
        t.id,
        t.dependencies.map((d) => d.dependsOnTaskId),
      );
    }
    return map;
  }

  public async deleteTask(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
  }
}

export class InMemoryTaskRepository implements ITaskRepository {
  public tasks = new Map<string, TaskRecord>();
  public dependencies = new Map<string, Set<string>>();

  public async createTask(data: {
    workspaceId: string;
    projectId: string;
    createdById: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    targetBranch?: string;
    dependencies?: string[];
  }): Promise<TaskRecord> {
    const now = new Date();
    const task: TaskRecord = {
      id: randomUUID(),
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      createdById: data.createdById,
      title: data.title,
      description: data.description,
      priority: data.priority ?? TaskPriority.MEDIUM,
      status: TaskStatus.QUEUED,
      targetBranch: data.targetBranch ?? "main",
      version: 1,
      createdAt: now,
      updatedAt: now,
      dependencies: data.dependencies ?? [],
    };

    this.tasks.set(task.id, task);

    const depSet = new Set<string>();
    if (data.dependencies) {
      for (const d of data.dependencies) depSet.add(d);
    }
    this.dependencies.set(task.id, depSet);

    return task;
  }

  public async findById(id: string): Promise<TaskRecord | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    const deps = Array.from(this.dependencies.get(id) ?? []);
    return { ...task, dependencies: deps };
  }

  public async listTasks(
    workspaceId: string,
    projectId?: string,
    filters: TaskFilterOptions = {},
  ): Promise<{ tasks: TaskRecord[]; totalCount: number }> {
    let list = Array.from(this.tasks.values()).filter(
      (t) => t.workspaceId === workspaceId,
    );

    if (projectId) {
      list = list.filter((t) => t.projectId === projectId);
    }
    if (filters.status) {
      list = list.filter((t) => t.status === filters.status);
    }
    if (filters.priority) {
      list = list.filter((t) => t.priority === filters.priority);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }

    const totalCount = list.length;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      tasks: paginated.map((t) => ({
        ...t,
        dependencies: Array.from(this.dependencies.get(t.id) ?? []),
      })),
      totalCount,
    };
  }

  public async updateTask(
    id: string,
    expectedVersion: number,
    data: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      branchName?: string;
      targetBranch?: string;
    },
  ): Promise<TaskRecord> {
    const task = this.tasks.get(id);
    if (!task) throw new Error("Task not found");

    if (task.version !== expectedVersion) {
      throw new ConflictError(
        `Task update conflict: Task '${id}' was modified concurrently (expected version ${expectedVersion}, actual version ${task.version})`,
        { id, expectedVersion, actualVersion: task.version },
      );
    }

    if (data.title) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.priority) task.priority = data.priority;
    if (data.status) task.status = data.status;
    if (data.branchName !== undefined) task.branchName = data.branchName;
    if (data.targetBranch) task.targetBranch = data.targetBranch;

    task.version += 1;
    task.updatedAt = new Date();

    return {
      ...task,
      dependencies: Array.from(this.dependencies.get(id) ?? []),
    };
  }

  public async addDependency(
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<void> {
    const set = this.dependencies.get(taskId) ?? new Set<string>();
    set.add(dependsOnTaskId);
    this.dependencies.set(taskId, set);
  }

  public async getDependencies(taskId: string): Promise<string[]> {
    return Array.from(this.dependencies.get(taskId) ?? []);
  }

  public async getAllDependenciesMap(
    workspaceId: string,
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    for (const task of this.tasks.values()) {
      if (task.workspaceId === workspaceId) {
        map.set(task.id, Array.from(this.dependencies.get(task.id) ?? []));
      }
    }
    return map;
  }

  public async deleteTask(id: string): Promise<void> {
    this.tasks.delete(id);
    this.dependencies.delete(id);
  }

  public clear(): void {
    this.tasks.clear();
    this.dependencies.clear();
  }
}
