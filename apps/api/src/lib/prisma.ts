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

if (!(prisma as any).scheduledReport) {
  Object.defineProperty(prisma, "scheduledReport", {
    get() {
      return (prisma as any).report;
    },
    configurable: true,
    enumerable: true,
  });
}

if (!(prisma as any).visualization) {
  Object.defineProperty(prisma, "visualization", {
    get() {
      return (prisma as any).chart;
    },
    configurable: true,
    enumerable: true,
  });
}

prisma.$use(async (params, next) => {
  if (params.model === "User" && (params.action === "delete" || params.action === "deleteMany")) {
    const where = params.args?.where;
    if (where?.id) {
      const userIds: string[] =
        typeof where.id === "string"
          ? [where.id]
          : Array.isArray(where.id?.in)
          ? where.id.in
          : [];
      if (userIds.length > 0) {
        await prisma.auditLog
          .deleteMany({
            where: { userId: { in: userIds } },
          })
          .catch(() => null);
        await prisma.report
          .deleteMany({
            where: {
              OR: [
                { dashboard: { ownerId: { in: userIds } } },
                { createdById: { in: userIds } },
              ],
            },
          })
          .catch(() => null);
        await prisma.chart
          .deleteMany({
            where: { dashboard: { ownerId: { in: userIds } } },
          })
          .catch(() => null);
        await prisma.dashboard
          .deleteMany({
            where: { ownerId: { in: userIds } },
          })
          .catch(() => null);
        await prisma.organizationMember
          .deleteMany({
            where: { userId: { in: userIds } },
          })
          .catch(() => null);
      }
    }
  }

  if (params.model === "Organization" && (params.action === "delete" || params.action === "deleteMany")) {
    const where = params.args?.where;
    if (where?.id) {
      const orgIds: string[] =
        typeof where.id === "string"
          ? [where.id]
          : Array.isArray(where.id?.in)
          ? where.id.in
          : [];
      if (orgIds.length > 0) {
        await prisma.auditLog
          .deleteMany({
            where: { organizationId: { in: orgIds } },
          })
          .catch(() => null);
      }
    }
  }

  return next(params);
});

// Log when Prisma encounters errors at startup
logger.debug("Prisma client initialized", { env: process.env["NODE_ENV"] });
