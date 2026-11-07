import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("API Health Routes", () => {
  const app = createApp();

  it("GET /v1/health returns 200 with uptime", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.uptimeSeconds).toBeDefined();
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("GET /metrics returns 200 with Prometheus text format", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("agentforge_active_runs_total");
    expect(res.text).toContain("agentforge_worker_lease_renewals_total");
    expect(res.text).toContain("process_resident_memory_bytes");
  });

  it("includes rate limit headers in responses", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
  });
});
