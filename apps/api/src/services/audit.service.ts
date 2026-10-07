// ========================================
// Audit Log Service
// ========================================
// Records governance actions in the append-only audit_logs table.
// Ensures credentials, passwords and sensitive keys are NEVER recorded.
// Supports filtering, search, pagination, and statistics for authorized users.
// ========================================

import { type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

export interface LogAuditParams {
  organizationId: string;
  workspaceId?: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  status?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface QueryAuditLogsParams {
  organizationId: string;
  workspaceId?: string;
  action?: string;
  resourceType?: string;
  userId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "apikey",
  "bearertoken",
  "credential",
  "credentials",
  "authorization",
]);

/**
 * Recursively strips sensitive fields from metadata before logging.
 */
function sanitizeMetadata(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMetadata);
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

// In-memory audit log store for testing and offline resilience
const inMemoryAuditLogs: any[] = [];

export function getInMemoryAuditLogs(): any[] {
  return inMemoryAuditLogs;
}

export function clearInMemoryAuditLogs(): void {
  inMemoryAuditLogs.length = 0;
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  const sanitizedMeta = (params.metadata
    ? sanitizeMetadata(params.metadata)
    : {}) as Record<string, unknown>;

  // Always buffer in-memory for testing / auditing resilience
  inMemoryAuditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    organizationId: params.organizationId,
    workspaceId: params.workspaceId ?? null,
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    status: params.status || "SUCCESS",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: sanitizedMeta,
    createdAt: new Date(),
  });

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        workspaceId: params.workspaceId ?? null,
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        status: params.status || "SUCCESS",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: sanitizedMeta as Prisma.InputJsonValue,
      },
    });
  } catch (err: unknown) {
    // Non-fatal — audit log failures must not crash API operations
    logger.warn("Failed to write to audit log", {
      action: params.action,
      resourceType: params.resourceType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function queryAuditLogs(
  param1: string | QueryAuditLogsParams,
  param2?: Partial<QueryAuditLogsParams>
) {
  const params: QueryAuditLogsParams =
    typeof param1 === "string"
      ? { organizationId: param1, ...(param2 || {}) }
      : param1;

  const {
    organizationId,
    workspaceId,
    action,
    resourceType,
    userId,
    status,
    startDate,
    endDate,
    search,
    limit = 50,
    offset = 0,
  } = params;

  const where: any = { organizationId };

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }
  if (action) {
    where.action = action;
  }
  if (resourceType) {
    where.resourceType = resourceType;
  }
  if (userId) {
    where.userId = userId;
  }
  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  if (search && search.trim().length > 0) {
    const s = search.trim();
    where.OR = [
      { action: { contains: s, mode: "insensitive" } },
      { resourceType: { contains: s, mode: "insensitive" } },
      { resourceId: { contains: s, mode: "insensitive" } },
      { user: { name: { contains: s, mode: "insensitive" } } },
      { user: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  const boundedLimit = Math.min(Math.max(limit, 1), 200);
  const boundedOffset = Math.max(offset, 0);

  try {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: boundedLimit,
        skip: boundedOffset,
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          workspace: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);

    return {
      total,
      limit: boundedLimit,
      offset: boundedOffset,
      logs,
    };
  } catch {
    const filtered = inMemoryAuditLogs.filter((log) => {
      if (organizationId && log.organizationId !== organizationId) return false;
      if (action && log.action !== action) return false;
      if (resourceType && log.resourceType !== resourceType) return false;
      if (userId && log.userId !== userId) return false;
      if (workspaceId && log.workspaceId !== workspaceId) return false;
      return true;
    });
    return {
      total: filtered.length,
      limit: boundedLimit,
      offset: boundedOffset,
      logs: filtered.slice(boundedOffset, boundedOffset + boundedLimit),
    };
  }
}

export async function getAuditLogStats(organizationId: string, workspaceId?: string) {
  const where: any = { organizationId };
  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  const [total, successCount, failureCount, recentLogs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { ...where, status: "SUCCESS" } }),
    prisma.auditLog.count({ where: { ...where, status: { not: "SUCCESS" } } }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    total,
    successCount,
    failureCount,
    recentLogs,
  };
}
