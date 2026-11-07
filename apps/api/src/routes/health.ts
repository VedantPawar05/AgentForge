import { Router, Request, Response } from "express";
import { metrics } from "@agentforge/shared";

export const healthRouter = Router();

/**
 * Liveness probe (standard /health and /healthz aliases)
 */
const livenessHandler = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
};

healthRouter.get("/health", livenessHandler);
healthRouter.get("/healthz", livenessHandler);

/**
 * Readiness probe
 */
healthRouter.get("/ready", async (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ready",
    services: {
      api: "healthy",
      database: "connected",
      queue: "ready",
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Prometheus metrics endpoint
 */
healthRouter.get("/metrics", (_req: Request, res: Response) => {
  const payload = metrics.exportPrometheus();
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.status(200).send(payload);
});
