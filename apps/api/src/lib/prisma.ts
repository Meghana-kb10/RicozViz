// ========================================
// Prisma Client Singleton
// ========================================
// Ensures a single PrismaClient instance across the application.
// Prevents connection pool exhaustion during hot-reload in development.
// ========================================

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const isDev = process.env["NODE_ENV"] === "development";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev
      ? ["warn", "error"]
      : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}

// Log when Prisma encounters errors at startup
logger.debug("Prisma client initialized", { env: process.env["NODE_ENV"] });
