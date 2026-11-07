import { createApp } from "./app.js";
import { validateEnv, logger } from "@agentforge/shared";
import { GracefulShutdownManager } from "./lifecycle.js";
import { AgentForgeSocketServer } from "./realtime/socket-server.js";
import { AuthService } from "./auth/auth-service.js";
import {
  PrismaUserRepository,
  PrismaWorkspaceRepository,
  PrismaTaskRepository,
  PrismaRunEventRepository,
} from "@agentforge/db";

const env = validateEnv();

const userRepo = new PrismaUserRepository();
const workspaceRepo = new PrismaWorkspaceRepository();
const taskRepo = new PrismaTaskRepository();
const runEventRepo = new PrismaRunEventRepository();
const authService = new AuthService(userRepo);

const app = createApp({
  userRepo,
  workspaceRepo,
  taskRepo,
  runEventRepo,
  authService,
});

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `[AgentForge API] Listening on port ${env.PORT}`,
  );
});

// Attach authenticated WebSocket server
export const socketServer = new AgentForgeSocketServer(
  server,
  authService,
  workspaceRepo,
  taskRepo,
  runEventRepo,
);
logger.info(
  "[AgentForge API] Real-time Socket.io server attached to HTTP listener",
);

const shutdownManager = new GracefulShutdownManager(server);

process.on("SIGTERM", () => shutdownManager.shutdown("SIGTERM"));
process.on("SIGINT", () => shutdownManager.shutdown("SIGINT"));
