// ========================================
// Dataset Management Service
// ========================================
// Handles dataset CRUD, CSV ingestion, PostgreSQL discovery,
// schema extraction, safe previewing, and query execution.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Dataset, DatasetStatus, DatasetType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import { parseCsvText, discoverCsvSchema } from "./type-inference.js";
import { schemaDiscoveryService } from "./schema-discovery.service.js";
import {
  datasetQueryEngine,
  ALLOWED_FILTER_OPERATORS,
  ALLOWED_AGGREGATIONS,
  QUERY_LIMITS,
} from "./query-engine.js";

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDatasetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["CONNECTED", "UPLOADED", "DERIVED"]).optional(),
  dataSourceId: z.string().uuid("Invalid DataSource ID").optional().nullable(),
  tableName: z.string().max(63).optional(),
  columns: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["string", "number", "integer", "boolean", "date"]),
        nullable: z.boolean().default(true),
      })
    )
    .optional(),
  sampleData: z.array(z.record(z.unknown())).optional(),
  csvText: z.string().optional(),
});

export const updateDatasetSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED", "ERROR"]).optional(),
});

export const previewCsvSchema = z.object({
  csvText: z.string().min(1, "CSV content cannot be empty").max(10 * 1024 * 1024, "Max CSV size is 10MB"),
  delimiter: z.string().default(","),
});

export const datasetQueryParamsSchema = z.object({
  columns: z.array(z.string().min(1)).max(QUERY_LIMITS.MAX_COLUMNS).optional(),
  limit: z.coerce.number().int().min(1).max(QUERY_LIMITS.MAX_ROW_LIMIT).default(QUERY_LIMITS.DEFAULT_ROW_LIMIT),
  offset: z.coerce.number().int().min(0).max(QUERY_LIMITS.MAX_OFFSET).default(0),
  orderBy: z
    .object({
      column: z.string().min(1),
      direction: z.enum(["asc", "desc", "ASC", "DESC"]).default("asc"),
    })
    .optional(),
  filters: z
    .array(
      z.object({
        column: z.string().min(1),
        operator: z.enum(ALLOWED_FILTER_OPERATORS),
        value: z.unknown().optional(),
      })
    )
    .max(QUERY_LIMITS.MAX_FILTERS)
    .optional(),
  filterLogic: z.enum(["AND", "OR"]).default("AND").optional(),
  logic: z.enum(["AND", "OR"]).optional(),
  dimensions: z.array(z.string().min(1)).max(QUERY_LIMITS.MAX_DIMENSIONS).optional(),
  measures: z
    .array(
      z.object({
        column: z.string().min(1),
        aggregation: z.enum(ALLOWED_AGGREGATIONS),
        alias: z.string().max(63).optional(),
      })
    )
    .max(QUERY_LIMITS.MAX_MEASURES)
    .optional(),
});

// ============================================================
// HELPER: BUILD SAFE DATASET RESPONSE
// ============================================================

export function buildSafeDataset(
  ds: Dataset & { dataSource?: { id: string; name: string; type: string } | null }
) {
  const meta = (ds.schemaMeta || {}) as Record<string, unknown>;

  return {
    id: ds.id,
    name: ds.name,
    description: ds.description,
    type: ds.type,
    status: ds.status === "ACTIVE" ? "READY" : ds.status === "ERROR" ? "FAILED" : ds.status,
    dataSourceId: ds.dataSourceId,
    dataSourceName: ds.dataSource?.name || null,
    dataSourceType: ds.dataSource?.type || null,
    columns: meta.columns || [],
    tableName: meta.tableName || null,
    rowCount: (meta.sampleData as unknown[])?.length || 0,
    createdAt: ds.createdAt.toISOString(),
    updatedAt: ds.updatedAt.toISOString(),
  };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/datasets
 * Create a new dataset from a registered DataSource or an uploaded CSV.
 */
export async function createDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const input = createDatasetSchema.parse(req.body);

  let determinedType: DatasetType = input.type || "CONNECTED";
  let resolvedDataSourceId: string | null = input.dataSourceId || null;
  let schemaColumns = input.columns || [];
  let sampleRows = input.sampleData || [];

  // 1. If dataSourceId provided, verify it belongs to this organization!
  if (resolvedDataSourceId) {
    const ds = await prisma.dataSource.findUnique({
      where: { id: resolvedDataSourceId },
    });

    if (!ds) {
      throw AppError.notFound("Data source");
    }

    if (ds.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: data source belongs to a different organization");
    }
  }

  // 2. If CSV text is submitted, parse and infer schema
  if (input.csvText) {
    determinedType = "UPLOADED";
    resolvedDataSourceId = null;
    const { headers, rows } = parseCsvText(input.csvText);
    schemaColumns = discoverCsvSchema(headers, rows);
    sampleRows = rows.slice(0, 100);
  }

  const schemaMeta: Record<string, unknown> = {
    columns: schemaColumns,
    sampleData: sampleRows,
    tableName: input.tableName || null,
  };

  const dataset = await prisma.dataset.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description,
      type: determinedType,
      status: "ACTIVE",
      dataSourceId: resolvedDataSourceId,
      schemaMeta: schemaMeta as Prisma.InputJsonValue,
      createdById: userId,
    },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_CREATED",
    resourceType: "Dataset",
    resourceId: dataset.id,
    metadata: {
      name: dataset.name,
      type: dataset.type,
      dataSourceId: dataset.dataSourceId,
      columnsCount: schemaColumns.length,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataset(dataset), 201);
}

/**
 * GET /api/v1/datasets
 * List organization datasets with search and pagination.
 */
export async function listDatasets(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const search = req.query.search ? String(req.query.search).trim() : "";
  const typeFilter = req.query.type ? String(req.query.type) : undefined;

  const whereClause: Prisma.DatasetWhereInput = {
    organizationId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    ...(typeFilter ? { type: typeFilter as DatasetType } : {}),
  };

  const [datasets, total] = await Promise.all([
    prisma.dataset.findMany({
      where: whereClause,
      include: {
        dataSource: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dataset.count({ where: whereClause }),
  ]);

  sendSuccess(res, datasets.map(buildSafeDataset), 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

/**
 * GET /api/v1/datasets/:id
 * Retrieve a single dataset with tenant verification.
 */
export async function getDataset(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const { id } = req.params;

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  sendSuccess(res, buildSafeDataset(dataset));
}

/**
 * PATCH /api/v1/datasets/:id
 * Update dataset details.
 */
export async function updateDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  const existing = await prisma.dataset.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Dataset");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  const input = updateDatasetSchema.parse(req.body);

  const updated = await prisma.dataset.update({
    where: { id },
    data: {
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      status: (input.status as DatasetStatus) ?? existing.status,
    },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_UPDATED",
    resourceType: "Dataset",
    resourceId: id,
    metadata: {
      name: updated.name,
      fieldsUpdated: Object.keys(input),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataset(updated));
}

/**
 * DELETE /api/v1/datasets/:id
 * Delete a dataset if not referenced by dashboards/charts.
 */
export async function deleteDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  const existing = await prisma.dataset.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Dataset");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  // Referential check: prevent deletion if charts depend on it
  const chartCount = await prisma.chart.count({
    where: { datasetId: id },
  });

  if (chartCount > 0) {
    throw AppError.conflict(
      `Cannot delete dataset: it is currently referenced by ${chartCount} chart(s)`
    );
  }

  await prisma.dataset.delete({
    where: { id },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_DELETED",
    resourceType: "Dataset",
    resourceId: id,
    metadata: {
      name: existing.name,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: "Dataset deleted successfully" });
}

/**
 * GET /api/v1/datasets/:id/preview
 * Returns bounded preview rows for a dataset.
 */
export async function previewDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);

  const dataset = await prisma.dataset.findUnique({
    where: { id },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  const result = await datasetQueryEngine.executeQuery(dataset, { limit });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_PREVIEWED",
    resourceType: "Dataset",
    resourceId: id,
    metadata: {
      limit,
      returnedRows: result.rows.length,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, result);
}

/**
 * POST /api/v1/datasets/:id/query
 * Safe query execution foundation supporting filtering, sorting, pagination, and aggregation.
 */
export async function queryDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;
  const queryParams = datasetQueryParamsSchema.parse(req.body);

  const dataset = await prisma.dataset.findUnique({
    where: { id },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  if (dataset.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  // Cross-tenant check for connected DataSource
  if (dataset.dataSourceId) {
    const ds = await prisma.dataSource.findUnique({
      where: { id: dataset.dataSourceId },
    });
    if (!ds || ds.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: data source belongs to a different organization");
    }
  }

  const result = await datasetQueryEngine.executeQuery(dataset, queryParams);

  const isAggregate =
    (queryParams.dimensions && queryParams.dimensions.length > 0) ||
    (queryParams.measures && queryParams.measures.length > 0);

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_QUERIED",
    resourceType: "Dataset",
    resourceId: id,
    metadata: {
      queryMode: isAggregate ? "AGGREGATE" : "RAW",
      selectedColumnCount: result.columns.length,
      filterCount: (queryParams.filters || []).length,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, result);
}

/**
 * POST /api/v1/datasets/csv/preview-schema
 * Parses uploaded CSV text and returns inferred column schema and preview rows.
 */
export function previewCsvSchemaHandler(req: Request, res: Response): Promise<void> {
  const input = previewCsvSchema.parse(req.body);
  const { headers, rows } = parseCsvText(input.csvText, input.delimiter);
  const columns = discoverCsvSchema(headers, rows);

  sendSuccess(res, {
    columns,
    previewRows: rows.slice(0, 25),
    totalRows: rows.length,
  });

  return Promise.resolve();
}

/**
 * GET /api/v1/datasets/source/:dataSourceId/tables
 * Discovers available tables for a PostgreSQL DataSource.
 */
export async function listSourceTables(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const dataSourceId = String(req.params.dataSourceId || "");

  if (!dataSourceId) {
    throw AppError.badRequest("DataSource ID is required");
  }

  const tables = await schemaDiscoveryService.listPostgresTables(
    dataSourceId,
    organizationId
  );

  sendSuccess(res, tables);
}

/**
 * GET /api/v1/datasets/source/:dataSourceId/tables/:tableName/schema
 * Discovers column schema for a specific table in a PostgreSQL DataSource.
 */
export async function getSourceTableSchema(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const dataSourceId = String(req.params.dataSourceId || "");
  const tableName = String(req.params.tableName || "");

  if (!dataSourceId || !tableName) {
    throw AppError.badRequest("DataSource ID and Table Name are required");
  }

  const columns = await schemaDiscoveryService.discoverPostgresTableSchema(
    dataSourceId,
    organizationId,
    tableName
  );

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_SCHEMA_DISCOVERED",
    resourceType: "DataSource",
    resourceId: dataSourceId,
    metadata: {
      tableName,
      columnsCount: columns.length,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    tableName,
    columns,
  });
}
