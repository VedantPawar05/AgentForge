import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthService } from "./auth-service.js";
import { createSignedJwt, verifyJwt } from "./jwt-verifier.js";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
} from "@agentforge/db";
import {
  UnauthorizedError,
  ForbiddenError,
  WorkspaceRole,
} from "@agentforge/shared";
import { createTenantMiddleware, requireRole } from "./tenant-middleware.js";
import { Request, Response, NextFunction } from "express";

describe("Phase 2: Cryptographic JWT Verification & Production Security Guardrails", () => {
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;
  const secretKey = "test-jwt-secret-key-32-characters-long!";
  const origEnv = { ...process.env };

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo);
    process.env.CLERK_SECRET_KEY = secretKey;
    process.env.AUTH_PROVIDER = "clerk";
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("verifies cryptographically valid signed JWT and syncs user", async () => {
    const token = createSignedJwt(
      {
        sub: "user_clerk_prod_1",
        email: "prod-user@northwind.dev",
        name: "Sarah Connor",
      },
      secretKey,
      { expiresInSeconds: 3600 },
    );

    const user = await authService.authenticateToken(token);

    expect(user.externalId).toBe("user_clerk_prod_1");
    expect(user.email).toBe("prod-user@northwind.dev");
    expect(user.fullName).toBe("Sarah Connor");

    // User is persisted in repository
    const stored = await userRepo.findById(user.id);
    expect(stored?.email).toBe("prod-user@northwind.dev");
  });

  it("rejects forged JWT tokens with 401 UnauthorizedError", async () => {
    const validToken = createSignedJwt(
      {
        sub: "user_victim",
        email: "victim@northwind.dev",
      },
      secretKey,
      { expiresInSeconds: 3600 },
    );

    // Tamper with payload segment
    const parts = validToken.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        sub: "user_attacker_admin",
        email: "admin@northwind.dev",
      }),
    )
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await expect(authService.authenticateToken(forgedToken)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(authService.authenticateToken(forgedToken)).rejects.toThrow(
      /Invalid cryptographic token signature/,
    );
  });

  it("rejects tokens signed with an incorrect or malicious secret key with 401", async () => {
    const forgedToken = createSignedJwt(
      {
        sub: "attacker_sub",
        email: "attacker@evil.com",
      },
      "attacker-malicious-secret-key-12345!",
      { expiresInSeconds: 3600 },
    );

    await expect(authService.authenticateToken(forgedToken)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects expired JWT tokens with 401 UnauthorizedError", async () => {
    const expiredToken = createSignedJwt(
      {
        sub: "user_expired",
        email: "expired@northwind.dev",
      },
      secretKey,
      { expiresInSeconds: -60 }, // expired 60 seconds ago
    );

    await expect(authService.authenticateToken(expiredToken)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(authService.authenticateToken(expiredToken)).rejects.toThrow(
      /Token expired/,
    );
  });

  it("rejects malformed or truncated tokens with 401 UnauthorizedError", async () => {
    await expect(authService.authenticateToken("not-a-jwt")).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(
      authService.authenticateToken("header.payload"),
    ).rejects.toThrow(UnauthorizedError);
    await expect(authService.authenticateToken("")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("strictly forbids mock/dev tokens in production mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "clerk";

    await expect(
      authService.authenticateToken("mock_user_alice"),
    ).rejects.toThrow(UnauthorizedError);
    await expect(
      authService.authenticateToken("alice@example.com"),
    ).rejects.toThrow(/Mock authentication tokens are strictly forbidden/);
  });

  it("strictly forbids mock/dev tokens when AUTH_PROVIDER is clerk", async () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_PROVIDER = "clerk";

    await expect(
      authService.authenticateToken("mock_user_bob"),
    ).rejects.toThrow(UnauthorizedError);
    await expect(
      authService.authenticateToken("bob@example.com"),
    ).rejects.toThrow(/Mock authentication tokens are strictly forbidden/);
  });

  it("permits mock tokens only when explicitly in development AND AUTH_PROVIDER=mock", async () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_PROVIDER = "mock";

    const user = await authService.authenticateToken("mock_user_dev_alice");
    expect(user.externalId).toBe("ext_mock_user_dev_alice");
    expect(user.email).toContain("mock_user_dev_alice");
  });
});

describe("Phase 2: Tenant Isolation & RBAC Middleware Enforcement", () => {
  let workspaceRepo: InMemoryWorkspaceRepository;
  let userRepo: InMemoryUserRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    userRepo = new InMemoryUserRepository();
  });

  it("enforces tenant isolation and returns 403 Forbidden for cross-tenant access", async () => {
    // 1. Create Workspace A with Owner Alice
    const alice = await userRepo.upsertUser({
      externalId: "alice_ext",
      email: "alice@domain.com",
    });
    const wsA = await workspaceRepo.createWorkspace({
      name: "Workspace A",
      slug: "ws-a",
      ownerId: alice.id,
    });

    // 2. Bob is an outsider (not a member of Workspace A)
    const bob = await userRepo.upsertUser({
      externalId: "bob_ext",
      email: "bob@domain.com",
    });

    const tenantMiddleware = createTenantMiddleware(workspaceRepo);

    // Mock Express Request & Next
    const req = {
      user: bob,
      params: { workspaceId: wsA.id },
      headers: {},
    } as unknown as Request;

    const res = {} as Response;
    let caughtError: any = null;
    const next: NextFunction = (err?: any) => {
      caughtError = err;
    };

    await tenantMiddleware(req, res, next);

    expect(caughtError).toBeInstanceOf(ForbiddenError);
    expect(caughtError.statusCode).toBe(403);
    expect(caughtError.message).toContain("Cross-tenant access denied");
  });

  it("attaches tenant membership when user is authorized", async () => {
    const alice = await userRepo.upsertUser({
      externalId: "alice_ext",
      email: "alice@domain.com",
    });
    const wsA = await workspaceRepo.createWorkspace({
      name: "Workspace A",
      slug: "ws-a",
      ownerId: alice.id,
    });

    const tenantMiddleware = createTenantMiddleware(workspaceRepo);

    const req = {
      user: alice,
      params: { workspaceId: wsA.id },
      headers: {},
    } as unknown as Request;

    const res = {} as Response;
    let caughtError: any = null;
    const next: NextFunction = (err?: any) => {
      caughtError = err;
    };

    await tenantMiddleware(req, res, next);

    expect(caughtError).toBeUndefined();
    expect(req.membership).toBeDefined();
    expect(req.membership?.role).toBe(WorkspaceRole.OWNER);
    expect(req.membership?.workspaceId).toBe(wsA.id);
  });

  it("enforces RBAC role gates and blocks lower-privileged members with 403 Forbidden", async () => {
    const rbacGuard = requireRole([WorkspaceRole.ADMIN, WorkspaceRole.OWNER]);

    // Viewer / Developer role attempt
    const req = {
      membership: {
        workspaceId: "ws-test",
        userId: "u-1",
        role: WorkspaceRole.DEVELOPER,
      },
    } as unknown as Request;

    const res = {} as Response;
    let caughtError: any = null;
    const next: NextFunction = (err?: any) => {
      caughtError = err;
    };

    rbacGuard(req, res, next);

    expect(caughtError).toBeInstanceOf(ForbiddenError);
    expect(caughtError.statusCode).toBe(403);
    expect(caughtError.message).toContain(
      "Action requires one of the following roles",
    );

    // Admin role attempt -> passes
    req.membership.role = WorkspaceRole.ADMIN;
    let passed = false;
    rbacGuard(req, res, (err) => {
      passed = !err;
    });
    expect(passed).toBe(true);
  });
});
