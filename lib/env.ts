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
  // WhatsApp Cloud API (Meta). Both must be set for automatic sending;
  // otherwise staff get a one-click "open in WhatsApp" fallback.
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  // Shared secret the reminder cron must present (Vercel Cron sends it as
  // "Authorization: Bearer <CRON_SECRET>" automatically).
  CRON_SECRET: z.string().min(16).optional(),
  // SMS transport. "netgsm" needs the three NETGSM_* values; "log" prints
  // messages instead of sending (local development).
  SMS_PROVIDER: z.enum(["netgsm", "log"]).optional(),
  NETGSM_USERCODE: z.string().min(1).optional(),
  NETGSM_PASSWORD: z.string().min(1).optional(),
  NETGSM_MSGHEADER: z.string().min(1).max(11).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).superRefine((v, ctx) => {
  if (v.SMS_PROVIDER === "netgsm") {
    for (const key of ["NETGSM_USERCODE", "NETGSM_PASSWORD", "NETGSM_MSGHEADER"] as const) {
      if (!v[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when SMS_PROVIDER=netgsm`,
        });
      }
    }
  }
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
