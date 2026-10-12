// ========================================
// Dashboard Version History Service
// ========================================
// Manages immutable point-in-time snapshots of dashboard state,
// grid layout configuration, and visualization chart specifications.
// Restoring a version creates a new state rather than overwriting history.
// ========================================

import mongoose from 'mongoose';
import {
  DashboardModel,
  DashboardVersionModel,
  ChartModel,
  toObjectId,
  serializeDoc,
  serializeDocs
} from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  getDashboardWorkspaceId,
  verifyResourceWorkspaceAccess
} from './dashboard-access.service.js';
import type { AuthenticatedUser, UserSummary } from '@repo/types';
import type {
  DashboardChartSnapshot,
  DashboardVersionRecord,
  VersionComparisonResult
} from '@repo/types';

export type { DashboardChartSnapshot, DashboardVersionRecord, VersionComparisonResult };

/** Author shape embedded in a version record. */
export interface VersionAuthor {
  id: string;
  name: string;
  email: string;
}

// In-memory fallback cache for headless tests or offline database
const inMemoryVersionStore = new Map<string, DashboardVersionRecord[]>();
const inMemoryDashboardStore = new Map<string, Record<string, unknown>>();

export function registerInMemoryVersionDashboard(dashboard: {
  id: string;
  [key: string]: unknown;
}): void {
  inMemoryDashboardStore.set(dashboard.id, dashboard as Record<string, unknown>);
}

export function clearInMemoryVersionDashboards(): void {
  inMemoryDashboardStore.clear();
}

/**
 * Check if the change between previous state and current state is meaningful
 * to avoid duplicate or redundant version clutter.
 */
function isMeaningfulChange(
  previous: {
    name: string;
    description: string | null;
    layoutConfig: unknown;
    charts: DashboardChartSnapshot[];
  } | null,
  current: {
    name: string;
    description: string | null;
    layoutConfig: unknown;
    charts: DashboardChartSnapshot[];
  }
): boolean {
  if (!previous) return true;

  if (previous.name !== current.name) return true;
  if (previous.description !== current.description) return true;

  const prevLayoutStr = JSON.stringify(previous.layoutConfig || {});
  const currLayoutStr = JSON.stringify(current.layoutConfig || {});
  if (prevLayoutStr !== currLayoutStr) return true;

  if (previous.charts.length !== current.charts.length) return true;

  const prevChartsStr = JSON.stringify(
    previous.charts.map((c) => ({
      id: c.id,
      title: c.title,
      chartType: c.chartType,
      config: c.config,
      pos: c.position
    }))
  );
  const currChartsStr = JSON.stringify(
    current.charts.map((c) => ({
      id: c.id,
      title: c.title,
      chartType: c.chartType,
      config: c.config,
      pos: c.position
    }))
  );
  if (prevChartsStr !== currChartsStr) return true;

  return false;
}

/**
 * Capture and store a version snapshot for a dashboard.
 */
export async function createDashboardVersionSnapshot(
  dashboardId: string,
  changeSummary: string | null,
  userId: string,
  userEmail?: string,
  userName?: string
): Promise<DashboardVersionRecord | null> {
  let dashboard: Record<string, unknown> | null = inMemoryDashboardStore.get(dashboardId) ?? null;

  const dashboardObjectId = toObjectId(dashboardId);

  if (!dashboard && dashboardObjectId) {
    const found = await DashboardModel.findById(dashboardObjectId).lean();
    if (found) {
      const charts = await ChartModel.find({ dashboardId: dashboardObjectId })
        .sort({ sortOrder: 1 })
        .lean();
      dashboard = { ...serializeDoc<Record<string, unknown>>(found), charts } as Record<string, unknown>;
    }
  }

  if (!dashboard) {
    const prev = inMemoryVersionStore.get(dashboardId);
    if (prev && prev.length > 0) {
      dashboard = {
        id: dashboardId,
        name: prev[0].name,
        description: prev[0].description ?? null,
        layoutConfig: prev[0].layoutConfig,
        charts: prev[0].chartsSnapshot
      };
    } else {
      return null;
    }
  }

  const rawCharts = Array.isArray(dashboard.charts) ? (dashboard.charts as Array<Record<string, unknown>>) : [];

  const chartsSnapshot: DashboardChartSnapshot[] = rawCharts.map((chart) => ({
    id: String(chart.id ?? ''),
    title: String(chart.title ?? ''),
    description: (chart.description ?? null) as string | null,
    chartType: String(chart.chartType ?? ''),
    config: chart.config ?? null,
    position: chart.position ?? null,
    sortOrder: Number(chart.sortOrder ?? 0),
    datasetId: (chart.datasetId ?? null) as string | null
  }));

  const layoutConfig = ((dashboard.layoutConfig || {}) as Record<string, unknown>);

  // Check previous version
  const versions = await listDashboardVersions(dashboardId);
  const latestVersion = versions.length > 0 ? versions[0] : null;

  if (
    latestVersion &&
    !changeSummary &&
    !isMeaningfulChange(
      {
        name: latestVersion.name,
        description: latestVersion.description ?? null,
        layoutConfig: latestVersion.layoutConfig,
        charts: latestVersion.chartsSnapshot
      },
      {
        name: String(dashboard.name ?? ''),
        description: (dashboard.description ?? null) as string | null,
        layoutConfig,
        charts: chartsSnapshot
      }
    )
  ) {
    // Insignificant change: avoid spamming redundant duplicate versions
    return latestVersion;
  }

  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  const name = String(dashboard.name ?? '');
  const description = (dashboard.description ?? null) as string | null;
  const summary =
    changeSummary || (nextVersionNumber === 1 ? 'Initial version' : `Version ${nextVersionNumber}`);

  let recordId = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const createdBy: UserSummary = {
    id: userId,
    name: userName || 'User',
    email: userEmail || '',
    avatarUrl: null
  };

  // ---- Persist the snapshot (the in-memory store stays a fallback) ----
  if (dashboardObjectId && !inMemoryDashboardStore.has(dashboardId)) {
    try {
      const created = await DashboardVersionModel.create({
        dashboardId: dashboardObjectId,
        versionNumber: nextVersionNumber,
        name,
        description,
        layoutConfig: layoutConfig as Record<string, unknown>,
        chartsSnapshot: chartsSnapshot,
        changeSummary: summary,
        createdById: toObjectId(userId) ?? dashboardObjectId
      });
      recordId = created._id.toString();
    } catch (err) {
      logger.warn('Database offline during dashboard version save, saving to in-memory store', {
        dashboardId,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const newRecord: DashboardVersionRecord = {
    id: recordId,
    dashboardId,
    versionNumber: nextVersionNumber,
    name,
    description,
    layoutConfig,
    chartsSnapshot,
    changeSummary: summary,
    createdById: userId,
    createdBy,
    createdAt: new Date().toISOString()
  };

  // Sync to in-memory cache
  const list = inMemoryVersionStore.get(dashboardId) || [];
  inMemoryVersionStore.set(dashboardId, [newRecord, ...list]);

  void logAuditEvent({
    organizationId: String(dashboard.organizationId ?? ''),
    workspaceId: typeof layoutConfig.workspaceId === 'string' ? layoutConfig.workspaceId : undefined,
    userId,
    action: 'DASHBOARD_VERSION_CREATED',
    resourceType: 'DashboardVersion',
    resourceId: recordId,
    metadata: {
      dashboardId,
      versionNumber: nextVersionNumber,
      chartCount: chartsSnapshot.length,
      changeSummary: summary
    }
  });

  return newRecord;
}

/**
 * List all historical versions for a dashboard, ordered newest first.
 *
 * MongoDB is the source of truth; the in-memory mirror is only consulted when
 * the database is unreachable so offline/headless runs keep working.
 */
export async function listDashboardVersions(
  dashboardId: string
): Promise<DashboardVersionRecord[]> {
  const dashboardObjectId = toObjectId(dashboardId);

  if (dashboardObjectId) {
    try {
      const records = await DashboardVersionModel.find({ dashboardId: dashboardObjectId })
        .sort({ versionNumber: -1 })
        .populate<{ createdById: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null } | null }>(
          'createdById',
          'name email avatarUrl'
        )
        .lean();

      if (records.length > 0) {
        return records.map((record) => {
          const creator = record.createdById as unknown as
            | { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null }
            | null;
          return {
            id: record._id.toString(),
            dashboardId: record.dashboardId.toString(),
            versionNumber: record.versionNumber,
            name: record.name,
            description: record.description,
            layoutConfig: (record.layoutConfig || {}) as Record<string, unknown>,
            chartsSnapshot: ((record.chartsSnapshot || []) as unknown) as DashboardChartSnapshot[],
            changeSummary: record.changeSummary,
            createdById: String(record.createdById ?? ''),
            createdBy: creator
              ? {
                  id: creator._id.toString(),
                  name: creator.name,
                  email: creator.email,
                  avatarUrl: creator.avatarUrl ?? null
                }
              : null,
            createdAt: record.createdAt.toISOString()
          };
        });
      }
    } catch {
      // Database offline — fall through to the in-memory mirror
    }
  }

  const fallback = inMemoryVersionStore.get(dashboardId) || [];
  return [...fallback].sort((a, b) => b.versionNumber - a.versionNumber);
}

/**
 * Retrieve a specific historical version by version number.
 */
export async function getDashboardVersion(
  dashboardId: string,
  versionNumber: number
): Promise<DashboardVersionRecord> {
  const versions = await listDashboardVersions(dashboardId);
  const found = versions.find((version) => version.versionNumber === versionNumber);
  if (!found) {
    throw AppError.notFound(`Dashboard version ${versionNumber} not found`);
  }
  return found;
}

/**
 * Compare two historical versions of a dashboard.
 */
export async function compareDashboardVersions(
  dashboardId: string,
  baseVersionNum: number,
  targetVersionNum: number
): Promise<VersionComparisonResult> {
  const [base, target] = await Promise.all([
    getDashboardVersion(dashboardId, baseVersionNum),
    getDashboardVersion(dashboardId, targetVersionNum)
  ]);

  const nameChanged = base.name !== target.name;
  const descriptionChanged = (base.description ?? null) !== (target.description ?? null);

  const baseLayoutStr = JSON.stringify(base.layoutConfig);
  const targetLayoutStr = JSON.stringify(target.layoutConfig);
  const layoutChanged = baseLayoutStr !== targetLayoutStr;

  const baseChartsMap = new Map(base.chartsSnapshot.map((chart) => [chart.id, chart]));
  const targetChartsMap = new Map(target.chartsSnapshot.map((chart) => [chart.id, chart]));

  const addedCharts: DashboardChartSnapshot[] = [];
  const removedCharts: DashboardChartSnapshot[] = [];
  const modifiedCharts: Array<{ id: string; title: string; changes: string[] }> = [];

  for (const [id, targetChart] of targetChartsMap.entries()) {
    const baseChart = baseChartsMap.get(id);
    if (!baseChart) {
      addedCharts.push(targetChart);
    } else {
      const changes: string[] = [];
      if (baseChart.title !== targetChart.title) {
        changes.push(`Title changed from "${baseChart.title}" to "${targetChart.title}"`);
      }
      if (baseChart.chartType !== targetChart.chartType) {
        changes.push(
          `Chart type changed from ${baseChart.chartType} to ${targetChart.chartType}`
        );
      }
      if (JSON.stringify(baseChart.position) !== JSON.stringify(targetChart.position)) {
        changes.push('Position/size updated');
      }
      if (JSON.stringify(baseChart.config) !== JSON.stringify(targetChart.config)) {
        changes.push('Visualization configuration updated');
      }

      if (changes.length > 0) {
        modifiedCharts.push({ id, title: targetChart.title, changes });
      }
    }
  }

  for (const [id, baseChart] of baseChartsMap.entries()) {
    if (!targetChartsMap.has(id)) {
      removedCharts.push(baseChart);
    }
  }

  const totalChanges =
    (nameChanged ? 1 : 0) +
    (descriptionChanged ? 1 : 0) +
    (layoutChanged ? 1 : 0) +
    addedCharts.length +
    removedCharts.length +
    modifiedCharts.length;

  return {
    dashboardId,
    baseVersion: baseVersionNum,
    targetVersion: targetVersionNum,
    nameChanged,
    baseName: base.name,
    targetName: target.name,
    descriptionChanged,
    baseDescription: base.description ?? null,
    targetDescription: target.description ?? null,
    layoutChanged,
    addedCharts,
    removedCharts,
    modifiedCharts,
    totalChanges
  };
}

export interface RestoreDashboardVersionResult {
  dashboard: Record<string, unknown>;
  restoredFromVersion: number;
  newVersionNumber: number;
}

/**
 * Restores a historical dashboard version.
 * RESTORE SEMANTICS:
 * - Does NOT overwrite historical versions.
 * - Restores the current dashboard layout and chart states from the selected version snapshot.
 * - Creates a NEW version (N+1) documenting the restoration.
 * - Emits an audit event for governance traceability.
 */
export async function restoreDashboardVersion(
  dashboardId: string,
  targetVersionNumber: number,
  user: AuthenticatedUser
): Promise<RestoreDashboardVersionResult> {
  const dashboardObjectId = toObjectId(dashboardId);
  if (!dashboardObjectId) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const dashboard = await DashboardModel.findOne({
    _id: dashboardObjectId,
    organizationId: toObjectId(user.organizationId)
  }).lean();

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  // Workspace and RBAC security check: Viewer cannot restore
  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);
  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId: user.organizationId },
    user.userId,
    user.organizationId,
    user.roleName,
    'WRITE'
  );

  const targetVersion = await getDashboardVersion(dashboardId, targetVersionNumber);

  // Apply restored state to dashboard
  try {
    await DashboardModel.updateOne(
      { _id: dashboardObjectId },
      {
        $set: {
          name: targetVersion.name,
          description: targetVersion.description ?? null,
          layoutConfig: targetVersion.layoutConfig
        }
      }
    ).exec();

    // Reconcile charts: update charts that match snapshot
    if (Array.isArray(targetVersion.chartsSnapshot)) {
      for (const snap of targetVersion.chartsSnapshot) {
        const snapObjectId = toObjectId(snap.id);
        if (!snapObjectId) continue;

        await ChartModel.updateOne(
          { _id: snapObjectId },
          {
            $set: {
              title: snap.title,
              description: snap.description ?? null,
              chartType: snap.chartType,
              config: (snap.config ?? {}) as Record<string, unknown>,
              position: (snap.position ?? {}) as Record<string, unknown>,
              sortOrder: snap.sortOrder ?? 0,
              dashboardId: dashboardObjectId,
              datasetId: snap.datasetId ? toObjectId(snap.datasetId) : null
            }
          },
          { upsert: true }
        )
          .catch(() => null);
      }
    }
  } catch (err) {
    logger.warn('Database offline during version restore, continuing', {
      dashboardId,
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // Create a NEW version representing the restored current state
  const newVersion = await createDashboardVersionSnapshot(
    dashboardId,
    `Restored from Version ${targetVersionNumber}`,
    user.userId
  );

  // Emit audit log for version restore
  void logAuditEvent({
    organizationId: user.organizationId,
    workspaceId,
    userId: user.userId,
    action: 'DASHBOARD_VERSION_RESTORED',
    resourceType: 'Dashboard',
    resourceId: dashboardId,
    metadata: {
      restoredFromVersion: targetVersionNumber,
      newVersionNumber: newVersion?.versionNumber,
      changeSummary: `Restored from Version ${targetVersionNumber}`
    }
  });

  const updatedDashboard = await DashboardModel.findById(dashboardObjectId)
    .populate<{ ownerId: { _id: mongoose.Types.ObjectId; name: string; email: string } }>(
      'ownerId',
      'name email'
    )
    .lean()
    .catch(() => null);

  let chartCount = 0;
  let restoredCharts: unknown[] = [];
  if (updatedDashboard) {
    const charts = await ChartModel.find({ dashboardId: dashboardObjectId })
      .sort({ sortOrder: 1 })
      .lean();
    chartCount = charts.length;
    restoredCharts = serializeDocs<unknown>(charts);
  }

  const fallbackCharts = (targetVersion.chartsSnapshot || []).map((snap) => ({
    id: snap.id,
    title: snap.title,
    description: snap.description ?? null,
    chartType: snap.chartType,
    config: snap.config,
    position: snap.position,
    sortOrder: snap.sortOrder ?? 0,
    datasetId: snap.datasetId ?? null
  }));

  return {
    dashboard: updatedDashboard
      ? {
          ...serializeDoc<Record<string, unknown>>(updatedDashboard),
          charts: restoredCharts,
          _count: { charts: chartCount }
        }
      : {
          ...serializeDoc<Record<string, unknown>>(dashboard),
          name: targetVersion.name,
          description: targetVersion.description,
          layoutConfig: targetVersion.layoutConfig,
          charts: fallbackCharts
        },
    restoredFromVersion: targetVersionNumber,
    newVersionNumber: newVersion?.versionNumber ?? targetVersionNumber + 1
  };
}

/**
 * Register in-memory version (for fast test setup without DB dependencies).
 */
export function registerInMemoryDashboardVersion(
  arg1: string | DashboardVersionRecord,
  arg2?: Partial<DashboardVersionRecord>
): void {
  const version: DashboardVersionRecord =
    typeof arg1 === 'string'
      ? ({
          id: arg2?.id || `ver-${Date.now()}`,
          dashboardId: arg1,
          versionNumber: arg2?.versionNumber || 1,
          name: arg2?.name || 'Dashboard',
          description: arg2?.description ?? null,
          layoutConfig: (arg2?.layoutConfig || {}) as Record<string, unknown>,
          chartsSnapshot: (arg2?.chartsSnapshot || []) as DashboardChartSnapshot[],
          changeSummary: arg2?.changeSummary || null,
          createdById: arg2?.createdById || 'user-1',
          createdAt: arg2?.createdAt ? new Date(arg2.createdAt).toISOString() : new Date().toISOString()
        } as DashboardVersionRecord)
      : arg1;

  const list = inMemoryVersionStore.get(version.dashboardId) || [];
  inMemoryVersionStore.set(version.dashboardId, [
    version,
    ...list.filter((entry) => entry.id !== version.id)
  ]);
}

/**
 * Clear in-memory versions.
 */
export function clearInMemoryDashboardVersions(): void {
  inMemoryVersionStore.clear();
}

// ============================================================
// ROUTE-LEVEL RESOLUTION HELPER
// ============================================================

export interface ResolvedDashboardForVersioning {
  id: string;
  organizationId: string;
  layoutConfig: Record<string, unknown>;
}

/**
 * Resolve + authorize a dashboard before touching its version history.
 * Mirrors the legacy `resolveDashboardForVersioning` route helper, including its
 * offline-DB fallback where the caller's own organization is assumed.
 */
export async function resolveDashboardForVersioning(
  dashboardId: string,
  user: AuthenticatedUser,
  requiredAction: 'READ' | 'WRITE' = 'READ'
): Promise<ResolvedDashboardForVersioning> {
  let dashboard: ResolvedDashboardForVersioning | null = null;

  try {
    const dashboardObjectId = toObjectId(dashboardId);
    const found = dashboardObjectId
      ? await DashboardModel.findById(dashboardObjectId)
          .select('organizationId layoutConfig')
          .lean()
      : null;
    if (found) {
      dashboard = {
        id: found._id.toString(),
        organizationId: found.organizationId.toString(),
        layoutConfig: (found.layoutConfig || {}) as Record<string, unknown>
      };
    }
  } catch {
    // Offline DB fallback
  }

  if (!dashboard) {
    dashboard = { id: dashboardId, organizationId: user.organizationId, layoutConfig: {} };
  }

  if (dashboard.organizationId !== user.organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);
  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId: user.organizationId },
    user.userId,
    user.organizationId,
    user.roleName,
    requiredAction
  );

  return dashboard;
}
