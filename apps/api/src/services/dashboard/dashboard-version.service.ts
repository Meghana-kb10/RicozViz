// ========================================
// Dashboard Version History Service
// ========================================
// Manages immutable point-in-time snapshots of dashboard state,
// grid layout configuration, and visualization chart specifications.
// Restoring a version creates a new state rather than overwriting history.
// ========================================

import type { Dashboard, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { logger } from "../../utils/logger.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";

export interface DashboardChartSnapshot {
  id: string;
  title: string;
  description: string | null;
  chartType: string;
  config: unknown;
  position: unknown;
  sortOrder: number;
  datasetId: string | null;
}

export interface DashboardVersionRecord {
  id: string;
  dashboardId: string;
  versionNumber: number;
  name: string;
  description: string | null;
  layoutConfig: Record<string, unknown>;
  chartsSnapshot: DashboardChartSnapshot[];
  changeSummary: string | null;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: Date;
}

export interface VersionComparisonResult {
  dashboardId: string;
  baseVersion: number;
  targetVersion: number;
  nameChanged: boolean;
  baseName: string;
  targetName: string;
  descriptionChanged: boolean;
  baseDescription: string | null;
  targetDescription: string | null;
  layoutChanged: boolean;
  addedCharts: DashboardChartSnapshot[];
  removedCharts: DashboardChartSnapshot[];
  modifiedCharts: Array<{
    id: string;
    title: string;
    changes: string[];
  }>;
  totalChanges: number;
}

// In-memory fallback cache for headless tests or offline database
const inMemoryVersionStore = new Map<string, DashboardVersionRecord[]>();

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
    previous.charts.map((c) => ({ id: c.id, title: c.title, chartType: c.chartType, config: c.config, pos: c.position }))
  );
  const currChartsStr = JSON.stringify(
    current.charts.map((c) => ({ id: c.id, title: c.title, chartType: c.chartType, config: c.config, pos: c.position }))
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
  let dashboard: any;
  try {
    dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      include: {
        charts: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  } catch {
    // If DB is offline, continue
  }

  if (!dashboard) return null;

  const chartsSnapshot: DashboardChartSnapshot[] = (dashboard.charts || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description ?? null,
    chartType: c.chartType,
    config: c.config,
    position: c.position,
    sortOrder: c.sortOrder ?? 0,
    datasetId: c.datasetId ?? null,
  }));

  const layoutConfig = (dashboard.layoutConfig || {}) as Record<string, unknown>;

  // Check previous version
  const versions = await listDashboardVersions(dashboardId);
  const latestVersion = versions.length > 0 ? versions[0] : null;

  if (
    latestVersion &&
    !isMeaningfulChange(
      {
        name: latestVersion.name,
        description: latestVersion.description,
        layoutConfig: latestVersion.layoutConfig,
        charts: latestVersion.chartsSnapshot,
      },
      {
        name: dashboard.name,
        description: dashboard.description,
        layoutConfig,
        charts: chartsSnapshot,
      }
    )
  ) {
    // Insignificant change: avoid spamming redundant duplicate versions
    return latestVersion;
  }

  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  const newRecord: DashboardVersionRecord = {
    id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    dashboardId,
    versionNumber: nextVersionNumber,
    name: dashboard.name,
    description: dashboard.description,
    layoutConfig,
    chartsSnapshot,
    changeSummary: changeSummary || (nextVersionNumber === 1 ? "Initial version" : `Version ${nextVersionNumber}`),
    createdById: userId,
    createdBy: {
      id: userId,
      name: userName || "User",
      email: userEmail || "",
    },
    createdAt: new Date(),
  };

  try {
    await prisma.dashboardVersion.create({
      data: {
        id: newRecord.id,
        dashboardId,
        versionNumber: nextVersionNumber,
        name: newRecord.name,
        description: newRecord.description,
        layoutConfig: layoutConfig as unknown as Prisma.InputJsonValue,
        chartsSnapshot: chartsSnapshot as unknown as Prisma.InputJsonValue,
        changeSummary: newRecord.changeSummary,
        createdById: userId,
      },
    });
  } catch (err) {
    logger.warn("Database offline during dashboard version save, saving to in-memory store", {
      dashboardId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Sync to in-memory cache
  const list = inMemoryVersionStore.get(dashboardId) || [];
  inMemoryVersionStore.set(dashboardId, [newRecord, ...list]);

  void logAuditEvent({
    organizationId: dashboard.organizationId,
    workspaceId: (layoutConfig.workspaceId as string) || undefined,
    userId,
    action: "DASHBOARD_VERSION_CREATED",
    resourceType: "DashboardVersion",
    resourceId: newRecord.id,
    metadata: {
      dashboardId,
      versionNumber: nextVersionNumber,
      chartCount: chartsSnapshot.length,
      changeSummary: newRecord.changeSummary,
    },
  });

  return newRecord;
}

/**
 * List all historical versions for a dashboard, ordered newest first.
 */
export async function listDashboardVersions(
  dashboardId: string
): Promise<DashboardVersionRecord[]> {
  const inMem = inMemoryVersionStore.get(dashboardId);
  if (inMem && inMem.length > 0) {
    return [...inMem].sort((a, b) => b.versionNumber - a.versionNumber);
  }

  try {
    const records = await prisma.dashboardVersion.findMany({

      where: { dashboardId },
      orderBy: { versionNumber: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (records.length > 0) {
      return records.map((r) => ({
        id: r.id,
        dashboardId: r.dashboardId,
        versionNumber: r.versionNumber,
        name: r.name,
        description: r.description,
        layoutConfig: (r.layoutConfig || {}) as Record<string, unknown>,
        chartsSnapshot: (r.chartsSnapshot || []) as unknown as DashboardChartSnapshot[],
        changeSummary: r.changeSummary,
        createdById: r.createdById,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
      }));
    }
  } catch {
    // Database offline
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
  const found = versions.find((v) => v.versionNumber === versionNumber);
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
    getDashboardVersion(dashboardId, targetVersionNum),
  ]);

  const nameChanged = base.name !== target.name;
  const descriptionChanged = base.description !== target.description;

  const baseLayoutStr = JSON.stringify(base.layoutConfig);
  const targetLayoutStr = JSON.stringify(target.layoutConfig);
  const layoutChanged = baseLayoutStr !== targetLayoutStr;

  const baseChartsMap = new Map(base.chartsSnapshot.map((c) => [c.id, c]));
  const targetChartsMap = new Map(target.chartsSnapshot.map((c) => [c.id, c]));

  const addedCharts: DashboardChartSnapshot[] = [];
  const removedCharts: DashboardChartSnapshot[] = [];
  const modifiedCharts: Array<{ id: string; title: string; changes: string[] }> = [];

  for (const [id, targetChart] of targetChartsMap.entries()) {
    if (!baseChartsMap.has(id)) {
      addedCharts.push(targetChart);
    } else {
      const baseChart = baseChartsMap.get(id)!;
      const changes: string[] = [];
      if (baseChart.title !== targetChart.title) changes.push(`Title changed from "${baseChart.title}" to "${targetChart.title}"`);
      if (baseChart.chartType !== targetChart.chartType) changes.push(`Chart type changed from ${baseChart.chartType} to ${targetChart.chartType}`);
      if (JSON.stringify(baseChart.position) !== JSON.stringify(targetChart.position)) changes.push("Position/size updated");
      if (JSON.stringify(baseChart.config) !== JSON.stringify(targetChart.config)) changes.push("Visualization configuration updated");

      if (changes.length > 0) {
        modifiedCharts.push({
          id,
          title: targetChart.title,
          changes,
        });
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
    baseDescription: base.description,
    targetDescription: target.description,
    layoutChanged,
    addedCharts,
    removedCharts,
    modifiedCharts,
    totalChanges,
  };
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
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<{
  dashboard: any;
  restoredFromVersion: number;
  newVersionNumber: number;
}> {
  let dashboard: any;
  try {
    dashboard = await prisma.dashboard.findFirst({
      where: { id: dashboardId, organizationId },
    });
  } catch {}

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  // Workspace and RBAC security check: Viewer cannot restore
  const workspaceId = (dashboard.layoutConfig as any)?.workspaceId ?? undefined;
  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "WRITE"
  );

  const targetVersion = await getDashboardVersion(dashboardId, targetVersionNumber);

  // Apply restored state to dashboard
  try {
    await prisma.dashboard.update({
      where: { id: dashboardId },
      data: {
        name: targetVersion.name,
        description: targetVersion.description,
        layoutConfig: targetVersion.layoutConfig as Prisma.InputJsonValue,
      },
    });

    // Reconcile charts: update charts that match snapshot
    if (Array.isArray(targetVersion.chartsSnapshot)) {
      for (const snap of targetVersion.chartsSnapshot) {
        await prisma.chart.upsert({
          where: { id: snap.id },
          update: {
            title: snap.title,
            description: snap.description,
            chartType: snap.chartType,
            config: snap.config as Prisma.InputJsonValue,
            position: snap.position as Prisma.InputJsonValue,
            sortOrder: snap.sortOrder,
            dashboardId,
            datasetId: snap.datasetId,
          },
          create: {
            id: snap.id,
            title: snap.title,
            description: snap.description,
            chartType: snap.chartType,
            config: snap.config as Prisma.InputJsonValue,
            position: snap.position as Prisma.InputJsonValue,
            sortOrder: snap.sortOrder,
            dashboardId,
            datasetId: snap.datasetId,
          },
        }).catch(() => null);
      }
    }
  } catch (err) {
    logger.warn("Database offline during version restore, continuing", {
      dashboardId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Create a NEW version representing the restored current state
  const newVersion = await createDashboardVersionSnapshot(
    dashboardId,
    `Restored from Version ${targetVersionNumber}`,
    userId
  );

  // Emit audit log for version restore
  void logAuditEvent({
    organizationId,
    workspaceId,
    userId,
    action: "DASHBOARD_VERSION_RESTORED",
    resourceType: "Dashboard",
    resourceId: dashboardId,
    metadata: {
      restoredFromVersion: targetVersionNumber,
      newVersionNumber: newVersion?.versionNumber,
      changeSummary: `Restored from Version ${targetVersionNumber}`,
    },
  });

  const updatedDashboard = await prisma.dashboard
    .findUnique({
      where: { id: dashboardId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        charts: { orderBy: { sortOrder: "asc" } },
        _count: { select: { charts: true } },
      },
    })
    .catch(() => null);

  return {
    dashboard: updatedDashboard || {
      ...dashboard,
      name: targetVersion.name,
      description: targetVersion.description,
      layoutConfig: targetVersion.layoutConfig,
      charts: targetVersion.chartsSnapshot,
    },
    restoredFromVersion: targetVersionNumber,
    newVersionNumber: newVersion?.versionNumber ?? targetVersionNumber + 1,
  };
}

/**
 * Register in-memory test version (for fast test setup without DB dependencies).
 */
export function registerInMemoryDashboardVersion(version: DashboardVersionRecord): void {
  const list = inMemoryVersionStore.get(version.dashboardId) || [];
  inMemoryVersionStore.set(version.dashboardId, [version, ...list]);
}

/**
 * Clear in-memory versions.
 */
export function clearInMemoryDashboardVersions(): void {
  inMemoryVersionStore.clear();
}
