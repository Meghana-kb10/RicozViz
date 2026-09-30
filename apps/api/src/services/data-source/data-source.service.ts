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

const restApiConnectionSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  method: z.enum(["GET", "POST"]).default("GET"),
  headers: z.record(z.string()).optional(),
  authType: z.enum(["NONE", "API_KEY", "BEARER", "BASIC"]).default("NONE"),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional(),
});

export const createDataSourceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["POSTGRESQL", "CSV", "CSV_UPLOAD", "REST_API"]),
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

  // Map internal status to client-friendly status
  const clientStatus =
    ds.status === "ACTIVE"
      ? "CONNECTED"
      : ds.status === "ERROR"
        ? "FAILED"
        : ds.status;

  // Map internal type CSV_UPLOAD to CSV
  const clientType = ds.type === "CSV_UPLOAD" ? "CSV" : ds.type;

  return {
    id: ds.id,
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
 * Create a new data source within the authenticated user's organization.
 */
export async function createDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const input = createDataSourceSchema.parse(req.body);

  const prismaType: DataSourceType =
    input.type === "CSV" ? "CSV_UPLOAD" : (input.type as DataSourceType);

  const { nonSecretMeta, credentials } = separateCredentials(
    input.type,
    input.connection
  );

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
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDataSource(dataSource), 201);
}

/**
 * GET /api/v1/data-sources
 * List data sources belonging exclusively to the user's organization.
 */
export async function listDataSources(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;

  const dataSources = await prisma.dataSource.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, dataSources.map(buildSafeDataSource));
}

/**
 * GET /api/v1/data-sources/:id
 * Retrieve a single data source by ID with tenant verification.
 */
export async function getDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const { id } = req.params;

  const dataSource = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!dataSource) {
    throw AppError.notFound("Data source");
  }

  if (dataSource.organizationId !== organizationId) {
    throw AppError.forbidden(
      "Access denied: resource belongs to a different organization"
    );
  }

  sendSuccess(res, buildSafeDataSource(dataSource));
}

/**
 * PATCH /api/v1/data-sources/:id
 * Update an existing data source.
 */
export async function updateDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  const existing = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Data source");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden(
      "Access denied: resource belongs to a different organization"
    );
  }

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
 * Delete data source after verifying referential integrity.
 */
export async function deleteDataSource(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  const existing = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Data source");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden(
      "Access denied: resource belongs to a different organization"
    );
  }

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
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  const dataSource = await prisma.dataSource.findUnique({
    where: { id },
  });

  if (!dataSource) {
    throw AppError.notFound("Data source");
  }

  if (dataSource.organizationId !== organizationId) {
    throw AppError.forbidden(
      "Access denied: resource belongs to a different organization"
    );
  }

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
