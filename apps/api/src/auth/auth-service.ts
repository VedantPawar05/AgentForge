import { AuthenticatedUser } from "./types.js";
import { IUserRepository } from "@agentforge/db";
import { UnauthorizedError } from "@agentforge/shared";
import { verifyJwt } from "./jwt-verifier.js";

export type AuthUser = AuthenticatedUser;

export interface IAuthService {
  authenticateToken(token: string): Promise<AuthenticatedUser>;
  syncUser(claims: {
    externalId: string;
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  }): Promise<AuthenticatedUser>;
}

export class AuthService implements IAuthService {
  constructor(private readonly userRepo: IUserRepository) {}

  public async authenticateToken(token: string): Promise<AuthenticatedUser> {
    if (!token || typeof token !== "string") {
      throw new UnauthorizedError("Missing authentication token");
    }

    const trimmed = token.trim();
    const isProduction = process.env.NODE_ENV === "production";
    const isClerk = process.env.AUTH_PROVIDER === "clerk";

    // 1. JWT verification (standard 3-segment token header.payload.sig)
    if (trimmed.split(".").length === 3) {
      const claims = verifyJwt(trimmed, {
        secret: process.env.CLERK_SECRET_KEY,
        publicKey: process.env.CLERK_PEM_PUBLIC_KEY,
      });

      const email =
        (claims.email as string) ||
        (claims.email_address as string) ||
        `${claims.sub}@agentforge.local`;

      const fullName =
        (claims.name as string) ||
        (claims.full_name as string) ||
        (claims.first_name
          ? `${claims.first_name} ${claims.last_name || ""}`.trim()
          : null);

      return this.syncUser({
        externalId: claims.sub,
        email,
        fullName,
        avatarUrl:
          (claims.avatar_url as string) || (claims.picture as string) || null,
      });
    }

    // 2. Strict Production Guard: In production or Clerk mode, mock tokens are strictly forbidden!
    if (isProduction || isClerk) {
      throw new UnauthorizedError(
        "Mock authentication tokens are strictly forbidden in production or Clerk mode. A valid cryptographically signed JWT is required.",
      );
    }

    // 3. Development / Test Only Fallback
    if (trimmed.startsWith("mock_user_") || trimmed.includes("@")) {
      const email = trimmed.includes("@")
        ? trimmed
        : `${trimmed}@agentforge.local`;
      const externalId = `ext_${trimmed}`;
      return this.syncUser({
        externalId,
        email,
        fullName: `Mock User (${trimmed})`,
      });
    }

    // Development simple bearer token fallback
    return this.syncUser({
      externalId: `dev_${trimmed}`,
      email: `${trimmed}@agentforge.local`,
      fullName: `User ${trimmed}`,
    });
  }

  public async syncUser(claims: {
    externalId: string;
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  }): Promise<AuthenticatedUser> {
    return this.userRepo.upsertUser(claims);
  }
}
