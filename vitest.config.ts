import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/agentforge_test?schema=public",
      REDIS_URL: "redis://localhost:6379",
      PORT: "4000",
    },
  },
  resolve: {
    alias: {
      "@agentforge/shared": path.resolve(
        __dirname,
        "./packages/shared/src/index.ts",
      ),
      "@agentforge/db": path.resolve(__dirname, "./packages/db/src/index.ts"),
      "@agentforge/agent-adapters": path.resolve(
        __dirname,
        "./packages/agent-adapters/src/index.ts",
      ),
      "@agentforge/sandbox": path.resolve(
        __dirname,
        "./packages/sandbox/src/index.ts",
      ),
      "@agentforge/runner": path.resolve(
        __dirname,
        "./packages/runner/src/index.ts",
      ),
    },
  },
});
