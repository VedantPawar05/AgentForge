import { prisma } from "../index.js";
import { randomUUID } from "crypto";

export interface AuthenticatedUser {
  id: string;
  email: string;
  externalId: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface IUserRepository {
  findById(id: string): Promise<AuthenticatedUser | null>;
  findByExternalId(externalId: string): Promise<AuthenticatedUser | null>;
  findByEmail(email: string): Promise<AuthenticatedUser | null>;
  upsertUser(data: {
    externalId: string;
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  }): Promise<AuthenticatedUser>;
}

export class PrismaUserRepository implements IUserRepository {
  public async findById(id: string): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      externalId: user.externalId,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }

  public async findByExternalId(
    externalId: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({ where: { externalId } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      externalId: user.externalId,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }

  public async findByEmail(email: string): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      externalId: user.externalId,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }

  public async upsertUser(data: {
    externalId: string;
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  }): Promise<AuthenticatedUser> {
    const user = await prisma.user.upsert({
      where: { externalId: data.externalId },
      update: {
        email: data.email,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
      },
      create: {
        externalId: data.externalId,
        email: data.email,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
      },
    });

    return {
      id: user.id,
      email: user.email,
      externalId: user.externalId,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }
}

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, AuthenticatedUser>();

  public async findById(id: string): Promise<AuthenticatedUser | null> {
    return this.users.get(id) ?? null;
  }

  public async findByExternalId(
    externalId: string,
  ): Promise<AuthenticatedUser | null> {
    for (const u of this.users.values()) {
      if (u.externalId === externalId) return u;
    }
    return null;
  }

  public async findByEmail(email: string): Promise<AuthenticatedUser | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  public async upsertUser(data: {
    externalId: string;
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  }): Promise<AuthenticatedUser> {
    const existing = await this.findByExternalId(data.externalId);
    if (existing) {
      existing.email = data.email;
      existing.fullName = data.fullName;
      existing.avatarUrl = data.avatarUrl;
      return existing;
    }

    const newUser: AuthenticatedUser = {
      id: randomUUID(),
      externalId: data.externalId,
      email: data.email,
      fullName: data.fullName,
      avatarUrl: data.avatarUrl,
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  public clear(): void {
    this.users.clear();
  }
}
