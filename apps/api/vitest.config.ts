// ========================================
// Vitest Configuration
// ========================================

import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables BEFORE any test modules are imported
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, ".env") });

// Set test-specific overrides
process.env["NODE_ENV"] = "test";
process.env["JWT_ACCESS_SECRET"] =
  "test_access_secret_min_32_characters_for_tests_abc";
process.env["JWT_REFRESH_SECRET"] =
  "test_refresh_secret_min_32_characters_for_tests_xyz";
process.env["JWT_ACCESS_EXPIRES_IN"] = "15m";
process.env["JWT_REFRESH_EXPIRES_IN"] = "7d";

if (!process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] =
    "postgresql://ricozviz:ricozviz_dev_password@localhost:5432/ricozviz_db?schema=public";
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    setupFiles: ["src/tests/setup.ts"],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/tests/**",
        "src/server.ts",
        "vitest.config.ts",
      ],
    },
  },
});
