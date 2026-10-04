// ========================================
// Dataset Versioning & Lineage Service
// ========================================
// Provides immutable dataset version tracking, rollback restoration,
// and end-to-end data lineage graph from data source to dashboards.
// ========================================

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";

export interface DatasetVersionItem {
  id: string;
  datasetId: string;
  versionNumber: number;
  changeSummary: string | null;
  transformationConfig: unknown;
  schemaSnapshot: unknown;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DatasetLineageNode {
  id: string;
  type: "DATA_SOURCE" | "DATASET" | "DERIVED_DATASET" | "VISUALIZATION" | "DASHBOARD";
  name: string;
  details?: Record<string, unknown>;
}

export interface DatasetLineageGraph {
  datasetId: string;
  currentDataset: {
    id: string;
    name: string;
    version: number;
    rowCount: number;
    columnCount: number;
  };
  upstream: {
    dataSource: DatasetLineageNode | null;
    parentDataset: DatasetLineageNode | null;
  };
  downstream: {
    derivedDatasets: DatasetLineageNode[];
    visualizations: DatasetLineageNode[];
    dashboards: DatasetLineageNode[];
  };
  transformations: unknown[];
  versionHistory: Array<{
    versionNumber: number;
    changeSummary: string | null;
    createdAt: string;
    rowCount: number;
  }>;
}

/**
 * List all versions of a dataset
 */
export async function listDatasetVersions(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<DatasetVersionItem[]> {
  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, organizationId },
    select: { id: true, workspaceId: true },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "READ"
  );

  const versions = await prisma.datasetVersion.findMany({
    where: { datasetId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { versionNumber: "desc" },
  });

  return versions.map((v) => ({
    id: v.id,
    datasetId: v.datasetId,
    versionNumber: v.versionNumber,
    changeSummary: v.changeSummary,
    transformationConfig: v.transformationConfig,
    schemaSnapshot: v.schemaSnapshot,
    rowCount: v.rowCount,
    columnCount: v.columnCount,
    createdAt: v.createdAt.toISOString(),
    createdBy: v.createdBy,
  }));
}

/**
 * Retrieve a specific version by version number
 */
export async function getDatasetVersion(
  datasetId: string,
  versionNumber: number,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<DatasetVersionItem> {
  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, organizationId },
    select: { id: true, workspaceId: true },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "READ"
  );

  const version = await prisma.datasetVersion.findUnique({
    where: {
      datasetId_versionNumber: {
        datasetId,
        versionNumber,
      },
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!version) {
    throw AppError.notFound(`Version ${versionNumber} of dataset "${datasetId}" not found`);
  }

  return {
    id: version.id,
    datasetId: version.datasetId,
    versionNumber: version.versionNumber,
    changeSummary: version.changeSummary,
    transformationConfig: version.transformationConfig,
    schemaSnapshot: version.schemaSnapshot,
    rowCount: version.rowCount,
    columnCount: version.columnCount,
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy,
  };
}

/**
 * Restore dataset to an earlier version (non-destructively increments version)
 */
export async function restoreDatasetVersion(
  datasetId: string,
  targetVersionNumber: number,
  userId: string,
  organizationId: string,
  userRoleName?: string
) {
  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, organizationId },
    include: { columns: true },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "WRITE"
  );

  const targetVersion = await prisma.datasetVersion.findUnique({
    where: {
      datasetId_versionNumber: {
        datasetId,
        versionNumber: targetVersionNumber,
      },
    },
  });

  if (!targetVersion) {
    throw AppError.notFound(`Cannot restore: Version ${targetVersionNumber} does not exist`);
  }

  const nextVersion = dataset.currentVersion + 1;
  const rawSnapshot = targetVersion.schemaSnapshot as any;
  const restoredColumns = (rawSnapshot?.columns || []) as Array<{ name: string; type: string }>;

  // Re-apply target version columns
  if (restoredColumns.length > 0) {
    await prisma.datasetColumn.deleteMany({ where: { datasetId: dataset.id } });
  }

  const updatedDataset = await prisma.dataset.update({
    where: { id: dataset.id },
    data: {
      currentVersion: nextVersion,
      rowCount: targetVersion.rowCount,
      columnCount: targetVersion.columnCount,
      transformationSteps: targetVersion.transformationConfig as any,
      columns: {
        create: restoredColumns.map((col, idx) => ({
          name: col.name,
          dataType: (col.type === "NUMBER" ? "NUMBER" : col.type === "DATE" ? "DATE" : col.type === "BOOLEAN" ? "BOOLEAN" : "STRING") as any,
          nullable: true,
          ordinalPosition: idx,
        })),
      },
      versions: {
        create: {
          versionNumber: nextVersion,
          changeSummary: `Restored from version ${targetVersionNumber}`,
          transformationConfig: targetVersion.transformationConfig as any,
          schemaSnapshot: targetVersion.schemaSnapshot as any,
          rowCount: targetVersion.rowCount,
          columnCount: targetVersion.columnCount,
          createdById: userId,
        },
      },
    },
    include: { columns: true, versions: true },
  });

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId: dataset.workspaceId ?? undefined,
    action: "DATASET_VERSION_RESTORED",
    resourceType: "DATASET",
    resourceId: dataset.id,
    metadata: {
      restoredFromVersion: targetVersionNumber,
      newVersionNumber: nextVersion,
    },
  });

  return updatedDataset;
}

/**
 * Retrieve end-to-end data lineage graph for a dataset
 */
export async function getDatasetLineage(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<DatasetLineageGraph> {
  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, organizationId },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
      parentDataset: { select: { id: true, name: true, currentVersion: true } },
      derivedDatasets: { select: { id: true, name: true, currentVersion: true, rowCount: true } },
      charts: {
        select: {
          id: true,
          title: true,
          chartType: true,
          dashboard: { select: { id: true, name: true } },
        },
      },
      versions: {
        select: { versionNumber: true, changeSummary: true, createdAt: true, rowCount: true },
        orderBy: { versionNumber: "desc" },
      },
    },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "READ"
  );

  const dashboardsMap = new Map<string, DatasetLineageNode>();
  const visualizationsList: DatasetLineageNode[] = [];

  for (const c of dataset.charts) {
    visualizationsList.push({
      id: c.id,
      type: "VISUALIZATION",
      name: c.title,
      details: { chartType: c.chartType },
    });
    if (c.dashboard && !dashboardsMap.has(c.dashboard.id)) {
      dashboardsMap.set(c.dashboard.id, {
        id: c.dashboard.id,
        type: "DASHBOARD",
        name: c.dashboard.name,
      });
    }
  }

  return {
    datasetId: dataset.id,
    currentDataset: {
      id: dataset.id,
      name: dataset.name,
      version: dataset.currentVersion,
      rowCount: dataset.rowCount,
      columnCount: dataset.columnCount,
    },
    upstream: {
      dataSource: dataset.dataSource
        ? {
            id: dataset.dataSource.id,
            type: "DATA_SOURCE",
            name: dataset.dataSource.name,
            details: { type: dataset.dataSource.type },
          }
        : null,
      parentDataset: dataset.parentDataset
        ? {
            id: dataset.parentDataset.id,
            type: "DATASET",
            name: dataset.parentDataset.name,
            details: { version: dataset.parentDataset.currentVersion },
          }
        : null,
    },
    downstream: {
      derivedDatasets: dataset.derivedDatasets.map((d) => ({
        id: d.id,
        type: "DERIVED_DATASET",
        name: d.name,
        details: { version: d.currentVersion, rowCount: d.rowCount },
      })),
      visualizations: visualizationsList,
      dashboards: Array.from(dashboardsMap.values()),
    },
    transformations: (dataset.transformationSteps as any[]) || [],
    versionHistory: dataset.versions.map((v) => ({
      versionNumber: v.versionNumber,
      changeSummary: v.changeSummary,
      createdAt: v.createdAt.toISOString(),
      rowCount: v.rowCount,
    })),
  };
}
