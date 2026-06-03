// Runtime environment validation.
//
// Imported by `lib/prisma.ts` and `lib/auth.ts` so a missing or malformed
// env var crashes the build / first import — not the first request.
//
// Tests stub the required vars in `vitest.setup.ts` because the modules
// that read them are mocked away.

import { z } from "zod";

const NodeEnv = z
  .enum(["development", "test", "production"])
  .default("development");

const envSchema = z.object({
  NODE_ENV: NodeEnv,
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters long"),
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  const issues = result.error.issues
    .map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
