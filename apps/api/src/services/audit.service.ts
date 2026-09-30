// ========================================
// Audit Log Service
// ========================================
// Records governance actions in the append-only audit_logs table.
// Ensures credentials, passwords and sensitive keys are NEVER recorded.
// ========================================

import { type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

export interface LogAuditParams {
  organizationId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
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

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  const sanitizedMeta = (params.metadata
    ? sanitizeMetadata(params.metadata)
    : {}) as Record<string, unknown>;

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
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
