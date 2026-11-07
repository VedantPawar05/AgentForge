import fs from "node:fs";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "@agentforge/shared";
import { randomBytes, createSign, createHmac, timingSafeEqual } from "crypto";

export interface GitHubRepositoryInfo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  cloneUrl: string;
}

export interface PullRequestDetails {
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  mergeable: boolean | null;
  htmlUrl: string;
  headBranch: string;
  baseBranch: string;
}

export interface IGitHubService {
  getInstallationToken(
    installationId: string,
  ): Promise<{ token: string; expiresAt: Date }>;
  listRepositories(installationId: string): Promise<GitHubRepositoryInfo[]>;
  createTaskBranch(
    installationId: string,
    owner: string,
    repo: string,
    baseBranch: string,
    taskId: string,
  ): Promise<{ branchName: string; commitSha: string }>;
  pushChanges(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
  ): Promise<{ commitSha: string }>;
  createPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    title: string,
    headBranch: string,
    baseBranch: string,
    body?: string,
  ): Promise<PullRequestDetails>;
  getPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestDetails>;
  mergeBranch(
    installationId: string,
    owner: string,
    repo: string,
    baseBranch: string,
    headBranch: string,
    commitMessage: string,
  ): Promise<{ mergeCommitSha: string }>;
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean;
}

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  apiBaseUrl?: string;
  webhookSecret?: string;
}

/**
 * Production GitHub App integration using RS256 JWT signing and GitHub REST API
 */
export class RealGitHubService implements IGitHubService {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly apiBaseUrl: string;
  private readonly webhookSecret?: string;

  constructor(config: GitHubAppConfig) {
    this.appId = config.appId;
    this.privateKey = config.privateKey;
    this.apiBaseUrl =
      config.apiBaseUrl?.replace(/\/$/, "") || "https://api.github.com";
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Cryptographically signs a GitHub App JWT with RS256
   */
  public generateAppJwt(): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iat: nowSec - 60, // 60s in past for clock drift
        exp: nowSec + 600, // 10 minutes maximum valid lifetime
        iss: this.appId,
      }),
    ).toString("base64url");

    const unsigned = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    const signature = signer.sign(this.privateKey, "base64url");

    return `${unsigned}.${signature}`;
  }

  public async getInstallationToken(
    installationId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const jwt = this.generateAppJwt();
    const res = await fetch(
      `${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new UnauthorizedError(
        `Failed to generate installation token for '${installationId}': ${err}`,
      );
    }

    const data: any = await res.json();
    return {
      token: data.token,
      expiresAt: new Date(data.expires_at),
    };
  }

  public async listRepositories(
    installationId: string,
  ): Promise<GitHubRepositoryInfo[]> {
    const { token } = await this.getInstallationToken(installationId);
    const res = await fetch(
      `${this.apiBaseUrl}/installation/repositories?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new NotFoundError("GitHub App Repositories", err);
    }

    const data: any = await res.json();
    return (data.repositories || []).map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || "",
      defaultBranch: repo.default_branch || "main",
      isPrivate: Boolean(repo.private),
      cloneUrl: repo.clone_url,
    }));
  }

  public async createTaskBranch(
    installationId: string,
    owner: string,
    repo: string,
    baseBranch: string,
    taskId: string,
  ): Promise<{ branchName: string; commitSha: string }> {
    const { token } = await this.getInstallationToken(installationId);

    // 1. Get base branch commit SHA
    const refRes = await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!refRes.ok) {
      throw new NotFoundError("Base branch", baseBranch);
    }

    const refData: any = await refRes.json();
    const baseSha = refData.object?.sha;

    // 2. Create isolated task branch
    const branchName = `agentforge/task-${taskId.slice(0, 8)}-${Date.now()}`;
    const createRes = await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/git/refs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      },
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new ConflictError(
        `Failed to create task branch '${branchName}': ${err}`,
      );
    }

    return {
      branchName,
      commitSha: baseSha,
    };
  }

  public async pushChanges(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
  ): Promise<{ commitSha: string }> {
    const { token } = await this.getInstallationToken(installationId);

    // Get current branch head
    const refRes = await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!refRes.ok) throw new NotFoundError("Branch", branch);
    const refData: any = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // Create blobs & tree
    const treePayload = {
      base_tree: latestCommitSha,
      tree: files.map((f) => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        content: f.content,
      })),
    };

    const treeRes = await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify(treePayload),
      },
    );
    const treeData: any = await treeRes.json();

    // Create commit
    const commitRes = await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: commitMessage,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      },
    );
    const commitData: any = await commitRes.json();

    // Update branch ref
    await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({ sha: commitData.sha }),
      },
    );

    return { commitSha: commitData.sha };
  }

  public async createPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    title: string,
    headBranch: string,
    baseBranch: string,
    body?: string,
  ): Promise<PullRequestDetails> {
    const { token } = await this.getInstallationToken(installationId);
    const res = await fetch(`${this.apiBaseUrl}/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title,
        head: headBranch,
        base: baseBranch,
        body:
          body ||
          `Automated Pull Request created by AgentForge for branch ${headBranch}`,
        maintainer_can_modify: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new ConflictError(`Failed to create pull request: ${err}`);
    }

    const pr: any = await res.json();
    return {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: Boolean(pr.merged),
      mergeable: pr.mergeable ?? null,
      htmlUrl: pr.html_url,
      headBranch: pr.head?.ref || headBranch,
      baseBranch: pr.base?.ref || baseBranch,
    };
  }

  public async getPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestDetails> {
    const { token } = await this.getInstallationToken(installationId);
    const res = await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!res.ok) {
      throw new NotFoundError("Pull Request", String(pullNumber));
    }

    const pr: any = await res.json();
    return {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: Boolean(pr.merged),
      mergeable: pr.mergeable ?? null,
      htmlUrl: pr.html_url,
      headBranch: pr.head?.ref,
      baseBranch: pr.base?.ref,
    };
  }

  public async mergeBranch(
    installationId: string,
    owner: string,
    repo: string,
    baseBranch: string,
    headBranch: string,
    commitMessage: string,
  ): Promise<{ mergeCommitSha: string }> {
    const { token } = await this.getInstallationToken(installationId);
    const res = await fetch(
      `${this.apiBaseUrl}/repos/${owner}/${repo}/merges`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          base: baseBranch,
          head: headBranch,
          commit_message: commitMessage,
        }),
      },
    );

    if (res.status === 409) {
      throw new ConflictError(
        `Merge conflict between '${headBranch}' and '${baseBranch}'`,
      );
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to merge branch: ${err}`);
    }

    const data: any = await res.json();
    return { mergeCommitSha: data.sha };
  }

  public verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secretOverride?: string,
  ): boolean {
    const secret = secretOverride || this.webhookSecret;
    if (!secret || !signature) return false;

    try {
      const rawBody =
        typeof payload === "string" ? Buffer.from(payload, "utf-8") : payload;
      const hmac = createHmac("sha256", secret);
      hmac.update(rawBody);
      const expected = `sha256=${hmac.digest("hex")}`;

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);

      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }
}

/**
 * Mock GitHub Service for unit testing and local development
 */
export class MockGitHubService implements IGitHubService {
  public installations = new Map<string, GitHubRepositoryInfo[]>();
  public branches = new Map<string, { [branchName: string]: string }>();
  public pullRequests = new Map<string, PullRequestDetails>();

  constructor() {
    const defaultRepos: GitHubRepositoryInfo[] = [
      {
        id: 101,
        name: "web-service",
        fullName: "agentforge/web-service",
        owner: "agentforge",
        defaultBranch: "main",
        isPrivate: true,
        cloneUrl: "https://github.com/agentforge/web-service.git",
      },
      {
        id: 102,
        name: "backend-core",
        fullName: "agentforge/backend-core",
        owner: "agentforge",
        defaultBranch: "main",
        isPrivate: false,
        cloneUrl: "https://github.com/agentforge/backend-core.git",
      },
    ];

    this.installations.set("inst-12345", defaultRepos);
    this.branches.set("agentforge/web-service", { main: "sha_base_00001" });
    this.branches.set("agentforge/backend-core", { main: "sha_base_00002" });
  }

  public async getInstallationToken(
    installationId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    if (!this.installations.has(installationId)) {
      throw new UnauthorizedError(
        `GitHub App installation '${installationId}' not found or revoked`,
      );
    }

    return {
      token: `ghs_mock_${randomBytes(16).toString("hex")}`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  public async listRepositories(
    installationId: string,
  ): Promise<GitHubRepositoryInfo[]> {
    const repos = this.installations.get(installationId);
    if (!repos) {
      throw new NotFoundError("GitHub App Installation", installationId);
    }
    return repos;
  }

  public async createTaskBranch(
    installationId: string,
    owner: string,
    repo: string,
    baseBranch: string,
    taskId: string,
  ): Promise<{ branchName: string; commitSha: string }> {
    await this.getInstallationToken(installationId);

    const repoKey = `${owner}/${repo}`;
    const repoBranches = this.branches.get(repoKey) ?? {
      [baseBranch]: "sha_base_init",
    };

    const baseSha = repoBranches[baseBranch];
    if (!baseSha) {
      throw new NotFoundError("Base branch", baseBranch);
    }

    const branchName = `agentforge/task-${taskId.slice(0, 8)}-${Date.now()}`;
    repoBranches[branchName] = baseSha;
    this.branches.set(repoKey, repoBranches);

    return {
      branchName,
      commitSha: baseSha,
    };
  }

  public async pushChanges(
    installationId: string,
    owner: string,
    repo: string,
    branch: string,
    _files: Array<{ path: string; content: string }>,
    _commitMessage: string,
  ): Promise<{ commitSha: string }> {
    await this.getInstallationToken(installationId);
    const sha = `sha_commit_${randomBytes(8).toString("hex")}`;
    const repoKey = `${owner}/${repo}`;
    const repoBranches = this.branches.get(repoKey) ?? {};
    repoBranches[branch] = sha;
    this.branches.set(repoKey, repoBranches);
    return { commitSha: sha };
  }

  public async createPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    title: string,
    headBranch: string,
    baseBranch: string,
    _body?: string,
  ): Promise<PullRequestDetails> {
    await this.getInstallationToken(installationId);
    const prNumber = (this.pullRequests.size || 0) + 1;
    const pr: PullRequestDetails = {
      number: prNumber,
      title,
      state: "open",
      merged: false,
      mergeable: true,
      htmlUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
      headBranch,
      baseBranch,
    };
    this.pullRequests.set(`${owner}/${repo}#${prNumber}`, pr);
    return pr;
  }

  public async getPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestDetails> {
    await this.getInstallationToken(installationId);
    const pr = this.pullRequests.get(`${owner}/${repo}#${pullNumber}`);
    if (!pr) {
      return {
        number: pullNumber,
        title: `PR #${pullNumber}`,
        state: "open",
        merged: false,
        mergeable: true,
        htmlUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
        headBranch: "feat/test",
        baseBranch: "main",
      };
    }
    return pr;
  }

  public async mergeBranch(
    installationId: string,
    owner: string,
    repo: string,
    baseBranch: string,
    headBranch: string,
    _commitMessage: string,
  ): Promise<{ mergeCommitSha: string }> {
    await this.getInstallationToken(installationId);

    const repoKey = `${owner}/${repo}`;
    let repoBranches = this.branches.get(repoKey);
    if (!repoBranches) {
      repoBranches = {
        [baseBranch]: "sha_base_init",
        [headBranch]: "sha_head_init",
      };
      this.branches.set(repoKey, repoBranches);
    }
    if (!repoBranches[baseBranch]) {
      repoBranches[baseBranch] = "sha_base_init";
    }
    if (!repoBranches[headBranch]) {
      repoBranches[headBranch] = "sha_head_init";
    }

    if (headBranch.includes("conflict")) {
      throw new ConflictError(
        `Merge conflict between '${headBranch}' and '${baseBranch}'`,
      );
    }

    const mergeSha = `sha_merge_${randomBytes(8).toString("hex")}`;
    repoBranches[baseBranch] = mergeSha;

    return { mergeCommitSha: mergeSha };
  }

  public verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    if (!secret || !signature) return false;
    try {
      const rawBody =
        typeof payload === "string" ? Buffer.from(payload, "utf-8") : payload;
      const hmac = createHmac("sha256", secret);
      hmac.update(rawBody);
      const expected = `sha256=${hmac.digest("hex")}`;

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }
}

/**
 * Factory creating either RealGitHubService or MockGitHubService depending on environment configuration
 */
export function createGitHubService(): IGitHubService {
  const appId = process.env.GITHUB_APP_ID;
  let privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (
    !privateKey &&
    process.env.GITHUB_APP_PRIVATE_KEY_PATH &&
    fs.existsSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH)
  ) {
    try {
      privateKey = fs.readFileSync(
        process.env.GITHUB_APP_PRIVATE_KEY_PATH,
        "utf-8",
      );
    } catch {}
  }

  if (appId && privateKey && privateKey.includes("BEGIN")) {
    return new RealGitHubService({
      appId,
      privateKey,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    });
  }

  return new MockGitHubService();
}
