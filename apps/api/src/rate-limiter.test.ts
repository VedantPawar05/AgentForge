import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { createRateLimiter } from "./middleware/rate-limiter.js";

describe("Phase 11: Production Hardening - Rate Limiting", () => {
  it("blocks client with 429 when max request quota is exceeded", async () => {
    const app = express();
    // Allow only 3 requests per 10 seconds for testing
    app.use(createRateLimiter({ windowMs: 10000, maxRequests: 3 }));
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const r1 = await request(app).get("/test");
    expect(r1.status).toBe(200);
    expect(r1.headers["x-ratelimit-remaining"]).toBe("2");

    const r2 = await request(app).get("/test");
    expect(r2.status).toBe(200);
    expect(r2.headers["x-ratelimit-remaining"]).toBe("1");

    const r3 = await request(app).get("/test");
    expect(r3.status).toBe(200);
    expect(r3.headers["x-ratelimit-remaining"]).toBe("0");

    // 4th request must be rejected with 429 Too Many Requests
    const r4 = await request(app).get("/test");
    expect(r4.status).toBe(429);
    expect(r4.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(r4.body.error.message).toContain("Too many requests");
  });
});
