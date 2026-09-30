// ========================================
// Environment Configuration
// ========================================
// Single source of truth for all env variables.
// Never use process.env directly outside this file.
// ========================================

import { z } from "zod";
import * as dotenv from "dotenv";
import * as path from "path";

// Load from current working directory, workspace, and monorepo root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

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

  // ---- Authentication ----
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // ---- CORS ----
  ALLOWED_ORIGIN: z.string().optional(),
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
