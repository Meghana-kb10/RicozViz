// ========================================
// Calculated Fields Management Service
// ========================================
// Ported from the legacy Express API
// (`RicozViz_old/apps/api/src/services/dataset/calculated-field.service.ts`).
//
// Handles calculated-field CRUD, expression previewing, compilation, dataset
// metadata updates and audit logging. Definitions live in
// `dataset.schemaMeta.calculatedFields` and are mirrored into the relational
// `DatasetColumn` collection so the query engine and studio can see them.
// ========================================

import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { DatasetModel, DatasetColumnModel, toObjectId, serializeDoc } from '@repo/database';

import type { CalculatedFieldConfig, PreviewCalculatedFieldResult } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';
import {
  compileCalculatedField,
  evaluateExpression,
  type CalculatedFieldDataType
} from './calculated-field.engine.js';
import {
  asMixed,
  buildSafeDataset,
  extractDatasetColumnsAndRows,
  mapColumnDataType,
  readSchemaMeta,
  verifyResourceWorkspaceAccess,
  type SafeDataset,
  type SerializedDataset
} from './data-quality.service.js';

// ============================================================
// TYPES & SCHEMAS
// ============================================================

export type { CalculatedFieldConfig };

const fieldNameSchema = z
  .string()
  .trim()
  .min(1, 'Field name is required')
  .max(64, 'Field name cannot exceed 64 characters')
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    'Field name must start with a letter or underscore and contain only alphanumeric characters'
  );

const expressionSchema = z
  .string()
  .trim()
  .min(1, 'Expression is required')
  .max(500, 'Expression cannot exceed 500 characters');

export const previewCalculatedFieldSchema = z.object({
  name: fieldNameSchema,
  expression: expressionSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const createCalculatedFieldSchema = z.object({
  name: fieldNameSchema,
  expression: expressionSchema
});

export const updateCalculatedFieldSchema = z.object({
  name: fieldNameSchema.optional(),
  expression: expressionSchema.optional()
});

/** Request-scoped identity used for tenant + workspace checks. */
export interface CalculatedFieldActor {
  userId: string;
  organizationId: string;
  roleName?: string;
  roleId?: string;
}

/** Payload returned by create / update. */
export interface CalculatedFieldMutationResult {
  field: CalculatedFieldConfig;
  dataset: SafeDataset;
}

/** Payload returned by delete. */
export interface CalculatedFieldDeletionResult {
  message: string;
  dataset: SafeDataset;
}

function mapDataTypeToColumnType(type: CalculatedFieldDataType): string {
  return mapColumnDataType(type);
}

// ============================================================
// SERVICE METHODS
// ============================================================

/**
 * Preview the evaluation of a calculated field against sample dataset rows.
 *
 * `POST /api/v1/datasets/:id/calculated-fields/preview`
 */
export async function previewCalculatedField(
  datasetId: string,
  input: z.infer<typeof previewCalculatedFieldSchema>,
  actor: CalculatedFieldActor
): Promise<PreviewCalculatedFieldResult> {
  const { dataset } = await loadDatasetForCalculatedFields(datasetId, actor, 'READ');

  const { columns, rows } = await extractDatasetColumnsAndRows(dataset);

  // Compile and validate expression
  const compiled = compileOrThrow(input.expression, columns);

  // Sample rows up to requested limit
  const sampleRows = rows.slice(0, input.limit);
  const previewRows = sampleRows.map((r) => ({
    ...r,
    [input.name]: evaluateExpression(compiled.ast, r)
  }));

  return {
    name: input.name,
    expression: input.expression,
    dataType: compiled.dataType,
    referencedColumns: compiled.referencedColumns,
    previewRowCount: previewRows.length,
    rows: previewRows
  };
}

/**
 * Create and persist a calculated field on the dataset.
 *
 * `POST /api/v1/datasets/:id/calculated-fields`
 */
export async function createCalculatedField(
  datasetId: string,
  input: z.infer<typeof createCalculatedFieldSchema>,
  actor: CalculatedFieldActor
): Promise<CalculatedFieldMutationResult> {
  const { dataset, datasetObjectId } = await loadDatasetForCalculatedFields(
    datasetId,
    actor,
    'READ'
  );

  const { columns } = await extractDatasetColumnsAndRows(dataset);

  // Check if name collides with an existing physical or calculated column
  const meta = readSchemaMeta(dataset.schemaMeta);
  const existingCalculated = readCalculatedFields(meta);

  const nameLower = input.name.toLowerCase();
  const physicalColMatch = columns.find((c) => c.name.toLowerCase() === nameLower);
  const existingCalcMatch = existingCalculated.find((cf) => cf.name.toLowerCase() === nameLower);

  if (physicalColMatch && !existingCalcMatch) {
    throw AppError.badRequest(`Column "${input.name}" already exists in the dataset schema`);
  }
  if (existingCalcMatch) {
    throw AppError.badRequest(`Calculated field "${input.name}" already exists on this dataset`);
  }

  const compiled = compileOrThrow(input.expression, columns);

  const now = new Date().toISOString();
  const newField: CalculatedFieldConfig = {
    id: randomUUID(),
    name: input.name,
    expression: input.expression,
    dataType: compiled.dataType,
    datasetId: dataset.id,
    createdAt: now,
    updatedAt: now
  };

  const updatedCalculatedFields = [...existingCalculated, newField];
  const updatedMeta = {
    ...meta,
    calculatedFields: updatedCalculatedFields
  };

  // Persist column to DatasetColumn so the query engine & studio see it
  const maxPosition = (dataset.columns ?? []).reduce(
    (max, c) => Math.max(max, c.ordinalPosition ?? 0),
    0
  );

  await DatasetColumnModel.create({
    datasetId: datasetObjectId,
    name: input.name,
    dataType: mapDataTypeToColumnType(compiled.dataType),
    nullable: true,
    ordinalPosition: maxPosition + 1
  });

  // Update dataset schemaMeta and column count
  const updatedDataset = await DatasetModel.findOneAndUpdate(
    { _id: datasetObjectId },
    {
      $set: {
        schemaMeta: asMixed(updatedMeta),
        columnCount: (dataset.columnCount ?? 0) + 1
      }
    },
    { new: true }
  )
    .populate<{
      columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
    }>('columns', 'name dataType nullable ordinalPosition')
    .exec();

  await logAuditEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'CALCULATED_FIELD_CREATED',
    resourceType: 'Dataset',
    resourceId: dataset.id,
    metadata: {
      datasetName: dataset.name,
      fieldName: newField.name,
      expression: newField.expression,
      dataType: newField.dataType
    }
  });

  return {
    field: newField,
    dataset: buildSafeDataset(
      serializeDoc<SerializedDataset>(updatedDataset ?? dataset, { virtuals: true }) as SerializedDataset
    )
  };
}

/**
 * List all calculated fields for a dataset.
 *
 * `GET /api/v1/datasets/:id/calculated-fields`
 */
export async function listCalculatedFields(
  datasetId: string,
  actor: CalculatedFieldActor
): Promise<CalculatedFieldConfig[]> {
  const { dataset } = await loadDatasetForCalculatedFields(datasetId, actor, 'READ');

  return readCalculatedFields(readSchemaMeta(dataset.schemaMeta));
}

/**
 * Update an existing calculated field on the dataset.
 *
 * `PATCH /api/v1/datasets/:id/calculated-fields/:fieldId`
 */
export async function updateCalculatedField(
  datasetId: string,
  fieldId: string,
  input: z.infer<typeof updateCalculatedFieldSchema>,
  actor: CalculatedFieldActor
): Promise<CalculatedFieldMutationResult> {
  const { dataset, datasetObjectId } = await loadDatasetForCalculatedFields(
    datasetId,
    actor,
    'READ'
  );

  const meta = readSchemaMeta(dataset.schemaMeta);
  const calculatedFields = readCalculatedFields(meta);

  const fieldIndex = calculatedFields.findIndex((f) => f.id === fieldId);
  const existingField = calculatedFields[fieldIndex];
  if (fieldIndex === -1 || !existingField) {
    throw AppError.notFound('Calculated field');
  }

  const newName = input.name || existingField.name;
  const newExpr = input.expression || existingField.expression;

  const { columns } = await extractDatasetColumnsAndRows(dataset);

  // If renaming, ensure no collision
  if (input.name && input.name.toLowerCase() !== existingField.name.toLowerCase()) {
    const colCollision = columns.find(
      (c) =>
        c.name.toLowerCase() === input.name!.toLowerCase() &&
        c.name.toLowerCase() !== existingField.name.toLowerCase()
    );
    if (colCollision) {
      throw AppError.badRequest(`Column "${input.name}" already exists in the dataset schema`);
    }
  }

  const compiled = compileOrThrow(newExpr, columns);

  const updatedField: CalculatedFieldConfig = {
    ...existingField,
    id: existingField.id,
    name: newName,
    expression: newExpr,
    dataType: compiled.dataType,
    updatedAt: new Date().toISOString()
  };

  calculatedFields[fieldIndex] = updatedField;

  // Update DatasetColumn entry if name or type changed
  const existingCol = (dataset.columns ?? []).find((c) => c.name === existingField.name);
  if (existingCol) {
    await DatasetColumnModel.updateOne(
      { datasetId: datasetObjectId, name: existingField.name },
      {
        $set: {
          name: newName,
          dataType: mapDataTypeToColumnType(compiled.dataType)
        }
      }
    ).exec();
  }

  const updatedDataset = await DatasetModel.findOneAndUpdate(
    { _id: datasetObjectId },
    { $set: { schemaMeta: asMixed({ ...meta, calculatedFields }) } },
    { new: true }
  )
    .populate<{ columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }> }>(
      'columns',
      'name dataType nullable ordinalPosition'
    )
    .exec();

  await logAuditEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'CALCULATED_FIELD_UPDATED',
    resourceType: 'Dataset',
    resourceId: dataset.id,
    metadata: {
      datasetName: dataset.name,
      fieldName: updatedField.name,
      expression: updatedField.expression
    }
  });

  return {
    field: updatedField,
    dataset: buildSafeDataset(
      serializeDoc<SerializedDataset>(updatedDataset ?? dataset, { virtuals: true }) as SerializedDataset
    )
  };
}

/**
 * Delete a calculated field from a dataset.
 *
 * `DELETE /api/v1/datasets/:id/calculated-fields/:fieldId`
 */
export async function deleteCalculatedField(
  datasetId: string,
  fieldId: string,
  actor: CalculatedFieldActor
): Promise<CalculatedFieldDeletionResult> {
  const { dataset, datasetObjectId } = await loadDatasetForCalculatedFields(
    datasetId,
    actor,
    'READ'
  );

  const meta = readSchemaMeta(dataset.schemaMeta);
  const calculatedFields = readCalculatedFields(meta);

  const target = calculatedFields.find((f) => f.id === fieldId);
  if (!target) {
    throw AppError.notFound('Calculated field');
  }

  const remainingFields = calculatedFields.filter((f) => f.id !== fieldId);

  // Remove corresponding DatasetColumn if it exists
  await DatasetColumnModel.deleteMany({
    datasetId: datasetObjectId,
    name: target.name
  }).exec();

  const updatedDataset = await DatasetModel.findOneAndUpdate(
    { _id: datasetObjectId },
    {
      $set: {
        schemaMeta: asMixed({ ...meta, calculatedFields: remainingFields }),
        columnCount: Math.max(0, (dataset.columnCount ?? 0) - 1)
      }
    },
    { new: true }
  )
    .populate<{ columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }> }>(
      'columns',
      'name dataType nullable ordinalPosition'
    )
    .exec();

  await logAuditEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'CALCULATED_FIELD_DELETED',
    resourceType: 'Dataset',
    resourceId: dataset.id,
    metadata: {
      datasetName: dataset.name,
      fieldName: target.name
    }
  });

  return {
    message: `Calculated field "${target.name}" deleted successfully`,
    dataset: buildSafeDataset(
      serializeDoc<SerializedDataset>(updatedDataset ?? dataset, { virtuals: true }) as SerializedDataset
    )
  };
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/** Compile an expression, converting engine errors into `400 BAD_REQUEST`. */
function compileOrThrow(
  expression: string,
  columns: Array<{ name: string; type: string }>
): ReturnType<typeof compileCalculatedField> {
  try {
    return compileCalculatedField(expression, columns);
  } catch (err) {
    throw AppError.badRequest(
      err instanceof Error ? err.message : 'Invalid calculated field expression'
    );
  }
}

/** Read `schemaMeta.calculatedFields`, tolerating malformed payloads. */
function readCalculatedFields(meta: Record<string, unknown>): CalculatedFieldConfig[] {
  return Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as CalculatedFieldConfig[])
    : [];
}

/**
 * Tenant + workspace scoped dataset load.
 *
 * Replaces the legacy `dataset.findUnique` + `resolveWorkspaceAccess` pair.
 */
async function loadDatasetForCalculatedFields(
  datasetId: string,
  actor: CalculatedFieldActor,
  action: 'READ' | 'WRITE'
): Promise<{ dataset: SerializedDataset; datasetObjectId: mongoose.Types.ObjectId }> {
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(actor.organizationId);

  if (!datasetObjectId || !organizationObjectId) {
    throw AppError.notFound('Dataset');
  }

  const doc = await DatasetModel.findOne({
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
    .exec();

  if (!doc) {
    throw AppError.notFound('Dataset');
  }

  // Tenant isolation
  if (doc.organizationId.toString() !== actor.organizationId) {
    throw AppError.forbidden('Access denied: dataset belongs to another organization');
  }

  // Workspace access
  if (doc.workspaceId) {
    const workspaceId = doc.workspaceId.toString();
    await verifyResourceWorkspaceAccess(
      { workspaceId, organizationId: doc.organizationId.toString() },
      actor.userId,
      actor.organizationId,
      actor.roleName,
      action
    );
  }

  return {
    dataset: serializeDoc<SerializedDataset>(doc, { virtuals: true }),
    datasetObjectId
  };
}