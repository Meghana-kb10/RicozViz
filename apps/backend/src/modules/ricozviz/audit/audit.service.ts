import mongoose from 'mongoose';
import {
  AuditLogModel,
  type IAuditLogDocument,
  toObjectId,
  serializeDocs
} from '@repo/database';
import { logger } from '../../../utils/logger.js';
import { AUDIT_STATUS } from '@repo/types';
import type { AuditLogItem, AuditLogStatsResponse, QueryAuditLogsResponse } from '@repo/types';

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

export interface QueryAuditLogsServiceParams {
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
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'bearertoken',
  'credential',
  'credentials',
  'authorization'
]);

/**
 * Recursively strips sensitive fields from metadata before persisting.
 */
export function sanitizeMetadata(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMetadata);
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * In-memory ring buffer kept alongside MongoDB so governance events survive a
 * database outage and remain assertable in tests.
 */
const inMemoryAuditLogs: Record<string, unknown>[] = [];

export function getInMemoryAuditLogs(): Record<string, unknown>[] {
  return inMemoryAuditLogs;
}

export function clearInMemoryAuditLogs(): void {
  inMemoryAuditLogs.length = 0;
}

/**
 * Append a governance event. Never throws: audit failures must not break the
 * business operation that triggered them.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  const sanitizedMeta = (params.metadata
    ? sanitizeMetadata(params.metadata)
    : {}) as Record<string, unknown>;

  inMemoryAuditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    organizationId: params.organizationId,
    workspaceId: params.workspaceId ?? null,
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId ?? null,
    status: params.status || AUDIT_STATUS.SUCCESS,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    metadata: sanitizedMeta,
    createdAt: new Date()
  });

  try {
    const organizationId = toObjectId(params.organizationId);
    const userId = toObjectId(params.userId);
    if (!organizationId || !userId) {
      logger.warn('Skipping audit log with invalid organization/user id', {
        action: params.action
      });
      return;
    }

    await AuditLogModel.create({
      organizationId,
      workspaceId: params.workspaceId ? toObjectId(params.workspaceId) : null,
      userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ? toObjectId(params.resourceId) : null,
      status: params.status || AUDIT_STATUS.SUCCESS,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: sanitizedMeta
    });
  } catch (err: unknown) {
    logger.warn('Failed to write to audit log', {
      action: params.action,
      resourceType: params.resourceType,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

/** Build the Mongo filter shared by `queryAuditLogs` and `getAuditLogStats`. */
function buildFilter(
  params: QueryAuditLogsServiceParams
): mongoose.QueryFilter<IAuditLogDocument> {
  const filter: mongoose.QueryFilter<IAuditLogDocument> = {};

  const organizationId = toObjectId(params.organizationId);
  if (organizationId) {
    filter.organizationId = organizationId;
  }
  if (params.workspaceId) {
    filter.workspaceId = toObjectId(params.workspaceId);
  }
  if (params.action) {
    filter.action = params.action;
  }
  if (params.resourceType) {
    filter.resourceType = params.resourceType;
  }
  if (params.userId) {
    filter.userId = toObjectId(params.userId);
  }
  if (params.status) {
    filter.status = params.status;
  }

  if (params.startDate || params.endDate) {
    const createdAt: Record<string, Date> = {};
    if (params.startDate) {
      createdAt.$gte = new Date(params.startDate);
    }
    if (params.endDate) {
      createdAt.$lte = new Date(params.endDate);
    }
    filter.createdAt = createdAt;
  }

  if (params.search && params.search.trim().length > 0) {
    const s = params.search.trim();
    const rx = new RegExp(escapeRegExp(s), 'i');
    filter.$or = [
      { action: rx },
      { resourceType: rx },
      { resourceId: rx },
      { 'user.name': rx },
      { 'user.email': rx }
    ];
  }

  return filter;
}

/** Escape user input before embedding it in a RegExp (ReDoS + injection guard). */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function queryAuditLogs(
  params: QueryAuditLogsServiceParams
): Promise<QueryAuditLogsResponse> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const filter = buildFilter(params);

  try {
    const [total, docs] = await Promise.all([
      AuditLogModel.countDocuments(filter).exec(),
      AuditLogModel.find(filter)
        .populate('user', 'id name email avatarUrl')
        .populate('workspace', 'id name slug')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec()
    ]);

    return {
      total,
      limit,
      offset,
      logs: serializeDocs<AuditLogItem>(docs, { virtuals: true })
    };
  } catch {
    const filtered = inMemoryAuditLogs.filter((log) => {
      if (params.organizationId && log.organizationId !== params.organizationId) return false;
      if (params.action && log.action !== params.action) return false;
      if (params.resourceType && log.resourceType !== params.resourceType) return false;
      if (params.userId && log.userId !== params.userId) return false;
      if (params.workspaceId && log.workspaceId !== params.workspaceId) return false;
      return true;
    });

    return {
      total: filtered.length,
      limit,
      offset,
      logs: filtered.slice(offset, offset + limit) as unknown as AuditLogItem[]
    };
  }
}

export async function getAuditLogStats(
  organizationId: string,
  workspaceId?: string
): Promise<AuditLogStatsResponse> {
  const filter = buildFilter({ organizationId, workspaceId });

  const [total, successCount, failureCount, recentDocs] = await Promise.all([
    AuditLogModel.countDocuments(filter).exec(),
    AuditLogModel.countDocuments({ ...filter, status: AUDIT_STATUS.SUCCESS }).exec(),
    AuditLogModel.countDocuments({ ...filter, status: { $ne: AUDIT_STATUS.SUCCESS } }).exec(),
    AuditLogModel.find(filter)
      .populate('user', 'id name email')
      .sort({ createdAt: -1 })
      .limit(10)
      .exec()
  ]);

  return {
    total,
    successCount,
    failureCount,
    recentLogs: serializeDocs<AuditLogItem>(recentDocs, { virtuals: true })
  };
}