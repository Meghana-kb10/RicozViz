// ========================================
// Dataset Blending Service
// ========================================
// Ported from the legacy Express API
// (`RicozViz_old/apps/api/src/services/dataset/dataset-blend.service.ts`).
//
// Combines two compatible datasets using an INNER or LEFT JOIN. Provides a
// live preview without persistence and persists blended datasets as DERIVED
// datasets so they can be queried and visualised like any other dataset.
// ========================================

import { z } from 'zod';
import {
  DatasetModel,
  DatasetColumnModel,
  ChartModel,
  WorkspaceMemberModel,
  toObjectId,
  serializeDoc
} from '@repo/database';
import { DATASET_SOURCE_TYPE, DATASET_STATUS, DATASET_TYPE } from '@repo/types';
import type {
  BlendJoinType,
  DatasetBlendConfig,
  DatasetBlendPreviewResult
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../audit/audit.service.js';
import {
  buildSafeDataset,
  extractDatasetColumnsAndRows,
  readSchemaMeta,
  resolveWorkspaceAccess,
  verifyResourceWorkspaceAccess,
  type SafeDataset,
  type SerializedDataset
} from './data-quality.service.js';

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const joinTypeSchema = z.enum(['INNER', 'LEFT', 'inner', 'left'], {
  errorMap: () => ({ message: 'Join type must be INNER or LEFT' })
});

export const blendPreviewSchema = z.object({
  datasetAId: z.string().min(1, 'Invalid dataset A ID'),
  datasetBId: z.string().min(1, 'Invalid dataset B ID'),
  joinColumnA: z.string().min(1, 'Join column A is required'),
  joinColumnB: z.string().min(1, 'Join column B is required'),
  joinType: joinTypeSchema,
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const createBlendSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  datasetAId: z.string().min(1, 'Invalid dataset A ID'),
  datasetBId: z.string().min(1, 'Invalid dataset B ID'),
  joinColumnA: z.string().min(1, 'Join column A is required'),
  joinColumnB: z.string().min(1, 'Join column B is required'),
  joinType: joinTypeSchema
});

/** Request-scoped identity used for tenant + workspace checks. */
export interface BlendActor {
  userId: string;
  organizationId: string;
  roleName?: string;
}

/** Blend listing entry (`DatasetData` plus the persisted blend configuration). */
export type DatasetBlendItem = SafeDataset & { blendConfig: DatasetBlendConfig | null };

/** Delete payload consumed by the web client. */
export interface DatasetBlendDeletionResult {
  success: true;
  message: string;
}

// ============================================================
// PURE HELPERS
// ============================================================

export interface BlendColumn {
  name: string;
  type: string;
}

/** Normalise any SQL-ish column type into the coarse blend type family. */
export function normalizeColumnType(type: string): string {
  const upper = String(type).toUpperCase();
  if (
    upper.includes('INT') ||
    upper.includes('NUM') ||
    upper.includes('FLOAT') ||
    upper.includes('DOUBLE') ||
    upper.includes('DECIMAL')
  ) {
    return 'NUMBER';
  }
  if (upper.includes('DATE') || upper.includes('TIME')) {
    return 'DATETIME';
  }
  if (upper.includes('BOOL')) {
    return 'BOOLEAN';
  }
  return 'STRING';
}

/** Map a normalised blend type onto the persisted `DatasetColumnType` enum. */
export function mapToPersistedColumnType(type: string): string {
  const norm = normalizeColumnType(type);
  if (norm === 'NUMBER') return 'NUMBER';
  if (norm === 'DATETIME') return 'DATETIME';
  if (norm === 'BOOLEAN') return 'BOOLEAN';
  return 'STRING';
}

/** Two columns can only be joined when their normalised types match. */
export function areJoinTypesCompatible(typeA: string, typeB: string): boolean {
  return normalizeColumnType(typeA) === normalizeColumnType(typeB);
}

export interface ResultingColumn {
  name: string;
  type: string;
  origin: 'A' | 'B';
  originalName: string;
}

/**
 * Compute the resulting column list of a blend, suffixing colliding names
 * coming from dataset B (`name`, `name_b`, `name_b2`, ...) and unifying the
 * join column when both sides share the same name.
 */
export function computeResultingColumns(
  colsA: Array<{ name: string; type: string }>,
  colsB: Array<{ name: string; type: string }>,
  joinColA: string,
  joinColB: string
): {
  resultingColumns: ResultingColumn[];
  colMappingB: Map<string, string>;
} {
  const resultingColumns: ResultingColumn[] = [];
  const colNamesA = new Set<string>();

  for (const c of colsA) {
    colNamesA.add(c.name);
    resultingColumns.push({
      name: c.name,
      type: c.type,
      origin: 'A',
      originalName: c.name
    });
  }

  const colMappingB = new Map<string, string>();

  for (const c of colsB) {
    // If this is the join column in B, and it has the exact same name as
    // joinColA, unify it.
    if (c.name === joinColB && joinColB === joinColA) {
      colMappingB.set(c.name, c.name);
      continue;
    }

    let finalName = c.name;
    if (colNamesA.has(finalName)) {
      finalName = `${c.name}_b`;
      let counter = 2;
      while (colNamesA.has(finalName)) {
        finalName = `${c.name}_b${counter}`;
        counter++;
      }
    }

    colNamesA.add(finalName);
    colMappingB.set(c.name, finalName);
    resultingColumns.push({
      name: finalName,
      type: c.type,
      origin: 'B',
      originalName: c.name
    });
  }

  return { resultingColumns, colMappingB };
}

/** Execute the in-memory hash join. */
export function performDatasetJoin(
  rowsA: Record<string, unknown>[],
  rowsB: Record<string, unknown>[],
  joinColA: string,
  joinColB: string,
  joinType: 'INNER' | 'LEFT',
  colMappingB: Map<string, string>
): Record<string, unknown>[] {
  const mapB = new Map<string, Array<Record<string, unknown>>>();
  for (const rB of rowsB) {
    const val = rB[joinColB];
    if (val !== undefined && val !== null && val !== '') {
      const key = String(val).trim();
      const existing = mapB.get(key) || [];
      existing.push(rB);
      mapB.set(key, existing);
    }
  }

  const emptyB: Record<string, unknown> = {};
  for (const [, targetCol] of colMappingB.entries()) {
    if (targetCol !== joinColA) {
      emptyB[targetCol] = null;
    }
  }

  const result: Record<string, unknown>[] = [];

  for (const rA of rowsA) {
    const valA = rA[joinColA];
    const keyA = valA !== undefined && valA !== null && valA !== '' ? String(valA).trim() : null;
    const matchesB = keyA ? mapB.get(keyA) : undefined;

    if (matchesB && matchesB.length > 0) {
      for (const mB of matchesB) {
        const merged: Record<string, unknown> = { ...rA };
        for (const [origCol, targetCol] of colMappingB.entries()) {
          merged[targetCol] = mB[origCol] ?? null;
        }
        result.push(merged);
      }
    } else if (joinType === 'LEFT') {
      result.push({
        ...rA,
        ...emptyB
      });
    }
  }

  return result;
}

// ============================================================
// BLEND VALIDATION & RESOLUTION
// ============================================================

interface ResolvedBlend {
  datasetA: SerializedDataset;
  datasetB: SerializedDataset;
  dataA: { columns: BlendColumn[]; rows: Record<string, unknown>[] };
  dataB: { columns: BlendColumn[]; rows: Record<string, unknown>[] };
  matchedColA: string;
  matchedColB: string;
  normalizedJoinType: 'INNER' | 'LEFT';
}

/**
 * Validate the requested blend and resolve both datasets.
 *
 * Tenant isolation, same-workspace enforcement and join type compatibility are
 * all checked before any row is touched.
 */
async function validateAndResolveBlend(
  datasetAId: string,
  datasetBId: string,
  joinColumnA: string,
  joinColumnB: string,
  joinTypeInput: string,
  actor: BlendActor
): Promise<ResolvedBlend> {
  if (datasetAId === datasetBId) {
    throw AppError.badRequest(
      'Cannot blend a dataset with itself. Please select two distinct datasets.'
    );
  }

  const [datasetA, datasetB] = await Promise.all([
    loadBlendDataset(datasetAId, actor.organizationId),
    loadBlendDataset(datasetBId, actor.organizationId)
  ]);

  if (!datasetA) {
    throw AppError.notFound('Dataset A not found');
  }
  if (!datasetB) {
    throw AppError.notFound('Dataset B not found');
  }

  // Tenant isolation
  if (
    datasetA.organizationId !== actor.organizationId ||
    datasetB.organizationId !== actor.organizationId
  ) {
    throw AppError.forbidden('Access denied: datasets belong to another organization');
  }

  // Workspace isolation
  if (datasetA.workspaceId !== datasetB.workspaceId) {
    throw AppError.badRequest('Datasets belong to different workspaces');
  }

  // Verify the user has access to this workspace
  if (datasetA.workspaceId) {
    await resolveWorkspaceAccess(
      datasetA.workspaceId,
      actor.userId,
      actor.organizationId,
      actor.roleName
    );
  }

  // Extract columns and rows
  const [dataA, dataB] = await Promise.all([
    extractDatasetColumnsAndRows(datasetA),
    extractDatasetColumnsAndRows(datasetB)
  ]);

  // Validate join column A exists
  const colA = dataA.columns.find((c) => c.name.toLowerCase() === joinColumnA.toLowerCase());
  if (!colA) {
    throw AppError.badRequest(`Join column "${joinColumnA}" does not exist in dataset A`);
  }

  // Validate join column B exists
  const colB = dataB.columns.find((c) => c.name.toLowerCase() === joinColumnB.toLowerCase());
  if (!colB) {
    throw AppError.badRequest(`Join column "${joinColumnB}" does not exist in dataset B`);
  }

  // Validate data type compatibility
  if (!areJoinTypesCompatible(colA.type, colB.type)) {
    throw AppError.badRequest(
      `Join columns have incompatible data types: "${colA.name}" (${colA.type}) and "${colB.name}" (${colB.type})`
    );
  }

  // Normalize join type
  const normalizedJoinType = joinTypeInput.toUpperCase() as 'INNER' | 'LEFT';
  if (normalizedJoinType !== 'INNER' && normalizedJoinType !== 'LEFT') {
    throw AppError.badRequest('Join type must be INNER or LEFT');
  }

  return {
    datasetA,
    datasetB,
    dataA,
    dataB,
    matchedColA: colA.name,
    matchedColB: colB.name,
    normalizedJoinType
  };
}

// ============================================================
// SERVICE METHODS
// ============================================================

/**
 * Preview a blend between two datasets without saving anything.
 *
 * `POST /api/v1/datasets/blends/preview`
 */
export async function previewDatasetBlend(
  input: z.infer<typeof blendPreviewSchema>,
  actor: BlendActor
): Promise<DatasetBlendPreviewResult> {
  const {
    datasetA,
    datasetB,
    dataA,
    dataB,
    matchedColA,
    matchedColB,
    normalizedJoinType
  } = await validateAndResolveBlend(
    input.datasetAId,
    input.datasetBId,
    input.joinColumnA,
    input.joinColumnB,
    input.joinType,
    actor
  );

  const { resultingColumns, colMappingB } = computeResultingColumns(
    dataA.columns,
    dataB.columns,
    matchedColA,
    matchedColB
  );

  const joinedRows = performDatasetJoin(
    dataA.rows,
    dataB.rows,
    matchedColA,
    matchedColB,
    normalizedJoinType,
    colMappingB
  );

  const previewRows = joinedRows.slice(0, input.limit);

  return {
    datasetA: {
      id: datasetA.id,
      name: datasetA.name,
      rowCount: dataA.rows.length,
      columnCount: dataA.columns.length
    },
    datasetB: {
      id: datasetB.id,
      name: datasetB.name,
      rowCount: dataB.rows.length,
      columnCount: dataB.columns.length
    },
    joinColumnA: matchedColA,
    joinColumnB: matchedColB,
    joinType: normalizedJoinType as BlendJoinType,
    resultingColumns: resultingColumns.map((c) => ({
      name: c.name,
      type: c.type.toLowerCase(),
      origin: c.origin
    })),
    rowCount: joinedRows.length,
    previewRowCount: previewRows.length,
    rows: previewRows
  };
}

/**
 * Permanently save the blended dataset as a DERIVED dataset.
 *
 * `POST /api/v1/datasets/blends`
 */
export async function createDatasetBlend(
  input: z.infer<typeof createBlendSchema>,
  actor: BlendActor
): Promise<SafeDataset> {
  const {
    datasetA,
    datasetB,
    dataA,
    dataB,
    matchedColA,
    matchedColB,
    normalizedJoinType
  } = await validateAndResolveBlend(
    input.datasetAId,
    input.datasetBId,
    input.joinColumnA,
    input.joinColumnB,
    input.joinType,
    actor
  );

  const { resultingColumns, colMappingB } = computeResultingColumns(
    dataA.columns,
    dataB.columns,
    matchedColA,
    matchedColB
  );

  const joinedRows = performDatasetJoin(
    dataA.rows,
    dataB.rows,
    matchedColA,
    matchedColB,
    normalizedJoinType,
    colMappingB
  );

  const schemaColumns = resultingColumns.map((c) => ({
    name: c.name,
    type: c.type.toLowerCase(),
    nullable: true
  }));

  const blendConfig: DatasetBlendConfig = {
    datasetAId: datasetA.id,
    datasetAName: datasetA.name,
    datasetBId: datasetB.id,
    datasetBName: datasetB.name,
    joinColumnA: matchedColA,
    joinColumnB: matchedColB,
    joinType: normalizedJoinType as BlendJoinType,
    createdAt: new Date().toISOString()
  };

  const schemaMeta: Record<string, unknown> = {
    columns: schemaColumns,
    sampleData: joinedRows.slice(0, 1000),
    rowCount: joinedRows.length,
    columnCount: resultingColumns.length,
    blendConfig
  };

  const createdById = toObjectId(actor.userId);
  if (!createdById) {
    throw AppError.badRequest('Invalid user identifier');
  }

  const blendedDataset = await DatasetModel.create({
    organizationId: toObjectId(actor.organizationId)!,
    workspaceId: toObjectId(datasetA.workspaceId),
    name: input.name,
    description: input.description || null,
    sourceType: DATASET_SOURCE_TYPE.CSV,
    type: DATASET_TYPE.DERIVED,
    status: DATASET_STATUS.READY,
    rowCount: joinedRows.length,
    columnCount: resultingColumns.length,
    createdById,
    schemaMeta
  });

  if (resultingColumns.length > 0) {
    await DatasetColumnModel.insertMany(
      resultingColumns.map((c, idx) => ({
        datasetId: blendedDataset._id,
        name: c.name,
        dataType: mapToPersistedColumnType(c.type),
        nullable: true,
        ordinalPosition: idx + 1
      }))
    );
  }

  await logAuditEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'DATASET_CREATED',
    resourceType: 'Dataset',
    resourceId: blendedDataset._id.toString(),
    metadata: {
      name: blendedDataset.name,
      type: 'DERIVED',
      blendConfig,
      rowCount: joinedRows.length,
      columnsCount: resultingColumns.length,
      workspaceId: datasetA.workspaceId
    }
  });

  const persisted = await DatasetModel.findOne({ _id: blendedDataset._id })
    .populate<{
      columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
    }>('columns', 'name dataType nullable ordinalPosition')
    .exec();

  return buildSafeDataset(
    serializeDoc<SerializedDataset>(persisted ?? blendedDataset) as SerializedDataset
  );
}

/**
 * List all blended (DERIVED) datasets visible to the caller.
 *
 * `GET /api/v1/datasets/blends`
 */
export async function listDatasetBlends(
  actor: BlendActor,
  queryWorkspaceId?: string
): Promise<DatasetBlendItem[]> {
  const organizationObjectId = toObjectId(actor.organizationId);

  const filter: Record<string, unknown> = {
    organizationId: organizationObjectId,
    type: DATASET_TYPE.DERIVED
  };

  if (queryWorkspaceId) {
    await resolveWorkspaceAccess(
      queryWorkspaceId,
      actor.userId,
      actor.organizationId,
      actor.roleName
    );
    filter.workspaceId = toObjectId(queryWorkspaceId);
  } else if (actor.roleName !== 'ADMIN') {
    const userObjectId = toObjectId(actor.userId);
    const memberships = userObjectId
      ? await WorkspaceMemberModel.find({ userId: userObjectId })
          .select('workspaceId')
          .lean()
          .exec()
      : [];
    const wsIds = memberships.map((m) => m.workspaceId);
    filter.$or = [{ workspaceId: { $in: wsIds } }, { workspaceId: null }];
  }

  const docs = await DatasetModel.find(filter)
    .populate<{
      columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
    }>('columns', 'name dataType nullable ordinalPosition')
    .sort({ createdAt: -1 })
    .exec();

  return docs.map((doc) => {
    const serialized = serializeDoc<SerializedDataset>(doc) as SerializedDataset;
    return {
      ...buildSafeDataset(serialized),
      blendConfig: (readSchemaMeta(serialized.schemaMeta).blendConfig as DatasetBlendConfig) || null
    };
  });
}

/**
 * Retrieve details of a single blended dataset.
 *
 * `GET /api/v1/datasets/blends/:id`
 */
export async function getDatasetBlend(
  datasetId: string,
  actor: BlendActor
): Promise<DatasetBlendItem> {
  const dataset = await loadBlendDataset(datasetId, actor.organizationId);

  if (!dataset || dataset.type !== DATASET_TYPE.DERIVED) {
    throw AppError.notFound('Blended dataset');
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: dataset.workspaceId,
      organizationId: dataset.organizationId
    },
    actor.userId,
    actor.organizationId,
    actor.roleName,
    'READ'
  );

  return {
    ...buildSafeDataset(dataset),
    blendConfig: (readSchemaMeta(dataset.schemaMeta).blendConfig as DatasetBlendConfig) || null
  };
}

/**
 * Delete a blended dataset (and its columns / charts).
 *
 * `DELETE /api/v1/datasets/blends/:id`
 */
export async function deleteDatasetBlend(
  datasetId: string,
  actor: BlendActor
): Promise<DatasetBlendDeletionResult> {
  const dataset = await loadBlendDataset(datasetId, actor.organizationId);

  if (!dataset || dataset.type !== DATASET_TYPE.DERIVED) {
    throw AppError.notFound('Blended dataset');
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: dataset.workspaceId,
      organizationId: dataset.organizationId
    },
    actor.userId,
    actor.organizationId,
    actor.roleName,
    'READ'
  );

  const datasetObjectId = toObjectId(dataset.id);
  if (!datasetObjectId) {
    throw AppError.notFound('Blended dataset');
  }

  // Legacy ran this inside a transaction; MongoDB has none here, so the
  // deletes are sequenced and a failure rolls the previous step back.
  try {
    await DatasetColumnModel.deleteMany({ datasetId: datasetObjectId }).exec();
    await ChartModel.deleteMany({ datasetId: datasetObjectId }).exec();
    await DatasetModel.deleteOne({ _id: datasetObjectId }).exec();
  } catch (err) {
    logger.error('Failed to delete blended dataset', {
      datasetId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw AppError.internal('Failed to delete blended dataset');
  }

  await logAuditEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'DATASET_DELETED',
    resourceType: 'Dataset',
    resourceId: datasetId,
    metadata: { name: dataset.name, type: 'DERIVED' }
  });

  return { success: true, message: 'Blended dataset deleted successfully.' };
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Tenant-scoped dataset load with columns, translated from
 * `prisma.dataset.findUnique({ include: { columns: { orderBy: { ordinalPosition: 'asc' } } } })`.
 */
async function loadBlendDataset(
  datasetId: string,
  organizationId: string
): Promise<SerializedDataset | null> {
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(organizationId);
  if (!datasetObjectId || !organizationObjectId) {
    return null;
  }

  const doc = await DatasetModel.findOne({
    _id: datasetObjectId,
    organizationId: organizationObjectId
  })
    .populate<{
      columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
    }>('columns', 'name dataType nullable ordinalPosition')
    .exec();

  if (!doc) return null;

  return serializeDoc<SerializedDataset>(doc) as SerializedDataset;
}