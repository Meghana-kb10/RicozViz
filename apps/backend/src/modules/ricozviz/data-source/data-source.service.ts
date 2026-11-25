// ========================================
// Data Source Service
// ========================================
// Data source CRUD, secure credential extraction and connection verification
// through the pluggable connectors.
//
// Ported from the legacy Express/Prisma implementation
// (`services/data-source/data-source.service.ts`). The HTTP layer lives in
// `data-source.controller.ts`.
// ========================================

import mongoose from 'mongoose';
import { z } from 'zod';
import {
  DataSourceModel,
  DatasetModel,
  WorkspaceMemberModel,
  toObjectId,
  serializeDoc,
  serializeDocs,
  type IDataSourceDocument
} from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import { credentialService } from './credential.service.js';
import type { DataSourceConnector, ConnectionTestResult } from './connectors/connector.interface.js';
import { PostgresConnector } from './connectors/postgres.connector.js';
import { MysqlConnector } from './connectors/mysql.connector.js';
import { SqliteConnector } from './connectors/sqlite.connector.js';
import { CsvConnector } from './connectors/csv.connector.js';
import { XlsxConnector } from './connectors/xlsx.connector.js';
import { JsonConnector } from './connectors/json.connector.js';
import { RestApiConnector } from './connectors/rest-api.connector.js';
import { WarehouseConnector } from './connectors/warehouse.connector.js';
import {
  resolveTargetWorkspaceId,
  verifyResourceWorkspaceAccess,
  resolveWorkspaceAccess
} from '../workspace/workspace.service.js';
import {
  DATA_SOURCE_STATUS,
  DATA_SOURCE_DISPLAY_STATUS,
  DATA_SOURCE_TYPE
} from '@repo/types';
import type { AuthenticatedUser, DataSourceData, DataSourceStatus, DataSourceType } from '@repo/types';

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

/** Resource identifiers are Mongo `ObjectId`s instead of the legacy UUIDs. */
function objectIdString(message: string) {
  return z
    .string()
    .min(1, message)
    .refine((value) => mongoose.Types.ObjectId.isValid(value), { message });
}

const postgresConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
  ssl: z.boolean().optional().default(false)
});

const mysqlConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535).default(3306),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
  ssl: z.boolean().optional().default(false)
});

const sqliteConnectionSchema = z
  .object({
    databasePath: z.string().optional(),
    fileName: z.string().optional(),
    filePath: z.string().optional()
  })
  .refine((data) => Boolean(data.databasePath || data.fileName || data.filePath), {
    message: 'databasePath, fileName, or filePath is required for SQLite'
  });

const csvConnectionSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  delimiter: z.string().min(1).default(','),
  hasHeader: z.boolean().default(true),
  fileSize: z.number().optional(),
  filePath: z.string().optional(),
  fileContent: z.string().optional(),
  csvText: z.string().optional()
});

const xlsxConnectionSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  sheetName: z.string().optional().default('Sheet1'),
  fileSize: z.number().optional()
});

const jsonConnectionSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  dataPath: z.string().optional().default('root'),
  fileSize: z.number().optional()
});

const restApiConnectionSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string()).optional(),
  authType: z.enum(['NONE', 'API_KEY', 'BEARER', 'BASIC']).default('NONE'),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional()
});

export const createDataSourceSchema = z
  .object({
    workspaceId: objectIdString('Invalid workspace ID').optional().nullable(),
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional(),
    type: z.enum([
      'POSTGRESQL',
      'MYSQL',
      'SQLITE',
      'CSV',
      'CSV_UPLOAD',
      'REST_API',
      'XLSX',
      'JSON',
      'SNOWFLAKE',
      'CLICKHOUSE',
      'BIGQUERY',
      'DATABRICKS',
      'REDSHIFT',
      'S3_PARQUET'
    ]),
    connection: z.record(z.unknown())
  })
  .superRefine((data, ctx) => {
    const normalizedType = data.type === 'CSV' ? 'CSV_UPLOAD' : data.type;
    if (normalizedType === 'POSTGRESQL') {
      const res = postgresConnectionSchema.safeParse(data.connection);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['connection', ...issue.path] });
        }
      }
    } else if (normalizedType === 'MYSQL') {
      const res = mysqlConnectionSchema.safeParse(data.connection);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['connection', ...issue.path] });
        }
      }
    } else if (normalizedType === 'SQLITE') {
      const res = sqliteConnectionSchema.safeParse(data.connection);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['connection', ...issue.path] });
        }
      }
    } else if (normalizedType === 'CSV_UPLOAD') {
      const res = csvConnectionSchema.safeParse(data.connection);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['connection', ...issue.path] });
        }
      }
    } else if (normalizedType === 'XLSX') {
      const res = xlsxConnectionSchema.safeParse(data.connection);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['connection', ...issue.path] });
        }
      }
    } else if (normalizedType === 'JSON') {
      const res = jsonConnectionSchema.safeParse(data.connection);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['connection', ...issue.path] });
        }
      }
    } else if (normalizedType === 'REST_API') {
      const res = restApiConnectionSchema.safeParse(data.connection);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['connection', ...issue.path] });
        }
      }
    }
  });

export const updateDataSourceSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  connection: z.record(z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING', 'CONNECTED', 'FAILED']).optional()
});

export const testRawConnectionSchema = z.object({
  type: z.enum([
    'POSTGRESQL',
    'MYSQL',
    'SQLITE',
    'CSV',
    'CSV_UPLOAD',
    'REST_API',
    'XLSX',
    'JSON',
    'SNOWFLAKE',
    'CLICKHOUSE',
    'BIGQUERY',
    'DATABRICKS',
    'REDSHIFT',
    'S3_PARQUET'
  ]),
  connection: z.record(z.unknown())
});

export type CreateDataSourceInput = z.infer<typeof createDataSourceSchema>;
export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;
export type TestRawConnectionInput = z.infer<typeof testRawConnectionSchema>;

// ============================================================
// HELPER: CONNECTOR REGISTRY
// ============================================================

const connectors: Record<string, DataSourceConnector> = {
  POSTGRESQL: new PostgresConnector(),
  MYSQL: new MysqlConnector(),
  SQLITE: new SqliteConnector(),
  CSV: new CsvConnector(),
  CSV_UPLOAD: new CsvConnector(),
  XLSX: new XlsxConnector(),
  JSON: new JsonConnector(),
  REST_API: new RestApiConnector(),
  SNOWFLAKE: new WarehouseConnector('SNOWFLAKE'),
  CLICKHOUSE: new WarehouseConnector('CLICKHOUSE'),
  BIGQUERY: new WarehouseConnector('BIGQUERY'),
  DATABRICKS: new WarehouseConnector('DATABRICKS'),
  REDSHIFT: new WarehouseConnector('REDSHIFT'),
  S3_PARQUET: new WarehouseConnector('S3_PARQUET')
};

export function getConnector(type: string): DataSourceConnector | null {
  return connectors[type.toUpperCase()] || null;
}

// ============================================================
// HELPERS: BUILD SAFE DATA SOURCE
// ============================================================

/** Serialized `DataSource` document: `_id` republished as `id`, dates as ISO strings. */
export interface SerializedDataSource {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  type: string;
  status: string;
  connectionMeta: Record<string, unknown>;
  credentialRef: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/** Per-request context forwarded from the HTTP layer (legacy read `req.*`). */
export interface DataSourceRequestContext {
  ipAddress?: string;
  userAgent?: string;
  /** `x-workspace-id` header — the legacy fallback when the body omits one. */
  workspaceHeaderId?: string;
}

/** `GET /data-sources` query parameters (query string + `x-workspace-id` header). */
export interface ListDataSourcesQuery {
  workspaceId?: string;
}

export function buildSafeDataSource(ds: SerializedDataSource): DataSourceData {
  const meta = (ds.connectionMeta || {}) as Record<string, unknown>;

  // Ensure secrets are never exposed in connection metadata
  const safeConnection: Record<string, unknown> = { ...meta };
  delete safeConnection['password'];
  delete safeConnection['apiKey'];
  delete safeConnection['bearerToken'];
  delete safeConnection['token'];
  delete safeConnection['secret'];
  delete safeConnection['accessToken'];
  delete safeConnection['privateKey'];

  // Map internal status to client-friendly status
  const clientStatus: DataSourceData['status'] =
    ds.status === DATA_SOURCE_STATUS.ACTIVE
      ? DATA_SOURCE_DISPLAY_STATUS.CONNECTED
      : ds.status === DATA_SOURCE_STATUS.ERROR
        ? DATA_SOURCE_DISPLAY_STATUS.FAILED
        : (ds.status as DataSourceData['status']);

  // Map internal type to client-friendly type
  const clientType: DataSourceData['type'] =
    meta['sourceFormat'] === 'XLSX'
      ? 'XLSX'
      : meta['sourceFormat'] === 'JSON'
        ? 'JSON'
        : ds.type === DATA_SOURCE_TYPE.CSV_UPLOAD
          ? 'CSV'
          : (ds.type as DataSourceData['type']);

  return {
    id: ds.id,
    workspaceId: ds.workspaceId ?? null,
    name: ds.name,
    description: ds.description,
    type: clientType,
    status: clientStatus,
    connection: safeConnection,
    hasCredentials: Boolean(ds.credentialRef),
    createdAt: ds.createdAt,
    updatedAt: ds.updatedAt
  };
}

/**
 * Extracts and separates sensitive credentials from connection configuration.
 */
export function separateCredentials(
  type: string,
  connection: Record<string, unknown>
): { nonSecretMeta: Record<string, unknown>; credentials: Record<string, unknown> } {
  const nonSecretMeta = { ...connection };
  const credentials: Record<string, unknown> = {};

  if (type === 'POSTGRESQL' || type === 'MYSQL') {
    if (nonSecretMeta['password']) {
      credentials['password'] = nonSecretMeta['password'];
      delete nonSecretMeta['password'];
    }
  } else if (type === 'REST_API') {
    if (nonSecretMeta['apiKey']) {
      credentials['apiKey'] = nonSecretMeta['apiKey'];
      delete nonSecretMeta['apiKey'];
    }
    if (nonSecretMeta['bearerToken']) {
      credentials['bearerToken'] = nonSecretMeta['bearerToken'];
      delete nonSecretMeta['bearerToken'];
    }
  }

  return { nonSecretMeta, credentials };
}

function principalIds(principal: AuthenticatedUser): {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
} {
  const userId = toObjectId(principal.userId);
  const organizationId = toObjectId(principal.organizationId);
  if (!userId || !organizationId) {
    throw AppError.unauthorized('Invalid session context');
  }
  return { userId, organizationId };
}

/** Load a data source by id, enforcing the standard 404. */
async function loadDataSource(id: string): Promise<SerializedDataSource> {
  const objectId = toObjectId(id);
  if (!objectId) {
    throw AppError.notFound('Data source');
  }

  const doc = await DataSourceModel.findById(objectId).exec();
  if (!doc) {
    throw AppError.notFound('Data source');
  }

  return serializeDoc<SerializedDataSource>(doc);
}

// ============================================================
// SERVICES
// ============================================================

/**
 * POST /api/v1/data-sources
 * Create a data source inside the caller's organization and workspace.
 */
export const COMING_SOON_DATA_SOURCES = ['SNOWFLAKE', 'CLICKHOUSE', 'BIGQUERY', 'DATABRICKS', 'REDSHIFT', 'S3_PARQUET'];

export async function createDataSource(
  principal: AuthenticatedUser,
  input: CreateDataSourceInput,
  context: DataSourceRequestContext = {}
): Promise<DataSourceData> {
  const { userId, organizationId } = principalIds(principal);
  if (COMING_SOON_DATA_SOURCES.includes(input.type)) {
    throw AppError.badRequest(`${input.type} connector is coming soon and disabled in this release.`);
  }

  const prismaType: DataSourceType =
    input.type === 'CSV'
      ? DATA_SOURCE_TYPE.CSV_UPLOAD
      : input.type === 'XLSX' || input.type === 'JSON'
        ? DATA_SOURCE_TYPE.OTHER
        : (input.type as DataSourceType);

  const requestedWsId = input.workspaceId || context.workspaceHeaderId || undefined;
  const workspaceId = await resolveTargetWorkspaceId(
    requestedWsId,
    userId.toString(),
    organizationId.toString(),
    principal.roleName
  );

  const { nonSecretMeta, credentials } = separateCredentials(input.type, input.connection);

  if (input.type === 'XLSX' || input.type === 'JSON') {
    nonSecretMeta['sourceFormat'] = input.type;
  }

  let credentialRef: string | null = null;
  if (Object.keys(credentials).length > 0) {
    credentialRef = await credentialService.storeCredentials(organizationId.toString(), credentials);
  }

  const doc = await DataSourceModel.create({
    organizationId,
    workspaceId: workspaceId ? toObjectId(workspaceId) : null,
    name: input.name,
    description: input.description ?? null,
    type: prismaType,
    status: DATA_SOURCE_STATUS.PENDING,
    connectionMeta: nonSecretMeta,
    credentialRef,
    createdById: userId
  });

  const dataSource = serializeDoc<SerializedDataSource>(doc);

  await logAuditEvent({
    organizationId: organizationId.toString(),
    userId: userId.toString(),
    action: 'DATA_SOURCE_CREATED',
    resourceType: 'DataSource',
    resourceId: dataSource.id,
    metadata: {
      name: dataSource.name,
      type: dataSource.type,
      workspaceId
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return buildSafeDataSource(dataSource);
}

/**
 * GET /api/v1/data-sources
 * List data sources belonging to the caller's workspace/organization.
 */
export async function listDataSources(
  principal: AuthenticatedUser,
  query: ListDataSourcesQuery = {}
): Promise<DataSourceData[]> {
  const { userId, organizationId } = principalIds(principal);
  const queryWsId = query.workspaceId;

  const whereClause: mongoose.QueryFilter<IDataSourceDocument> = { organizationId };

  if (queryWsId) {
    await resolveWorkspaceAccess(
      queryWsId,
      userId.toString(),
      organizationId.toString(),
      principal.roleName
    );
    whereClause.workspaceId = toObjectId(queryWsId);
  } else if (principal.roleName !== 'ADMIN') {
    const userMemberships = await WorkspaceMemberModel.find({ userId })
      .select('workspaceId')
      .lean()
      .exec();
    whereClause.$or = [
      { workspaceId: { $in: userMemberships.map((membership) => membership.workspaceId) } },
      { workspaceId: null }
    ];
  }

  const docs = await DataSourceModel.find(whereClause).sort({ createdAt: -1 }).exec();

  return serializeDocs<SerializedDataSource>(docs).map(buildSafeDataSource);
}

/**
 * GET /api/v1/data-sources/:id
 * Retrieve a single data source with tenant and workspace verification.
 */
export async function getDataSource(
  principal: AuthenticatedUser,
  id: string
): Promise<DataSourceData> {
  const dataSource = await loadDataSource(id);

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataSource.workspaceId, organizationId: dataSource.organizationId },
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  return buildSafeDataSource(dataSource);
}

/**
 * PATCH /api/v1/data-sources/:id
 * Update an existing data source.
 */
export async function updateDataSource(
  principal: AuthenticatedUser,
  id: string,
  input: UpdateDataSourceInput,
  context: DataSourceRequestContext = {}
): Promise<DataSourceData> {
  const { organizationId } = principalIds(principal);

  const existing = await loadDataSource(id);

  await verifyResourceWorkspaceAccess(
    { workspaceId: existing.workspaceId, organizationId: existing.organizationId },
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  let newCredentialRef = existing.credentialRef;
  let updatedMeta = (existing.connectionMeta || {}) as Record<string, unknown>;

  if (input.connection) {
    const { nonSecretMeta, credentials } = separateCredentials(existing.type, input.connection);

    updatedMeta = { ...updatedMeta, ...nonSecretMeta };

    if (Object.keys(credentials).length > 0) {
      if (existing.credentialRef) {
        await credentialService.deleteCredentials(existing.credentialRef);
      }
      newCredentialRef = await credentialService.storeCredentials(
        organizationId.toString(),
        credentials
      );
    }
  }

  // Normalize status if provided
  let prismaStatus: DataSourceStatus | undefined;
  if (input.status) {
    if (input.status === 'CONNECTED') prismaStatus = DATA_SOURCE_STATUS.ACTIVE;
    else if (input.status === 'FAILED') prismaStatus = DATA_SOURCE_STATUS.ERROR;
    else prismaStatus = input.status as DataSourceStatus;
  }

  const objectId = toObjectId(id);
  if (!objectId) {
    throw AppError.notFound('Data source');
  }

  const doc = await DataSourceModel.findByIdAndUpdate(
    objectId,
    {
      $set: {
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        connectionMeta: updatedMeta,
        credentialRef: newCredentialRef,
        status: prismaStatus ?? existing.status
      }
    },
    { new: true }
  )
    .exec();

  if (!doc) {
    throw AppError.notFound('Data source');
  }

  const updated = serializeDoc<SerializedDataSource>(doc);

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'DATA_SOURCE_UPDATED',
    resourceType: 'DataSource',
    resourceId: id,
    metadata: {
      name: updated.name,
      updatedFields: Object.keys(input)
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return buildSafeDataSource(updated);
}

/**
 * DELETE /api/v1/data-sources/:id
 * Delete a data source after verifying referential integrity and permissions.
 */
export async function deleteDataSource(
  principal: AuthenticatedUser,
  id: string,
  context: DataSourceRequestContext = {}
): Promise<{ message: string }> {
  const existing = await loadDataSource(id);

  await verifyResourceWorkspaceAccess(
    { workspaceId: existing.workspaceId, organizationId: existing.organizationId },
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  // Integrity check: prevent deletion if datasets depend on this data source
  const datasetCount = await DatasetModel.countDocuments({ dataSourceId: toObjectId(id) }).exec();

  if (datasetCount > 0) {
    throw AppError.conflict(
      `Cannot delete data source: it is referenced by ${datasetCount} dataset(s)`
    );
  }

  await DataSourceModel.deleteOne({ _id: toObjectId(id) }).exec();

  // Clean up credentials if present
  if (existing.credentialRef) {
    await credentialService.deleteCredentials(existing.credentialRef);
  }

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'DATA_SOURCE_DELETED',
    resourceType: 'DataSource',
    resourceId: id,
    metadata: {
      name: existing.name,
      type: existing.type
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return { message: 'Data source deleted successfully' };
}

/**
 * POST /api/v1/data-sources/:id/test-connection
 * Attempt a connection test and return the safe status.
 */
export async function testDataSourceConnection(
  principal: AuthenticatedUser,
  id: string,
  context: DataSourceRequestContext = {}
): Promise<ConnectionTestResult> {
  const dataSource = await loadDataSource(id);

  if (COMING_SOON_DATA_SOURCES.includes(dataSource.type)) {
    return {
      success: false,
      status: 'FAILED',
      message: `${dataSource.type} connector is coming soon and disabled in this release.`
    };
  }

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataSource.workspaceId, organizationId: dataSource.organizationId },
    principal.userId,
    principal.organizationId,
    principal.roleName
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
  const newStatus: DataSourceStatus = testResult.success
    ? DATA_SOURCE_STATUS.ACTIVE
    : DATA_SOURCE_STATUS.ERROR;
  await DataSourceModel.updateOne({ _id: toObjectId(id) }, { $set: { status: newStatus } })
    .exec()
    .catch((error: unknown) => {
      logger.warn('Failed to persist data source status after connection test', {
        dataSourceId: id,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'DATA_SOURCE_CONNECTION_TESTED',
    resourceType: 'DataSource',
    resourceId: id,
    metadata: {
      success: testResult.success,
      status: testResult.status
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return testResult;
}

/**
 * POST /api/v1/data-sources/test-connection
 * Test a raw connection configuration and credentials before creating a DataSource.
 * Enforces secure credential handling and never leaks secrets.
 */
export async function testRawConnection(input: TestRawConnectionInput): Promise<ConnectionTestResult> {
  if (COMING_SOON_DATA_SOURCES.includes(input.type)) {
    return {
      success: false,
      status: 'FAILED',
      message: `${input.type} connector is coming soon and disabled in this release.`
    };
  }

  const connector = getConnector(input.type);
  if (!connector) {
    throw AppError.badRequest(`Unsupported connector type: ${input.type}`);
  }

  const { nonSecretMeta, credentials } = separateCredentials(input.type, input.connection);
  const valResult = connector.validateConfiguration(nonSecretMeta, credentials);
  if (!valResult.valid) {
    throw AppError.badRequest(
      valResult.error || 'Invalid connection configuration',
      valResult.fieldErrors
    );
  }

  const testResult = await connector.testConnection(nonSecretMeta, credentials);
  return testResult;
}
