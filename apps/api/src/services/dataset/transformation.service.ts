// ========================================
// Dataset Transformation & Cleaning Service
// ========================================
// Provides a secure, tenant-isolated data transformation pipeline.
// Supports row filtering, column renaming, type conversion,
// missing value imputation, duplicate removal, derived columns,
// and case/whitespace sanitization.
// ========================================

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";
import { datasetQueryEngine } from "./query-engine.js";
import { evaluateExpression, compileCalculatedField } from "./calculated-field.engine.js";

export const TransformationStepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FILTER_ROWS"),
    column: z.string().min(1),
    operator: z.enum([
      "EQUALS",
      "NOT_EQUALS",
      "GREATER_THAN",
      "LESS_THAN",
      "CONTAINS",
      "IS_NULL",
      "IS_NOT_NULL",
    ]),
    value: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("RENAME_COLUMN"),
    oldName: z.string().min(1),
    newName: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  }),
  z.object({
    type: z.literal("TYPE_CONVERSION"),
    column: z.string().min(1),
    targetType: z.enum(["STRING", "TEXT", "NUMBER", "BOOLEAN", "DATE"]),
  }),
  z.object({
    type: z.enum(["HANDLE_MISSING", "FILL_MISSING"]),
    column: z.string().min(1),
    strategy: z.enum(["DROP_ROW", "FILL_ZERO", "FILL_MEAN", "FILL_VALUE", "STATIC_VALUE", "MEAN", "MEDIAN", "MODE"]),
    fillValue: z.unknown().optional(),
    staticValue: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("REMOVE_DUPLICATES"),
    columns: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    type: z.literal("DERIVED_COLUMN"),
    name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
    expression: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal("DROP_COLUMN"),
    column: z.string().min(1),
  }),
  z.object({
    type: z.literal("TRIM_WHITESPACE"),
    column: z.string().min(1),
  }),
  z.object({
    type: z.enum(["CASE_CONVERT", "CHANGE_CASE"]),
    column: z.string().min(1),
    mode: z.enum(["UPPER", "LOWER"]).optional(),
    casing: z.enum(["UPPER", "LOWER"]).optional(),
  }),
]);

export type TransformationStep = z.infer<typeof TransformationStepSchema>;

export const PreviewTransformationSchema = z.object({
  steps: z.array(TransformationStepSchema).max(50),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const ApplyTransformationSchema = z.object({
  steps: z.array(TransformationStepSchema).max(50),
  mode: z.enum(["CREATE_NEW", "SAVE_VERSION", "DERIVED_DATASET", "NEW_VERSION"]).default("CREATE_NEW"),
  newDatasetName: z.string().min(1).max(100).optional(),
  changeSummary: z.string().max(500).optional(),
  workspaceId: z.string().optional(),
});

export interface TransformationPreviewResult {
  originalRowCount: number;
  transformedRowCount: number;
  originalColumns: Array<{ name: string; type: string }>;
  transformedColumns: Array<{ name: string; type: string }>;
  sampleRows: Record<string, unknown>[];
}

/**
 * Execute transformation steps sequentially on in-memory row set
 */
export function executeTransformationPipeline(
  initialRows: Record<string, unknown>[],
  initialColumns: Array<{ name: string; type: string }>,
  steps: TransformationStep[]
): { rows: Record<string, unknown>[]; columns: Array<{ name: string; type: string }> } {
  let rows = initialRows.map((r) => ({ ...r }));
  let columns = [...initialColumns];

  for (const step of steps) {
    switch (step.type) {
      case "FILTER_ROWS": {
        const col = step.column;
        const val = step.value;
        rows = rows.filter((row) => {
          const rowVal = row[col];
          if (step.operator === "IS_NULL") return rowVal === null || rowVal === undefined;
          if (step.operator === "IS_NOT_NULL") return rowVal !== null && rowVal !== undefined;
          if (rowVal === null || rowVal === undefined) return false;

          if (step.operator === "EQUALS") return String(rowVal) === String(val);
          if (step.operator === "NOT_EQUALS") return String(rowVal) !== String(val);
          if (step.operator === "CONTAINS") {
            return String(rowVal).toLowerCase().includes(String(val).toLowerCase());
          }
          if (step.operator === "GREATER_THAN") return Number(rowVal) > Number(val);
          if (step.operator === "LESS_THAN") return Number(rowVal) < Number(val);
          return true;
        });
        break;
      }

      case "RENAME_COLUMN": {
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

      case "TYPE_CONVERSION": {
        const { column, targetType } = step;
        const normalizedType = targetType === "TEXT" ? "STRING" : targetType;
        columns = columns.map((c) => (c.name === column ? { ...c, type: normalizedType } : c));
        rows = rows.map((r) => {
          const copy = { ...r };
          const curVal = copy[column];
          if (curVal !== null && curVal !== undefined) {
            if (normalizedType === "NUMBER") {
              const num = Number(curVal);
              copy[column] = isNaN(num) ? null : num;
            } else if (normalizedType === "STRING") {
              copy[column] = String(curVal);
            } else if (normalizedType === "BOOLEAN") {
              copy[column] = curVal === true || curVal === "true" || curVal === 1 || curVal === "1";
            } else if (normalizedType === "DATE") {
              const d = new Date(String(curVal));
              copy[column] = isNaN(d.getTime()) ? null : d.toISOString();
            }
          }
          return copy;
        });
        break;
      }

      case "HANDLE_MISSING":
      case "FILL_MISSING" as unknown as "HANDLE_MISSING": {
        const anyStep = step as unknown as {
          column: string;
          strategy: string;
          fillValue?: unknown;
          staticValue?: unknown;
        };
        const { column, strategy } = anyStep;
        const fill = anyStep.fillValue !== undefined ? anyStep.fillValue : anyStep.staticValue;

        if (strategy === "DROP_ROW") {
          rows = rows.filter((r) => r[column] !== null && r[column] !== undefined && r[column] !== "");
        } else if (strategy === "FILL_ZERO") {
          rows = rows.map((r) => ({
            ...r,
            [column]: r[column] === null || r[column] === undefined || r[column] === "" ? 0 : r[column],
          }));
        } else if (strategy === "FILL_VALUE" || strategy === "STATIC_VALUE") {
          rows = rows.map((r) => ({
            ...r,
            [column]: r[column] === null || r[column] === undefined || r[column] === "" ? fill : r[column],
          }));
        } else if (strategy === "FILL_MEAN" || strategy === "MEAN") {
          const numericVals = rows
            .map((r) => Number(r[column]))
            .filter((n) => !isNaN(n) && n !== null && n !== undefined);
          const mean = numericVals.length > 0 ? numericVals.reduce((a, b) => a + b, 0) / numericVals.length : 0;
          rows = rows.map((r) => ({
            ...r,
            [column]: r[column] === null || r[column] === undefined || r[column] === "" ? Math.round(mean * 100) / 100 : r[column],
          }));
        }
        break;
      }

      case "REMOVE_DUPLICATES": {
        const keys = step.columns && step.columns.length > 0 ? step.columns : columns.map((c) => c.name);
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const signature = keys.map((k) => String(r[k] ?? "")).join("||");
          if (seen.has(signature)) return false;
          seen.add(signature);
          return true;
        });
        break;
      }

      case "DERIVED_COLUMN": {
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

      case "DROP_COLUMN": {
        const { column } = step;
        columns = columns.filter((c) => c.name !== column);
        rows = rows.map((r) => {
          const copy = { ...r };
          delete copy[column];
          return copy;
        });
        break;
      }

      case "TRIM_WHITESPACE": {
        const { column } = step;
        rows = rows.map((r) => {
          const val = r[column];
          return typeof val === "string" ? { ...r, [column]: val.trim() } : r;
        });
        break;
      }

      case "CASE_CONVERT":
      case "CHANGE_CASE" as unknown as "CASE_CONVERT": {
        const anyStep = step as unknown as { column: string; mode?: string; casing?: string };
        const { column } = anyStep;
        const targetMode = anyStep.mode || anyStep.casing || "UPPER";
        rows = rows.map((r) => {
          const val = r[column];
          if (typeof val === "string") {
            return { ...r, [column]: targetMode === "UPPER" ? val.toUpperCase() : val.toLowerCase() };
          }
          return r;
        });
        break;
      }
    }
  }

  return { rows, columns };
}

/**
 * Preview transformations against dataset sample without modifying database
 */
export async function previewDatasetTransformations(
  datasetId: string,
  steps: TransformationStep[],
  limit: number,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<TransformationPreviewResult> {
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
    "READ"
  );

  const queryRes = await datasetQueryEngine.executeQuery(dataset, {
    limit: Math.min(limit, 1000),
    offset: 0,
  });

  const rawRows = queryRes.rows || [];
  const rawCols = dataset.columns.map((c) => ({ name: c.name, type: c.dataType || "STRING" }));

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
    sampleRows: transformedRows.slice(0, 100),
  };
}

/**
 * Apply transformations: either creates a new derived dataset or creates a new version
 */
export async function applyDatasetTransformations(params: {
  datasetId: string;
  steps: TransformationStep[];
  mode: "CREATE_NEW" | "SAVE_VERSION" | "DERIVED_DATASET" | "NEW_VERSION";
  newDatasetName?: string;
  changeSummary?: string;
  workspaceId?: string;
  userId: string;
  organizationId: string;
  userRoleName?: string;
}) {
  const {
    datasetId,
    steps,
    mode,
    newDatasetName,
    changeSummary,
    workspaceId: targetWorkspaceId,
    userId,
    organizationId,
    userRoleName,
  } = params;

  const effectiveMode =
    mode === "DERIVED_DATASET" ? "CREATE_NEW" : mode === "NEW_VERSION" ? "SAVE_VERSION" : mode;

  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, organizationId },
    include: { columns: true },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  const effectiveWorkspaceId = targetWorkspaceId || dataset.workspaceId || undefined;

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "WRITE"
  );

  // Compute transformed columns and row count
  const preview = await previewDatasetTransformations(
    datasetId,
    steps,
    1000,
    userId,
    organizationId,
    userRoleName
  );

  if (effectiveMode === "CREATE_NEW") {
    const datasetName = newDatasetName || `${dataset.name} (Cleaned)`;
    const newDataset = await prisma.dataset.create({
      data: {
        organizationId,
        workspaceId: effectiveWorkspaceId,
        name: datasetName,
        description: `Derived from ${dataset.name} via transformation pipeline`,
        type: dataset.type,
        status: "ACTIVE",
        rowCount: preview.transformedRowCount,
        columnCount: preview.transformedColumns.length,
        parentDatasetId: dataset.id,
        currentVersion: 1,
        transformationSteps: steps as unknown as Prisma.InputJsonValue,
        createdById: userId,
        columns: {
          create: preview.transformedColumns.map((col, idx) => ({
            name: col.name,
            dataType: (col.type === "NUMBER" ? "NUMBER" : col.type === "DATE" ? "DATE" : col.type === "BOOLEAN" ? "BOOLEAN" : "STRING") as any,
            nullable: true,
            ordinalPosition: idx,
          })),
        },
        versions: {
          create: {
            versionNumber: 1,
            changeSummary: changeSummary || "Initial derived dataset creation",
            transformationConfig: steps as unknown as Prisma.InputJsonValue,
            schemaSnapshot: { columns: preview.transformedColumns },
            rowCount: preview.transformedRowCount,
            columnCount: preview.transformedColumns.length,
            createdById: userId,
          },
        },
      },
      include: { columns: true, versions: true },
    });

    await logAuditEvent({
      userId,
      organizationId,
      workspaceId: effectiveWorkspaceId,
      action: "DATASET_TRANSFORMED_NEW",
      resourceType: "DATASET",
      resourceId: newDataset.id,
      metadata: {
        parentDatasetId: dataset.id,
        stepsCount: steps.length,
        rowCount: preview.transformedRowCount,
      },
    });

    return newDataset;
  } else {
    // SAVE_VERSION: updates the dataset and creates a new version
    const nextVersion = dataset.currentVersion + 1;

    // Delete existing columns and recreate transformed columns
    await prisma.datasetColumn.deleteMany({ where: { datasetId: dataset.id } });

    const updatedDataset = await prisma.dataset.update({
      where: { id: dataset.id },
      data: {
        currentVersion: nextVersion,
        rowCount: preview.transformedRowCount,
        columnCount: preview.transformedColumns.length,
        transformationSteps: steps as unknown as Prisma.InputJsonValue,
        columns: {
          create: preview.transformedColumns.map((col, idx) => ({
            name: col.name,
            dataType: (col.type === "NUMBER" ? "NUMBER" : col.type === "DATE" ? "DATE" : col.type === "BOOLEAN" ? "BOOLEAN" : "STRING") as any,
            nullable: true,
            ordinalPosition: idx,
          })),
        },
        versions: {
          create: {
            versionNumber: nextVersion,
            changeSummary: changeSummary || `Transformation pipeline v${nextVersion}`,
            transformationConfig: steps as unknown as Prisma.InputJsonValue,
            schemaSnapshot: { columns: preview.transformedColumns },
            rowCount: preview.transformedRowCount,
            columnCount: preview.transformedColumns.length,
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
      action: "DATASET_TRANSFORMED_VERSION",
      resourceType: "DATASET",
      resourceId: dataset.id,
      metadata: {
        versionNumber: nextVersion,
        stepsCount: steps.length,
        rowCount: preview.transformedRowCount,
      },
    });

    return updatedDataset;
  }
}
