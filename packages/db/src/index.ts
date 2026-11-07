import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

// Singleton Prisma Client pattern to avoid connection exhaustion in dev
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Export Repositories
export * from "./repositories/user-repository.js";
export * from "./repositories/workspace-repository.js";
export * from "./repositories/project-repository.js";
export * from "./repositories/task-repository.js";
export * from "./repositories/run-repository.js";
export * from "./repositories/outbox-repository.js";
export * from "./repositories/audit-repository.js";
export * from "./repositories/run-event-repository.js";

export * from "./repositories/approval-repository.js";
export * from "./repositories/artifact-repository.js";
export * from "./repositories/runner-repository.js";
