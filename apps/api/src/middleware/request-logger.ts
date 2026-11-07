import { Request, Response, NextFunction } from "express";
import {
  logger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from "@agentforge/shared";

// Normalize path to prevent high-cardinality route explosion in Prometheus
function sanitizePath(path: string): string {
  return path
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":id",
    )
    .replace(/\/\d+/g, "/:id");
}

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const requestId =
    (req as any).id || (req.headers["x-request-id"] as string) || "unknown";
  const correlationId =
    (req.headers["x-correlation-id"] as string) || requestId;
  const workspaceId =
    (req.headers["x-workspace-id"] as string) ||
    (req as any).workspaceId ||
    (req as any).user?.workspaceId;

  const reqLogger = logger.child({
    service: "agentforge-api",
    requestId,
    correlationId,
    ...(workspaceId ? { workspaceId } : {}),
  });

  (req as any).log = reqLogger;

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const status = res.statusCode;
    const path = sanitizePath(req.baseUrl + (req.route?.path || req.path));

    // Record Prometheus metrics
    httpRequestsTotal.inc({
      method: req.method,
      path,
      status: String(status),
    });
    httpRequestDurationSeconds.observe(durationSec, {
      method: req.method,
      path,
    });

    const meta = {
      method: req.method,
      url: req.originalUrl || req.url,
      path,
      status,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"] || "unknown",
    };

    if (status >= 500) {
      reqLogger.error(
        meta,
        `HTTP ${req.method} ${meta.url} failed with ${status}`,
      );
    } else if (status >= 400) {
      reqLogger.warn(
        meta,
        `HTTP ${req.method} ${meta.url} client warning ${status}`,
      );
    } else {
      reqLogger.info(meta, `HTTP ${req.method} ${meta.url} completed`);
    }
  });

  next();
}
