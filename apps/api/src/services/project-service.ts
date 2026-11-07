import {
  IProjectRepository,
  ProjectRecord,
  IAuditRepository,
} from "@agentforge/db";
import { NotFoundError } from "@agentforge/shared";

export class ProjectService {
  constructor(
    private readonly projectRepo: IProjectRepository,
    private readonly auditRepo: IAuditRepository,
  ) {}

  public async createProject(
    workspaceId: string,
    actorId: string,
    input: {
      name: string;
      repoOwner: string;
      repoName: string;
      defaultBranch?: string;
      testCommand?: string;
      buildCommand?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ProjectRecord> {
    const project = await this.projectRepo.createProject({
      workspaceId,
      ...input,
    });

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "PROJECT_CREATED",
      targetType: "Project",
      targetId: project.id,
      ipAddress,
      userAgent,
      metadata: {
        name: project.name,
        repo: `${project.repoOwner}/${project.repoName}`,
      },
    });

    return project;
  }

  public async getProject(
    workspaceId: string,
    projectId: string,
  ): Promise<ProjectRecord> {
    const project = await this.projectRepo.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new NotFoundError("Project", projectId);
    }
    return project;
  }

  public async listProjects(workspaceId: string): Promise<ProjectRecord[]> {
    return this.projectRepo.listByWorkspace(workspaceId);
  }

  public async updateProject(
    workspaceId: string,
    projectId: string,
    actorId: string,
    data: {
      name?: string;
      defaultBranch?: string;
      testCommand?: string;
      buildCommand?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ProjectRecord> {
    await this.getProject(workspaceId, projectId); // verify tenant scoping

    const updated = await this.projectRepo.updateProject(projectId, data);

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "PROJECT_UPDATED",
      targetType: "Project",
      targetId: projectId,
      ipAddress,
      userAgent,
      metadata: data,
    });

    return updated;
  }
}
