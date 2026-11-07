import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import http from "http";
import net from "net";
import { createApp } from "./app.js";
import { createRateLimiter } from "./middleware/rate-limiter.js";
import { GracefulShutdownManager } from "./lifecycle.js";
import { metrics } from "@agentforge/shared";

describe("Phase 11: Production Hardening", () => {
  describe("Workspace & IP Token Bucket Rate Limiting", () => {
    it("enforces separate token bucket quotas per workspace ID", async () => {
      const app = express();
      // 2 requests capacity per client
      app.use(createRateLimiter({ capacity: 2, refillRatePerSec: 0.1 }));
      app.get("/api/resource", (req, res) =>
        res.json({ ok: true, scope: req.headers["x-workspace-id"] || "anon" }),
      );

      // Workspace A sends 2 requests (allowed)
      const a1 = await request(app)
        .get("/api/resource")
        .set("x-workspace-id", "ws-alpha");
      expect(a1.status).toBe(200);
      expect(a1.headers["x-ratelimit-remaining"]).toBe("1");
      expect(a1.headers["x-ratelimit-scope"]).toBe("ws:ws-alpha");

      const a2 = await request(app)
        .get("/api/resource")
        .set("x-workspace-id", "ws-alpha");
      expect(a2.status).toBe(200);
      expect(a2.headers["x-ratelimit-remaining"]).toBe("0");

      // Workspace A 3rd request is blocked
      const a3 = await request(app)
        .get("/api/resource")
        .set("x-workspace-id", "ws-alpha");
      expect(a3.status).toBe(429);
      expect(a3.body.error.code).toBe("RATE_LIMIT_EXCEEDED");

      // Workspace B has its own independent bucket and is NOT blocked
      const b1 = await request(app)
        .get("/api/resource")
        .set("x-workspace-id", "ws-beta");
      expect(b1.status).toBe(200);
      expect(b1.headers["x-ratelimit-remaining"]).toBe("1");
      expect(b1.headers["x-ratelimit-scope"]).toBe("ws:ws-beta");
    });

    it("falls back to IP scoping when no workspace ID is provided", async () => {
      const app = express();
      app.use(createRateLimiter({ capacity: 1, refillRatePerSec: 0.1 }));
      app.get("/unauth", (_req, res) => res.json({ ok: true }));

      const r1 = await request(app).get("/unauth");
      expect(r1.status).toBe(200);
      expect(r1.headers["x-ratelimit-scope"]).toContain("ip:");

      const r2 = await request(app).get("/unauth");
      expect(r2.status).toBe(429);
    });
  });

  describe("Prometheus Metrics & Health Endpoints", () => {
    it("serves Prometheus text exposition format with live process and HTTP metrics", async () => {
      const app = createApp();

      // Trigger a few HTTP requests to populate metrics
      await request(app).get("/health");
      await request(app).get("/ready");

      const res = await request(app).get("/metrics");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");

      const body = res.text;
      expect(body).toContain("# HELP process_uptime_seconds");
      expect(body).toContain("# HELP http_requests_total");
      expect(body).toContain("# TYPE http_requests_total counter");
      expect(body).toContain(
        'http_requests_total{method="GET",path="/health",status="200"}',
      );
    });
  });

  describe("Graceful Shutdown Manager", () => {
    it("drains active sockets, triggers cleanups, and exits with code 0", async () => {
      const server = http.createServer((_req, res) => res.end("ok"));
      let exitCode = -1;
      let cleanupCalled = false;

      const manager = new GracefulShutdownManager(server, {
        timeoutMs: 2000,
        onExit: (code) => {
          exitCode = code;
        },
        cleanupFns: [
          async () => {
            cleanupCalled = true;
          },
        ],
      });

      await new Promise<void>((resolve) => server.listen(0, resolve));

      expect(manager.shuttingDown).toBe(false);

      await manager.shutdown("SIGTERM");

      expect(manager.shuttingDown).toBe(true);
      expect(cleanupCalled).toBe(true);
      expect(exitCode).toBe(0);
    });
  });
});
