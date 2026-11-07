import path from "node:path";
import fs from "node:fs/promises";
import { SecurityError } from "./types.js";

export interface WorktreeCleanupOptions {
  worktreeDir: string;
  allowedBaseDir?: string;
  branchName?: string;
  onCommand?: (cmd: string, args: string[]) => Promise<void> | void;
}

const PROTECTED_BRANCHES = new Set([
  "main",
  "master",
  "dev",
  "develop",
  "development",
  "prod",
  "production",
  "release",
  "staging",
  "trunk",
]);

/**
 * Validates and safely cleans up an isolated agent worktree directory without risking
 * host filesystem escape, parent directory deletion, or deletion of protected branches.
 */
export async function safeCleanupWorktree(
  options: WorktreeCleanupOptions,
): Promise<{ cleaned: boolean; dir: string }> {
  const {
    worktreeDir,
    allowedBaseDir = "/tmp/agentforge",
    branchName,
  } = options;

  // 1. Validate branch name: refuse deletion of protected branches
  if (branchName) {
    const normalizedBranch = branchName
      .trim()
      .toLowerCase()
      .replace(/^refs\/heads\//, "");
    if (
      PROTECTED_BRANCHES.has(normalizedBranch) ||
      normalizedBranch.startsWith("release/") ||
      normalizedBranch.startsWith("prod/") ||
      normalizedBranch.startsWith("main/")
    ) {
      throw new SecurityError(
        `Refusing to delete protected branch: '${branchName}'`,
      );
    }
  }

  // 2. Validate worktree directory path
  if (!worktreeDir || typeof worktreeDir !== "string") {
    throw new SecurityError("Invalid worktree directory provided");
  }

  const resolvedTarget = path.resolve(worktreeDir);
  const resolvedBase = path.resolve(allowedBaseDir);

  // Must not be identical to base dir (e.g. cannot delete /tmp/agentforge itself)
  if (resolvedTarget === resolvedBase) {
    throw new SecurityError(
      `Refusing to delete worktree root directory: ${resolvedBase}`,
    );
  }

  // Must not be root of filesystem
  const root = path.parse(resolvedTarget).root;
  if (resolvedTarget === root) {
    throw new SecurityError(
      `Refusing to delete filesystem root: ${resolvedTarget}`,
    );
  }

  // Must be strictly located inside resolvedBase
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new SecurityError(
      `Worktree cleanup directory '${resolvedTarget}' is outside allowed base directory '${resolvedBase}'`,
    );
  }

  // 3. Optional git branch / worktree removal callback
  if (options.onCommand && branchName) {
    await options.onCommand("git", ["branch", "-D", branchName]);
  }

  // 4. Safely remove directory
  try {
    await fs.rm(resolvedTarget, { recursive: true, force: true });
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  return { cleaned: true, dir: resolvedTarget };
}
