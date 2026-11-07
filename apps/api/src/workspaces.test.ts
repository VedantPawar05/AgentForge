import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryAuditRepository,
} from "@agentforge/db";
import { AuthService } from "./auth/auth-service.js";
import { WorkspaceService } from "./services/workspace-service.js";
import { WorkspaceRole } from "@agentforge/shared";

describe("Phase 2: Authentication, Multi-Tenancy & Authorization", () => {
  let userRepo: InMemoryUserRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let auditRepo: InMemoryAuditRepository;
  let authService: AuthService;
  let workspaceService: WorkspaceService;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    auditRepo = new InMemoryAuditRepository();
    authService = new AuthService(userRepo);
    workspaceService = new WorkspaceService(workspaceRepo, userRepo, auditRepo);

    app = createApp({
      userRepo,
      workspaceRepo,
      auditRepo,
      authService,
      workspaceService,
    });
  });

  it("synchronizes user identity and handles /v1/auth/me", async () => {
    // 1. Sync User
    const syncRes = await request(app).post("/v1/auth/sync").send({
      externalId: "ext_alice",
      email: "alice@example.com",
      fullName: "Alice Engineer",
    });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.user.email).toBe("alice@example.com");

    // 2. Auth /me with Bearer token
    const meRes = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer alice@example.com");

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("alice@example.com");
    expect(meRes.body.workspaces).toEqual([]);
  });

  it("rejects unauthenticated requests to protected endpoints", async () => {
    const res = await request(app).get("/v1/workspaces");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates workspace and assigns creator as OWNER", async () => {
    const res = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer alice@example.com")
      .send({
        name: "Acme Corp",
        slug: "acme-corp",
      });

    expect(res.status).toBe(201);
    expect(res.body.workspace.name).toBe("Acme Corp");
    expect(res.body.workspace.slug).toBe("acme-corp");

    // Check membership
    const membersRes = await request(app)
      .get(`/v1/workspaces/${res.body.workspace.id}/members`)
      .set("Authorization", "Bearer alice@example.com");

    expect(membersRes.status).toBe(200);
    expect(membersRes.body.members.length).toBe(1);
    expect(membersRes.body.members[0].role).toBe(WorkspaceRole.OWNER);

    // Verify audit log recorded
    const auditRes = await request(app)
      .get(`/v1/workspaces/${res.body.workspace.id}/audit-logs`)
      .set("Authorization", "Bearer alice@example.com");

    expect(auditRes.status).toBe(200);
    expect(
      auditRes.body.logs.some((l: any) => l.action === "WORKSPACE_CREATED"),
    ).toBe(true);
  });

  it("rejects duplicate workspace slugs with 409 Conflict", async () => {
    await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer alice@example.com")
      .send({ name: "Acme Corp", slug: "acme" });

    const duplicateRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer bob@example.com")
      .send({ name: "Acme Other", slug: "acme" });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe("CONFLICT");
  });

  it("strictly isolates workspaces: rejects cross-tenant access with 403 Forbidden", async () => {
    // Alice creates Workspace A
    const wsARes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer alice@example.com")
      .send({ name: "Workspace A", slug: "workspace-a" });
    const wsAId = wsARes.body.workspace.id;

    // Bob creates Workspace B
    const wsBRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer bob@example.com")
      .send({ name: "Workspace B", slug: "workspace-b" });
    const wsBId = wsBRes.body.workspace.id;

    // Bob attempts to access Workspace A -> 403 Forbidden
    const crossAccessRes = await request(app)
      .get(`/v1/workspaces/${wsAId}`)
      .set("Authorization", "Bearer bob@example.com");

    expect(crossAccessRes.status).toBe(403);
    expect(crossAccessRes.body.error.code).toBe("FORBIDDEN");
    expect(crossAccessRes.body.error.message).toContain(
      "Cross-tenant access denied",
    );

    // Alice attempts to access Workspace B -> 403 Forbidden
    const crossAccessRes2 = await request(app)
      .get(`/v1/workspaces/${wsBId}`)
      .set("Authorization", "Bearer alice@example.com");

    expect(crossAccessRes2.status).toBe(403);
  });

  it("handles member invitation, token acceptance, and RBAC role gating", async () => {
    // 1. Alice creates Workspace
    const wsRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer alice@example.com")
      .send({ name: "Cloud Engineering", slug: "cloud-eng" });
    const wsId = wsRes.body.workspace.id;

    // 2. Alice invites Charlie as DEVELOPER
    const inviteRes = await request(app)
      .post(`/v1/workspaces/${wsId}/invitations`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        email: "charlie@example.com",
        role: WorkspaceRole.DEVELOPER,
      });

    expect(inviteRes.status).toBe(201);
    const token = inviteRes.body.invitation.token;
    expect(token).toBeDefined();

    // 3. Charlie accepts invitation
    const acceptRes = await request(app)
      .post("/v1/invitations/accept")
      .set("Authorization", "Bearer charlie@example.com")
      .send({ token });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.membership.role).toBe(WorkspaceRole.DEVELOPER);

    // 4. Charlie can now view workspace
    const charlieView = await request(app)
      .get(`/v1/workspaces/${wsId}`)
      .set("Authorization", "Bearer charlie@example.com");
    expect(charlieView.status).toBe(200);

    // 5. Charlie (DEVELOPER) attempts admin action (updating workspace name) -> 403 Forbidden
    const adminActionRes = await request(app)
      .patch(`/v1/workspaces/${wsId}`)
      .set("Authorization", "Bearer charlie@example.com")
      .send({ name: "Hacked Name" });

    expect(adminActionRes.status).toBe(403);
    expect(adminActionRes.body.error.message).toContain(
      "Action requires one of the following roles: [ADMIN, OWNER]",
    );

    // 6. Alice promotes Charlie to ADMIN
    const charlieUserId = acceptRes.body.membership.userId;
    const promoteRes = await request(app)
      .patch(`/v1/workspaces/${wsId}/members/${charlieUserId}`)
      .set("Authorization", "Bearer alice@example.com")
      .send({ role: WorkspaceRole.ADMIN });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.membership.role).toBe(WorkspaceRole.ADMIN);

    // 7. Charlie (now ADMIN) can update workspace
    const updateRes = await request(app)
      .patch(`/v1/workspaces/${wsId}`)
      .set("Authorization", "Bearer charlie@example.com")
      .send({ name: "Cloud Platform Engineering" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.workspace.name).toBe("Cloud Platform Engineering");

    // 8. Attempting to demote or remove the last remaining OWNER (Alice) is blocked
    const aliceUserId = wsRes.body.workspace.ownerId;
    const demoteOwnerRes = await request(app)
      .patch(`/v1/workspaces/${wsId}/members/${aliceUserId}`)
      .set("Authorization", "Bearer charlie@example.com")
      .send({ role: WorkspaceRole.DEVELOPER });

    expect(demoteOwnerRes.status).toBe(403);
    expect(demoteOwnerRes.body.error.message).toContain(
      "Cannot demote the last remaining Owner",
    );
  });
});
