#!/usr/bin/env node

import { LocalRunnerDaemon } from "./daemon.js";
import { logger } from "@agentforge/shared";

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val =
        args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      result[key] = val;
    }
  }
  return result;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  const apiBaseUrl =
    flags["api"] || process.env.API_BASE_URL || "http://localhost:4000/v1";
  const workspaceId =
    flags["workspace"] ||
    flags["ws"] ||
    process.env.WORKSPACE_ID ||
    "ws-default-prod";
  const localRepoPath = flags["repo"] || flags["path"] || process.cwd();
  const userToken =
    flags["token"] ||
    process.env.AGENTFORGE_TOKEN ||
    "developer@agentforge.dev";
  const runnerName = flags["name"];

  logger.info(
    { apiBaseUrl, workspaceId, localRepoPath },
    "[AgentForge Runner CLI] Initializing runner...",
  );

  const daemon = new LocalRunnerDaemon({
    apiBaseUrl,
    workspaceId,
    localRepoPath,
    runnerName,
    userToken,
  });

  const { runnerId } = await daemon.start();
  console.log(`\n======================================================`);
  console.log(`  AgentForge Local Runner connected and active!`);
  console.log(`  Runner ID: ${runnerId}`);
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Local Path: ${localRepoPath}`);
  console.log(`======================================================\n`);

  const shutdown = async () => {
    console.log("\nShutting down Local Runner...");
    await daemon.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (
  process.argv[1]?.endsWith("cli.js") ||
  process.argv[1]?.endsWith("cli.ts")
) {
  main().catch((err) => {
    console.error("Fatal error in AgentForge Runner:", err);
    process.exit(1);
  });
}
