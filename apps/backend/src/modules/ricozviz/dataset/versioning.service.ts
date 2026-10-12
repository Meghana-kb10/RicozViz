// ========================================
// Dataset Versioning & Lineage Service
// ========================================
// Ported from the legacy Express API
// (`RicozViz_old/apps/api/src/services/dataset/versioning.service.ts`).
//
// Provides immutable dataset version tracking, non-destructive rollback
// restoration and the end-to-end data lineage graph from data source to
// dashboards.
// ========================================

import {
  DatasetModel,
  DatasetColumnModel,
  DatasetVersionModel,
  ChartModel,
  DashboardModel,
  DataSourceModel,
  UserModel,
  toObjectId,
  serializeDoc
} from '@repo/database';
import type {
  DatasetLineageResponse,
  DatasetVersionItem,
  TransformationStep,
  UserSummary
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';
import {
  mapColumnDataType,
  verifyResourceWorkspaceAccess
} from './data-quality.service.js';

/** Restore payload consumed by the web client. */
export interface RestoreDatasetVersionResult {
  message: string;
  dataset: Record<string, unknown>;
  restoredVersion: number;
  newVersion: number;
}

/**
 * Lineage payload.
 *
 * `DatasetLineageResponse` is the shape the web client reads. The legacy
 * service additionally exposed the upstream data source, which the shared
 * contract type has no slot for — it is kept here as an additive field so no
 * information is lost.
 */
export interface DatasetLineageResult extends DatasetLineageResponse {
  dataSource: { id: string; name: string; type: string } | null;
}

/** Snapshot column projection persisted on every version. */
interface SnapshotColumn {
  name: string;
  type: string;
}

/** Normalise a `schemaSnapshot` Mixed value into `{ columns: [...] }`. */
function readSnapshotColumns(schemaSnapshot: unknown): SnapshotColumn[] {
  if (!schemaSnapshot || typeof schemaSnapshot !== 'object' || Array.isArray(schemaSnapshot)) {
    return [];
  }
  const columns = (schemaSnapshot as Record<string, unknown>).columns;
  return Array.isArray(columns) ? (columns as SnapshotColumn[]) : [];
}

/**
 * List every version of a dataset, newest version number first.
 *
 * Mongoose translation:
 *   `dataset.findFirst({ where: { id, organizationId }, select: {...} })`
 *   `datasetVersion.findMany({ where: { datasetId }, include: { createdBy }, orderBy: { versionNumber: 'desc' } })`
 */
export async function listDatasetVersions(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<DatasetVersionItem[]> {
  const dataset = await findDatasetScope(datasetId, organizationId);

  await verifyResourceWorkspaceAccess(
    dataset,
    userId,
    organizationId,
    userRoleName,
    'READ'
  );

  const datasetObjectId = toObjectId(datasetId)!;

  const versions = await DatasetVersionModel.find({ datasetId: datasetObjectId })
    .sort({ versionNumber: -1 })
    .exec();

  const creatorIds = Array.from(
    new Set(versions.map((v) => v.createdById?.toString()).filter((id): id is string => !!id))
  );
  const creators = await loadCreators(creatorIds);

  return versions.map((version) => buildVersionItem(version, creators));
}

/**
 * Retrieve a single version snapshot by version number.
 *
 * Mongoose translation of
 * `datasetVersion.findUnique({ where: { datasetId_versionNumber: { datasetId, versionNumber } }, include: { createdBy } })`.
 */
export async function getDatasetVersion(
  datasetId: string,
  versionNumber: number,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<DatasetVersionItem> {
  const dataset = await findDatasetScope(datasetId, organizationId);

  await verifyResourceWorkspaceAccess(
    dataset,
    userId,
    organizationId,
    userRoleName,
    'READ'
  );

  const datasetObjectId = toObjectId(datasetId)!;

  const version = await DatasetVersionModel.findOne({
    datasetId: datasetObjectId,
    versionNumber
  }).exec();

  if (!version) {
    throw AppError.notFound(`Version ${versionNumber} of dataset "${datasetId}" not found`);
  }

  const creators = await loadCreators(
    version.createdById ? [version.createdById.toString()] : []
  );

  return buildVersionItem(version, creators);
}

/**
 * Restore a dataset to an earlier version.
 *
 * Restoration is non-destructive: columns are replaced with the target
 * snapshot and a *new* version number is appended pointing at the restored
 * schema.
 */
export async function restoreDatasetVersion(
  datasetId: string,
  targetVersionNumber: number,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<RestoreDatasetVersionResult> {
  const datasetDoc = await loadDatasetDocument(datasetId, organizationId);

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: datasetDoc.workspaceId?.toString() ?? null,
      organizationId: datasetDoc.organizationId.toString()
    },
    userId,
    organizationId,
    userRoleName,
    'WRITE'
  );

  const datasetObjectId = datasetDoc._id;

  const targetVersion = await DatasetVersionModel.findOne({
    datasetId: datasetObjectId,
    versionNumber: targetVersionNumber
  }).exec();

  if (!targetVersion) {
    throw AppError.notFound(`Cannot restore: Version ${targetVersionNumber} does not exist`);
  }

  const createdById = toObjectId(userId);
  if (!createdById) {
    throw AppError.badRequest('Invalid user identifier');
  }

  const nextVersion = datasetDoc.currentVersion + 1;
  const restoredColumns = readSnapshotColumns(targetVersion.schemaSnapshot);

  // Re-apply the target version columns
  if (restoredColumns.length > 0) {
    await DatasetColumnModel.deleteMany({ datasetId: datasetObjectId }).exec();
  }

  await DatasetModel.updateOne(
    { _id: datasetObjectId },
    {
      $set: {
        currentVersion: nextVersion,
        rowCount: targetVersion.rowCount,
        columnCount: targetVersion.columnCount,
        transformationSteps: targetVersion.transformationConfig
      }
    }
  ).exec();

  if (restoredColumns.length > 0) {
    await DatasetColumnModel.insertMany(
      restoredColumns.map((col, idx) => ({
        datasetId: datasetObjectId,
        name: col.name,
        dataType: mapColumnDataType(col.type),
        nullable: true,
        ordinalPosition: idx
      }))
    );
  }

  await DatasetVersionModel.create({
    datasetId: datasetObjectId,
    versionNumber: nextVersion,
    changeSummary: `Restored from version ${targetVersionNumber}`,
    transformationConfig: targetVersion.transformationConfig,
    schemaSnapshot: targetVersion.schemaSnapshot,
    rowCount: targetVersion.rowCount,
    columnCount: targetVersion.columnCount,
    createdById
  });

  const updatedDataset = await DatasetModel.findOne({ _id: datasetObjectId })
    .populate<{
      columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
    }>('columns', 'name dataType nullable ordinalPosition')
    .populate<{ versions: Array<Record<string, unknown>> }>('versions')
    .exec();

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId: datasetDoc.workspaceId?.toString() ?? undefined,
    action: 'DATASET_VERSION_RESTORED',
    resourceType: 'DATASET',
    resourceId: datasetId,
    metadata: {
      restoredFromVersion: targetVersionNumber,
      newVersionNumber: nextVersion
    }
  });

  return {
    message: `Dataset restored to version ${targetVersionNumber}`,
    dataset: updatedDataset
      ? serializeDoc<Record<string, unknown>>(updatedDataset, { virtuals: true })
      : {},
    restoredVersion: targetVersionNumber,
    newVersion: nextVersion
  };
}

/**
 * Retrieve the end-to-end data lineage graph for a dataset.
 *
 * Shape follows `@repo/types` `DatasetLineageResponse` (also the shape the web
 * client consumes). The legacy service returned a richer `DatasetLineageGraph`
 * the client never read, so the flat contract is what is emitted here.
 */
export async function getDatasetLineage(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<DatasetLineageResult> {
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(organizationId);

  const doc =
    datasetObjectId && organizationObjectId
      ? await DatasetModel.findOne({
          _id: datasetObjectId,
          organizationId: organizationObjectId
        }).exec()
      : null;

  if (!doc) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: doc.workspaceId?.toString() ?? null,
      organizationId: doc.organizationId.toString()
    },
    userId,
    organizationId,
    userRoleName,
    'READ'
  );

  // ---- Upstream: data source ----
  let upstreamDataSource: { id: string; name: string; type: string } | null = null;
  if (doc.dataSourceId) {
    const ds = await DataSourceModel.findOne({ _id: doc.dataSourceId })
      .select('name type')
      .lean()
      .exec();
    if (ds) {
      upstreamDataSource = { id: doc.dataSourceId.toString(), name: ds.name, type: ds.type };
    }
  }

  // ---- Upstream: parent dataset ----
  let parent: { id: string; name: string } | null = null;
  if (doc.parentDatasetId) {
    const parentDoc = await DatasetModel.findOne({ _id: doc.parentDatasetId })
      .select('name')
      .lean()
      .exec();
    if (parentDoc) {
      parent = { id: doc.parentDatasetId.toString(), name: parentDoc.name };
    }
  }

  // ---- Downstream: derived datasets ----
  const derivedDocs = await DatasetModel.find({ parentDatasetId: doc._id })
    .select('name currentVersion')
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const derivedDatasets = derivedDocs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    currentVersion: d.currentVersion
  }));

  // ---- Downstream: linked visualisations (+ their dashboards) ----
  const charts = await ChartModel.find({ datasetId: doc._id })
    .select('title chartType dashboardId')
    .lean()
    .exec();

  const dashboardIds = Array.from(
    new Set(charts.map((c) => c.dashboardId?.toString()).filter((id): id is string => !!id))
  );
  const dashboards = dashboardIds.length
    ? await DashboardModel.find({ _id: { $in: dashboardIds.map((id) => toObjectId(id)) } })
        .select('name')
        .lean()
        .exec()
    : [];
  const dashboardNameById = new Map(dashboards.map((d) => [d._id.toString(), d.name]));

  const linkedVisualizations = charts.map((c) => ({
    id: c._id.toString(),
    title: c.title,
    type: c.chartType,
    dashboardId: c.dashboardId?.toString() ?? null,
    dashboardTitle: c.dashboardId ? (dashboardNameById.get(c.dashboardId.toString()) ?? null) : null
  }));

  const versionsCount = await DatasetVersionModel.countDocuments({
    datasetId: doc._id
  }).exec();

  return {
    dataset: {
      id: doc._id.toString(),
      name: doc.name,
      version: doc.currentVersion,
      parentDatasetId: doc.parentDatasetId?.toString() ?? null
    },
    // The upstream data source has no slot in `DatasetLineageResponse`; it is
    // surfaced alongside the contract fields so nothing is dropped.
    parent,
    derivedDatasets,
    linkedVisualizations,
    versionsCount,
    dataSource: upstreamDataSource
  };
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

interface DatasetScope {
  workspaceId: string | null;
  organizationId: string;
}

/** Tenant-scoped `{ workspaceId, organizationId }` lookup for authorization. */
async function findDatasetScope(
  datasetId: string,
  organizationId: string
): Promise<DatasetScope> {
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(organizationId);

  const doc =
    datasetObjectId && organizationObjectId
      ? await DatasetModel.findOne({
          _id: datasetObjectId,
          organizationId: organizationObjectId
        })
          .select('workspaceId organizationId')
          .lean()
          .exec()
      : null;

  if (!doc) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  return {
    workspaceId: doc.workspaceId?.toString() ?? null,
    organizationId: doc.organizationId.toString()
  };
}

/** Tenant-scoped dataset document lookup (full document, no populate). */
async function loadDatasetDocument(datasetId: string, organizationId: string) {
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(organizationId);

  const doc =
    datasetObjectId && organizationObjectId
      ? await DatasetModel.findOne({
          _id: datasetObjectId,
          organizationId: organizationObjectId
        }).exec()
      : null;

  if (!doc) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  return doc;
}

/** Batch-load the user summaries referenced by version creators. */
async function loadCreators(userIds: string[]): Promise<Map<string, UserSummary>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const users = await UserModel.find({
    _id: { $in: userIds.map((id) => toObjectId(id)).filter((id) => !!id) }
  })
    .select('name email avatarUrl')
    .lean()
    .exec();

  const map = new Map<string, UserSummary>();
  for (const u of users) {
    map.set(u._id.toString(), {
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl ?? null
    });
  }
  return map;
}

/** Map a `DatasetVersion` document onto the shared `DatasetVersionItem`. */
function buildVersionItem(
  version: {
    _id: unknown;
    datasetId: unknown;
    versionNumber: number;
    changeSummary: string | null;
    transformationConfig: unknown;
    schemaSnapshot: unknown;
    rowCount: number;
    columnCount: number;
    createdById: unknown;
    createdAt: Date;
  },
  creators: Map<string, UserSummary>
): DatasetVersionItem {
  const versionId = String(version._id);
  const datasetId = String(version.datasetId);
  const createdById = String(version.createdById);

  return {
    id: versionId,
    datasetId,
    versionNumber: version.versionNumber,
    changeSummary: version.changeSummary ?? null,
    rowCount: version.rowCount,
    columnCount: version.columnCount,
    schemaSnapshot: { columns: readSnapshotColumns(version.schemaSnapshot) },
    transformationConfig:
      (version.transformationConfig as TransformationStep[] | undefined) ?? null,
    createdAt: version.createdAt.toISOString(),
    createdById,
    creator: creators.get(createdById)
  };
}