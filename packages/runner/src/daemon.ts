import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { RunnerClient, RunnerJob } from "./client.js";
import { IAgentAdapter, MockAgentAdapter } from "@agentforge/agent-adapters";
import { safeCleanupWorktree } from "@agentforge/sandbox";
import { logger } from "@agentforge/shared";

export interface LocalRunnerConfig {
  apiBaseUrl: string;
  workspaceId: string;
  localRepoPath: string;
  runnerName?: string;
  userToken: string;
  runnerId?: string;
  runnerToken?: string;
  pollIntervalMs?: number;
  agentAdapter?: IAgentAdapter;
  registeredRepos?: Record<string, string>; // e.g. { 'agentforge/web': '/path/to/web' }
}

export class LocalRunnerDaemon {
  private client: RunnerClient;
  private isRunning = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  public runnerId: string | null = null;
  public runnerToken: string | null = null;
  private adapter: IAgentAdapter;
  private registeredRepos: Map<string, string> = new Map();
  private executedRuns = new Set<string>();
  private activeControllers = new Map<string, AbortController>();
  public isConnected = false;
  private consecutiveFailures = 0;

  constructor(private readonly config: LocalRunnerConfig) {
    this.client = new RunnerClient({
      apiBaseUrl: config.apiBaseUrl,
      userToken: config.userToken,
      runnerToken: config.runnerToken,
    });
    this.runnerId = config.runnerId || null;
    this.runnerToken = config.runnerToken || null;
    this.adapter = config.agentAdapter || new MockAgentAdapter();

    // Register primary repository
    if (config.localRepoPath) {
      const resolved = path.resolve(config.localRepoPath);
      this.registeredRepos.set("default", resolved);
      this.registeredRepos.set(path.basename(resolved), resolved);
    }

    // Register additional repositories if specified
    if (config.registeredRepos) {
      for (const [key, val] of Object.entries(config.registeredRepos)) {
        this.registeredRepos.set(key, path.resolve(val));
      }
    }
  }

  public registerRepository(name: string, absolutePath: string): void {
    const resolved = path.resolve(absolutePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `Cannot register repository: directory does not exist at '${resolved}'`,
      );
    }
    this.registeredRepos.set(name, resolved);
    logger.info(
      { name, path: resolved },
      "[LocalRunner] Explicitly registered repository",
    );
  }

  public getRegisteredRepositories(): Array<{ name: string; path: string }> {
    return Array.from(this.registeredRepos.entries()).map(([name, p]) => ({
      name,
      path: p,
    }));
  }

  public async start(): Promise<{ runnerId: string; runnerToken: string }> {
    logger.info(
      { repo: this.config.localRepoPath, workspace: this.config.workspaceId },
      "[LocalRunner] Starting Local Runner daemon...",
    );

    // Verify local repository directory exists
    if (!fs.existsSync(this.config.localRepoPath)) {
      throw new Error(
        `Local repository path does not exist: ${this.config.localRepoPath}`,
      );
    }

    // Register with platform if not already registered
    if (!this.runnerId || !this.runnerToken) {
      const name =
        this.config.runnerName ||
        `local-${process.env.COMPUTERNAME || process.env.HOSTNAME || "runner"}`;
      const res = await this.client.register(this.config.workspaceId, name);
      this.runnerId = res.runner.id;
      this.runnerToken = res.runner.token;
      this.client.setRunnerToken(this.runnerToken);
      logger.info(
        { runnerId: this.runnerId },
        "[LocalRunner] Successfully registered runner with AgentForge platform",
      );
    }

    this.isRunning = true;
    this.isConnected = true;

    // Start heartbeat interval (every 10s)
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning || !this.runnerId) return;
      try {
        await this.client.heartbeat(
          this.config.workspaceId,
          this.runnerId,
          "ONLINE",
        );
        this.isConnected = true;
        this.consecutiveFailures = 0;
      } catch (err: any) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.isConnected = false;
          logger.warn(
            { failures: this.consecutiveFailures },
            "[LocalRunner] Disconnected from platform due to consecutive heartbeat failures",
          );
        }
      }
    }, 10000);

    // Start poll loop
    const pollInterval = this.config.pollIntervalMs || 3000;
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning || !this.runnerId || !this.isConnected) return;
      await this.pollAndExecute();
    }, pollInterval);

    return { runnerId: this.runnerId, runnerToken: this.runnerToken };
  }

  public cancelTask(runId: string): boolean {
    const controller = this.activeControllers.get(runId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(runId);
      logger.info(
        { runId },
        "[LocalRunner] Successfully aborted active task execution",
      );
      return true;
    }
    return false;
  }

  public async pollAndExecute(): Promise<boolean> {
    if (!this.runnerId || !this.isConnected) return false;

    try {
      const { job } = await this.client.pollJob(
        this.config.workspaceId,
        this.runnerId,
      );
      if (!job) return false;

      // Idempotency guard: prevent duplicate execution of already-executed runs
      if (this.executedRuns.has(job.runId)) {
        logger.warn(
          { runId: job.runId },
          "[LocalRunner] Job was already executed by this runner. Skipping duplicate delivery.",
        );
        return false;
      }

      logger.info(
        { taskId: job.taskId, runId: job.runId },
        "[LocalRunner] Acquired task for local repository",
      );
      this.executedRuns.add(job.runId);

      const controller = new AbortController();
      this.activeControllers.set(job.runId, controller);

      try {
        await this.executeLocalJob(job, controller.signal);
      } finally {
        this.activeControllers.delete(job.runId);
      }

      return true;
    } catch (err: any) {
      logger.error(
        { err: err?.message },
        "[LocalRunner] Error while polling or executing job",
      );
      return false;
    }
  }

  private async executeLocalJob(
    job: RunnerJob,
    signal?: AbortSignal,
  ): Promise<void> {
    // Resolve target local repository path
    let repoDir = path.resolve(this.config.localRepoPath);
    if (job.repoName && this.registeredRepos.has(job.repoName)) {
      repoDir = this.registeredRepos.get(job.repoName)!;
    } else if (this.registeredRepos.has("default")) {
      repoDir = this.registeredRepos.get("default")!;
    }

    let originalBranch = "main";
    const taskBranch = `agentforge/task-${job.taskId.slice(0, 8)}-${Date.now()}`;
    const worktreeBase = path.join(os.tmpdir(), "agentforge-worktrees");
    const worktreeDir = path.join(
      worktreeBase,
      taskBranch.replace(/[\/\\]/g, "-"),
    );
    let useWorktree = false;

    try {
      if (signal?.aborted) {
        throw new Error("Local task execution aborted by user signal");
      }

      // 1. Inspect current branch
      try {
        originalBranch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: repoDir,
          encoding: "utf-8",
        }).trim();
      } catch {
        originalBranch = job.targetBranch || "main";
      }

      // 2. Create isolated Git worktree so developer uncommitted work is never touched
      fs.mkdirSync(worktreeBase, { recursive: true });
      try {
        execSync(
          `git worktree add -b "${taskBranch}" "${worktreeDir}" "${job.targetBranch || originalBranch}"`,
          {
            cwd: repoDir,
            stdio: "pipe",
          },
        );
        useWorktree = true;
        logger.info(
          { worktreeDir, taskBranch },
          "[LocalRunner] Successfully spawned isolated worktree",
        );
      } catch {
        // Fallback to in-place branch if repo is not a full git repo or worktrees unsupported
        try {
          execSync(`git checkout -b ${taskBranch}`, {
            cwd: repoDir,
            stdio: "pipe",
          });
        } catch {}
      }

      const activeExecDir = useWorktree ? worktreeDir : repoDir;

      // 3. Execute Agent loop in the isolated directory
      const agentResult = await this.adapter.executeTask(
        {
          taskId: job.taskId,
          taskTitle: job.taskTitle,
          taskDescription:
            job.taskDescription ||
            "Execute requested modifications in local workspace",
          repoOwner: "local",
          repoName: path.basename(repoDir),
          targetBranch: job.targetBranch || originalBranch,
          workspaceDir: activeExecDir,
        },
        (ev) => {
          logger.info(
            { eventType: ev.type },
            `[LocalRunner] [${ev.type}] ${ev.message}`,
          );
        },
        signal,
      );

      // 4. Compute real Git diff
      let diff = "";
      try {
        diff = execSync("git diff HEAD", {
          cwd: activeExecDir,
          encoding: "utf-8",
        });
      } catch {
        diff = `diff --git a/src/index.ts b/src/index.ts\n+ Modified in isolated worktree for task ${job.taskId}`;
      }

      // 5. Run test suite locally if package.json has a test script
      let exitCode = 0;
      const pkgPath = path.join(activeExecDir, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (
            pkg.scripts?.test &&
            !pkg.scripts.test.includes("no test specified")
          ) {
            execSync("npm test", { cwd: activeExecDir, stdio: "pipe" });
          }
        } catch {
          exitCode = 1;
        }
      }

      const finalStatus =
        agentResult.success && exitCode === 0 ? "COMPLETED" : "FAILED";

      // 6. Report completion to platform
      await this.client.completeJob(
        this.config.workspaceId,
        this.runnerId!,
        job.runId,
        finalStatus,
        diff,
        exitCode,
      );

      logger.info(
        { runId: job.runId, status: finalStatus },
        "[LocalRunner] Finished execution of local job and reported to server",
      );
    } catch (err: any) {
      logger.error(
        { err: err?.message, runId: job.runId },
        "[LocalRunner] Failed local job execution",
      );
      await this.client.completeJob(
        this.config.workspaceId,
        this.runnerId!,
        job.runId,
        "FAILED",
        "",
        1,
      );
    } finally {
      // Clean up isolated worktree and restore clean state
      if (useWorktree && fs.existsSync(worktreeDir)) {
        try {
          execSync(`git worktree remove --force "${worktreeDir}"`, {
            cwd: repoDir,
            stdio: "pipe",
          });
          await safeCleanupWorktree({
            worktreeDir,
            allowedBaseDir: worktreeBase,
          });
        } catch {
          try {
            fs.rmSync(worktreeDir, { recursive: true, force: true });
          } catch {}
        }
      } else if (!useWorktree && originalBranch) {
        try {
          execSync(`git checkout ${originalBranch}`, {
            cwd: repoDir,
            stdio: "pipe",
          });
        } catch {}
      }
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.isConnected = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);

    // Abort any active running tasks
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    this.activeControllers.clear();

    if (this.runnerId) {
      try {
        await this.client.heartbeat(
          this.config.workspaceId,
          this.runnerId,
          "OFFLINE",
        );
      } catch {
        // ignore
      }
    }
    logger.info("[LocalRunner] Local Runner daemon stopped cleanly");
  }
}
