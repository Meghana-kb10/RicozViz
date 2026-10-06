// ========================================
// Dataset Management Service
// ========================================
// Handles dataset CRUD, CSV ingestion, PostgreSQL discovery,
// schema extraction, safe previewing, and query execution.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type {
  Dataset,
  DatasetColumn,
  DatasetColumnType,
  DatasetSourceType,
  DatasetStatus,
  DatasetType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import {
  parseCsvText,
  discoverCsvSchema,
  parseJsonTabular,
  discoverJsonSchema,
  parseXlsxBuffer,
  discoverXlsxSchema,
} from "./type-inference.js";
import { schemaDiscoveryService } from "./schema-discovery.service.js";
import { computeDatasetProfile } from "./data-quality.service.js";
import {
  datasetQueryEngine,
  ALLOWED_AGGREGATIONS,
  QUERY_LIMITS,
  type DatasetQueryParams,
} from "./query-engine.js";
import {
  resolveTargetWorkspaceId,
  verifyResourceWorkspaceAccess,
} from "../workspace/workspace-auth.helper.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";

export function mapToPrismaColumnType(type: string): DatasetColumnType {
  const normalized = type.toUpperCase();
  if (
    normalized === "INTEGER" ||
    normalized === "NUMBER" ||
    normalized === "DECIMAL" ||
    normalized === "FLOAT" ||
    normalized === "DOUBLE"
  ) {
    return "NUMBER";
  }
  if (normalized === "BOOLEAN" || normalized === "BOOL") {
    return "BOOLEAN";
  }
  if (normalized === "DATETIME" || normalized === "TIMESTAMP") {
    return "DATETIME";
  }
  if (normalized === "DATE") {
    return "DATE";
  }
  return "STRING";
}

/**
 * Validates dataset ID format.
 * Accepts standard UUIDs as well as test slug identifiers (e.g. ds-preview-test).
 */
export function validateDatasetId(id: string | undefined): string {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw AppError.badRequest("Invalid dataset ID: ID is required");
  }
  const trimmed = id.trim();
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(trimmed)) {
    throw AppError.badRequest("Invalid dataset ID format: must be a valid UUID or identifier");
  }
  return trimmed;
}

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDatasetSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),
  description: z.string().max(500).optional().nullable(),
  workspaceId: z.string().trim().min(1, "Invalid workspace ID").max(100).optional().nullable(),
  sourceType: z
    .enum(["CSV", "XLSX", "JSON"], {
      errorMap: () => ({ message: "Invalid source type: must be CSV, XLSX, or JSON" }),
    })
    .optional()
    .default("CSV"),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  rowCount: z.number().int().nonnegative().optional().default(0),
  columnCount: z.number().int().nonnegative().optional().default(0),
  status: z
    .enum(["PROCESSING", "READY", "FAILED", "ACTIVE", "DRAFT", "ARCHIVED", "ERROR"])
    .optional()
    .default("READY"),
  schema: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  schemaMeta: z.record(z.unknown()).optional(),
  type: z.enum(["CONNECTED", "UPLOADED", "DERIVED"]).optional(),
  dataSourceId: z.string().uuid("Invalid DataSource ID").optional().nullable(),
  tableName: z.string().max(63).optional(),
  columns: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["string", "number", "integer", "boolean", "date", "datetime", "decimal"]),
        nullable: z.boolean().default(true),
      })
    )
    .optional(),
  sampleData: z.array(z.record(z.unknown())).optional(),
  csvText: z.string().optional(),
});

export const updateDatasetSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  sourceType: z
    .enum(["CSV", "XLSX", "JSON"], {
      errorMap: () => ({ message: "Invalid source type: must be CSV, XLSX, or JSON" }),
    })
    .optional(),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  rowCount: z.number().int().nonnegative().optional(),
  columnCount: z.number().int().nonnegative().optional(),
  status: z
    .enum(["PROCESSING", "READY", "FAILED", "ACTIVE", "DRAFT", "ARCHIVED", "ERROR"])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  schemaMeta: z.record(z.unknown()).optional(),
});

export const listDatasetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sourceType: z.enum(["CSV", "XLSX", "JSON"]).optional(),
  type: z.enum(["CONNECTED", "UPLOADED", "DERIVED"]).optional(),
  status: z.string().optional(),
  workspaceId: z.string().trim().min(1, "Invalid workspace ID").max(100).optional(),
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
  sort: z
    .object({
      column: z.string().min(1),
      direction: z.enum(["asc", "desc", "ASC", "DESC"]).default("asc"),
    })
    .optional(),
  sorting: z
    .union([
      z.object({
        column: z.string().min(1),
        direction: z.enum(["asc", "desc", "ASC", "DESC"]).default("asc"),
      }),
      z.array(
        z.object({
          column: z.string().min(1),
          direction: z.enum(["asc", "desc", "ASC", "DESC"]).default("asc"),
        })
      ),
    ])
    .optional(),
  filters: z
    .array(
      z.object({
        column: z.string().min(1),
        operator: z.string().min(1),
        value: z.unknown().optional(),
      })
    )
    .max(QUERY_LIMITS.MAX_FILTERS)
    .optional(),
  filterLogic: z.enum(["AND", "OR"]).default("AND").optional(),
  logic: z.enum(["AND", "OR"]).optional(),
  dimensions: z.array(z.string().min(1)).max(QUERY_LIMITS.MAX_DIMENSIONS).optional(),
  groupBy: z.array(z.string().min(1)).max(QUERY_LIMITS.MAX_DIMENSIONS).optional(),
  measures: z
    .array(
      z.object({
        column: z.string().min(1),
        aggregation: z.union([z.enum(ALLOWED_AGGREGATIONS), z.string()]),
        alias: z.string().max(63).optional(),
      })
    )
    .max(QUERY_LIMITS.MAX_MEASURES)
    .optional(),
  aggregations: z
    .array(
      z.object({
        column: z.string().min(1),
        function: z.string().optional(),
        aggregation: z.string().optional(),
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
  ds: Dataset & {
    dataSource?: { id: string; name: string; type: string } | null;
    columns?: DatasetColumn[];
  }
) {
  const meta = (ds.schemaMeta || {}) as Record<string, unknown>;

  const calculatedFields = Array.isArray(meta["calculatedFields"])
    ? (meta["calculatedFields"] as Array<{ id: string; name: string; expression: string; dataType: string }>)
    : [];
  const calcFieldMap = new Map(calculatedFields.map((cf) => [cf.name.toLowerCase(), cf]));

  // Use relational DatasetColumn records if available, otherwise fallback to schemaMeta.columns
  let columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    ordinalPosition?: number;
    isCalculated?: boolean;
    expression?: string;
  }> = [];

  if (ds.columns && ds.columns.length > 0) {
    columns = ds.columns.map((c) => ({
      name: c.name,
      type: c.dataType.toLowerCase(),
      nullable: c.nullable,
      ordinalPosition: c.ordinalPosition,
      isCalculated: calcFieldMap.has(c.name.toLowerCase()),
      expression: calcFieldMap.get(c.name.toLowerCase())?.expression || undefined,
    }));
  } else if (Array.isArray(meta["columns"])) {
    columns = (meta["columns"] as Array<{
      name: string;
      type: string;
      nullable: boolean;
      ordinalPosition?: number;
    }>).map((c) => ({
      name: c.name,
      type: (c.type || "string").toLowerCase(),
      nullable: c.nullable ?? true,
      ordinalPosition: c.ordinalPosition,
      isCalculated: calcFieldMap.has(c.name.toLowerCase()),
      expression: calcFieldMap.get(c.name.toLowerCase())?.expression || undefined,
    }));
  }

  const sampleData = (meta["sampleData"] as unknown[]) || [];
  const storedRowCount =
    typeof ds.rowCount === "number" && ds.rowCount > 0
      ? ds.rowCount
      : typeof meta["rowCount"] === "number"
        ? meta["rowCount"]
        : sampleData.length;

  const storedColumnCount =
    typeof ds.columnCount === "number" && ds.columnCount > 0
      ? ds.columnCount
      : typeof meta["columnCount"] === "number"
        ? meta["columnCount"]
        : columns.length;

  const clientStatus =
    ds.status === "ACTIVE"
      ? "READY"
      : ds.status === "ERROR"
        ? "FAILED"
        : ds.status;

  const clientSourceType =
    ds.sourceType ?? (meta["sourceType"] as string) ?? "CSV";

  const clientFileName =
    ds.fileName ?? (meta["filename"] as string) ?? (meta["fileName"] as string) ?? null;

  const clientFileSize =
    ds.fileSize ?? (meta["fileSize"] as number) ?? null;

  return {
    id: ds.id,
    workspaceId: ds.workspaceId ?? null,
    name: ds.name,
    description: ds.description,
    sourceType: clientSourceType,
    fileName: clientFileName,
    fileSize: clientFileSize,
    rowCount: storedRowCount,
    columnCount: storedColumnCount,
    type: ds.type,
    status: clientStatus,
    dataSourceId: ds.dataSourceId,
    dataSourceName: ds.dataSource?.name || null,
    dataSourceType: ds.dataSource?.type || null,
    dataSource: ds.dataSource
      ? {
          id: ds.dataSource.id,
          name: ds.dataSource.name,
          type: ds.dataSource.type === "CSV_UPLOAD" ? "CSV" : ds.dataSource.type,
        }
      : null,
    columns,
    calculatedFields,
    tableName: (meta["tableName"] as string) || null,
    schema: meta,
    metadata: meta,
    schemaMeta: meta,
    createdAt: ds.createdAt ? (ds.createdAt instanceof Date ? ds.createdAt.toISOString() : new Date(ds.createdAt).toISOString()) : new Date().toISOString(),
    updatedAt: ds.updatedAt ? (ds.updatedAt instanceof Date ? ds.updatedAt.toISOString() : new Date(ds.updatedAt).toISOString()) : new Date().toISOString(),
  };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/datasets
 * Create a new dataset from metadata, a registered DataSource, or an uploaded CSV.
 */
export async function createDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const input = createDatasetSchema.parse(req.body);

  const requestedWsId =
    input.workspaceId || (req.headers["x-workspace-id"] as string | undefined);
  const workspaceId = await resolveTargetWorkspaceId(
    requestedWsId,
    userId,
    organizationId,
    roleName
  );

  let determinedType: DatasetType = input.type || "UPLOADED";
  let resolvedDataSourceId: string | null = input.dataSourceId || null;
  let schemaColumns: Array<{ name: string; type: string; nullable: boolean }> = input.columns || [];
  let sampleRows = input.sampleData || [];

  // 1. If dataSourceId provided, verify it belongs to this organization and workspace!
  if (resolvedDataSourceId) {
    determinedType = "CONNECTED";
    const ds = await prisma.dataSource.findUnique({
      where: { id: resolvedDataSourceId },
    });

    if (!ds) {
      throw AppError.notFound("Data source");
    }

    await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);
  }

  // 2. If CSV text is submitted, parse and infer schema
  if (input.csvText) {
    determinedType = "UPLOADED";
    resolvedDataSourceId = null;
    const { headers, rows } = parseCsvText(input.csvText);
    schemaColumns = discoverCsvSchema(headers, rows);
    sampleRows = rows.slice(0, 100);
  }

  const metadata = input.metadata || input.schema || input.schemaMeta || {};
  const schemaMeta: Record<string, unknown> = {
    ...metadata,
    columns: schemaColumns.length > 0 ? schemaColumns : metadata["columns"] || [],
    sampleData: sampleRows.length > 0 ? sampleRows : metadata["sampleData"] || [],
    tableName: input.tableName || metadata["tableName"] || null,
    rowCount: input.rowCount || sampleRows.length || (typeof metadata["rowCount"] === "number" ? metadata["rowCount"] : 0),
    columnCount: input.columnCount || schemaColumns.length || (typeof metadata["columnCount"] === "number" ? metadata["columnCount"] : 0),
    sourceType: input.sourceType,
    fileName: input.fileName || null,
    fileSize: input.fileSize || null,
  };

  if (sampleRows.length > 0) {
    try {
      const generatedProfile = computeDatasetProfile(
        { id: "pending", name: input.name, schemaMeta },
        sampleRows
      );
      schemaMeta.dataQualityProfile = generatedProfile;
    } catch {
      // Non-blocking profiling failure
    }
  }

  const finalRowCount = input.rowCount || Number(schemaMeta["rowCount"]) || 0;
  const finalColumnCount = input.columnCount || Number(schemaMeta["columnCount"]) || schemaColumns.length || 0;

  const dataset = await prisma.dataset.create({
    data: {
      organizationId,
      workspaceId,
      name: input.name,
      description: input.description,
      sourceType: input.sourceType as DatasetSourceType,
      fileName: input.fileName,
      fileSize: input.fileSize,
      rowCount: finalRowCount,
      columnCount: finalColumnCount,
      type: determinedType,
      status: (input.status as DatasetStatus) || "READY",
      dataSourceId: resolvedDataSourceId,
      schemaMeta: schemaMeta as Prisma.InputJsonValue,
      createdById: userId,
      columns: {
        create: schemaColumns.map((col, idx) => ({
          name: col.name,
          dataType: mapToPrismaColumnType(col.type),
          nullable: col.nullable !== false,
          ordinalPosition: idx + 1,
        })),
      },
    },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
      columns: { orderBy: { ordinalPosition: "asc" } },
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
      sourceType: dataset.sourceType,
      type: dataset.type,
      dataSourceId: dataset.dataSourceId,
      columnsCount: finalColumnCount,
      rowCount: finalRowCount,
      workspaceId,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataset(dataset), 201);
}

/**
 * POST /api/v1/datasets/upload
 * Multipart file upload (CSV, XLSX, or JSON) with schema inference and DatasetColumn creation.
 */
export async function uploadDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;

  let fileBuffer: Buffer | null = null;
  let rawFilename = "";

  if (req.file) {
    fileBuffer = req.file.buffer;
    rawFilename = req.file.originalname || "";
  } else if (req.body?.fileContent) {
    fileBuffer = Buffer.from(String(req.body.fileContent), "utf-8");
    rawFilename = String(req.body.fileName || "uploaded_data.csv");
  } else if (req.body?.csvText) {
    fileBuffer = Buffer.from(String(req.body.csvText), "utf-8");
    rawFilename = "uploaded_data.csv";
  } else if (req.body?.jsonText) {
    fileBuffer = Buffer.from(String(req.body.jsonText), "utf-8");
    rawFilename = "uploaded_data.json";
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw AppError.badRequest("Uploaded file is empty");
  }

  const MAX_FILE_SIZE =
    parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || "", 10) || 15 * 1024 * 1024; // 15MB
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw AppError.badRequest(
      `File exceeds maximum allowable size of ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`
    );
  }

  // Safe sanitized filename (never trust raw client filename for filesystem paths)
  const safeFilename =
    rawFilename
      .replace(/^.*[\\/]/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .trim() || "uploaded_file";

  const ext = safeFilename.split(".").pop()?.toLowerCase() || "";
  const mime = req.file?.mimetype?.toLowerCase() || "";

  const isXlsx =
    ext === "xlsx" ||
    ext === "xls" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel";

  const isJson =
    ext === "json" ||
    mime === "application/json" ||
    mime === "text/json";

  const isCsv =
    ext === "csv" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    (mime === "text/plain" && ext === "csv") ||
    (!isXlsx && !isJson && ext === "csv");

  if (!isXlsx && !isJson && !isCsv) {
    throw AppError.badRequest(
      "Unsupported file format. Supported formats are CSV, XLSX, and JSON."
    );
  }

  let schemaColumns: Array<{ name: string; type: string; nullable: boolean }> = [];
  let sampleRows: Record<string, unknown>[] = [];
  let rowCount = 0;
  let detectedSourceType: DatasetSourceType = "CSV";

  if (isXlsx) {
    detectedSourceType = "XLSX";
    try {
      const { headers, rows } = parseXlsxBuffer(fileBuffer);
      if (headers.length === 0 || rows.length === 0) {
        throw AppError.badRequest("XLSX file is empty or contains no records");
      }
      schemaColumns = discoverXlsxSchema(headers, rows);
      sampleRows = rows.slice(0, 100);
      rowCount = rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : "Failed to parse XLSX file";
      throw AppError.badRequest(msg);
    }
  } else if (isJson) {
    detectedSourceType = "JSON";
    const fileText = fileBuffer.toString("utf-8");
    if (!fileText.trim()) {
      throw AppError.badRequest("Uploaded file is empty");
    }
    try {
      const { headers, rows } = parseJsonTabular(fileText);
      schemaColumns = discoverJsonSchema(headers, rows);
      sampleRows = rows.slice(0, 100);
      rowCount = rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : "Failed to parse JSON file";
      throw AppError.badRequest(msg);
    }
  } else {
    detectedSourceType = "CSV";
    const fileText = fileBuffer.toString("utf-8");
    if (!fileText.trim()) {
      throw AppError.badRequest("Uploaded file is empty");
    }
    try {
      const { headers, rows } = parseCsvText(fileText);
      if (headers.length === 0 || rows.length === 0) {
        throw AppError.badRequest("CSV file is empty or contains no records");
      }
      schemaColumns = discoverCsvSchema(headers, rows);
      sampleRows = rows.slice(0, 100);
      rowCount = rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : "Failed to parse CSV file";
      throw AppError.badRequest(msg);
    }
  }

  const requestedWsId =
    (req.body?.workspaceId as string | undefined) ||
    (req.query.workspaceId as string | undefined) ||
    (req.headers["x-workspace-id"] as string | undefined);

  const workspaceId = await resolveTargetWorkspaceId(
    requestedWsId,
    userId,
    organizationId,
    roleName
  );

  const rawName = (req.body?.name as string | undefined)?.trim();
  const defaultName = safeFilename ? safeFilename.replace(/\.[^/.]+$/, "") : "Uploaded Dataset";
  const datasetName = rawName || defaultName;
  const description = (req.body?.description as string | undefined)?.trim() || null;

  let resolvedDataSourceId: string | null = null;
  const rawDataSourceId = (req.body?.dataSourceId as string | undefined)?.trim();
  if (rawDataSourceId) {
    const ds = await prisma.dataSource.findUnique({ where: { id: rawDataSourceId } });
    if (!ds) throw AppError.notFound("Data source");
    await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);
    resolvedDataSourceId = ds.id;
  }

  const schemaMeta: Record<string, unknown> = {
    columns: schemaColumns,
    sampleData: sampleRows,
    rowCount,
    columnCount: schemaColumns.length,
    fileName: safeFilename,
    fileSize: fileBuffer.length,
    sourceType: detectedSourceType,
    uploadedAt: new Date().toISOString(),
  };

  if (sampleRows.length > 0) {
    try {
      const generatedProfile = computeDatasetProfile(
        { id: "pending", name: datasetName, schemaMeta },
        sampleRows
      );
      schemaMeta.dataQualityProfile = generatedProfile;
    } catch {
      // Non-blocking profiling failure
    }
  }

  const dataset = await prisma.dataset.create({
    data: {
      organizationId,
      workspaceId,
      dataSourceId: resolvedDataSourceId,
      name: datasetName,
      description,
      sourceType: detectedSourceType,
      fileName: safeFilename,
      fileSize: fileBuffer.length,
      rowCount,
      columnCount: schemaColumns.length,
      type: "UPLOADED",
      status: "READY",
      schemaMeta: schemaMeta as Prisma.InputJsonValue,
      createdById: userId,
      columns: {
        create: schemaColumns.map((col, idx) => ({
          name: col.name,
          dataType: mapToPrismaColumnType(col.type),
          nullable: col.nullable !== false,
          ordinalPosition: idx + 1,
        })),
      },
    },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_UPLOADED",
    resourceType: "Dataset",
    resourceId: dataset.id,
    metadata: {
      name: dataset.name,
      type: dataset.type,
      format: detectedSourceType,
      rowCount,
      columnsCount: schemaColumns.length,
      workspaceId,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataset(dataset), 201);
}

/**
 * GET /api/v1/datasets
 * List organization datasets with workspace filtering, search, source type filtering, and pagination.
 */
export async function listDatasets(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const query = listDatasetsQuerySchema.parse(req.query);
  const page = query.page;
  const limit = query.limit;
  const search = query.search;
  const sourceType = query.sourceType;
  const typeFilter = query.type;
  const queryWsId =
    query.workspaceId ||
    (req.headers["x-workspace-id"] as string | undefined);

  const whereClause: Prisma.DatasetWhereInput = {
    organizationId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    ...(sourceType ? { sourceType: sourceType as DatasetSourceType } : {}),
    ...(typeFilter ? { type: typeFilter as DatasetType } : {}),
    ...(query.status ? { status: query.status as DatasetStatus } : {}),
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

  const [datasets, total] = await Promise.all([
    prisma.dataset.findMany({
      where: whereClause,
      include: {
        dataSource: { select: { id: true, name: true, type: true } },
        columns: { orderBy: { ordinalPosition: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dataset.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  sendSuccess(res, datasets.map(buildSafeDataset), 200, {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  });
}

/**
 * GET /api/v1/datasets/:id
 * Retrieve a single dataset with tenant and workspace verification.
 */
export async function getDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const id = validateDatasetId(req.params.id);

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  sendSuccess(res, buildSafeDataset(dataset));
}

/**
 * PATCH /api/v1/datasets/:id
 * Update dataset details.
 */
export async function updateDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const id = validateDatasetId(req.params.id);

  const existing = await prisma.dataset.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Dataset");
  }

  await verifyResourceWorkspaceAccess(existing, userId, organizationId, roleName);

  const input = updateDatasetSchema.parse(req.body);

  const existingMeta = (existing.schemaMeta || {}) as Record<string, unknown>;
  const mergedMeta = {
    ...existingMeta,
    ...(input.metadata || input.schemaMeta || {}),
  };

  const updated = await prisma.dataset.update({
    where: { id },
    data: {
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      sourceType: (input.sourceType as DatasetSourceType) ?? existing.sourceType,
      fileName: input.fileName !== undefined ? input.fileName : existing.fileName,
      fileSize: input.fileSize !== undefined ? input.fileSize : existing.fileSize,
      rowCount: input.rowCount !== undefined ? input.rowCount : existing.rowCount,
      columnCount: input.columnCount !== undefined ? input.columnCount : existing.columnCount,
      status: (input.status as DatasetStatus) ?? existing.status,
      schemaMeta: (input.metadata || input.schemaMeta) ? (mergedMeta as Prisma.InputJsonValue) : undefined,
    },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
      columns: { orderBy: { ordinalPosition: "asc" } },
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
  const { organizationId, userId, roleName } = req.user!;
  const id = validateDatasetId(req.params.id);

  const existing = await prisma.dataset.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Dataset");
  }

  await verifyResourceWorkspaceAccess(existing, userId, organizationId, roleName);

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
 * Returns bounded preview rows with column definitions for a dataset.
 */
export async function previewDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const id = validateDatasetId(req.params.id);
  const rawLimit = Number(req.query.limit || 25);
  const effectiveLimit = Math.min(Math.max(rawLimit, 1), 50);

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  const result = await datasetQueryEngine.executeQuery(dataset, { limit: effectiveLimit });
  const previewRows = result.rows.slice(0, 50);

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_PREVIEWED",
    resourceType: "Dataset",
    resourceId: id,
    metadata: {
      limit: effectiveLimit,
      returnedRows: previewRows.length,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    ...result,
    rows: previewRows,
    dataset: buildSafeDataset(dataset),
    datasetId: id,
    columnNames: dataset.columns.map((c) => c.name),
    columnTypes: dataset.columns.map((c) => ({
      name: c.name,
      type: c.dataType.toLowerCase(),
      dataType: c.dataType,
    })),
    totalRowCount: dataset.rowCount,
    totalColumnCount: dataset.columnCount || dataset.columns.length,
    previewRows,
    previewLimit: Math.min(Math.max(rawLimit, 1), 1000),
    columnDefinitions: dataset.columns.map((c) => ({
      name: c.name,
      dataType: c.dataType,
      nullable: c.nullable,
      ordinalPosition: c.ordinalPosition,
    })),
  });
}

/**
 * POST /api/v1/datasets/:id/query
 * Safe query execution foundation supporting filtering, sorting, pagination, and aggregation.
 */
export async function queryDataset(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const id = validateDatasetId(req.params.id);
  const queryParams = datasetQueryParamsSchema.parse(req.body);

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset");
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  // Cross-tenant and cross-workspace check for connected DataSource
  if (dataset.dataSourceId) {
    const ds = await prisma.dataSource.findUnique({
      where: { id: dataset.dataSourceId },
    });
    if (!ds) {
      throw AppError.notFound("Data source");
    }
    await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);
  }

  const result = await datasetQueryEngine.executeQuery(dataset, queryParams as unknown as DatasetQueryParams);

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
  const { organizationId, userId, roleName } = req.user!;
  const dataSourceId = String(req.params.dataSourceId || "");

  if (!dataSourceId) {
    throw AppError.badRequest("DataSource ID is required");
  }

  const ds = await prisma.dataSource.findUnique({ where: { id: dataSourceId } });
  if (!ds) throw AppError.notFound("Data source");
  await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);

  const tables = await schemaDiscoveryService.listTables(
    dataSourceId,
    organizationId
  );

  sendSuccess(res, tables);
}

/**
 * GET /api/v1/datasets/source/:dataSourceId/tables/:tableName/schema
 * Discovers column schema for a specific table in a DataSource (PostgreSQL, MySQL, etc).
 */
export async function getSourceTableSchema(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const dataSourceId = String(req.params.dataSourceId || "");
  const tableName = String(req.params.tableName || "");

  if (!dataSourceId || !tableName) {
    throw AppError.badRequest("DataSource ID and Table Name are required");
  }

  const ds = await prisma.dataSource.findUnique({ where: { id: dataSourceId } });
  if (!ds) throw AppError.notFound("Data source");
  await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);

  const columns = await schemaDiscoveryService.discoverTableSchema(
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
