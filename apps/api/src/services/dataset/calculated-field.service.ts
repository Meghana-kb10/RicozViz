// ========================================
// Calculated Fields Management Service
// ========================================
// Handles Calculated Field CRUD, expression previewing,
// compilation, dataset metadata updating, and audit logging.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Prisma, DatasetColumnType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { buildSafeDataset } from "./dataset.service.js";
import { datasetQueryEngine } from "./query-engine.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";
import { logAuditEvent } from "../audit.service.js";
import {
  compileCalculatedField,
  evaluateExpression,
  type CalculatedFieldDataType,
} from "./calculated-field.engine.js";

// ============================================================
// TYPES & SCHEMAS
// ============================================================

export interface CalculatedFieldConfig {
  id: string;
  name: string;
  expression: string;
  dataType: CalculatedFieldDataType;
  datasetId: string;
  createdAt: string;
  updatedAt: string;
}

export const previewCalculatedFieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Field name is required")
    .max(64, "Field name cannot exceed 64 characters")
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field name must start with a letter or underscore and contain only alphanumeric characters"),
  expression: z
    .string()
    .trim()
    .min(1, "Expression is required")
    .max(500, "Expression cannot exceed 500 characters"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createCalculatedFieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Field name is required")
    .max(64, "Field name cannot exceed 64 characters")
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field name must start with a letter or underscore and contain only alphanumeric characters"),
  expression: z
    .string()
    .trim()
    .min(1, "Expression is required")
    .max(500, "Expression cannot exceed 500 characters"),
});

export const updateCalculatedFieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Field name is required")
    .max(64, "Field name cannot exceed 64 characters")
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field name must start with a letter or underscore and contain only alphanumeric characters")
    .optional(),
  expression: z
    .string()
    .trim()
    .min(1, "Expression is required")
    .max(500, "Expression cannot exceed 500 characters")
    .optional(),
});

function mapDataTypeToPrisma(type: CalculatedFieldDataType): DatasetColumnType {
  switch (type) {
    case "NUMBER":
      return "NUMBER";
    case "BOOLEAN":
      return "BOOLEAN";
    case "STRING":
    default:
      return "STRING";
  }
}

// ============================================================
// HELPER: EXTRACT DATASET COLUMNS AND ROWS
// ============================================================

async function extractDatasetColumnsAndRows(dataset: any): Promise<{
  columns: Array<{ name: string; type: string }>;
  rows: Record<string, unknown>[];
}> {
  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  let columns: Array<{ name: string; type: string }> = [];

  if (Array.isArray(dataset.columns) && dataset.columns.length > 0) {
    columns = dataset.columns.map((c: any) => ({
      name: c.name,
      type: String(c.dataType || "STRING").toUpperCase(),
    }));
  } else if (Array.isArray(meta.columns)) {
    columns = (meta.columns as any[]).map((c: any) => ({
      name: c.name,
      type: String(c.type || "STRING").toUpperCase(),
    }));
  }

  let rows = ((meta.sampleData || meta.previewRows || meta.rows || []) as Record<string, unknown>[]) || [];
  if (rows.length === 0 && dataset.type === "CONNECTED") {
    try {
      const qRes = await datasetQueryEngine.executeQuery(dataset, { limit: 1000 });
      rows = qRes.rows;
      if (columns.length === 0) {
        columns = qRes.columns.map((c) => ({ name: c.name, type: c.type.toUpperCase() }));
      }
    } catch {
      // Fallback
    }
  }

  return { columns, rows };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/datasets/:id/calculated-fields/preview
 * Previews the evaluation of a calculated field against sample dataset rows.
 */
export async function previewCalculatedField(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const datasetId = req.params.id;
  const input = previewCalculatedFieldSchema.parse(req.body);

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  // Tenant Isolation
  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dataset belongs to another organization");
  }

  // Workspace Access
  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  const { columns, rows } = await extractDatasetColumnsAndRows(dataset);

  // Compile and validate expression
  let compiled;
  try {
    compiled = compileCalculatedField(input.expression, columns);
  } catch (err: any) {
    throw AppError.badRequest(err.message || "Invalid calculated field expression");
  }

  // Sample rows up to requested limit
  const sampleRows = rows.slice(0, input.limit);
  const previewRows = sampleRows.map((r) => {
    const calculatedValue = evaluateExpression(compiled.ast, r);
    return {
      ...r,
      [input.name]: calculatedValue,
    };
  });

  sendSuccess(res, {
    name: input.name,
    expression: input.expression,
    dataType: compiled.dataType,
    referencedColumns: compiled.referencedColumns,
    previewRowCount: previewRows.length,
    rows: previewRows,
  });
}

/**
 * POST /api/v1/datasets/:id/calculated-fields
 * Creates and persists a calculated field on the dataset.
 */
export async function createCalculatedField(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const datasetId = req.params.id;
  const input = createCalculatedFieldSchema.parse(req.body);

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dataset belongs to another organization");
  }

  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  const { columns } = await extractDatasetColumnsAndRows(dataset);

  // Check if name collides with an existing physical or calculated column
  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const existingCalculated: CalculatedFieldConfig[] = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as CalculatedFieldConfig[])
    : [];

  const nameLower = input.name.toLowerCase();
  const physicalColMatch = columns.find((c) => c.name.toLowerCase() === nameLower);
  const existingCalcMatch = existingCalculated.find((cf) => cf.name.toLowerCase() === nameLower);

  if (physicalColMatch && !existingCalcMatch) {
    throw AppError.badRequest(`Column "${input.name}" already exists in the dataset schema`);
  }
  if (existingCalcMatch) {
    throw AppError.badRequest(`Calculated field "${input.name}" already exists on this dataset`);
  }

  // Compile expression
  let compiled;
  try {
    compiled = compileCalculatedField(input.expression, columns);
  } catch (err: any) {
    throw AppError.badRequest(err.message || "Invalid calculated field expression");
  }

  const newField: CalculatedFieldConfig = {
    id: crypto.randomUUID(),
    name: input.name,
    expression: input.expression,
    dataType: compiled.dataType,
    datasetId: dataset.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedCalculatedFields = [...existingCalculated, newField];
  const updatedMeta = {
    ...meta,
    calculatedFields: updatedCalculatedFields,
  };

  // Persist column to DatasetColumn table so query engine & studio see it
  const maxPosition = dataset.columns.reduce((max, c) => Math.max(max, c.ordinalPosition), 0);
  await prisma.datasetColumn.create({
    data: {
      datasetId: dataset.id,
      name: input.name,
      dataType: mapDataTypeToPrisma(compiled.dataType),
      nullable: true,
      ordinalPosition: maxPosition + 1,
    },
  });

  // Update dataset schemaMeta and column count
  const updatedDataset = await prisma.dataset.update({
    where: { id: dataset.id },
    data: {
      schemaMeta: (updatedMeta as unknown) as Prisma.InputJsonValue,
      columnCount: dataset.columnCount + 1,
    },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CALCULATED_FIELD_CREATED",
    resourceType: "Dataset",
    resourceId: dataset.id,
    metadata: {
      datasetName: dataset.name,
      fieldName: newField.name,
      expression: newField.expression,
      dataType: newField.dataType,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(
    res,
    {
      field: newField,
      dataset: buildSafeDataset(updatedDataset),
    },
    201
  );
}

/**
 * GET /api/v1/datasets/:id/calculated-fields
 * Lists all calculated fields for a dataset.
 */
export async function listCalculatedFields(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const datasetId = req.params.id;

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
    throw AppError.forbidden("Access denied");
  }

  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const calculatedFields: CalculatedFieldConfig[] = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as CalculatedFieldConfig[])
    : [];

  sendSuccess(res, calculatedFields);
}

/**
 * PATCH /api/v1/datasets/:id/calculated-fields/:fieldId
 * Updates an existing calculated field on the dataset.
 */
export async function updateCalculatedField(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id: datasetId, fieldId } = req.params;
  const input = updateCalculatedFieldSchema.parse(req.body);

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied");
  }

  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const calculatedFields: CalculatedFieldConfig[] = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as CalculatedFieldConfig[])
    : [];

  const fieldIndex = calculatedFields.findIndex((f) => f.id === fieldId);
  const existingField = calculatedFields[fieldIndex];
  if (fieldIndex === -1 || !existingField) {
    throw AppError.notFound("Calculated field");
  }

  const newName = input.name || existingField.name;
  const newExpr = input.expression || existingField.expression;

  const { columns } = await extractDatasetColumnsAndRows(dataset);

  // If renaming, ensure no collision
  if (input.name && input.name.toLowerCase() !== existingField.name.toLowerCase()) {
    const colCollision = columns.find(
      (c) => c.name.toLowerCase() === input.name!.toLowerCase() && c.name.toLowerCase() !== existingField.name.toLowerCase()
    );
    if (colCollision) {
      throw AppError.badRequest(`Column "${input.name}" already exists in the dataset schema`);
    }
  }

  // Compile new expression
  let compiled;
  try {
    compiled = compileCalculatedField(newExpr, columns);
  } catch (err: any) {
    throw AppError.badRequest(err.message || "Invalid calculated field expression");
  }

  const updatedField: CalculatedFieldConfig = {
    ...existingField,
    id: existingField.id,
    name: newName,
    expression: newExpr,
    dataType: compiled.dataType,
    updatedAt: new Date().toISOString(),
  };

  calculatedFields[fieldIndex] = updatedField;

  // Update DatasetColumn entry if name or type changed
  const existingCol = dataset.columns.find((c) => c.name === existingField.name);
  if (existingCol) {
    await prisma.datasetColumn.update({
      where: { id: existingCol.id },
      data: {
        name: newName,
        dataType: mapDataTypeToPrisma(compiled.dataType),
      },
    });
  }

  const updatedDataset = await prisma.dataset.update({
    where: { id: dataset.id },
    data: {
      schemaMeta: ({
        ...meta,
        calculatedFields,
      } as unknown) as Prisma.InputJsonValue,
    },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CALCULATED_FIELD_UPDATED",
    resourceType: "Dataset",
    resourceId: dataset.id,
    metadata: {
      datasetName: dataset.name,
      fieldName: updatedField.name,
      expression: updatedField.expression,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    field: updatedField,
    dataset: buildSafeDataset(updatedDataset),
  });
}

/**
 * DELETE /api/v1/datasets/:id/calculated-fields/:fieldId
 * Deletes a calculated field from a dataset.
 */
export async function deleteCalculatedField(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id: datasetId, fieldId } = req.params;

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      columns: true,
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied");
  }

  if (dataset.workspaceId) {
    await resolveWorkspaceAccess(dataset.workspaceId, userId, organizationId, roleName);
  }

  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const calculatedFields: CalculatedFieldConfig[] = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as CalculatedFieldConfig[])
    : [];

  const target = calculatedFields.find((f) => f.id === fieldId);
  if (!target) {
    throw AppError.notFound("Calculated field");
  }

  const remainingFields = calculatedFields.filter((f) => f.id !== fieldId);

  // Remove corresponding DatasetColumn if it exists
  await prisma.datasetColumn.deleteMany({
    where: {
      datasetId: dataset.id,
      name: target.name,
    },
  });

  const updatedDataset = await prisma.dataset.update({
    where: { id: dataset.id },
    data: {
      schemaMeta: ({
        ...meta,
        calculatedFields: remainingFields,
      } as unknown) as Prisma.InputJsonValue,
      columnCount: Math.max(0, dataset.columnCount - 1),
    },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CALCULATED_FIELD_DELETED",
    resourceType: "Dataset",
    resourceId: dataset.id,
    metadata: {
      datasetName: dataset.name,
      fieldName: target.name,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    message: `Calculated field "${target.name}" deleted successfully`,
    dataset: buildSafeDataset(updatedDataset),
  });
}
