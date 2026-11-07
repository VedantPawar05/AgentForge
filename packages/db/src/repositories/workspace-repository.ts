import { WorkspaceRole } from "@agentforge/shared";
import { prisma } from "../index.js";
import { randomUUID } from "crypto";

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    fullName?: string | null;
  };
}

export interface InvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: Date;
  invitedById: string;
  createdAt: Date;
}

export interface IWorkspaceRepository {
  createWorkspace(data: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<WorkspaceRecord>;
  findById(id: string): Promise<WorkspaceRecord | null>;
  findBySlug(slug: string): Promise<WorkspaceRecord | null>;
  listUserWorkspaces(
    userId: string,
  ): Promise<{ workspace: WorkspaceRecord; role: WorkspaceRole }[]>;
  updateWorkspace(
    id: string,
    data: { name?: string },
  ): Promise<WorkspaceRecord>;
  deleteWorkspace(id: string): Promise<void>;

  // Memberships
  findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null>;
  listMembers(workspaceId: string): Promise<MembershipRecord[]>;
  addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<MembershipRecord>;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<MembershipRecord>;
  removeMember(workspaceId: string, userId: string): Promise<void>;

  // Invitations
  createInvitation(data: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    token: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<InvitationRecord>;
  findInvitationByToken(token: string): Promise<InvitationRecord | null>;
  listInvitations(workspaceId: string): Promise<InvitationRecord[]>;
  updateInvitationStatus(
    id: string,
    status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED",
  ): Promise<InvitationRecord>;
}

export class PrismaWorkspaceRepository implements IWorkspaceRepository {
  public async createWorkspace(data: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<WorkspaceRecord> {
    const ws = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
          ownerId: data.ownerId,
        },
      });

      // Default owner membership
      await tx.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: data.ownerId,
          role: "OWNER",
        },
      });

      // Default workspace settings
      await tx.workspaceSetting.create({
        data: {
          workspaceId: workspace.id,
        },
      });

      return workspace;
    });

    return ws;
  }

  public async findById(id: string): Promise<WorkspaceRecord | null> {
    return prisma.workspace.findUnique({ where: { id } });
  }

  public async findBySlug(slug: string): Promise<WorkspaceRecord | null> {
    return prisma.workspace.findUnique({ where: { slug } });
  }

  public async listUserWorkspaces(
    userId: string,
  ): Promise<{ workspace: WorkspaceRecord; role: WorkspaceRole }[]> {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
    });

    return memberships.map((m) => ({
      workspace: m.workspace,
      role: m.role as WorkspaceRole,
    }));
  }

  public async updateWorkspace(
    id: string,
    data: { name?: string },
  ): Promise<WorkspaceRecord> {
    return prisma.workspace.update({
      where: { id },
      data,
    });
  }

  public async deleteWorkspace(id: string): Promise<void> {
    await prisma.workspace.delete({ where: { id } });
  }

  public async findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const m = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      include: { user: true },
    });
    if (!m) return null;
    return {
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role as WorkspaceRole,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
      },
    };
  }

  public async listMembers(workspaceId: string): Promise<MembershipRecord[]> {
    const members = await prisma.membership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role as WorkspaceRole,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
      },
    }));
  }

  public async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<MembershipRecord> {
    const m = await prisma.membership.create({
      data: {
        workspaceId,
        userId,
        role,
      },
      include: { user: true },
    });
    return {
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role as WorkspaceRole,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
      },
    };
  }

  public async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<MembershipRecord> {
    const m = await prisma.membership.update({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      data: { role },
      include: { user: true },
    });
    return {
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role as WorkspaceRole,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
      },
    };
  }

  public async removeMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    await prisma.membership.delete({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
  }

  public async createInvitation(data: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    token: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<InvitationRecord> {
    const inv = await prisma.invitation.create({
      data: {
        workspaceId: data.workspaceId,
        email: data.email,
        role: data.role,
        token: data.token,
        invitedById: data.invitedById,
        expiresAt: data.expiresAt,
      },
    });
    return {
      ...inv,
      role: inv.role as WorkspaceRole,
    };
  }

  public async findInvitationByToken(
    token: string,
  ): Promise<InvitationRecord | null> {
    const inv = await prisma.invitation.findUnique({ where: { token } });
    if (!inv) return null;
    return {
      ...inv,
      role: inv.role as WorkspaceRole,
    };
  }

  public async listInvitations(
    workspaceId: string,
  ): Promise<InvitationRecord[]> {
    const invs = await prisma.invitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return invs.map((i) => ({
      ...i,
      role: i.role as WorkspaceRole,
    }));
  }

  public async updateInvitationStatus(
    id: string,
    status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED",
  ): Promise<InvitationRecord> {
    const inv = await prisma.invitation.update({
      where: { id },
      data: { status },
    });
    return {
      ...inv,
      role: inv.role as WorkspaceRole,
    };
  }
}

export class InMemoryWorkspaceRepository implements IWorkspaceRepository {
  public workspaces = new Map<string, WorkspaceRecord>();
  public memberships = new Map<string, MembershipRecord>();
  public invitations = new Map<string, InvitationRecord>();

  public async createWorkspace(data: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<WorkspaceRecord> {
    const now = new Date();
    const ws: WorkspaceRecord = {
      id: randomUUID(),
      name: data.name,
      slug: data.slug,
      ownerId: data.ownerId,
      createdAt: now,
      updatedAt: now,
    };
    this.workspaces.set(ws.id, ws);

    const membership: MembershipRecord = {
      id: randomUUID(),
      workspaceId: ws.id,
      userId: data.ownerId,
      role: WorkspaceRole.OWNER,
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(`${ws.id}:${data.ownerId}`, membership);

    return ws;
  }

  public async findById(id: string): Promise<WorkspaceRecord | null> {
    return this.workspaces.get(id) ?? null;
  }

  public async findBySlug(slug: string): Promise<WorkspaceRecord | null> {
    for (const ws of this.workspaces.values()) {
      if (ws.slug === slug) return ws;
    }
    return null;
  }

  public async listUserWorkspaces(
    userId: string,
  ): Promise<{ workspace: WorkspaceRecord; role: WorkspaceRole }[]> {
    const result: { workspace: WorkspaceRecord; role: WorkspaceRole }[] = [];
    for (const m of this.memberships.values()) {
      if (m.userId === userId) {
        const ws = this.workspaces.get(m.workspaceId);
        if (ws) {
          result.push({ workspace: ws, role: m.role });
        }
      }
    }
    return result;
  }

  public async updateWorkspace(
    id: string,
    data: { name?: string },
  ): Promise<WorkspaceRecord> {
    const ws = this.workspaces.get(id);
    if (!ws) throw new Error(`Workspace ${id} not found`);
    if (data.name) ws.name = data.name;
    ws.updatedAt = new Date();
    return ws;
  }

  public async deleteWorkspace(id: string): Promise<void> {
    this.workspaces.delete(id);
    for (const [key, m] of this.memberships.entries()) {
      if (m.workspaceId === id) this.memberships.delete(key);
    }
  }

  public async findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    return this.memberships.get(`${workspaceId}:${userId}`) ?? null;
  }

  public async listMembers(workspaceId: string): Promise<MembershipRecord[]> {
    const list: MembershipRecord[] = [];
    for (const m of this.memberships.values()) {
      if (m.workspaceId === workspaceId) list.push(m);
    }
    return list;
  }

  public async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<MembershipRecord> {
    const now = new Date();
    const m: MembershipRecord = {
      id: randomUUID(),
      workspaceId,
      userId,
      role,
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(`${workspaceId}:${userId}`, m);
    return m;
  }

  public async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<MembershipRecord> {
    const key = `${workspaceId}:${userId}`;
    const m = this.memberships.get(key);
    if (!m) throw new Error(`Membership not found`);
    m.role = role;
    m.updatedAt = new Date();
    return m;
  }

  public async removeMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    this.memberships.delete(`${workspaceId}:${userId}`);
  }

  public async createInvitation(data: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    token: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<InvitationRecord> {
    const now = new Date();
    const inv: InvitationRecord = {
      id: randomUUID(),
      workspaceId: data.workspaceId,
      email: data.email,
      role: data.role,
      token: data.token,
      status: "PENDING",
      expiresAt: data.expiresAt,
      invitedById: data.invitedById,
      createdAt: now,
    };
    this.invitations.set(inv.id, inv);
    return inv;
  }

  public async findInvitationByToken(
    token: string,
  ): Promise<InvitationRecord | null> {
    for (const inv of this.invitations.values()) {
      if (inv.token === token) return inv;
    }
    return null;
  }

  public async listInvitations(
    workspaceId: string,
  ): Promise<InvitationRecord[]> {
    const list: InvitationRecord[] = [];
    for (const inv of this.invitations.values()) {
      if (inv.workspaceId === workspaceId) list.push(inv);
    }
    return list;
  }

  public async updateInvitationStatus(
    id: string,
    status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED",
  ): Promise<InvitationRecord> {
    const inv = this.invitations.get(id);
    if (!inv) throw new Error("Invitation not found");
    inv.status = status;
    return inv;
  }

  public clear(): void {
    this.workspaces.clear();
    this.memberships.clear();
    this.invitations.clear();
  }
}
