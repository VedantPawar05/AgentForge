import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { safeCleanupWorktree } from "./worktree.js";
import { SecurityError } from "./types.js";

describe("Phase 1 Step 5: Scenario 9 - Worktree Isolation & Safe Cleanup", () => {
  const tempBase = path.join(os.tmpdir(), "agentforge-test-worktrees");

  it("safely deletes an isolated task worktree within approved base directory", async () => {
    const runId = "run-scenario-9-ok";
    const worktreeDir = path.join(tempBase, `sb-${runId}`);

    // Create target dir and a canary file
    await fs.mkdir(worktreeDir, { recursive: true });
    await fs.writeFile(path.join(worktreeDir, "canary.txt"), "content");

    const result = await safeCleanupWorktree({
      worktreeDir,
      allowedBaseDir: tempBase,
    });

    expect(result.cleaned).toBe(true);

    // Verify worktreeDir no longer exists
    await expect(fs.access(worktreeDir)).rejects.toThrow();
  });

  it("strictly rejects path traversal attempts targeting parent directories", async () => {
    const maliciousPaths = [
      path.join(tempBase, "..", "unrelated-repo"),
      path.join(tempBase, "sb-run", "..", "..", "etc"),
      tempBase, // Root base itself must not be deleted!
      path.parse(process.cwd()).root, // Root of filesystem
    ];

    for (const badPath of maliciousPaths) {
      await expect(
        safeCleanupWorktree({
          worktreeDir: badPath,
          allowedBaseDir: tempBase,
        }),
      ).rejects.toThrow(SecurityError);
    }
  });

  it("strictly refuses to delete protected branches (main, master, production, staging, release)", async () => {
    const runId = "run-branch-guard";
    const worktreeDir = path.join(tempBase, `sb-${runId}`);
    const onCommand = vi.fn();

    const protectedBranches = [
      "main",
      "master",
      "dev",
      "develop",
      "production",
      "staging",
      "release",
      "release/v1.0.0",
      "prod/us-east-1",
      "refs/heads/main",
    ];

    for (const branch of protectedBranches) {
      await expect(
        safeCleanupWorktree({
          worktreeDir,
          allowedBaseDir: tempBase,
          branchName: branch,
          onCommand,
        }),
      ).rejects.toThrow(/Refusing to delete protected branch/);
    }

    expect(onCommand).not.toHaveBeenCalled();
  });

  it("allows safe deletion of ephemeral task-specific feature branches", async () => {
    const runId = "run-safe-branch";
    const worktreeDir = path.join(tempBase, `sb-${runId}`);
    const onCommand = vi.fn();

    const result = await safeCleanupWorktree({
      worktreeDir,
      allowedBaseDir: tempBase,
      branchName: "agentforge/task-12345",
      onCommand,
    });

    expect(result.cleaned).toBe(true);
    expect(onCommand).toHaveBeenCalledWith("git", [
      "branch",
      "-D",
      "agentforge/task-12345",
    ]);
  });
});
