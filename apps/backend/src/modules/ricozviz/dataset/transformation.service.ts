// ========================================
// Dataset Transformation & Cleaning Service
// ========================================
// Ported from the legacy Express API
// (`RicozViz_old/apps/api/src/services/dataset/transformation.service.ts`).
//
// Provides a tenant-isolated data transformation pipeline supporting row
// filtering, column renaming, type conversion, missing value imputation,
// duplicate removal, derived columns and case/whitespace sanitization.
// ========================================

import { z } from 'zod';
import {
  DatasetModel,
  DatasetColumnModel,
  DatasetVersionModel,
  toObjectId,
  serializeDoc
} from '@repo/database';
import { DATASET_STATUS } from '@repo/types';
import type { TransformationStep, TransformationPreviewResponse } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';
import {
  compileCalculatedField,
  evaluateExpression
} from './calculated-field.engine.js';
import {
  asMixed,
  mapColumnDataType,
  readDatasetRows,
  verifyResourceWorkspaceAccess,
  type SerializedDataset
} from './data-quality.service.js';

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

export const TransformationStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('FILTER_ROWS'),
    column: z.string().min(1),
    operator: z.enum([
      'EQUALS',
      'NOT_EQUALS',
      'GREATER_THAN',
      'LESS_THAN',
      'CONTAINS',
      'IS_NULL',
      'IS_NOT_NULL'
    ]),
    value: z.unknown().optional()
  }),
  z.object({
    type: z.literal('RENAME_COLUMN'),
    oldName: z.string().min(1),
    newName: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
  }),
  z.object({
    type: z.literal('TYPE_CONVERSION'),
    column: z.string().min(1),
    targetType: z.enum(['STRING', 'TEXT', 'NUMBER', 'BOOLEAN', 'DATE'])
  }),
  z.object({
    type: z.enum(['HANDLE_MISSING', 'FILL_MISSING']),
    column: z.string().min(1),
    strategy: z.enum([
      'DROP_ROW',
      'FILL_ZERO',
      'FILL_MEAN',
      'FILL_VALUE',
      'STATIC_VALUE',
      'MEAN',
      'MEDIAN',
      'MODE'
    ]),
    fillValue: z.unknown().optional(),
    staticValue: z.unknown().optional()
  }),
  z.object({
    type: z.literal('REMOVE_DUPLICATES'),
    columns: z.array(z.string().min(1)).optional()
  }),
  z.object({
    type: z.literal('DERIVED_COLUMN'),
    name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
    expression: z.string().min(1).max(500)
  }),
  z.object({
    type: z.literal('DROP_COLUMN'),
    column: z.string().min(1)
  }),
  z.object({
    type: z.literal('TRIM_WHITESPACE'),
    column: z.string().min(1)
  }),
  z.object({
    type: z.enum(['CASE_CONVERT', 'CHANGE_CASE']),
    column: z.string().min(1),
    mode: z.enum(['UPPER', 'LOWER']).optional(),
    casing: z.enum(['UPPER', 'LOWER']).optional()
  })
]);

export const PreviewTransformationSchema = z.object({
  steps: z.array(TransformationStepSchema).max(50),
  limit: z.coerce.number().int().min(1).max(1000).default(100)
});

export const ApplyTransformationSchema = z.object({
  steps: z.array(TransformationStepSchema).max(50),
  mode: z.enum(['CREATE_NEW', 'SAVE_VERSION', 'DERIVED_DATASET', 'NEW_VERSION']).default('CREATE_NEW'),
  newDatasetName: z.string().min(1).max(100).optional(),
  changeSummary: z.string().max(500).optional(),
  workspaceId: z.string().optional()
});

/** Transformation apply modes, after alias normalisation. */
export type TransformationApplyMode = 'CREATE_NEW' | 'SAVE_VERSION';

export interface TransformationColumn {
  name: string;
  type: string;
}

/**
 * Preview payload.
 *
 * The legacy API returned `{ originalRowCount, transformedRowCount,
 * originalColumns, transformedColumns, sampleRows }`; the shared contract type
 * additionally declares `previewRows` / `sampleSize`, which the legacy server
 * never emitted (the web client reads `sampleRows || previewRows`).
 */
export type TransformationPreviewResult = Omit<
  TransformationPreviewResponse,
  'previewRows' | 'sampleSize'
> & {
  originalColumns: TransformationColumn[];
  sampleRows: Array<Record<string, unknown>>;
};

/** Result of applying a transformation pipeline. */
export interface ApplyTransformationsResult {
  mode: 'NEW_VERSION' | 'DERIVED_DATASET' | 'CREATE_NEW' | 'SAVE_VERSION';
  dataset: Record<string, unknown>;
  version: Record<string, unknown>;
}

/** Normalise the legacy mode aliases onto the two real behaviours. */
function normalizeApplyMode(
  mode: 'CREATE_NEW' | 'SAVE_VERSION' | 'DERIVED_DATASET' | 'NEW_VERSION'
): TransformationApplyMode {
  if (mode === 'DERIVED_DATASET') return 'CREATE_NEW';
  if (mode === 'NEW_VERSION') return 'SAVE_VERSION';
  return mode;
}

// ============================================================
// TRANSFORMATION PIPELINE
// ============================================================

/**
 * Execute transformation steps sequentially on the in-memory row set.
 */
export function executeTransformationPipeline(
  initialRows: Record<string, unknown>[],
  initialColumns: TransformationColumn[],
  steps: TransformationStep[]
): { rows: Record<string, unknown>[]; columns: TransformationColumn[] } {
  let rows = initialRows.map((r) => ({ ...r }));
  let columns: TransformationColumn[] = [...initialColumns];

  for (const step of steps) {
    switch (step.type) {
      case 'FILTER_ROWS': {
        const col = step.column;
        const val = step.value;
        rows = rows.filter((row) => {
          const rowVal = row[col];
          if (step.operator === 'IS_NULL') return rowVal === null || rowVal === undefined;
          if (step.operator === 'IS_NOT_NULL') return rowVal !== null && rowVal !== undefined;
          if (rowVal === null || rowVal === undefined) return false;

          if (step.operator === 'EQUALS') return String(rowVal) === String(val);
          if (step.operator === 'NOT_EQUALS') return String(rowVal) !== String(val);
          if (step.operator === 'CONTAINS') {
            return String(rowVal).toLowerCase().includes(String(val).toLowerCase());
          }
          if (step.operator === 'GREATER_THAN') return Number(rowVal) > Number(val);
          if (step.operator === 'LESS_THAN') return Number(rowVal) < Number(val);
          return true;
        });
        break;
      }

      case 'RENAME_COLUMN': {
        const { oldName, newName } = step;
        columns = columns.map((c) => (c.name === oldName ? { ...c, name: newName } : c));
        rows = rows.map((r) => {
          const copy = { ...r };
          if (oldName in copy) {
            copy[newName] = copy[oldName];
            delete copy[oldName];
          }
          return copy;
        });
        break;
      }

      case 'TYPE_CONVERSION': {
        const { column, targetType } = step;
        const normalizedType = targetType === 'TEXT' ? 'STRING' : targetType;
        columns = columns.map((c) => (c.name === column ? { ...c, type: normalizedType } : c));
        rows = rows.map((r) => {
          const copy = { ...r };
          const curVal = copy[column];
          if (curVal !== null && curVal !== undefined) {
            if (normalizedType === 'NUMBER') {
              const num = Number(curVal);
              copy[column] = isNaN(num) ? null : num;
            } else if (normalizedType === 'STRING') {
              copy[column] = String(curVal);
            } else if (normalizedType === 'BOOLEAN') {
              copy[column] = curVal === true || curVal === 'true' || curVal === 1 || curVal === '1';
            } else if (normalizedType === 'DATE') {
              const d = new Date(String(curVal));
              copy[column] = isNaN(d.getTime()) ? null : d.toISOString();
            }
          }
          return copy;
        });
        break;
      }

      case 'HANDLE_MISSING':
      case 'FILL_MISSING': {
        const anyStep = step as unknown as {
          column: string;
          strategy: string;
          fillValue?: unknown;
          staticValue?: unknown;
        };
        const { column, strategy } = anyStep;
        const fill = anyStep.fillValue !== undefined ? anyStep.fillValue : anyStep.staticValue;

        if (strategy === 'DROP_ROW') {
          rows = rows.filter(
            (r) => r[column] !== null && r[column] !== undefined && r[column] !== ''
          );
        } else if (strategy === 'FILL_ZERO') {
          rows = rows.map((r) => ({
            ...r,
            [column]:
              r[column] === null || r[column] === undefined || r[column] === '' ? 0 : r[column]
          }));
        } else if (strategy === 'FILL_VALUE' || strategy === 'STATIC_VALUE') {
          rows = rows.map((r) => ({
            ...r,
            [column]:
              r[column] === null || r[column] === undefined || r[column] === '' ? fill : r[column]
          }));
        } else if (strategy === 'FILL_MEAN' || strategy === 'MEAN') {
          const numericVals = rows
            .map((r) => Number(r[column]))
            .filter((n) => !isNaN(n) && n !== null && n !== undefined);
          const mean =
            numericVals.length > 0
              ? numericVals.reduce((a, b) => a + b, 0) / numericVals.length
              : 0;
          rows = rows.map((r) => ({
            ...r,
            [column]:
              r[column] === null || r[column] === undefined || r[column] === ''
                ? Math.round(mean * 100) / 100
                : r[column]
          }));
        }
        break;
      }

      case 'REMOVE_DUPLICATES': {
        const keys =
          step.columns && step.columns.length > 0 ? step.columns : columns.map((c) => c.name);
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const signature = keys.map((k) => String(r[k] ?? '')).join('||');
          if (seen.has(signature)) return false;
          seen.add(signature);
          return true;
        });
        break;
      }

      case 'DERIVED_COLUMN': {
        const { name, expression } = step;
        const compiled = compileCalculatedField(
          expression,
          columns.map((c) => ({ name: c.name, type: c.type }))
        );
        if (!columns.some((c) => c.name === name)) {
          columns.push({ name, type: compiled.dataType });
        }
        rows = rows.map((r) => {
          try {
            const computed = evaluateExpression(compiled.ast, r);
            return { ...r, [name]: computed };
          } catch {
            return { ...r, [name]: null };
          }
        });
        break;
      }

      case 'DROP_COLUMN': {
        const { column } = step;
        columns = columns.filter((c) => c.name !== column);
        rows = rows.map((r) => {
          const copy = { ...r };
          delete copy[column];
          return copy;
        });
        break;
      }

      case 'TRIM_WHITESPACE': {
        const { column } = step;
        rows = rows.map((r) => {
          const val = r[column];
          return typeof val === 'string' ? { ...r, [column]: val.trim() } : r;
        });
        break;
      }

      case 'CASE_CONVERT':
      case 'CHANGE_CASE': {
        const anyStep = step as unknown as { column: string; mode?: string; casing?: string };
        const { column } = anyStep;
        const targetMode = anyStep.mode || anyStep.casing || 'UPPER';
        rows = rows.map((r) => {
          const val = r[column];
          if (typeof val === 'string') {
            return { ...r, [column]: targetMode === 'UPPER' ? val.toUpperCase() : val.toLowerCase() };
          }
          return r;
        });
        break;
      }
    }
  }

  return { rows, columns };
}

// ============================================================
// SERVICE METHODS
// ============================================================

/** Dataset document shape used by the transformation service. */
interface TransformationDataset extends SerializedDataset {
  type?: string;
  currentVersion?: number;
}

/**
 * Preview transformations against the dataset sample without modifying the
 * database.
 */
export async function previewTransformations(
  datasetId: string,
  steps: TransformationStep[],
  limit: number,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<TransformationPreviewResult> {
  const dataset = await findDatasetForTransformation(datasetId, organizationId);

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: dataset.workspaceId ?? null,
      organizationId: dataset.organizationId
    },
    userId,
    organizationId,
    userRoleName,
    'READ'
  );

  const rawRows = readDatasetRows(dataset, Math.min(limit, 1000), 0);

  const rawCols: TransformationColumn[] = (dataset.columns ?? []).map((c) => ({
    name: c.name,
    type: c.dataType || 'STRING'
  }));

  const { rows: transformedRows, columns: transformedCols } = executeTransformationPipeline(
    rawRows,
    rawCols,
    steps
  );

  return {
    originalRowCount: rawRows.length,
    transformedRowCount: transformedRows.length,
    originalColumns: rawCols,
    transformedColumns: transformedCols,
    sampleRows: transformedRows.slice(0, 100)
  };
}

/** Inputs accepted by `applyTransformations`. */
export interface ApplyTransformationsInput {
  datasetId: string;
  steps: TransformationStep[];
  mode: 'CREATE_NEW' | 'SAVE_VERSION' | 'DERIVED_DATASET' | 'NEW_VERSION';
  newDatasetName?: string;
  changeSummary?: string;
  workspaceId?: string;
  userId: string;
  organizationId: string;
  userRoleName?: string;
}

/**
 * Apply transformations: either create a new derived dataset or bump the
 * dataset to a new version.
 */
export async function applyTransformations(
  params: ApplyTransformationsInput
): Promise<ApplyTransformationsResult> {
  const {
    datasetId,
    steps,
    mode,
    newDatasetName,
    changeSummary,
    workspaceId: targetWorkspaceId,
    userId,
    organizationId,
    userRoleName
  } = params;

  const effectiveMode = normalizeApplyMode(mode);
  const requestedMode = mode;

  const dataset = await findDatasetForTransformation(datasetId, organizationId);

  const effectiveWorkspaceId =
    targetWorkspaceId || dataset.workspaceId || undefined;

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: dataset.workspaceId ?? null,
      organizationId: dataset.organizationId
    },
    userId,
    organizationId,
    userRoleName,
    'WRITE'
  );

  // Compute transformed columns and row count
  const preview = await previewTransformations(
    datasetId,
    steps,
    1000,
    userId,
    organizationId,
    userRoleName
  );

  const createdById = toObjectId(userId);
  if (!createdById) {
    throw AppError.badRequest('Invalid user identifier');
  }

  if (effectiveMode === 'CREATE_NEW') {
    const datasetName = newDatasetName || `${dataset.name} (Cleaned)`;

    // Prisma nested `create` -> sequential writes (no cross-collection tx).
    const newDataset = await DatasetModel.create({
      organizationId: toObjectId(organizationId)!,
      workspaceId: toObjectId(effectiveWorkspaceId ?? null),
      name: datasetName,
      description: `Derived from ${dataset.name} via transformation pipeline`,
      type: dataset.type ?? 'UPLOADED',
      status: DATASET_STATUS.ACTIVE,
      rowCount: preview.transformedRowCount,
      columnCount: preview.transformedColumns.length,
      parentDatasetId: toObjectId(datasetId),
      currentVersion: 1,
      transformationSteps: asMixed(steps),
      createdById
    });

    if (preview.transformedColumns.length > 0) {
      await DatasetColumnModel.insertMany(
        preview.transformedColumns.map((col, idx) => ({
          datasetId: newDataset._id,
          name: col.name,
          dataType: mapColumnDataType(col.type),
          nullable: true,
          ordinalPosition: idx
        }))
      );
    }

    const version = await DatasetVersionModel.create({
      datasetId: newDataset._id,
      versionNumber: 1,
      changeSummary: changeSummary || 'Initial derived dataset creation',
      transformationConfig: asMixed(steps),
      schemaSnapshot: asMixed({ columns: preview.transformedColumns }),
      rowCount: preview.transformedRowCount,
      columnCount: preview.transformedColumns.length,
      createdById
    });

    await logAuditEvent({
      userId,
      organizationId,
      workspaceId: effectiveWorkspaceId,
      action: 'DATASET_TRANSFORMED_NEW',
      resourceType: 'DATASET',
      resourceId: newDataset._id.toString(),
      metadata: {
        parentDatasetId: datasetId,
        stepsCount: steps.length,
        rowCount: preview.transformedRowCount
      }
    });

    return {
      mode: requestedMode,
      dataset: serializeDoc<Record<string, unknown>>(await reloadDataset(newDataset._id)),
      version: serializeDoc<Record<string, unknown>>(version)
    };
  }

  // SAVE_VERSION: updates the dataset and creates a new version
  const datasetObjectId = toObjectId(datasetId)!;
  const nextVersion = (dataset.currentVersion ?? 1) + 1;

  // Delete existing columns and recreate the transformed set
  await DatasetColumnModel.deleteMany({ datasetId: datasetObjectId }).exec();

  await DatasetModel.updateOne(
    { _id: datasetObjectId },
    {
      $set: {
        currentVersion: nextVersion,
        rowCount: preview.transformedRowCount,
        columnCount: preview.transformedColumns.length,
        transformationSteps: asMixed(steps)
      }
    }
  ).exec();

  if (preview.transformedColumns.length > 0) {
    await DatasetColumnModel.insertMany(
      preview.transformedColumns.map((col, idx) => ({
        datasetId: datasetObjectId,
        name: col.name,
        dataType: mapColumnDataType(col.type),
        nullable: true,
        ordinalPosition: idx
      }))
    );
  }

  const version = await DatasetVersionModel.create({
    datasetId: datasetObjectId,
    versionNumber: nextVersion,
    changeSummary: changeSummary || `Transformation pipeline v${nextVersion}`,
    transformationConfig: asMixed(steps),
    schemaSnapshot: asMixed({ columns: preview.transformedColumns }),
    rowCount: preview.transformedRowCount,
    columnCount: preview.transformedColumns.length,
    createdById
  });

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId: dataset.workspaceId ?? undefined,
    action: 'DATASET_TRANSFORMED_VERSION',
    resourceType: 'DATASET',
    resourceId: datasetId,
    metadata: {
      versionNumber: nextVersion,
      stepsCount: steps.length,
      rowCount: preview.transformedRowCount
    }
  });

  return {
    mode: requestedMode,
    dataset: serializeDoc<Record<string, unknown>>(await reloadDataset(datasetObjectId)),
    version: serializeDoc<Record<string, unknown>>(version)
  };
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Tenant-scoped dataset lookup with its relational columns, translated from
 * `prisma.dataset.findFirst({ where: { id, organizationId }, include: { columns: true } })`.
 */
async function findDatasetForTransformation(
  datasetId: string,
  organizationId: string
): Promise<TransformationDataset> {
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(organizationId);

  const doc =
    datasetObjectId && organizationObjectId
      ? await DatasetModel.findOne({
          _id: datasetObjectId,
          organizationId: organizationObjectId
        })
          .populate<{
            columns: Array<{
              name: string;
              dataType: string;
              nullable: boolean;
              ordinalPosition: number;
            }>;
          }>('columns', 'name dataType nullable ordinalPosition')
          .exec()
      : null;

  if (!doc) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  return serializeDoc<TransformationDataset>(doc, { virtuals: true });
}

/**
 * Re-read a dataset with its columns and versions populated, reproducing the
 * legacy `include: { columns: true, versions: true }` response payload.
 */
async function reloadDataset(datasetObjectId: unknown) {
  const objectId = toObjectId(datasetObjectId);
  if (!objectId) {
    throw AppError.notFound('Dataset');
  }

  const doc = await DatasetModel.findOne({ _id: objectId })
    .populate<{
      columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
    }>('columns', 'name dataType nullable ordinalPosition')
    .populate<{ versions: Array<Record<string, unknown>> }>('versions')
    .exec();

  if (!doc) {
    throw AppError.notFound('Dataset');
  }

  return doc;
}