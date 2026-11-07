import { WorkspaceRole } from "@agentforge/shared";

export interface AuthenticatedUser {
  id: string;
  email: string;
  externalId: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface TenantMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      membership?: TenantMembership;
    }
  }
}
