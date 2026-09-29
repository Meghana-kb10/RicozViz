// ========================================
// Environment Configuration
// ========================================
// Single source of truth for all env variables.
// Never use process.env directly outside this file.
// ========================================

import { z } from "zod";

const envSchema = z.object({
  // ---- Node ----
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // ---- Server ----
  PORT: z.coerce.number().int().positive().default(4000),

  // ---- Database ----
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid URL"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const config = parseEnv();

export type Config = typeof config;
