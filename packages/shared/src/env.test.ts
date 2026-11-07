import { describe, it, expect } from "vitest";
import { validateEnv } from "./index.js";

describe("Environment Validator", () => {
  it("parses valid environment with defaults", () => {
    const raw = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/testdb",
    };
    const env = validateEnv(raw);
    expect(env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/testdb",
    );
    expect(env.PORT).toBe(4000);
    expect(env.AUTH_PROVIDER).toBe("mock");
    expect(env.SANDBOX_DRIVER).toBe("mock");
    expect(env.MAX_TASK_EXECUTION_SECONDS).toBe(600);
  });

  it("fails if DATABASE_URL is missing", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL is required/);
  });

  it("parses overrides correctly", () => {
    const raw = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/testdb",
      PORT: "8080",
      AUTH_PROVIDER: "clerk",
      MAX_TASK_EXECUTION_SECONDS: "1200",
    };
    const env = validateEnv(raw);
    expect(env.PORT).toBe(8080);
    expect(env.AUTH_PROVIDER).toBe("clerk");
    expect(env.MAX_TASK_EXECUTION_SECONDS).toBe(1200);
  });

  it("rejects starting in production with mock authentication enabled", () => {
    const raw = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/proddb",
      AUTH_PROVIDER: "mock",
    };
    expect(() => validateEnv(raw)).toThrow(
      /Production environment cannot start with mock authentication enabled/,
    );
  });

  it("rejects starting in production with placeholder CLERK_SECRET_KEY", () => {
    const raw = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/proddb",
      AUTH_PROVIDER: "clerk",
      CLERK_SECRET_KEY: "sk_test_mock_1234",
    };
    expect(() => validateEnv(raw)).toThrow(
      /Production environment requires a valid non-mock CLERK_SECRET_KEY/,
    );
  });

  it("accepts valid production configuration with real Clerk credentials", () => {
    const raw = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/proddb",
      AUTH_PROVIDER: "clerk",
      CLERK_SECRET_KEY: "sk_live_abcdef1234567890",
    };
    const env = validateEnv(raw);
    expect(env.NODE_ENV).toBe("production");
    expect(env.AUTH_PROVIDER).toBe("clerk");
    expect(env.CLERK_SECRET_KEY).toBe("sk_live_abcdef1234567890");
  });
});
