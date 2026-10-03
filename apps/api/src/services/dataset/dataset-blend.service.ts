// ========================================
// Dataset Blending Service
// ========================================
// Combines two compatible datasets using INNER or LEFT JOIN.
// Provides live preview without persistence and persists blended datasets as
// DERIVED datasets for seamless querying and visualization.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { buildSafeDataset } from "./dataset.service.js";
import { datasetQueryEngine } from "./query-engine.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";
import { logAuditEvent } from "../audit.service.js";

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

export const blendPreviewSchema = z.object({
  datasetAId: z.string().uuid("Invalid dataset A ID"),
  datasetBId: z.string().uuid("Invalid dataset B ID"),
  joinColumnA: z.string().min(1, "Join column A is required"),
  joinColumnB: z.string().min(1, "Join column B is required"),
  joinType: z.enum(["INNER", "LEFT", "inner", "left"], {
    errorMap: () => ({ message: "Join type must be INNER or LEFT" }),
  }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const createBlendSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  datasetAId: z.string().uuid("Invalid dataset A ID"),
  datasetBId: z.string().uuid("Invalid dataset B ID"),
  joinColumnA: z.string().min(1, "Join column A is required"),
  joinColumnB: z.string().min(1, "Join column B is required"),
  joinType: z.enum(["INNER", "LEFT", "inner", "left"], {
    errorMap: () => ({ message: "Join type must be INNER or LEFT" }),
  }),
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function normalizeColumnType(type: string): string {
  const upper = String(type).toUpperCase();
  if (
    upper.includes("INT") ||
    upper.includes("NUM") ||
    upper.includes("FLOAT") ||
    upper.includes("DOUBLE") ||
    upper.includes("DECIMAL")
  ) {
    return "NUMBER";
  }
  if (upper.includes("DATE") || upper.includes("TIME")) {
    return "DATETIME";
  }
  if (upper.includes("BOOL")) {
    return "BOOLEAN";
  }
  return "STRING";
}

export function mapToPrismaColumnType(type: string): "STRING" | "NUMBER" | "BOOLEAN" | "DATE" | "DATETIME" {
  const norm = normalizeColumnType(type);
  if (norm === "NUMBER") return "NUMBER";
  if (norm === "DATETIME") return "DATETIME";
  if (norm === "BOOLEAN") return "BOOLEAN";
  return "STRING";
}

export function areJoinTypesCompatible(typeA: string, typeB: string): boolean {
  return normalizeColumnType(typeA) === normalizeColumnType(typeB);
}

export function computeResultingColumns(
  colsA: Array<{ name: string; type: string }>,
  colsB: Array<{ name: string; type: string }>,
  joinColA: string,
  joinColB: string
): {
  resultingColumns: Array<{ name: string; type: string; origin: "A" | "B"; originalName: string }>;
  colMappingB: Map<string, string>;
} {
  const resultingColumns: Array<{ name: string; type: string; origin: "A" | "B"; originalName: string }> = [];
  const colNamesA = new Set<string>();

  for (const c of colsA) {
    colNamesA.add(c.name);
    resultingColumns.push({
      name: c.name,
      type: c.type,
      origin: "A",
      originalName: c.name,
    });
  }

  const colMappingB = new Map<string, string>();

  for (const c of colsB) {
    // If this is the join column in B, and it has the exact same name as joinColA, unify it
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
      origin: "B",
      originalName: c.name,
    });
  }

  return { resultingColumns, colMappingB };
}

export function performDatasetJoin(
  rowsA: Record<string, unknown>[],
  rowsB: Record<string, unknown>[],
  joinColA: string,
  joinColB: string,
  joinType: "INNER" | "LEFT",
  colMappingB: Map<string, string>
): Record<string, unknown>[] {
  const mapB = new Map<string, Array<Record<string, unknown>>>();
  for (const rB of rowsB) {
    const val = rB[joinColB];
    if (val !== undefined && val !== null && val !== "") {
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
    const keyA = valA !== undefined && valA !== null && valA !== "" ? String(valA).trim() : null;
    const matchesB = keyA ? mapB.get(keyA) : undefined;

    if (matchesB && matchesB.length > 0) {
      for (const mB of matchesB) {
        const merged: Record<string, unknown> = { ...rA };
        for (const [origCol, targetCol] of colMappingB.entries()) {
          merged[targetCol] = mB[origCol] ?? null;
        }
        result.push(merged);
      }
    } else if (joinType === "LEFT") {
      result.push({
        ...rA,
        ...emptyB,
      });
    }
  }

  return result;
}

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
// CORE BLEND VALIDATION & RESOLUTION
// ============================================================

async function validateAndResolveBlend(
  datasetAId: string,
  datasetBId: string,
  joinColumnA: string,
  joinColumnB: string,
  joinTypeInput: string,
  userId: string,
  organizationId: string,
  roleName: string
) {
  if (datasetAId === datasetBId) {
    throw AppError.badRequest("Cannot blend a dataset with itself. Please select two distinct datasets.");
  }

  const [datasetA, datasetB] = await Promise.all([
    prisma.dataset.findUnique({
      where: { id: datasetAId },
      include: {
        columns: { orderBy: { ordinalPosition: "asc" } },
        dataSource: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.dataset.findUnique({
      where: { id: datasetBId },
      include: {
        columns: { orderBy: { ordinalPosition: "asc" } },
        dataSource: { select: { id: true, name: true, type: true } },
      },
    }),
  ]);

  if (!datasetA) {
    throw AppError.notFound("Dataset A not found");
  }
  if (!datasetB) {
    throw AppError.notFound("Dataset B not found");
  }

  // Tenant Isolation
  if (datasetA.organizationId !== organizationId || datasetB.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: datasets belong to another organization");
  }

  // Workspace Isolation
  if (datasetA.workspaceId !== datasetB.workspaceId) {
    throw AppError.badRequest("Datasets belong to different workspaces");
  }

  // Verify user has access to this workspace
  if (datasetA.workspaceId) {
    await resolveWorkspaceAccess(datasetA.workspaceId, userId, organizationId, roleName);
  }

  // Extract columns and rows
  const [dataA, dataB] = await Promise.all([
    extractDatasetColumnsAndRows(datasetA),
    extractDatasetColumnsAndRows(datasetB),
  ]);

  // Validate Join Column A exists
  const colA = dataA.columns.find((c) => c.name.toLowerCase() === joinColumnA.toLowerCase());
  if (!colA) {
    throw AppError.badRequest(`Join column "${joinColumnA}" does not exist in dataset A`);
  }

  // Validate Join Column B exists
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
  const normalizedJoinType = joinTypeInput.toUpperCase() as "INNER" | "LEFT";
  if (normalizedJoinType !== "INNER" && normalizedJoinType !== "LEFT") {
    throw AppError.badRequest("Join type must be INNER or LEFT");
  }

  return {
    datasetA,
    datasetB,
    dataA,
    dataB,
    matchedColA: colA.name,
    matchedColB: colB.name,
    normalizedJoinType,
  };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/datasets/blends/preview
 * Previews a blend between two datasets without saving to database.
 */
export async function previewDatasetBlend(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const input = blendPreviewSchema.parse(req.body);

  const {
    datasetA,
    datasetB,
    dataA,
    dataB,
    matchedColA,
    matchedColB,
    normalizedJoinType,
  } = await validateAndResolveBlend(
    input.datasetAId,
    input.datasetBId,
    input.joinColumnA,
    input.joinColumnB,
    input.joinType,
    userId,
    organizationId,
    roleName
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

  sendSuccess(res, {
    datasetA: {
      id: datasetA.id,
      name: datasetA.name,
      rowCount: dataA.rows.length,
      columnCount: dataA.columns.length,
    },
    datasetB: {
      id: datasetB.id,
      name: datasetB.name,
      rowCount: dataB.rows.length,
      columnCount: dataB.columns.length,
    },
    joinColumnA: matchedColA,
    joinColumnB: matchedColB,
    joinType: normalizedJoinType,
    resultingColumns: resultingColumns.map((c) => ({
      name: c.name,
      type: c.type.toLowerCase(),
      origin: c.origin,
    })),
    rowCount: joinedRows.length,
    previewRowCount: previewRows.length,
    rows: previewRows,
  });
}

/**
 * POST /api/v1/datasets/blends
 * Permanently saves the blended dataset as a DERIVED dataset.
 */
export async function createDatasetBlend(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const input = createBlendSchema.parse(req.body);

  const {
    datasetA,
    datasetB,
    dataA,
    dataB,
    matchedColA,
    matchedColB,
    normalizedJoinType,
  } = await validateAndResolveBlend(
    input.datasetAId,
    input.datasetBId,
    input.joinColumnA,
    input.joinColumnB,
    input.joinType,
    userId,
    organizationId,
    roleName
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
    nullable: true,
  }));

  const schemaMeta: Record<string, unknown> = {
    columns: schemaColumns,
    sampleData: joinedRows.slice(0, 1000),
    rowCount: joinedRows.length,
    columnCount: resultingColumns.length,
    blendConfig: {
      datasetAId: datasetA.id,
      datasetAName: datasetA.name,
      datasetBId: datasetB.id,
      datasetBName: datasetB.name,
      joinColumnA: matchedColA,
      joinColumnB: matchedColB,
      joinType: normalizedJoinType,
      createdAt: new Date().toISOString(),
    },
  };

  const blendedDataset = await prisma.dataset.create({
    data: {
      organizationId,
      workspaceId: datasetA.workspaceId,
      name: input.name,
      description: input.description || null,
      sourceType: "CSV",
      type: "DERIVED",
      status: "READY",
      rowCount: joinedRows.length,
      columnCount: resultingColumns.length,
      createdById: userId,
      schemaMeta: schemaMeta as Prisma.InputJsonValue,
      columns: {
        create: resultingColumns.map((c, idx) => ({
          name: c.name,
          dataType: mapToPrismaColumnType(c.type),
          nullable: true,
          ordinalPosition: idx + 1,
        })),
      },
    },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_CREATED",
    resourceType: "Dataset",
    resourceId: blendedDataset.id,
    metadata: {
      name: blendedDataset.name,
      type: "DERIVED",
      blendConfig: schemaMeta.blendConfig,
      rowCount: joinedRows.length,
      columnsCount: resultingColumns.length,
      workspaceId: datasetA.workspaceId,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataset(blendedDataset), 201);
}

/**
 * GET /api/v1/datasets/blends
 * Lists all blended (DERIVED) datasets for the current workspace.
 */
export async function listDatasetBlends(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const queryWsId =
    (req.query.workspaceId as string | undefined) ||
    (req.headers["x-workspace-id"] as string | undefined);

  const whereClause: Prisma.DatasetWhereInput = {
    organizationId,
    type: "DERIVED",
  };

  if (queryWsId) {
    await resolveWorkspaceAccess(queryWsId, userId, organizationId, roleName);
    whereClause.workspaceId = queryWsId;
  } else if (roleName !== "ADMIN") {
    const userMemberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const wsIds = userMemberships.map((m) => m.workspaceId);
    whereClause.OR = [
      { workspaceId: { in: wsIds } },
      { workspaceId: null },
    ];
  }

  const datasets = await prisma.dataset.findMany({
    where: whereClause,
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, datasets.map((d) => ({
    ...buildSafeDataset(d),
    blendConfig: ((d.schemaMeta || {}) as Record<string, unknown>).blendConfig || null,
  })));
}

/**
 * GET /api/v1/datasets/blends/:id
 * Retrieve details of a single blended dataset.
 */
export async function getDatasetBlend(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  if (!dataset || dataset.type !== "DERIVED") {
    throw AppError.notFound("Blended dataset");
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  sendSuccess(res, {
    ...buildSafeDataset(dataset),
    blendConfig: ((dataset.schemaMeta || {}) as Record<string, unknown>).blendConfig || null,
  });
}

/**
 * DELETE /api/v1/datasets/blends/:id
 * Deletes a blended dataset.
 */
export async function deleteDatasetBlend(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const dataset = await prisma.dataset.findUnique({
    where: { id },
  });

  if (!dataset || dataset.type !== "DERIVED") {
    throw AppError.notFound("Blended dataset");
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  await prisma.$transaction(async (tx) => {
    await tx.datasetColumn.deleteMany({ where: { datasetId: id } });
    await tx.chart.deleteMany({ where: { datasetId: id } });
    await tx.dataset.delete({ where: { id } });
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_DELETED",
    resourceType: "Dataset",
    resourceId: id,
    metadata: { name: dataset.name, type: "DERIVED" },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { success: true, message: "Blended dataset deleted successfully." });
}
