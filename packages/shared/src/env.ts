import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    API_BASE_URL: z.string().url().default("http://localhost:4000"),
    WEB_BASE_URL: z.string().url().default("http://localhost:3000"),

    // Database
    DATABASE_URL: z
      .string({ required_error: "DATABASE_URL is required" })
      .min(1, "DATABASE_URL is required"),

    // Redis
    REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
    BULLMQ_CONCURRENCY: z.coerce.number().int().positive().default(5),

    // Auth Provider
    AUTH_PROVIDER: z.enum(["mock", "clerk"]).default("mock"),
    CLERK_SECRET_KEY: z.string().optional().default("sk_test_mock"),
    CLERK_PUBLISHABLE_KEY: z.string().optional().default("pk_test_mock"),
    CLERK_WEBHOOK_SECRET: z.string().optional().default("whsec_mock"),

    // S3 / MinIO
    S3_ENDPOINT: z.string().default("http://localhost:9000"),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default("agentforge-artifacts"),
    S3_ACCESS_KEY: z.string().default("minioadmin"),
    S3_SECRET_KEY: z.string().default("minioadmin"),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

    // GitHub App
    GITHUB_APP_ID: z.string().optional().default("123456"),
    GITHUB_APP_CLIENT_ID: z.string().optional().default("mock_client_id"),
    GITHUB_APP_CLIENT_SECRET: z
      .string()
      .optional()
      .default("mock_client_secret"),
    GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional().default(""),
    GITHUB_APP_PRIVATE_KEY: z.string().optional().default(""),
    GITHUB_WEBHOOK_SECRET: z.string().optional().default("mock_webhook_secret"),

    // Agent & Sandbox
    AGENT_PROVIDER: z
      .enum(["mock", "anthropic", "gemini", "openai"])
      .default("mock"),
    ANTHROPIC_API_KEY: z.string().optional().default(""),
    GEMINI_API_KEY: z.string().optional().default(""),
    OPENAI_API_KEY: z.string().optional().default(""),

    SANDBOX_DRIVER: z.enum(["mock", "docker", "e2b"]).default("mock"),
    DOCKER_SANDBOX_IMAGE: z.string().default("agentforge/sandbox-node:latest"),
    E2B_API_KEY: z.string().optional().default(""),

    // Limits
    MAX_TASK_EXECUTION_SECONDS: z.coerce.number().int().positive().default(600),
    MAX_WORKSPACE_CONCURRENT_RUNS: z.coerce
      .number()
      .int()
      .positive()
      .default(2),
    MAX_RUN_RETRIES: z.coerce.number().int().nonnegative().default(2),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (data.AUTH_PROVIDER === "mock") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_PROVIDER"],
          message:
            "Production environment cannot start with mock authentication enabled (AUTH_PROVIDER=mock).",
        });
      }
      if (
        !data.CLERK_SECRET_KEY ||
        data.CLERK_SECRET_KEY.startsWith("sk_test_mock")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CLERK_SECRET_KEY"],
          message:
            "Production environment requires a valid non-mock CLERK_SECRET_KEY.",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates process.env against schema and returns typed configuration.
 * Throws a formatted error if validation fails.
 */
export function validateEnv(
  rawEnv: Record<string, unknown> = process.env,
): Env {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `[AgentForge] Environment configuration validation failed:\n${errorMessages}`,
    );
  }
  return parsed.data;
}
