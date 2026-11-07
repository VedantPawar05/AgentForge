import { prisma } from "../index.js";
import { randomUUID } from "crypto";

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  repositoryInstallationId?: string | null;
  name: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  testCommand?: string | null;
  buildCommand?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectRepository {
  createProject(data: {
    workspaceId: string;
    name: string;
    repoOwner: string;
    repoName: string;
    defaultBranch?: string;
    testCommand?: string;
    buildCommand?: string;
  }): Promise<ProjectRecord>;

  findById(id: string): Promise<ProjectRecord | null>;
  listByWorkspace(workspaceId: string): Promise<ProjectRecord[]>;
  updateProject(
    id: string,
    data: {
      name?: string;
      defaultBranch?: string;
      testCommand?: string;
      buildCommand?: string;
    },
  ): Promise<ProjectRecord>;
  deleteProject(id: string): Promise<void>;
}

export class PrismaProjectRepository implements IProjectRepository {
  public async createProject(data: {
    workspaceId: string;
    name: string;
    repoOwner: string;
    repoName: string;
    defaultBranch?: string;
    testCommand?: string;
    buildCommand?: string;
  }): Promise<ProjectRecord> {
    return prisma.project.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        repoOwner: data.repoOwner,
        repoName: data.repoName,
        defaultBranch: data.defaultBranch ?? "main",
        testCommand: data.testCommand ?? "npm test",
        buildCommand: data.buildCommand ?? "npm run build",
      },
    });
  }

  public async findById(id: string): Promise<ProjectRecord | null> {
    return prisma.project.findUnique({ where: { id } });
  }

  public async listByWorkspace(workspaceId: string): Promise<ProjectRecord[]> {
    return prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  public async updateProject(
    id: string,
    data: {
      name?: string;
      defaultBranch?: string;
      testCommand?: string;
      buildCommand?: string;
    },
  ): Promise<ProjectRecord> {
    return prisma.project.update({
      where: { id },
      data,
    });
  }

  public async deleteProject(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }
}

export class InMemoryProjectRepository implements IProjectRepository {
  public projects = new Map<string, ProjectRecord>();

  public async createProject(data: {
    workspaceId: string;
    name: string;
    repoOwner: string;
    repoName: string;
    defaultBranch?: string;
    testCommand?: string;
    buildCommand?: string;
  }): Promise<ProjectRecord> {
    const now = new Date();
    const proj: ProjectRecord = {
      id: randomUUID(),
      workspaceId: data.workspaceId,
      name: data.name,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
      defaultBranch: data.defaultBranch ?? "main",
      testCommand: data.testCommand ?? "npm test",
      buildCommand: data.buildCommand ?? "npm run build",
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(proj.id, proj);
    return proj;
  }

  public async findById(id: string): Promise<ProjectRecord | null> {
    return this.projects.get(id) ?? null;
  }

  public async listByWorkspace(workspaceId: string): Promise<ProjectRecord[]> {
    return Array.from(this.projects.values()).filter(
      (p) => p.workspaceId === workspaceId,
    );
  }

  public async updateProject(
    id: string,
    data: {
      name?: string;
      defaultBranch?: string;
      testCommand?: string;
      buildCommand?: string;
    },
  ): Promise<ProjectRecord> {
    const proj = this.projects.get(id);
    if (!proj) throw new Error("Project not found");
    if (data.name) proj.name = data.name;
    if (data.defaultBranch) proj.defaultBranch = data.defaultBranch;
    if (data.testCommand !== undefined) proj.testCommand = data.testCommand;
    if (data.buildCommand !== undefined) proj.buildCommand = data.buildCommand;
    proj.updatedAt = new Date();
    return proj;
  }

  public async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }

  public clear(): void {
    this.projects.clear();
  }
}
