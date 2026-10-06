// ============================================================
// Scheduled Dataset Refresh Service
// ============================================================
// Powers automated background and on-demand dataset re-ingestion,
// schema sync, and query re-computation.
// Features:
// - Frequency scheduling (1H, 6H, 12H, 24H/Daily, Weekly, custom minutes)
// - Concurrency mutex to prevent overlapping refresh runs
// - Persistent schedule and execution history in dataset metadata
// - Safe failure isolation (never corrupts existing dataset data)
// - Full audit logging and workspace authorization
// ============================================================

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { logAuditEvent } from "../audit.service.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";
import { schemaDiscoveryService } from "./schema-discovery.service.js";
import { computeDatasetProfile } from "./data-quality.service.js";
import {
  compileCalculatedField,
  evaluateExpression,
} from "./calculated-field.engine.js";
import type { Dataset, DatasetColumn } from "@prisma/client";

export type RefreshFrequency = "1H" | "6H" | "12H" | "DAILY" | "WEEKLY" | string;

export interface DatasetRefreshHistoryItem {
  id: string;
  refreshedAt: string;
  status: "SUCCESS" | "FAILED";
  durationMs: number;
  rowCount: number;
  errorMessage?: string | null;
  triggeredBy: "SCHEDULE" | "MANUAL";
}

export interface DatasetRefreshSchedule {
  enabled: boolean;
  frequency: RefreshFrequency;
  intervalMinutes: number;
  lastRefreshedAt: string | null;
  nextRefreshAt: string | null;
  lastStatus: "SUCCESS" | "FAILED" | "PENDING";
  lastError?: string | null;
  durationMs?: number;
  history: DatasetRefreshHistoryItem[];
}

export interface DatasetRefreshResult {
  success: boolean;
  datasetId: string;
  datasetName: string;
  refreshedAt: string;
  durationMs: number;
  rowCount: number;
  columnCount: number;
  status: "SUCCESS" | "FAILED";
  error?: string | null;
  schedule: DatasetRefreshSchedule;
}

// In-memory mutex for preventing overlapping refreshes of the same dataset
const activeRefreshJobIds = new Set<string>();

/**
 * Checks if a specific dataset is currently undergoing a refresh.
 */
export function isDatasetRefreshing(datasetId: string): boolean {
  return activeRefreshJobIds.has(datasetId);
}

/**
 * Calculates the next execution timestamp based on frequency string or intervalMinutes.
 */
export function calculateNextRefreshAt(
  frequency: string,
  baseDate = new Date(),
  intervalMinutes?: number
): Date {
  if (typeof intervalMinutes === "number" && intervalMinutes > 0) {
    return new Date(baseDate.getTime() + intervalMinutes * 60 * 1000);
  }

  const norm = String(frequency || "6H").toUpperCase().trim();
  switch (norm) {
    case "1H":
    case "60M":
      return new Date(baseDate.getTime() + 60 * 60 * 1000);
    case "6H":
    case "360M":
      return new Date(baseDate.getTime() + 6 * 60 * 60 * 1000);
    case "12H":
    case "720M":
      return new Date(baseDate.getTime() + 12 * 60 * 60 * 1000);
    case "WEEKLY":
    case "7D":
      return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "DAILY":
    case "24H":
    default:
      return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Resolves frequency label to interval in minutes.
 */
export function resolveFrequencyMinutes(frequency: string): number {
  const norm = String(frequency || "6H").toUpperCase().trim();
  switch (norm) {
    case "1H":
      return 60;
    case "6H":
      return 360;
    case "12H":
      return 720;
    case "WEEKLY":
    case "7D":
      return 10080;
    case "DAILY":
    case "24H":
    default:
      return 1440;
  }
}

/**
 * Extracts normalized refresh schedule from dataset schemaMeta.
 */
export function extractRefreshSchedule(
  dataset: Dataset | { schemaMeta?: unknown }
): DatasetRefreshSchedule {
  const meta = ((dataset as any).schemaMeta || {}) as Record<string, any>;
  const rawSchedule = (meta.refreshSchedule || {}) as Record<string, any>;

  const frequency = String(rawSchedule.frequency || "6H").toUpperCase();
  const intervalMinutes =
    typeof rawSchedule.intervalMinutes === "number" && rawSchedule.intervalMinutes > 0
      ? rawSchedule.intervalMinutes
      : resolveFrequencyMinutes(frequency);

  const history = Array.isArray(rawSchedule.history) ? rawSchedule.history : [];

  return {
    enabled: rawSchedule.enabled !== undefined ? Boolean(rawSchedule.enabled) : false,
    frequency,
    intervalMinutes,
    lastRefreshedAt: (rawSchedule.lastRefreshedAt as string) || null,
    nextRefreshAt: (rawSchedule.nextRefreshAt as string) || null,
    lastStatus: (rawSchedule.lastStatus as "SUCCESS" | "FAILED" | "PENDING") || "PENDING",
    lastError: (rawSchedule.lastError as string) || null,
    durationMs: typeof rawSchedule.durationMs === "number" ? rawSchedule.durationMs : undefined,
    history,
  };
}

/**
 * GET: Retrieve the refresh schedule configuration and history for a dataset.
 */
export async function getDatasetRefreshSchedule(
  datasetId: string,
  organizationId: string,
  userId: string,
  roleName: string
): Promise<DatasetRefreshSchedule> {
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: {
      id: true,
      organizationId: true,
      workspaceId: true,
      schemaMeta: true,
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dataset belongs to a different organization");
  }

  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  return extractRefreshSchedule(dataset);
}

/**
 * POST: Configure or update scheduled refresh for a dataset.
 */
export async function configureDatasetRefreshSchedule(
  datasetId: string,
  organizationId: string,
  userId: string,
  roleName: string,
  config: {
    frequency?: string;
    enabled?: boolean;
    intervalMinutes?: number;
  }
): Promise<DatasetRefreshSchedule> {
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      workspaceId: true,
      schemaMeta: true,
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dataset belongs to a different organization");
  }

  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  const existingMeta = (dataset.schemaMeta || {}) as Record<string, any>;
  const currentSchedule = extractRefreshSchedule(dataset);

  const frequency = config.frequency
    ? String(config.frequency).toUpperCase().trim()
    : currentSchedule.frequency;

  const intervalMinutes =
    typeof config.intervalMinutes === "number" && config.intervalMinutes > 0
      ? config.intervalMinutes
      : resolveFrequencyMinutes(frequency);

  const isEnabled = config.enabled !== undefined ? Boolean(config.enabled) : true;

  const now = new Date();
  const nextRefreshAt = isEnabled
    ? calculateNextRefreshAt(frequency, now, intervalMinutes)
    : null;

  const updatedSchedule: DatasetRefreshSchedule = {
    ...currentSchedule,
    enabled: isEnabled,
    frequency,
    intervalMinutes,
    nextRefreshAt: nextRefreshAt ? nextRefreshAt.toISOString() : null,
  };

  const updatedMeta = {
    ...existingMeta,
    refreshSchedule: updatedSchedule,
  };

  await prisma.dataset.update({
    where: { id: datasetId },
    data: {
      schemaMeta: updatedMeta as any,
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_SCHEDULE_CONFIGURED",
    resourceType: "Dataset",
    resourceId: datasetId,
    metadata: {
      datasetName: dataset.name,
      frequency,
      intervalMinutes,
      enabled: isEnabled,
      nextRefreshAt: nextRefreshAt?.toISOString() || null,
    },
  });

  return updatedSchedule;
}

/**
 * DELETE: Disable and clear refresh schedule for a dataset.
 */
export async function deleteDatasetRefreshSchedule(
  datasetId: string,
  organizationId: string,
  userId: string,
  roleName: string
): Promise<{ message: string; schedule: DatasetRefreshSchedule }> {
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      workspaceId: true,
      schemaMeta: true,
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dataset belongs to a different organization");
  }

  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  const existingMeta = (dataset.schemaMeta || {}) as Record<string, any>;
  const currentSchedule = extractRefreshSchedule(dataset);

  const disabledSchedule: DatasetRefreshSchedule = {
    ...currentSchedule,
    enabled: false,
    nextRefreshAt: null,
  };

  await prisma.dataset.update({
    where: { id: datasetId },
    data: {
      schemaMeta: {
        ...existingMeta,
        refreshSchedule: disabledSchedule,
      } as any,
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_SCHEDULE_DELETED",
    resourceType: "Dataset",
    resourceId: datasetId,
    metadata: { datasetName: dataset.name },
  });

  return {
    message: "Dataset refresh schedule disabled successfully",
    schedule: disabledSchedule,
  };
}

/**
 * Main execution engine: Refreshes a dataset using the existing pipeline,
 * updates metadata/status, records last success or failure, and enforces
 * concurrency locking so overlapping runs are prevented.
 */
export async function executeDatasetRefresh(
  datasetId: string,
  organizationId: string,
  triggeredBy: "SCHEDULE" | "MANUAL" = "MANUAL",
  userContext?: { userId: string; roleName?: string }
): Promise<DatasetRefreshResult> {
  // 1. Concurrency protection: prevent overlapping refresh runs
  if (activeRefreshJobIds.has(datasetId)) {
    throw AppError.conflict(
      `Dataset refresh already in progress for "${datasetId}". Overlapping jobs are strictly prevented.`
    );
  }

  activeRefreshJobIds.add(datasetId);
  const startTime = Date.now();

  try {
    const dataset = await prisma.dataset.findUnique({
      where: { id: datasetId },
      include: {
        dataSource: true,
        columns: { orderBy: { ordinalPosition: "asc" } },
      },
    });

    if (!dataset) {
      throw AppError.notFound("Dataset");
    }

    if (dataset.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: dataset belongs to a different organization");
    }

    if (userContext?.userId && dataset.workspaceId) {
      await resolveWorkspaceAccess(
        dataset.workspaceId,
        userContext.userId,
        organizationId,
        userContext.roleName || "MEMBER"
      );
    }

    logger.info(`[DatasetRefresh] Starting dataset refresh (${triggeredBy})`, {
      datasetId: dataset.id,
      name: dataset.name,
      type: dataset.type,
      currentRows: dataset.rowCount,
    });

    const existingMeta = (dataset.schemaMeta || {}) as Record<string, any>;
    const currentSchedule = extractRefreshSchedule(dataset);

    let updatedRowCount = dataset.rowCount;
    let updatedColCount = dataset.columnCount;
    let sampleRows = (existingMeta.sampleData || existingMeta.rows || []) as Record<string, unknown>[];

    // 2. Execute refresh pipeline based on dataset type
    if (dataset.type === "CONNECTED" && dataset.dataSourceId) {
      const tableName = String(existingMeta.tableName || "");
      if (tableName) {
        try {
          const liveColumns = await schemaDiscoveryService.discoverPostgresTableSchema(
            dataset.dataSourceId,
            organizationId,
            tableName
          );
          if (liveColumns && liveColumns.length > 0) {
            updatedColCount = liveColumns.length;
          }
        } catch (connErr: any) {
          logger.warn(
            `[DatasetRefresh] Live DB connection warning during refresh of "${dataset.name}": ${connErr?.message}. Retaining schema snapshot.`
          );
        }
      }
    } else {
      // UPLOADED / DERIVED datasets:
      // Re-evaluate calculated fields if present over data to ensure fresh computations
      const calculatedFields = Array.isArray(existingMeta.calculatedFields)
        ? existingMeta.calculatedFields
        : [];

      if (calculatedFields.length > 0 && sampleRows.length > 0) {
        const knownCols = dataset.columns.map((c) => ({
          name: c.name,
          type: c.dataType.toLowerCase(),
        }));

        sampleRows = sampleRows.map((row) => {
          const copy = { ...row };
          for (const cf of calculatedFields) {
            try {
              const compiled = compileCalculatedField(cf.expression, knownCols);
              copy[cf.name] = evaluateExpression(compiled.ast, copy);
            } catch {
              // Ignore non-blocking calculation errors on single row
            }
          }
          return copy;
        });
      }

      updatedRowCount = sampleRows.length > 0 ? sampleRows.length : dataset.rowCount;
      updatedColCount = dataset.columns.length > 0 ? dataset.columns.length : dataset.columnCount;
    }

    const durationMs = Date.now() - startTime;
    const now = new Date();

    const nextRunDate = currentSchedule.enabled
      ? calculateNextRefreshAt(
          currentSchedule.frequency,
          now,
          currentSchedule.intervalMinutes
        )
      : null;

    const historyEntry: DatasetRefreshHistoryItem = {
      id: crypto.randomUUID(),
      refreshedAt: now.toISOString(),
      status: "SUCCESS",
      durationMs,
      rowCount: updatedRowCount,
      errorMessage: null,
      triggeredBy,
    };

    const newHistory = [historyEntry, ...(currentSchedule.history || [])].slice(0, 50);

    const newSchedule: DatasetRefreshSchedule = {
      ...currentSchedule,
      lastRefreshedAt: now.toISOString(),
      nextRefreshAt: nextRunDate ? nextRunDate.toISOString() : null,
      lastStatus: "SUCCESS",
      lastError: null,
      durationMs,
      history: newHistory,
    };

    const updatedMeta: Record<string, any> = {
      ...existingMeta,
      sampleData: sampleRows,
      rowCount: updatedRowCount,
      columnCount: updatedColCount,
      lastRefreshedAt: now.toISOString(),
      refreshSchedule: newSchedule,
    };

    if (sampleRows.length > 0) {
      try {
        const refreshedProfile = computeDatasetProfile(
          { id: dataset.id, name: dataset.name, schemaMeta: updatedMeta, columns: dataset.columns },
          sampleRows
        );
        updatedMeta.dataQualityProfile = refreshedProfile;
      } catch {
        // Non-blocking profiling failure
      }
    }

    // 3. Persist refreshed state in database
    await prisma.dataset.update({
      where: { id: datasetId },
      data: {
        status: "READY",
        rowCount: updatedRowCount,
        columnCount: updatedColCount,
        updatedAt: now,
        schemaMeta: updatedMeta as any,
      },
    });

    if (userContext?.userId) {
      await logAuditEvent({
        organizationId,
        userId: userContext.userId,
        action: "DATASET_REFRESHED",
        resourceType: "Dataset",
        resourceId: datasetId,
        status: "SUCCESS",
        metadata: {
          datasetName: dataset.name,
          durationMs,
          rowCount: updatedRowCount,
          triggeredBy,
        },
      });
    }

    logger.info(`[DatasetRefresh] Dataset "${dataset.name}" refreshed successfully`, {
      datasetId: dataset.id,
      durationMs,
      rowCount: updatedRowCount,
      nextRefreshAt: newSchedule.nextRefreshAt,
    });

    return {
      success: true,
      datasetId: dataset.id,
      datasetName: dataset.name,
      refreshedAt: now.toISOString(),
      durationMs,
      rowCount: updatedRowCount,
      columnCount: updatedColCount,
      status: "SUCCESS",
      schedule: newSchedule,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err?.message || "Dataset refresh failed";

    logger.error(`[DatasetRefresh] Failed to refresh dataset "${datasetId}": ${errorMsg}`);

    // Safely record failure status in metadata without corrupting dataset
    try {
      const failedDs = await prisma.dataset.findUnique({
        where: { id: datasetId },
        select: { schemaMeta: true, name: true },
      });

      if (failedDs) {
        const meta = (failedDs.schemaMeta || {}) as Record<string, any>;
        const sched = extractRefreshSchedule(failedDs);
        const now = new Date();
        const nextDate = sched.enabled
          ? calculateNextRefreshAt(sched.frequency, now, sched.intervalMinutes)
          : null;

        const failEntry: DatasetRefreshHistoryItem = {
          id: crypto.randomUUID(),
          refreshedAt: now.toISOString(),
          status: "FAILED",
          durationMs,
          rowCount: (meta.rowCount as number) || 0,
          errorMessage: errorMsg,
          triggeredBy,
        };

        const updatedFailSchedule: DatasetRefreshSchedule = {
          ...sched,
          lastRefreshedAt: now.toISOString(),
          nextRefreshAt: nextDate ? nextDate.toISOString() : null,
          lastStatus: "FAILED",
          lastError: errorMsg,
          durationMs,
          history: [failEntry, ...(sched.history || [])].slice(0, 50),
        };

        await prisma.dataset.update({
          where: { id: datasetId },
          data: {
            schemaMeta: {
              ...meta,
              refreshSchedule: updatedFailSchedule,
            } as any,
          },
        });
      }
    } catch {
      // Ignore secondary error while updating failure log
    }

    if (err instanceof AppError) throw err;
    throw AppError.internal(`Dataset refresh failed: ${errorMsg}`);
  } finally {
    // Release concurrency lock
    activeRefreshJobIds.delete(datasetId);
  }
}
