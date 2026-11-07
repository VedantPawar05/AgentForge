import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import {
  ISandboxDriver,
  SandboxConfig,
  SandboxSecurityLimits,
  CommandExecutionOptions,
  CommandExecutionResult,
  SecurityError,
} from "./types.js";
export { SecurityError };

export interface IProcessRunner {
  spawn(
    command: string,
    args: string[],
    options?: { env?: NodeJS.ProcessEnv; cwd?: string },
  ): ChildProcess;
}

export const DEFAULT_SECURITY_LIMITS: SandboxSecurityLimits = {
  cpuLimit: 2.0,
  memoryLimitMb: 2048,
  pidsLimit: 100,
  timeoutSeconds: 300,
  readOnlyRoot: true,
  allowNetwork: false,
};

/**
 * List of forbidden IP addresses, CIDRs, and hostnames to block SSRF attacks against cloud metadata services.
 */
export const FORBIDDEN_SSRF_TARGETS = [
  "169.254.169.254", // AWS / GCP / Azure Instance Metadata Service
  "metadata.google.internal",
  "169.254.170.2", // AWS ECS Task Metadata
  "100.100.100.200", // Alibaba Cloud Metadata
  "localhost",
  "127.0.0.1",
  "::1",
];

export class DockerSandboxDriver implements ISandboxDriver {
  public readonly driverName = "docker";
  private config?: SandboxConfig;
  private limits: SandboxSecurityLimits = DEFAULT_SECURITY_LIMITS;
  private containerName?: string;
  private isProvisioned = false;
  private isDestroyed = false;

  constructor(
    private readonly runner: IProcessRunner = {
      spawn: (cmd, args, opts) => spawn(cmd, args, opts),
    },
  ) {}

  /**
   * Validates relative file paths to strictly prevent path traversal outside workspace.
   */
  public validatePath(relativePath: string): string {
    if (!relativePath || typeof relativePath !== "string") {
      throw new SecurityError("Invalid path specified");
    }

    // Reject null bytes
    if (relativePath.includes("\0")) {
      throw new SecurityError("Path contains null bytes");
    }

    // Disallow absolute paths or Windows drive letters
    if (path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath)) {
      throw new SecurityError(
        `Absolute paths are not allowed: ${relativePath}`,
      );
    }

    // Normalize and check for traversal
    const normalized = path.normalize(relativePath).replace(/\\/g, "/");
    if (
      normalized.startsWith("../") ||
      normalized === ".." ||
      normalized.includes("/../")
    ) {
      throw new SecurityError(`Directory traversal attempted: ${relativePath}`);
    }

    return normalized;
  }

  /**
   * Asserts whether a network destination is allowed or blocked by SSRF filters.
   */
  public assertNetworkAllowed(targetUrlOrHost: string): void {
    if (!this.limits.allowNetwork) {
      throw new SecurityError(
        `Network access is strictly disabled for this sandbox.`,
      );
    }

    let hostname = targetUrlOrHost.toLowerCase().trim();
    try {
      if (hostname.startsWith("http://") || hostname.startsWith("https://")) {
        const parsed = new URL(hostname);
        hostname = parsed.hostname;
      }
    } catch {
      // Use raw hostname if not a full URL
    }

    // Check against forbidden SSRF targets
    for (const forbidden of FORBIDDEN_SSRF_TARGETS) {
      if (hostname === forbidden || hostname.endsWith(`.${forbidden}`)) {
        throw new SecurityError(
          `SSRF blocked: Access to metadata or loopback address "${targetUrlOrHost}" is forbidden`,
        );
      }
    }

    // Check link-local range (169.254.x.x)
    if (hostname.startsWith("169.254.")) {
      throw new SecurityError(
        `SSRF blocked: Access to link-local range "${targetUrlOrHost}" is forbidden`,
      );
    }
  }

  /**
   * Generates hardened Docker run CLI arguments.
   */
  public getDockerRunArgs(config: SandboxConfig): string[] {
    const limits = { ...DEFAULT_SECURITY_LIMITS, ...config.limits };
    const containerName = `agentforge-sandbox-${config.sandboxId}`;
    const image = config.image ?? "node:20-alpine";

    const args: string[] = [
      "run",
      "-d",
      "--name",
      containerName,
      "--user",
      "1000:1000",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--cpus",
      String(limits.cpuLimit),
      "--memory",
      `${limits.memoryLimitMb}m`,
      "--pids-limit",
      String(limits.pidsLimit),
      "--workdir",
      "/workspace",
      "-v",
      `${path.resolve(config.workspaceDir)}:/workspace:rw`,
    ];

    if (limits.readOnlyRoot) {
      args.push("--read-only");
      args.push("--tmpfs", "/tmp:rw,noexec,nosuid,size=64m");
    }

    if (!limits.allowNetwork) {
      args.push("--network", "none");
    }

    // Pass environment variables safely
    if (config.env) {
      for (const [key, val] of Object.entries(config.env)) {
        args.push("-e", `${key}=${val}`);
      }
    }

    args.push(image);
    args.push("sleep", "infinity");

    return args;
  }

  public async provision(config: SandboxConfig): Promise<void> {
    this.config = config;
    this.limits = { ...DEFAULT_SECURITY_LIMITS, ...config.limits };
    this.containerName = `agentforge-sandbox-${config.sandboxId}`;

    // Ensure workspace directory exists
    await fs.mkdir(config.workspaceDir, { recursive: true });

    const args = this.getDockerRunArgs(config);
    const result = await this.runProcess("docker", args, { timeoutMs: 30000 });
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to provision Docker sandbox container: ${result.stderr || result.stdout}`,
      );
    }

    this.isProvisioned = true;
    this.isDestroyed = false;
  }

  public async executeCommand(
    command: string,
    args: string[] = [],
    options: CommandExecutionOptions = {},
  ): Promise<CommandExecutionResult> {
    if (!this.isProvisioned || this.isDestroyed || !this.containerName) {
      throw new Error("Sandbox is not provisioned or has been destroyed");
    }

    // Build docker exec command
    const execArgs = ["exec", "-i"];
    if (options.cwd) {
      execArgs.push("-w", options.cwd);
    }
    if (options.env) {
      for (const [k, v] of Object.entries(options.env)) {
        execArgs.push("-e", `${k}=${v}`);
      }
    }

    execArgs.push(this.containerName, command, ...args);

    const timeoutMs = options.timeoutMs ?? this.limits.timeoutSeconds * 1000;
    return this.runProcess("docker", execArgs, {
      timeoutMs,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
    });
  }

  public async writeFile(
    relativePath: string,
    content: string | Buffer,
  ): Promise<void> {
    if (!this.config) {
      throw new Error("Sandbox is not provisioned");
    }
    const safeRel = this.validatePath(relativePath);
    const targetFile = path.join(this.config.workspaceDir, safeRel);
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, content);
  }

  public async readFile(relativePath: string): Promise<string> {
    if (!this.config) {
      throw new Error("Sandbox is not provisioned");
    }
    const safeRel = this.validatePath(relativePath);
    const targetFile = path.join(this.config.workspaceDir, safeRel);
    return fs.readFile(targetFile, "utf-8");
  }

  public async getDiff(baseBranch = "main"): Promise<string> {
    if (!this.config) {
      throw new Error("Sandbox is not provisioned");
    }
    const res = await this.runProcess("git", ["diff", baseBranch], {
      cwd: this.config.workspaceDir,
    });
    return res.stdout;
  }

  public async destroy(): Promise<void> {
    if (this.containerName) {
      try {
        await this.runProcess("docker", ["rm", "-f", this.containerName], {
          timeoutMs: 10000,
        });
      } catch {
        // Container might already be stopped
      }
    }
    this.isProvisioned = false;
    this.isDestroyed = true;
  }

  private runProcess(
    cmd: string,
    args: string[],
    opts: {
      cwd?: string;
      timeoutMs?: number;
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
    } = {},
  ): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const child = this.runner.spawn(cmd, args, { cwd: opts.cwd });

      let timer: NodeJS.Timeout | undefined;
      if (opts.timeoutMs && opts.timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          try {
            child.kill("SIGTERM");
            setTimeout(() => {
              try {
                child.kill("SIGKILL");
              } catch {
                // Process already exited
              }
            }, 1000);
          } catch {
            // Already dead
          }
        }, opts.timeoutMs);
      }

      child.stdout?.on("data", (data) => {
        const text = data.toString();
        stdout += text;
        opts.onStdout?.(text);
      });

      child.stderr?.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        opts.onStderr?.(text);
      });

      child.on("error", (err) => {
        if (timer) clearTimeout(timer);
        resolve({
          stdout,
          stderr: stderr || err.message,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          timedOut,
        });
      });

      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: timedOut ? 124 : (code ?? 0),
          durationMs: Date.now() - startTime,
          timedOut,
        });
      });
    });
  }
}
