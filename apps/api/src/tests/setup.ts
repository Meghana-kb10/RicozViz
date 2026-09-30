// ========================================
// Test Setup
// ========================================
// Loads test environment variables and mocks.
// This file runs before every test suite.
// ========================================

import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env") });
// Also try current directory for CI environments
config({ path: resolve(process.cwd(), ".env") });

// Override / set test-specific values
process.env["NODE_ENV"] = "test";
process.env["JWT_ACCESS_SECRET"] =
  "test_access_secret_min_32_characters_for_tests_abc";
process.env["JWT_REFRESH_SECRET"] =
  "test_refresh_secret_min_32_characters_for_tests_xyz";
process.env["JWT_ACCESS_EXPIRES_IN"] = "15m";
process.env["JWT_REFRESH_EXPIRES_IN"] = "7d";

// Provide a fallback DATABASE_URL so env.ts doesn't crash on parse.
// The actual DB availability is checked at runtime in beforeAll.
if (!process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] =
    "postgresql://ricozviz:ricozviz_dev_password@localhost:5432/ricozviz_db?schema=public";
}
