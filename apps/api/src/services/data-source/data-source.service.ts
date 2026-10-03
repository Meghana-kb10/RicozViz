// ========================================
// Data Source Service
// ========================================
// Manages data source CRUD, secure credential extraction,
// and connection verification through connectors.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { DataSource, DataSourceStatus, DataSourceType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { credentialService } from "./credential.service.js";
import { getConnector } from "./connectors/index.js";
import { logAuditEvent } from "../audit.service.js";
import {
  resolveTargetWorkspaceId,
  verifyResourceWorkspaceAccess,
} from "../workspace/workspace-auth.helper.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

const postgresConnectionSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  ssl: z.boolean().optional().default(false),
});

const csvConnectionSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  delimiter: z.string().min(1).default(","),
  hasHeader: z.boolean().default(true),
  fileSize: z.number().optional(),
});

const xlsxConnectionSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  sheetName: z.string().optional().default("Sheet1"),
  fileSize: z.number().optional(),
});

const jsonConnectionSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  dataPath: z.string().optional().default("root"),
  fileSize: z.number().optional(),
});

const restApiConnectionSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  method: z.enum(["GET", "POST"]).default("GET"),
  headers: z.record(z.string()).optional(),
  authType: z.enum(["NONE", "API_KEY", "BEARER", "BASIC"]).default("NONE"),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional(),
});

export const createDataSourceSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional().nullable(),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["POSTGRESQL", "CSV", "CSV_UPLOAD", "REST_API", "XLSX", "JSON"]),
  connection: z.record(z.unknown()),
}).superRefine((data, ctx) => {
  const normalizedType = data.type === "CSV" ? "CSV_UPLOAD" : data.type;
  if (normalizedType === "POSTGRESQL") {
    const res = postgresConnectionSchema.safeParse(data.connection);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ["connection", ...issue.path] });
      }
    }
  } else if (normalizedType === "CSV_UPLOAD") {
    const res = csvConnectionSchema.safeParse(data.connection);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ["connection", ...issue.path] });
      }
    }
  } else if (normalizedType === "XLSX") {
    const res = xlsxConnectionSchema.safeParse(data.connection);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ["connection", ...issue.path] });
      }
    }
  } else if (normalizedType === "JSON") {
    const res = jsonConnectionSchema.safeParse(data.connection);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ["connection", ...issue.path] });
      }
    }
  } else if (normalizedType === "REST_API") {
    const res = restApiConnectionSchema.safeParse(data.connection);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ["connection", ...issue.path] });
      }
    }
  }
});

export const updateDataSourceSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  connection: z.record(z.unknown()).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR", "PENDING", "CONNECTED", "FAILED"]).optional(),
});

// ============================================================
// HELPER: BUILD SAFE DATA SOURCE
// ============================================================

export function buildSafeDataSource(ds: DataSource) {
  const meta = (ds.connectionMeta || {}) as Record<string, unknown>;

  // Ensure secrets are never exposed in connection metadata
  const safeConnection: Record<string, unknown> = { ...meta };
  delete safeConnection.password;
  delete safeConnection.apiKey;
  delete safeConnection.bearerToken;
  delete safeConnection.token;
  delete safeConnection.secret;
  delete safeConnection.accessToken;
  delete safeConnection.privateKey;

  // Map internal status to client-friendly status
  const clientStatus =
    ds.status === "ACTIVE"
      ? "CONNECTED"
      : ds.status === "ERROR"
        ? "FAILED"
        : ds.status;

  // Map internal type to client-friendly type
  const clientType =
    meta.sourceFormat === "XLSX"
      ? "XLSX"
      : meta.sourceFormat === "JSON"
        ? "JSON"
        : ds.type === "CSV_UPLOAD"
          ? "CSV"
          : ds.type;

  return {
    id: ds.id,
    workspaceId: ds.workspaceId ?? null,
    name: ds.name,
    description: ds.description,
    type: clientType,
    status: clientStatus,
    connection: safeConnection,
    hasCredentials: Boolean(ds.credentialRef),
    createdAt: ds.createdAt.toISOString(),
    updatedAt: ds.updatedAt.toISOString(),
  };
}

/**
 * Extracts and separates sensitive credentials from connection configuration.
 */
function separateCredentials(
  type: string,
  connection: Record<string, unknown>
): { nonSecretMeta: Record<string, unknown>; credentials: Record<string, unknown> } {
  const nonSecretMeta = { ...connection };
  const credentials: Record<string, unknown> = {};

  if (type === "POSTGRESQL") {
    if (nonSecretMeta.password) {
      credentials.password = nonSecretMeta.password;
      delete nonSecretMeta.password;
    }
  } else if (type === "REST_API") {
    if (nonSecretMeta.apiKey) {
      credentials.apiKey = nonSecretMeta.apiKey;
      delete nonSecretMeta.apiKey;
    }
    if (nonSecretMeta.bearerToken) {
      credentials.bearerToken = nonSecretMeta.bearerToken;
      delete nonSecretMeta.bearerToken;
    }
  }

  return { nonSecretMeta, credentials };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/data-sources
 * Create a new data source within the authenticated user's organization and workspace.
 */
export async function createDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const input = createDataSourceSchema.parse(req.body);

  const prismaType: DataSourceType =
    input.type === "CSV"
      ? "CSV_UPLOAD"
      : input.type === "XLSX" || input.type === "JSON"
        ? "OTHER"
        : (input.type as DataSourceType);

  const requestedWsId =
    input.workspaceId || (req.headers["x-workspace-id"] as string | undefined);
  const workspaceId = await resolveTargetWorkspaceId(
    requestedWsId,
    userId,
    organizationId,
    roleName
  );

  const { nonSecretMeta, credentials } = separateCredentials(
    input.type,
    input.connection
  );

  if (input.type === "XLSX" || input.type === "JSON") {
    nonSecretMeta.sourceFormat = input.type;
  }

  let credentialRef: string | null = null;
  if (Object.keys(credentials).length > 0) {
    credentialRef = await credentialService.storeCredentials(
      organizationId,
      credentials
    );
  }

  const dataSource = await prisma.dataSource.create({
    data: {
      organizationId,
      workspaceId,
      name: input.name,
      description: input.description,
      type: prismaType,
      status: "PENDING",
      connectionMeta: nonSecretMeta as object,
      credentialRef,
      createdById: userId,
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATA_SOURCE_CREATED",
    resourceType: "DataSource",
    resourceId: dataSource.id,
    metadata: {
      name: dataSource.name,
      type: dataSource.type,
      workspaceId,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataSource(dataSource), 201);
}

/**
 * GET /api/v1/data-sources
 * List data sources belonging to the user's workspace/organization.
 */
export async function listDataSources(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const queryWsId =
    (req.query.workspaceId as string | undefined) ||
    (req.headers["x-workspace-id"] as string | undefined);

  const whereClause: {
    organizationId: string;
    workspaceId?: string;
    OR?: Array<{ workspaceId: { in: string[] } } | { workspaceId: null }>;
  } = { organizationId };

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

  const dataSources = await prisma.dataSource.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, dataSources.map(buildSafeDataSource));
}

/**
 * GET /api/v1/data-sources/:id
 * Retrieve a single data source by ID with tenant and workspace verification.
 */
export async function getDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const dataSource = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!dataSource) {
    throw AppError.notFound("Data source");
  }

  await verifyResourceWorkspaceAccess(
    dataSource,
    userId,
    organizationId,
    roleName
  );

  sendSuccess(res, buildSafeDataSource(dataSource));
}

/**
 * PATCH /api/v1/data-sources/:id
 * Update an existing data source.
 */
export async function updateDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const existing = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Data source");
  }

  await verifyResourceWorkspaceAccess(
    existing,
    userId,
    organizationId,
    roleName
  );

  const input = updateDataSourceSchema.parse(req.body);

  let newCredentialRef = existing.credentialRef;
  let updatedMeta = (existing.connectionMeta || {}) as Record<string, unknown>;

  if (input.connection) {
    const { nonSecretMeta, credentials } = separateCredentials(
      existing.type,
      input.connection
    );

    updatedMeta = { ...updatedMeta, ...nonSecretMeta };

    if (Object.keys(credentials).length > 0) {
      if (existing.credentialRef) {
        await credentialService.deleteCredentials(existing.credentialRef);
      }
      newCredentialRef = await credentialService.storeCredentials(
        organizationId,
        credentials
      );
    }
  }

  // Normalize status if provided
  let prismaStatus: DataSourceStatus | undefined;
  if (input.status) {
    if (input.status === "CONNECTED") prismaStatus = "ACTIVE";
    else if (input.status === "FAILED") prismaStatus = "ERROR";
    else prismaStatus = input.status as DataSourceStatus;
  }

  const updated = await prisma.dataSource.update({
    where: { id },
    data: {
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      connectionMeta: updatedMeta as object,
      credentialRef: newCredentialRef,
      status: prismaStatus ?? existing.status,
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATA_SOURCE_UPDATED",
    resourceType: "DataSource",
    resourceId: id,
    metadata: {
      name: updated.name,
      updatedFields: Object.keys(input),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataSource(updated));
}

/**
 * DELETE /api/v1/data-sources/:id
 * Delete data source after verifying referential integrity and workspace permissions.
 */
export async function deleteDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const existing = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Data source");
  }

  await verifyResourceWorkspaceAccess(
    existing,
    userId,
    organizationId,
    roleName
  );

  // Integrity check: prevent deletion if datasets depend on this data source
  const datasetCount = await prisma.dataset.count({
    where: { dataSourceId: id },
  });

  if (datasetCount > 0) {
    throw AppError.conflict(
      `Cannot delete data source: it is referenced by ${datasetCount} dataset(s)`
    );
  }

  await prisma.dataSource.delete({
    where: { id },
  });

  // Clean up credentials if present
  if (existing.credentialRef) {
    await credentialService.deleteCredentials(existing.credentialRef);
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATA_SOURCE_DELETED",
    resourceType: "DataSource",
    resourceId: id,
    metadata: {
      name: existing.name,
      type: existing.type,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: "Data source deleted successfully" });
}

/**
 * POST /api/v1/data-sources/:id/test-connection
 * Attempt connection test and return safe status.
 */
export async function testDataSourceConnection(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const dataSource = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!dataSource) {
    throw AppError.notFound("Data source");
  }

  await verifyResourceWorkspaceAccess(
    dataSource,
    userId,
    organizationId,
    roleName
  );

  const connector = getConnector(dataSource.type);
  if (!connector) {
    throw AppError.badRequest(`Unsupported connector type: ${dataSource.type}`);
  }

  let credentials: Record<string, unknown> | undefined;
  if (dataSource.credentialRef) {
    const creds = await credentialService.getCredentials(dataSource.credentialRef);
    if (creds) credentials = creds;
  }

  const testResult = await connector.testConnection(
    (dataSource.connectionMeta || {}) as Record<string, unknown>,
    credentials
  );

  // Update status in database
  const newStatus: DataSourceStatus = testResult.success ? "ACTIVE" : "ERROR";
  await prisma.dataSource.update({
    where: { id },
    data: { status: newStatus },
  }).catch(() => {});

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATA_SOURCE_CONNECTION_TESTED",
    resourceType: "DataSource",
    resourceId: id,
    metadata: {
      success: testResult.success,
      status: testResult.status,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, testResult);
}
