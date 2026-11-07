import {
  ISandboxDriver,
  SandboxConfig,
  CommandExecutionOptions,
  CommandExecutionResult,
} from "./types.js";

export interface MockSandboxDriverOptions {
  simulatedExitCode?: number;
  simulatedStdout?: string;
  simulatedStderr?: string;
  simulatedDiff?: string;
  shouldTimeout?: boolean;
}

export class MockSandboxDriver implements ISandboxDriver {
  public readonly driverName = "mock";
  public isProvisioned = false;
  public isDestroyed = false;
  public files = new Map<string, string>();
  public executedCommands: {
    command: string;
    args: string[];
    options?: CommandExecutionOptions;
  }[] = [];

  constructor(private readonly options: MockSandboxDriverOptions = {}) {}

  public async provision(_config: SandboxConfig): Promise<void> {
    this.isProvisioned = true;
    this.isDestroyed = false;
    this.files.set("README.md", "# Mock Project\n");
    this.files.set(
      "package.json",
      '{"name": "mock-app", "scripts": {"test": "echo tests pass"}}\n',
    );
  }

  public async executeCommand(
    command: string,
    args: string[],
    options?: CommandExecutionOptions,
  ): Promise<CommandExecutionResult> {
    if (!this.isProvisioned || this.isDestroyed) {
      throw new Error("Sandbox is not provisioned or has been destroyed");
    }

    this.executedCommands.push({ command, args, options });

    if (this.options.shouldTimeout) {
      return {
        stdout: "",
        stderr: "Command timed out after execution limit reached",
        exitCode: 124,
        durationMs: 5000,
        timedOut: true,
      };
    }

    const stdout =
      this.options.simulatedStdout ??
      `Simulated output for ${command} ${args.join(" ")}\n`;
    const stderr = this.options.simulatedStderr ?? "";
    const exitCode = this.options.simulatedExitCode ?? 0;

    options?.onStdout?.(stdout);
    if (stderr) {
      options?.onStderr?.(stderr);
    }

    return {
      stdout,
      stderr,
      exitCode,
      durationMs: 150,
      timedOut: false,
    };
  }

  public async writeFile(
    relativePath: string,
    content: string | Buffer,
  ): Promise<void> {
    this.files.set(
      relativePath,
      typeof content === "string" ? content : content.toString("utf-8"),
    );
  }

  public async readFile(relativePath: string): Promise<string> {
    const val = this.files.get(relativePath);
    if (val === undefined) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return val;
  }

  public async getDiff(_baseBranch = "main"): Promise<string> {
    return (
      this.options.simulatedDiff ??
      `diff --git a/src/index.ts b/src/index.ts\nindex 0000000..1111111 100644\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,5 @@\n+// Added by AgentForge Agent\n+export const status = 'ok';\n`
    );
  }

  public async destroy(): Promise<void> {
    this.isDestroyed = true;
    this.isProvisioned = false;
    this.files.clear();
  }
}
