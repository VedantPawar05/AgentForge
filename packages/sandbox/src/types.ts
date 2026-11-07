/**
 * Sandbox Execution Types & Driver Interfaces
 */

export class SecurityError extends Error {
  constructor(message: string) {
    super(`[Sandbox Security Violation] ${message}`);
    this.name = "SecurityError";
  }
}

export interface SandboxSecurityLimits {
  /** Maximum CPU cores (e.g., 2.0) */
  cpuLimit: number;
  /** Maximum RAM in MB (e.g., 2048) */
  memoryLimitMb: number;
  /** Maximum number of processes/threads to prevent fork bombs (e.g., 100) */
  pidsLimit: number;
  /** Maximum wall-clock execution timeout in seconds */
  timeoutSeconds: number;
  /** Whether host root filesystem is mounted read-only */
  readOnlyRoot: boolean;
  /** Whether outbound network access is enabled */
  allowNetwork: boolean;
}

export interface SandboxConfig {
  sandboxId: string;
  workspaceDir: string;
  image?: string;
  limits?: Partial<SandboxSecurityLimits>;
  env?: Record<string, string>;
}

export interface CommandExecutionOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface CommandExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

export interface ISandboxDriver {
  readonly driverName: string;

  /** Provisions a fresh isolated environment */
  provision(config: SandboxConfig): Promise<void>;

  /** Executes an isolated command within the sandbox */
  executeCommand(
    command: string,
    args: string[],
    options?: CommandExecutionOptions,
  ): Promise<CommandExecutionResult>;

  /** Writes a file into the sandbox workspace */
  writeFile(relativePath: string, content: string | Buffer): Promise<void>;

  /** Reads a file from the sandbox workspace */
  readFile(relativePath: string): Promise<string>;

  /** Computes the git diff against a base branch inside the sandbox */
  getDiff(baseBranch?: string): Promise<string>;

  /** Tears down and permanently destroys the sandbox and temporary directories */
  destroy(): Promise<void>;
}
