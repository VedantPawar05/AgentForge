import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryRunRepository,
  InMemoryOutboxRepository,
  InMemoryAuditRepository,
} from "@agentforge/db";
import { MockGitHubService } from "./integrations/github/github-service.js";

describe("Phase 5: GitHub Integration", () => {
  let userRepo: InMemoryUserRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let githubService: MockGitHubService;
  let app: ReturnType<typeof createApp>;

  let workspaceId: string;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    githubService = new MockGitHubService();

    app = createApp({
      userRepo,
      workspaceRepo,
      projectRepo: new InMemoryProjectRepository(),
      taskRepo: new InMemoryTaskRepository(),
      runRepo: new InMemoryRunRepository(),
      outboxRepo: new InMemoryOutboxRepository(),
      auditRepo: new InMemoryAuditRepository(),
      githubService,
    });

    const wsRes = await request(app)
      .post("/v1/workspaces")
      .set("Authorization", "Bearer alice@example.com")
      .send({ name: "GitHub Integration Org", slug: "gh-org" });
    workspaceId = wsRes.body.workspace.id;
  });

  it("generates GitHub App installation URL", async () => {
    const res = await request(app)
      .get("/v1/integrations/github/install-url")
      .set("Authorization", "Bearer alice@example.com");

    expect(res.status).toBe(200);
    expect(res.body.installUrl).toContain(
      "https://github.com/apps/agentforge-app/installations/new",
    );
  });

  it("lists repositories available to the workspace installation", async () => {
    const res = await request(app)
      .get(
        `/v1/workspaces/${workspaceId}/integrations/github/repos?installationId=inst-12345`,
      )
      .set("Authorization", "Bearer alice@example.com");

    expect(res.status).toBe(200);
    expect(res.body.repositories.length).toBeGreaterThanOrEqual(2);
    expect(res.body.repositories[0].name).toBe("web-service");
  });

  it("creates isolated task branch with controlled credentials", async () => {
    const branchResult = await githubService.createTaskBranch(
      "inst-12345",
      "agentforge",
      "backend-core",
      "main",
      "task-test-uuid",
    );

    expect(branchResult.branchName).toContain("agentforge/task-task-tes");
    expect(branchResult.commitSha).toBeDefined();

    // Verify token expiration is 1 hour
    const tokenResult = await githubService.getInstallationToken("inst-12345");
    expect(tokenResult.token).toMatch(/^ghs_mock_/);
    const diffMs = tokenResult.expiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(3500 * 1000); // ~1 hour
  });

  it("simulates branch merging and conflict detection", async () => {
    // Valid merge
    const merge = await githubService.mergeBranch(
      "inst-12345",
      "agentforge",
      "backend-core",
      "main",
      "main",
      "Merge task branch",
    );
    expect(merge.mergeCommitSha).toMatch(/^sha_merge_/);

    // Merge conflict detection
    await expect(
      githubService.mergeBranch(
        "inst-12345",
        "agentforge",
        "backend-core",
        "main",
        "feature-conflict-branch",
        "Conflicting PR",
      ),
    ).rejects.toThrow();
  });

  it("pushes approved code changes and updates branch commit ref", async () => {
    const pushResult = await githubService.pushChanges(
      "inst-12345",
      "agentforge",
      "backend-core",
      "agentforge/task-branch-01",
      [
        {
          path: "src/rate-limiter.ts",
          content: "export const limiter = true;",
        },
      ],
      "Implement rate limiting middleware",
    );

    expect(pushResult.commitSha).toMatch(/^sha_commit_/);
  });

  it("creates and retrieves a pull request via REST API", async () => {
    const createRes = await request(app)
      .post(`/v1/workspaces/${workspaceId}/integrations/github/pull-requests`)
      .set("Authorization", "Bearer alice@example.com")
      .send({
        owner: "agentforge",
        repo: "backend-core",
        title: "feat: add rate limiting middleware",
        headBranch: "agentforge/task-auth-01",
        baseBranch: "main",
        body: "Automated changes synthesized by AgentForge.",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.pullRequest.number).toBeDefined();
    expect(createRes.body.pullRequest.title).toBe(
      "feat: add rate limiting middleware",
    );

    const prNum = createRes.body.pullRequest.number;
    const getRes = await request(app)
      .get(
        `/v1/workspaces/${workspaceId}/integrations/github/pull-requests/${prNum}?owner=agentforge&repo=backend-core`,
      )
      .set("Authorization", "Bearer alice@example.com");

    expect(getRes.status).toBe(200);
    expect(getRes.body.pullRequest.title).toBe(
      "feat: add rate limiting middleware",
    );
  });

  it("verifies GitHub webhook HMAC-SHA256 signature", async () => {
    const secret = "mock_webhook_secret";
    const payload = JSON.stringify({
      action: "opened",
      repository: { full_name: "agentforge/backend-core" },
    });

    const crypto = await import("crypto");
    const validSig = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;

    // Valid signature passes
    const validRes = await request(app)
      .post("/v1/integrations/github/webhook")
      .set("x-hub-signature-256", validSig)
      .set("Content-Type", "application/json")
      .send(payload);
    expect(validRes.status).toBe(200);
    expect(validRes.body.received).toBe(true);

    // Forged signature fails with 401
    const invalidRes = await request(app)
      .post("/v1/integrations/github/webhook")
      .set("x-hub-signature-256", "sha256=badf00dbadf00dbadf00dbadf00dbadf00d")
      .set("Content-Type", "application/json")
      .send(payload);
    expect(invalidRes.status).toBe(401);
  });

  it("RealGitHubService signs RS256 JWT using GitHub App private key", async () => {
    const crypto = await import("crypto");
    const { RealGitHubService } =
      await import("./integrations/github/github-service.js");

    // Generate real ephemeral RSA key pair for testing
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const realService = new RealGitHubService({
      appId: "gh-app-998877",
      privateKey,
    });

    const jwt = realService.generateAppJwt();
    const parts = jwt.split(".");
    expect(parts.length).toBe(3);

    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf-8"),
    );
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    );

    expect(header.alg).toBe("RS256");
    expect(header.typ).toBe("JWT");
    expect(payload.iss).toBe("gh-app-998877");
    expect(payload.exp - payload.iat).toBe(660);
  });
});
