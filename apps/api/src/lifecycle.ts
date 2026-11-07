import { Server } from "http";
import { Socket } from "net";
import { logger } from "@agentforge/shared";
import { prisma } from "@agentforge/db";

export interface ShutdownOptions {
  timeoutMs?: number;
  onExit?: (code: number) => void;
  cleanupFns?: Array<() => Promise<void> | void>;
}

export class GracefulShutdownManager {
  private isShuttingDown = false;
  private sockets = new Set<Socket>();
  private timeoutMs: number;
  private onExit: (code: number) => void;
  private cleanupFns: Array<() => Promise<void> | void>;

  constructor(
    private server: Server,
    options: ShutdownOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.onExit = options.onExit ?? ((code: number) => process.exit(code));
    this.cleanupFns = options.cleanupFns ?? [
      async () => {
        try {
          await prisma.$disconnect();
        } catch {
          // ignore in tests or when disconnected
        }
      },
    ];

    // Track active sockets
    this.server.on("connection", (socket: Socket) => {
      this.sockets.add(socket);
      socket.on("close", () => {
        this.sockets.delete(socket);
      });
    });
  }

  public registerCleanup(fn: () => Promise<void> | void): void {
    this.cleanupFns.push(fn);
  }

  public async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    logger.info(
      { signal, activeSockets: this.sockets.size },
      `Received ${signal}. Initiating graceful shutdown...`,
    );

    // Forceful shutdown timer fallback
    const forceTimer = setTimeout(() => {
      logger.error(
        { timeoutMs: this.timeoutMs },
        "Graceful shutdown timed out. Forcing socket termination.",
      );
      for (const socket of this.sockets) {
        socket.destroy();
      }
      this.onExit(1);
    }, this.timeoutMs);

    if (forceTimer.unref) {
      forceTimer.unref();
    }

    // Stop accepting new connections
    await new Promise<void>((resolve) => {
      this.server.close((err) => {
        if (err) {
          logger.warn({ err: err.message }, "Error closing HTTP server");
        } else {
          logger.info("HTTP server stopped accepting connections.");
        }
        resolve();
      });

      // Close idle keep-alive sockets gracefully
      for (const socket of this.sockets) {
        socket.end();
      }
    });

    // Execute registered cleanup hooks (DB, redis, background runners)
    for (const fn of this.cleanupFns) {
      try {
        await fn();
      } catch (err: any) {
        logger.error(
          { err: err?.message },
          "Error during shutdown cleanup hook",
        );
      }
    }

    clearTimeout(forceTimer);
    logger.info("Graceful shutdown completed successfully.");
    this.onExit(0);
  }

  public get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}
