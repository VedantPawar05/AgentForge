import { describe, it, expect, vi } from "vitest";
import { Logger, LogRecord } from "./logger.js";

describe("Phase 11: Structured JSON Logger", () => {
  it("formats log records as structured JSON with level, timestamp, and message", () => {
    const logs: LogRecord[] = [];
    const logger = new Logger({
      level: "debug",
      outputFn: (record) => logs.push(record),
    });

    logger.info("System initialized");

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("info");
    expect(logs[0].levelValue).toBe(20);
    expect(logs[0].msg).toBe("System initialized");
    expect(typeof logs[0].time).toBe("number");
  });

  it("supports child loggers with inherited bindings and correlation IDs", () => {
    const logs: LogRecord[] = [];
    const rootLogger = new Logger({
      bindings: { service: "agentforge-api" },
      outputFn: (record) => logs.push(record),
    });

    const reqLogger = rootLogger.child({
      requestId: "req-abc-123",
      workspaceId: "ws-tenant-99",
    });

    reqLogger.warn({ detail: "High latency detected" }, "Request warning");

    expect(logs).toHaveLength(1);
    expect(logs[0].service).toBe("agentforge-api");
    expect(logs[0].requestId).toBe("req-abc-123");
    expect(logs[0].workspaceId).toBe("ws-tenant-99");
    expect(logs[0].detail).toBe("High latency detected");
    expect(logs[0].msg).toBe("Request warning");
  });

  it("redacts sensitive fields like passwords, tokens, and authorization headers", () => {
    const logs: LogRecord[] = [];
    const logger = new Logger({
      outputFn: (record) => logs.push(record),
    });

    logger.info(
      {
        user: "alice",
        token: "secret-jwt-token",
        nested: {
          apiKey: "sk-ant-123456",
          safeData: "visible",
        },
      },
      "Authentication attempt",
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].user).toBe("alice");
    expect(logs[0].token).toBe("[REDACTED]");
    expect((logs[0].nested as any).apiKey).toBe("[REDACTED]");
    expect((logs[0].nested as any).safeData).toBe("visible");
  });

  it("serializes Error objects with stack, name, and message", () => {
    const logs: LogRecord[] = [];
    const logger = new Logger({
      outputFn: (record) => logs.push(record),
    });

    const testError = new Error("Database connection failed");
    (testError as any).code = "ECONNREFUSED";

    logger.error({ err: testError }, "Fatal connection failure");

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].err).toBeDefined();
    expect(logs[0].err?.message).toBe("Database connection failed");
    expect(logs[0].err?.code).toBe("ECONNREFUSED");
    expect(logs[0].err?.stack).toBeDefined();
  });

  it("respects configured log levels", () => {
    const logs: LogRecord[] = [];
    const logger = new Logger({
      level: "warn",
      outputFn: (record) => logs.push(record),
    });

    logger.debug("Debug ignored");
    logger.info("Info ignored");
    logger.warn("Warn recorded");
    logger.error("Error recorded");

    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.level)).toEqual(["warn", "error"]);
  });
});
