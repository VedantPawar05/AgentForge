import {
  IWorkspaceRepository,
  WorkspaceRecord,
  MembershipRecord,
  InvitationRecord,
  IAuditRepository,
  IUserRepository,
} from "@agentforge/db";
import {
  WorkspaceRole,
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@agentforge/shared";
import { randomBytes } from "crypto";

export class WorkspaceService {
  constructor(
    private readonly workspaceRepo: IWorkspaceRepository,
    private readonly userRepo: IUserRepository,
    private readonly auditRepo: IAuditRepository,
  ) {}

  public async createWorkspace(
    actorId: string,
    input: { name: string; slug: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<WorkspaceRecord> {
    const existing = await this.workspaceRepo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(
        `Workspace slug '${input.slug}' is already taken`,
        { slug: input.slug },
      );
    }

    const workspace = await this.workspaceRepo.createWorkspace({
      name: input.name,
      slug: input.slug,
      ownerId: actorId,
    });

    await this.auditRepo.record({
      workspaceId: workspace.id,
      actorId,
      action: "WORKSPACE_CREATED",
      targetType: "Workspace",
      targetId: workspace.id,
      ipAddress,
      userAgent,
      metadata: { name: input.name, slug: input.slug },
    });

    return workspace;
  }

  public async listUserWorkspaces(userId: string) {
    return this.workspaceRepo.listUserWorkspaces(userId);
  }

  public async getWorkspace(workspaceId: string): Promise<WorkspaceRecord> {
    const ws = await this.workspaceRepo.findById(workspaceId);
    if (!ws) {
      throw new NotFoundError("Workspace", workspaceId);
    }
    return ws;
  }

  public async updateWorkspace(
    workspaceId: string,
    actorId: string,
    input: { name?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<WorkspaceRecord> {
    const ws = await this.workspaceRepo.updateWorkspace(workspaceId, input);

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "WORKSPACE_UPDATED",
      targetType: "Workspace",
      targetId: workspaceId,
      ipAddress,
      userAgent,
      metadata: input,
    });

    return ws;
  }

  public async listMembers(workspaceId: string): Promise<MembershipRecord[]> {
    return this.workspaceRepo.listMembers(workspaceId);
  }

  public async inviteMember(
    workspaceId: string,
    actorId: string,
    input: { email: string; role: WorkspaceRole },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<InvitationRecord> {
    // Check if user is already a member
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await this.workspaceRepo.findMembership(
        workspaceId,
        existingUser.id,
      );
      if (existingMembership) {
        throw new ConflictError(
          `User '${input.email}' is already a member of this workspace`,
        );
      }
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.workspaceRepo.createInvitation({
      workspaceId,
      email: input.email,
      role: input.role,
      token,
      invitedById: actorId,
      expiresAt,
    });

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "MEMBER_INVITED",
      targetType: "Invitation",
      targetId: invitation.id,
      ipAddress,
      userAgent,
      metadata: { email: input.email, role: input.role },
    });

    return invitation;
  }

  public async acceptInvitation(
    token: string,
    user: { id: string; email: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MembershipRecord> {
    const invitation = await this.workspaceRepo.findInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundError("Invitation", "invalid token");
    }

    if (invitation.status !== "PENDING") {
      throw new ConflictError(
        `Invitation is already ${invitation.status.toLowerCase()}`,
      );
    }

    if (new Date() > invitation.expiresAt) {
      await this.workspaceRepo.updateInvitationStatus(invitation.id, "EXPIRED");
      throw new ValidationError("Invitation token has expired");
    }

    // Add membership
    const membership = await this.workspaceRepo.addMember(
      invitation.workspaceId,
      user.id,
      invitation.role,
    );

    // Update invitation status
    await this.workspaceRepo.updateInvitationStatus(invitation.id, "ACCEPTED");

    await this.auditRepo.record({
      workspaceId: invitation.workspaceId,
      actorId: user.id,
      action: "INVITATION_ACCEPTED",
      targetType: "Membership",
      targetId: membership.id,
      ipAddress,
      userAgent,
      metadata: { role: invitation.role, email: invitation.email },
    });

    return membership;
  }

  public async updateMemberRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MembershipRecord> {
    const currentMembership = await this.workspaceRepo.findMembership(
      workspaceId,
      targetUserId,
    );
    if (!currentMembership) {
      throw new NotFoundError("Member", targetUserId);
    }

    // Protection: Prevent demoting the last OWNER
    if (
      currentMembership.role === WorkspaceRole.OWNER &&
      newRole !== WorkspaceRole.OWNER
    ) {
      const allMembers = await this.workspaceRepo.listMembers(workspaceId);
      const owners = allMembers.filter((m) => m.role === WorkspaceRole.OWNER);
      if (owners.length <= 1) {
        throw new ForbiddenError(
          "Cannot demote the last remaining Owner of the workspace",
        );
      }
    }

    const updated = await this.workspaceRepo.updateMemberRole(
      workspaceId,
      targetUserId,
      newRole,
    );

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "MEMBER_ROLE_UPDATED",
      targetType: "Membership",
      targetId: updated.id,
      ipAddress,
      userAgent,
      metadata: { targetUserId, previousRole: currentMembership.role, newRole },
    });

    return updated;
  }

  public async removeMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const currentMembership = await this.workspaceRepo.findMembership(
      workspaceId,
      targetUserId,
    );
    if (!currentMembership) {
      throw new NotFoundError("Member", targetUserId);
    }

    // Protection: Prevent removing the last OWNER
    if (currentMembership.role === WorkspaceRole.OWNER) {
      const allMembers = await this.workspaceRepo.listMembers(workspaceId);
      const owners = allMembers.filter((m) => m.role === WorkspaceRole.OWNER);
      if (owners.length <= 1) {
        throw new ForbiddenError(
          "Cannot remove the last remaining Owner of the workspace",
        );
      }
    }

    await this.workspaceRepo.removeMember(workspaceId, targetUserId);

    await this.auditRepo.record({
      workspaceId,
      actorId,
      action: "MEMBER_REMOVED",
      targetType: "Membership",
      targetId: targetUserId,
      ipAddress,
      userAgent,
      metadata: {
        removedUserId: targetUserId,
        previousRole: currentMembership.role,
      },
    });
  }

  public async getAuditLogs(workspaceId: string, limit = 50) {
    return this.auditRepo.listByWorkspace(workspaceId, limit);
  }
}
