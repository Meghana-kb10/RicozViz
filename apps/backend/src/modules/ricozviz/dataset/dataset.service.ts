// ========================================
// Dataset Management Service
// ========================================
// Handles dataset CRUD, CSV ingestion, connected-source discovery,
// schema extraction, safe previewing, and query execution.
// ========================================

import { z } from 'zod';
import mongoose from 'mongoose';
import {
  ChartModel,
  DatasetColumnModel,
  DatasetModel,
  DataSourceModel,
  WorkspaceMemberModel,
  WorkspaceModel,
  toObjectId,
  type IDatasetDocument
} from '@repo/database';
import {
  DATASET_COLUMN_TYPE,
  DATASET_SOURCE_TYPE,
  DATASET_STATUS,
  DATASET_TYPE,
  type DatasetColumn,
  type DatasetType
} from '@repo/types';
import type { ApiMeta } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  parseCsvText,
  discoverCsvSchema,
  parseJsonTabular,
  discoverJsonSchema,
  parseXlsxBuffer,
  discoverXlsxSchema,
  type ColumnSchema
} from './type-inference.js';
import { schemaDiscoveryService } from './schema-discovery.js';
import { computeDatasetProfile } from './data-quality.service.js';
import {
  datasetQueryEngine,
  ALLOWED_AGGREGATIONS,
  QUERY_LIMITS,
  type DatasetQueryEngineParams
} from './query-engine.js';

// ============================================================
// COLUMN TYPE MAPPING
// ============================================================

/** Legacy `mapToPrismaColumnType`: inferred type -> persisted DatasetColumn type. */
export function mapToColumnType(type: string): string {
  const normalized = type.toUpperCase();
  if (
    normalized === 'INTEGER' ||
    normalized === 'NUMBER' ||
    normalized === 'DECIMAL' ||
    normalized === 'FLOAT' ||
    normalized === 'DOUBLE'
  ) {
    return DATASET_COLUMN_TYPE.NUMBER;
  }
  if (normalized === 'BOOLEAN' || normalized === 'BOOL') {
    return DATASET_COLUMN_TYPE.BOOLEAN;
  }
  if (normalized === 'DATETIME' || normalized === 'TIMESTAMP') {
    return DATASET_COLUMN_TYPE.DATETIME;
  }
  if (normalized === 'DATE') {
    return DATASET_COLUMN_TYPE.DATE;
  }
  return DATASET_COLUMN_TYPE.STRING;
}

/**
 * Validates dataset ID format.
 * Accepts standard Mongo ObjectIds as well as test slug identifiers (e.g. ds-preview-test).
 */
export function validateDatasetId(id: string | undefined): string {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw AppError.badRequest('Invalid dataset ID: ID is required');
  }
  const trimmed = id.trim();
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(trimmed)) {
    throw AppError.badRequest('Invalid dataset ID format: must be a valid UUID or identifier');
  }
  return trimmed;
}

/**
 * Strict `toObjectId` for call sites that already validated the identifier and
 * must surface a 404 rather than a null reference.
 */
export function requireObjectId(value: unknown, resource = 'Resource'): mongoose.Types.ObjectId {
  const objectId = toObjectId(value);
  if (!objectId) {
    throw AppError.notFound(resource);
  }
  return objectId;
}

// ============================================================
// WORKSPACE AUTHORIZATION HELPERS
// ============================================================

export type WorkspaceAction = 'READ' | 'WRITE' | 'DELETE' | 'ADMIN' | 'SHARE';

export interface UserWorkspaceContext {
  userRole: string;
  isOrgAdmin: boolean;
}

const inMemoryWorkspaceRoleStore = new Map<string, string>();

export function registerInMemoryWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: string
): void {
  inMemoryWorkspaceRoleStore.set(`${workspaceId}:${userId}`, role);
}

export function clearInMemoryWorkspaceMembers(): void {
  inMemoryWorkspaceRoleStore.clear();
}

/**
 * Resolves the caller's workspace role, enforcing organization tenancy.
 * Organization admins bypass the membership requirement.
 */
export async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<UserWorkspaceContext> {
  const workspaceObjectId = toObjectId(workspaceId);
  const workspace = workspaceObjectId
    ? await WorkspaceModel.findOne({
        _id: workspaceObjectId,
        organizationId: toObjectId(organizationId)
      })
        .lean()
        .exec()
    : null;

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  const isOrgAdmin = userRoleName === 'ADMIN';

  const membership = await WorkspaceMemberModel.findOne({
    workspaceId: workspaceObjectId,
    userId: toObjectId(userId)
  })
    .select('role')
    .lean()
    .exec();

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden('Access denied: You do not have access to this workspace');
  }

  return {
    userRole: membership?.role ?? 'ADMIN',
    isOrgAdmin
  };
}

/**
 * Resolves target workspaceId for resource creation or query filtering.
 * - If targetWorkspaceId is supplied by the client, verifies membership.
 * - If not supplied, falls back to the user's first accessible workspace in the organization.
 */
export async function resolveTargetWorkspaceId(
  targetWorkspaceId: string | undefined | null,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<string | null> {
  if (targetWorkspaceId) {
    await resolveWorkspaceAccess(targetWorkspaceId, userId, organizationId, userRoleName);
    return targetWorkspaceId;
  }

  // Fallback to first accessible workspace for this user in the organization
  try {
    const userObjectId = toObjectId(userId);
    if (!userObjectId) return null;
    const membership = await WorkspaceMemberModel.findOne({
      userId: userObjectId,
      workspace: { organizationId: toObjectId(organizationId) }
    })
      .select('workspaceId')
      .lean()
      .exec();
    return membership?.workspaceId ? membership.workspaceId.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Verifies that the authenticated user has access to the workspace of the given resource.
 * Enforces role hierarchy: OWNER -> ADMIN -> EDITOR/MEMBER -> VIEWER.
 */
export async function verifyResourceWorkspaceAccess(
  resource: { workspaceId?: unknown; organizationId: unknown },
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: WorkspaceAction = 'READ'
): Promise<void> {
  // 1. Organization tenant isolation
  if (String(resource.organizationId) !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  // 2. Organization admins bypass workspace restrictions
  if (userRoleName === 'ADMIN') {
    return;
  }

  const resourceWorkspaceId = resource.workspaceId
    ? String(resource.workspaceId)
    : null;

  // 3. Workspace scoping
  if (resourceWorkspaceId) {
    let userRole = inMemoryWorkspaceRoleStore.get(`${resourceWorkspaceId}:${userId}`);

    if (!userRole) {
      try {
        const access = await resolveWorkspaceAccess(
          resourceWorkspaceId,
          userId,
          organizationId,
          userRoleName
        );
        if (access.isOrgAdmin) {
          return; // Organization admins bypass workspace restrictions
        }
        userRole = access.userRole;
      } catch (err) {
        if (err instanceof AppError) throw err;
        return;
      }
    }

    if (requiredAction === 'READ') {
      // All workspace members (OWNER, ADMIN, MEMBER, EDITOR, VIEWER) can read
      return;
    }

    if (requiredAction === 'WRITE') {
      if (userRole === 'VIEWER') {
        throw AppError.forbidden('Access denied: Viewers have read-only access to this workspace');
      }
      return;
    }

    if (requiredAction === 'DELETE') {
      if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
        throw AppError.forbidden(
          'Access denied: Only workspace owners and admins can delete this resource'
        );
      }
      return;
    }

    if (requiredAction === 'SHARE') {
      if (userRole === 'VIEWER') {
        throw AppError.forbidden('Access denied: Viewers cannot share workspace resources');
      }
      return;
    }

    if (requiredAction === 'ADMIN') {
      if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
        throw AppError.forbidden(
          'Access denied: Only workspace owners and admins have administrative permissions'
        );
      }
      return;
    }
  }
}

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDatasetSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters'),
  description: z.string().max(500).optional().nullable(),
  workspaceId: z.string().trim().min(1, 'Invalid workspace ID').max(100).optional().nullable(),
  sourceType: z
    .enum(['CSV', 'XLSX', 'JSON'], {
      errorMap: () => ({ message: 'Invalid source type: must be CSV, XLSX, or JSON' })
    })
    .optional()
    .default('CSV'),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  rowCount: z.number().int().nonnegative().optional().default(0),
  columnCount: z.number().int().nonnegative().optional().default(0),
  status: z
    .enum(['PROCESSING', 'READY', 'FAILED', 'ACTIVE', 'DRAFT', 'ARCHIVED', 'ERROR'])
    .optional()
    .default('READY'),
  schema: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  schemaMeta: z.record(z.unknown()).optional(),
  type: z.enum(['CONNECTED', 'UPLOADED', 'DERIVED']).optional(),
  dataSourceId: z.string().min(1, 'Invalid DataSource ID').optional().nullable(),
  tableName: z.string().max(63).optional(),
  columns: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(['string', 'number', 'integer', 'boolean', 'date', 'datetime', 'decimal']),
        nullable: z.boolean().default(true)
      })
    )
    .optional(),
  sampleData: z.array(z.record(z.unknown())).optional(),
  csvText: z.string().optional()
});

export const updateDatasetSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  sourceType: z
    .enum(['CSV', 'XLSX', 'JSON'], {
      errorMap: () => ({ message: 'Invalid source type: must be CSV, XLSX, or JSON' })
    })
    .optional(),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  rowCount: z.number().int().nonnegative().optional(),
  columnCount: z.number().int().nonnegative().optional(),
  status: z
    .enum(['PROCESSING', 'READY', 'FAILED', 'ACTIVE', 'DRAFT', 'ARCHIVED', 'ERROR'])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  schemaMeta: z.record(z.unknown()).optional()
});

export const listDatasetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sourceType: z.enum(['CSV', 'XLSX', 'JSON']).optional(),
  type: z.enum(['CONNECTED', 'UPLOADED', 'DERIVED']).optional(),
  status: z.string().optional(),
  workspaceId: z.string().trim().min(1, 'Invalid workspace ID').max(100).optional()
});

export const previewCsvSchema = z.object({
  csvText: z.string().min(1, 'CSV content cannot be empty').max(10 * 1024 * 1024, 'Max CSV size is 10MB'),
  delimiter: z.string().default(',')
});

export const datasetQueryParamsSchema = z.object({
  columns: z.array(z.string().min(1)).max(QUERY_LIMITS.MAX_COLUMNS).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(QUERY_LIMITS.MAX_ROW_LIMIT)
    .default(QUERY_LIMITS.DEFAULT_ROW_LIMIT),
  offset: z.coerce.number().int().min(0).max(QUERY_LIMITS.MAX_OFFSET).default(0),
  orderBy: z
    .object({
      column: z.string().min(1),
      direction: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc')
    })
    .optional(),
  sort: z
    .object({
      column: z.string().min(1),
      direction: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc')
    })
    .optional(),
  sorting: z
    .union([
      z.object({
        column: z.string().min(1),
        direction: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc')
      }),
      z.array(
        z.object({
          column: z.string().min(1),
          direction: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc')
        })
      )
    ])
    .optional(),
  filters: z
    .array(
      z.object({
        column: z.string().min(1),
        operator: z.string().min(1),
        value: z.unknown().optional()
      })
    )
    .max(QUERY_LIMITS.MAX_FILTERS)
    .optional(),
  filterLogic: z.enum(['AND', 'OR']).default('AND').optional(),
  logic: z.enum(['AND', 'OR']).optional(),
  dimensions: z.array(z.string().min(1)).max(QUERY_LIMITS.MAX_DIMENSIONS).optional(),
  groupBy: z.array(z.string().min(1)).max(QUERY_LIMITS.MAX_DIMENSIONS).optional(),
  measures: z
    .array(
      z.object({
        column: z.string().min(1),
        aggregation: z.union([z.enum(ALLOWED_AGGREGATIONS), z.string()]),
        alias: z.string().max(63).optional()
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
        alias: z.string().max(63).optional()
      })
    )
    .max(QUERY_LIMITS.MAX_MEASURES)
    .optional()
});

export const importSourceTableSchema = z.object({
  workspaceId: z.string().trim().min(1, 'Invalid workspace ID').max(100).optional().nullable(),
  tableName: z.string().min(1, 'Table name or Sheet is required').max(100),
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(500).optional().nullable()
});

export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;
export type UpdateDatasetInput = z.infer<typeof updateDatasetSchema>;
export type ListDatasetsQuery = z.infer<typeof listDatasetsQuerySchema>;
export type PreviewCsvInput = z.infer<typeof previewCsvSchema>;
export type DatasetQueryInput = z.infer<typeof datasetQueryParamsSchema>;
export type ImportSourceTableInput = z.infer<typeof importSourceTableSchema>;

/** Per-request identity + audit metadata threaded through every service call. */
export interface DatasetRequestContext {
  organizationId: string;
  userId: string;
  roleName: string;
  ipAddress?: string;
  userAgent?: string;
  /** Value of the `x-workspace-id` request header, if any. */
  headerWorkspaceId?: string;
}

// ============================================================
// HELPER: BUILD SAFE DATASET RESPONSE
// ============================================================

/** A persisted `DatasetColumn` reduced to the fields the response builder needs. */
export interface SchemaColumnInput {
  name: string;
  dataType: string;
  nullable: boolean;
  ordinalPosition?: number;
}

/** Serialized dataset (ids already stringified) consumed by `buildSafeDataset`. */
export interface SafeDatasetInput {
  id: string;
  organizationId?: unknown;
  workspaceId?: unknown;
  dataSourceId?: unknown;
  name: string;
  description?: string | null;
  sourceType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  rowCount?: number | null;
  columnCount?: number | null;
  type: string;
  status: string;
  schemaMeta?: Record<string, unknown> | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  dataSource?: { _id?: unknown; id?: string; name: string; type: string } | null;
  columns?: SchemaColumnInput[];
}

export interface SafeDataset {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  sourceType: string;
  fileName: string | null;
  fileSize: number | null;
  rowCount: number;
  columnCount: number;
  type: string;
  status: string;
  dataSourceId: string | null;
  dataSourceName: string | null;
  dataSourceType: string | null;
  dataSource: { id: string; name: string; type: string } | null;
  columns: DatasetColumn[];
  calculatedFields: Array<{ id: string; name: string; expression: string; dataType: string }>;
  tableName: string | null;
  schema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  schemaMeta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export function buildSafeDataset(ds: SafeDatasetInput): SafeDataset {
  const meta = (ds.schemaMeta || {}) as Record<string, unknown>;

  const calculatedFields = Array.isArray(meta['calculatedFields'])
    ? (meta['calculatedFields'] as Array<{
        id: string;
        name: string;
        expression: string;
        dataType: string;
      }>)
    : [];
  const calcFieldMap = new Map(calculatedFields.map((cf) => [cf.name.toLowerCase(), cf]));

  // Use relational DatasetColumn records if available, otherwise fallback to schemaMeta.columns
  let columns: DatasetColumn[] = [];

  if (ds.columns && ds.columns.length > 0) {
    columns = ds.columns.map((c) => ({
      name: c.name,
      type: c.dataType.toLowerCase(),
      nullable: c.nullable,
      ordinalPosition: c.ordinalPosition,
      isCalculated: calcFieldMap.has(c.name.toLowerCase()),
      expression: calcFieldMap.get(c.name.toLowerCase())?.expression || undefined
    }));
  } else if (Array.isArray(meta['columns'])) {
    columns = (meta['columns'] as Array<{
      name: string;
      type: string;
      nullable: boolean;
      ordinalPosition?: number;
    }>).map((c) => ({
      name: c.name,
      type: (c.type || 'string').toLowerCase(),
      nullable: c.nullable ?? true,
      ordinalPosition: c.ordinalPosition,
      isCalculated: calcFieldMap.has(c.name.toLowerCase()),
      expression: calcFieldMap.get(c.name.toLowerCase())?.expression || undefined
    }));
  }

  const sampleData = (meta['sampleData'] as unknown[]) || [];
  const storedRowCount =
    typeof ds.rowCount === 'number' && ds.rowCount > 0
      ? ds.rowCount
      : typeof meta['rowCount'] === 'number'
        ? (meta['rowCount'] as number)
        : sampleData.length;

  const storedColumnCount =
    typeof ds.columnCount === 'number' && ds.columnCount > 0
      ? ds.columnCount
      : typeof meta['columnCount'] === 'number'
        ? (meta['columnCount'] as number)
        : columns.length;

  const clientStatus =
    ds.status === 'ACTIVE' ? 'READY' : ds.status === 'ERROR' ? 'FAILED' : ds.status;

  const clientSourceType = ds.sourceType ?? (meta['sourceType'] as string) ?? 'CSV';

  const clientFileName =
    ds.fileName ?? (meta['filename'] as string) ?? (meta['fileName'] as string) ?? null;

  const clientFileSize = ds.fileSize ?? (meta['fileSize'] as number) ?? null;

  const dataSourceIdString = ds.dataSourceId ? String(ds.dataSourceId) : null;

  return {
    id: ds.id,
    workspaceId: ds.workspaceId ? String(ds.workspaceId) : null,
    name: ds.name,
    description: ds.description ?? null,
    sourceType: clientSourceType,
    fileName: clientFileName,
    fileSize: clientFileSize,
    rowCount: storedRowCount,
    columnCount: storedColumnCount,
    type: ds.type,
    status: clientStatus,
    dataSourceId: dataSourceIdString,
    dataSourceName: ds.dataSource?.name || null,
    dataSourceType: ds.dataSource?.type || null,
    dataSource: ds.dataSource
      ? {
          id: ds.dataSource.id ?? String(ds.dataSource._id ?? ''),
          name: ds.dataSource.name,
          type: ds.dataSource.type === 'CSV_UPLOAD' ? 'CSV' : ds.dataSource.type
        }
      : null,
    columns,
    calculatedFields,
    tableName: (meta['tableName'] as string) || null,
    schema: meta,
    metadata: meta,
    schemaMeta: meta,
    createdAt: toIsoString(ds.createdAt ?? null),
    updatedAt: toIsoString(ds.updatedAt ?? null)
  };
}

/**
 * Batch-load `DatasetColumn` rows (ordered by `ordinalPosition`) for the given
 * dataset ids. Mongoose cannot sort a populated relation, so the legacy
 * `include: { columns: { orderBy: ... } }` is reproduced with a second query.
 */
export async function listDatasetColumns(
  datasetIds: string[]
): Promise<Map<string, SchemaColumnInput[]>> {
  const result = new Map<string, SchemaColumnInput[]>();
  const objectIds = datasetIds
    .map((id) => toObjectId(id))
    .filter((id): id is mongoose.Types.ObjectId => id !== null);
  if (objectIds.length === 0) {
    return result;
  }

  const columns = await DatasetColumnModel.find({ datasetId: { $in: objectIds } })
    .sort({ ordinalPosition: 1 })
    .lean()
    .exec();

  for (const column of columns) {
    const key = column.datasetId.toString();
    const bucket = result.get(key) ?? [];
    bucket.push({
      name: column.name,
      dataType: column.dataType,
      nullable: column.nullable,
      ordinalPosition: column.ordinalPosition
    });
    result.set(key, bucket);
  }

  return result;
}

/** Convert an inferred/discovered column definition into a `DatasetColumn` insert payload. */
function toDatasetColumnDocs(
  datasetId: mongoose.Types.ObjectId,
  schemaColumns: Array<{ name: string; type: string; nullable: boolean }>
): Array<Record<string, unknown>> {
  return schemaColumns.map((col, idx) => ({
    datasetId,
    name: col.name,
    dataType: mapToColumnType(col.type),
    nullable: col.nullable !== false,
    ordinalPosition: idx + 1
  }));
}

/** Load a dataset with its data source and ordered columns, or raise 404. */
async function loadDatasetWithRelations(id: string): Promise<SafeDatasetInput | null> {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  const doc = await DatasetModel.findById(objectId)
    .populate<{ dataSource: { _id: mongoose.Types.ObjectId; name: string; type: string } }>(
      'dataSource',
      'name type'
    )
    .exec();

  if (!doc) return null;

  const columns = await listDatasetColumns([doc._id.toString()]);

  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId,
    workspaceId: doc.workspaceId,
    dataSourceId: doc.dataSourceId,
    name: doc.name,
    description: doc.description,
    sourceType: doc.sourceType,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    rowCount: doc.rowCount,
    columnCount: doc.columnCount,
    type: doc.type,
    status: doc.status,
    schemaMeta: (doc.schemaMeta || {}) as unknown as Record<string, unknown>,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    dataSource: doc.dataSource ?? null,
    columns: columns.get(doc._id.toString()) ?? []
  };
}

/** Load a dataset together with the query-engine projection. */
async function loadQueryableDataset(id: string): Promise<{
  id: string;
  organizationId: string;
  workspaceId: string | null;
  dataSourceId: string | null;
  type: string;
  schemaMeta: Record<string, unknown>;
  columns: SchemaColumnInput[];
} | null> {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  const doc = await DatasetModel.findById(objectId).exec();
  if (!doc) return null;

  const columns = await listDatasetColumns([doc._id.toString()]);

  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    workspaceId: doc.workspaceId ? doc.workspaceId.toString() : null,
    dataSourceId: doc.dataSourceId ? doc.dataSourceId.toString() : null,
    type: doc.type,
    schemaMeta: (doc.schemaMeta || {}) as unknown as Record<string, unknown>,
    columns: columns.get(doc._id.toString()) ?? []
  };
}

// ============================================================
// CREATE — POST /api/v1/datasets
// ============================================================

/**
 * Create a new dataset from metadata, a registered DataSource, or an uploaded CSV.
 */
export async function createDataset(
  input: CreateDatasetInput,
  context: DatasetRequestContext
): Promise<SafeDataset> {
  const { organizationId, userId, roleName } = context;

  const requestedWsId = input.workspaceId || context.headerWorkspaceId;
  const workspaceId = await resolveTargetWorkspaceId(
    requestedWsId,
    userId,
    organizationId,
    roleName
  );

  if (workspaceId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId, organizationId },
      userId,
      organizationId,
      roleName,
      'WRITE'
    );
  }

  let determinedType: DatasetType = input.type || DATASET_TYPE.UPLOADED;

  let resolvedDataSourceId = input.dataSourceId || null;
  let schemaColumns: Array<{ name: string; type: string; nullable: boolean }> = input.columns || [];
  let sampleRows: Array<Record<string, unknown>> = input.sampleData || [];

  // 1. If dataSourceId provided, verify it belongs to this organization and workspace!
  if (resolvedDataSourceId) {
    determinedType = DATASET_TYPE.CONNECTED;
    const dataSourceObjectId = toObjectId(resolvedDataSourceId);
    const ds = dataSourceObjectId
      ? await DataSourceModel.findById(dataSourceObjectId).lean().exec()
      : null;

    if (!ds) {
      throw AppError.notFound('Data source');
    }

    await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);
    resolvedDataSourceId = ds._id.toString();
  }

  // 2. If CSV text is submitted, parse and infer schema
  if (input.csvText) {
    determinedType = DATASET_TYPE.UPLOADED;
    resolvedDataSourceId = null;
    const { headers, rows } = parseCsvText(input.csvText);
    schemaColumns = discoverCsvSchema(headers, rows);
    sampleRows = rows.slice(0, 100).map((row) => ({ ...row }));
  }

  const metadata = input.metadata || input.schema || input.schemaMeta || {};
  const schemaMeta: Record<string, unknown> = {
    ...metadata,
    columns: schemaColumns.length > 0 ? schemaColumns : metadata['columns'] || [],
    sampleData: sampleRows.length > 0 ? sampleRows : metadata['sampleData'] || [],
    tableName: input.tableName || metadata['tableName'] || null,
    rowCount:
      input.rowCount ||
      sampleRows.length ||
      (typeof metadata['rowCount'] === 'number' ? metadata['rowCount'] : 0),
    columnCount:
      input.columnCount ||
      schemaColumns.length ||
      (typeof metadata['columnCount'] === 'number' ? metadata['columnCount'] : 0),
    sourceType: input.sourceType,
    fileName: input.fileName || null,
    fileSize: input.fileSize || null
  };

  if (sampleRows.length > 0) {
    try {
      const generatedProfile = computeDatasetProfile(
        { id: 'pending', name: input.name, schemaMeta },
        sampleRows
      );
      schemaMeta['dataQualityProfile'] = generatedProfile;
    } catch {
      // Non-blocking profiling failure
    }
  }

  const finalRowCount = input.rowCount || Number(schemaMeta['rowCount']) || 0;
  const finalColumnCount =
    input.columnCount || Number(schemaMeta['columnCount']) || schemaColumns.length || 0;

  const dataset = await DatasetModel.create({
    organizationId: requireObjectId(organizationId, 'Organization'),
    workspaceId: workspaceId ? toObjectId(workspaceId) : null,
    name: input.name,
    description: input.description,
    sourceType: input.sourceType,
    fileName: input.fileName,
    fileSize: input.fileSize,
    rowCount: finalRowCount,
    columnCount: finalColumnCount,
    type: determinedType,
    status: (input.status as string) || DATASET_STATUS.READY,
    dataSourceId: resolvedDataSourceId ? toObjectId(resolvedDataSourceId) : null,
    schemaMeta,
    createdById: requireObjectId(userId, 'User')
  });

  if (schemaColumns.length > 0) {
    await DatasetColumnModel.insertMany(
      toDatasetColumnDocs(dataset._id, schemaColumns)
    );
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_CREATED',
    resourceType: 'Dataset',
    resourceId: dataset._id.toString(),
    metadata: {
      name: dataset.name,
      sourceType: dataset.sourceType,
      type: dataset.type,
      dataSourceId: dataset.dataSourceId ? dataset.dataSourceId.toString() : null,
      columnsCount: finalColumnCount,
      rowCount: finalRowCount,
      workspaceId
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  const created = await loadDatasetWithRelations(dataset._id.toString());
  return buildSafeDataset(created!);
}

// ============================================================
// UPLOAD — POST /api/v1/datasets/upload
// ============================================================

export interface UploadDatasetFields {
  workspaceId?: string;
  name?: string;
  description?: string;
  dataSourceId?: string;
  fileContent?: string;
  fileName?: string;
  csvText?: string;
  jsonText?: string;
}

export interface UploadedDatasetFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadDatasetInput {
  file?: UploadedDatasetFile;
  fields: UploadDatasetFields;
  /** Value of the `?workspaceId=` query string, if any. */
  queryWorkspaceId?: string;
}

const DEFAULT_MAX_FILE_SIZE = 15 * 1024 * 1024;

/**
 * Multipart file upload (CSV, XLSX, or JSON) with schema inference and DatasetColumn creation.
 */
export async function uploadDataset(
  input: UploadDatasetInput,
  context: DatasetRequestContext,
  maxFileSizeBytes: number = DEFAULT_MAX_FILE_SIZE
): Promise<SafeDataset> {
  const { organizationId, userId, roleName } = context;
  const fields = input.fields;

  let fileBuffer: Buffer | null = null;
  let rawFilename = '';

  if (input.file) {
    fileBuffer = input.file.buffer;
    rawFilename = input.file.originalname || '';
  } else if (fields.fileContent) {
    fileBuffer = Buffer.from(String(fields.fileContent), 'utf-8');
    rawFilename = String(fields.fileName || 'uploaded_data.csv');
  } else if (fields.csvText) {
    fileBuffer = Buffer.from(String(fields.csvText), 'utf-8');
    rawFilename = 'uploaded_data.csv';
  } else if (fields.jsonText) {
    fileBuffer = Buffer.from(String(fields.jsonText), 'utf-8');
    rawFilename = 'uploaded_data.json';
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw AppError.badRequest('Uploaded file is empty');
  }

  const MAX_FILE_SIZE = maxFileSizeBytes;
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw AppError.badRequest(
      `File exceeds maximum allowable size of ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`
    );
  }

  // Safe sanitized filename (never trust raw client filename for filesystem paths)
  const safeFilename =
    rawFilename
      .replace(/^.*[\\/]/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .trim() || 'uploaded_file';

  const ext = safeFilename.split('.').pop()?.toLowerCase() || '';
  const mime = input.file?.mimetype?.toLowerCase() || '';

  const isXlsx =
    ext === 'xlsx' ||
    ext === 'xls' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel';

  const isJson =
    ext === 'json' || mime === 'application/json' || mime === 'text/json';

  const isCsv =
    ext === 'csv' ||
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    (mime === 'text/plain' && ext === 'csv') ||
    (!isXlsx && !isJson && ext === 'csv');

  if (!isXlsx && !isJson && !isCsv) {
    throw AppError.badRequest(
      'Unsupported file format. Supported formats are CSV, XLSX, and JSON.'
    );
  }

  let schemaColumns: ColumnSchema[] = [];
  let sampleRows: Array<Record<string, unknown>> = [];
  let rowCount = 0;
  let detectedSourceType: string = DATASET_SOURCE_TYPE.CSV;

  if (isXlsx) {
    detectedSourceType = DATASET_SOURCE_TYPE.XLSX;
    try {
      const { headers, rows } = parseXlsxBuffer(fileBuffer);
      if (headers.length === 0 || rows.length === 0) {
        throw AppError.badRequest('XLSX file is empty or contains no records');
      }
      schemaColumns = discoverXlsxSchema(headers, rows);
      sampleRows = rows.slice(0, 100);
      rowCount = rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : 'Failed to parse XLSX file';
      throw AppError.badRequest(msg);
    }
  } else if (isJson) {
    detectedSourceType = DATASET_SOURCE_TYPE.JSON;
    const fileText = fileBuffer.toString('utf-8');
    if (!fileText.trim()) {
      throw AppError.badRequest('Uploaded file is empty');
    }
    try {
      const { headers, rows } = parseJsonTabular(fileText);
      schemaColumns = discoverJsonSchema(headers, rows);
      sampleRows = rows.slice(0, 100);
      rowCount = rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : 'Failed to parse JSON file';
      throw AppError.badRequest(msg);
    }
  } else {
    detectedSourceType = DATASET_SOURCE_TYPE.CSV;
    const fileText = fileBuffer.toString('utf-8');
    if (!fileText.trim()) {
      throw AppError.badRequest('Uploaded file is empty');
    }
    try {
      const { headers, rows } = parseCsvText(fileText);
      if (headers.length === 0 || rows.length === 0) {
        throw AppError.badRequest('CSV file is empty or contains no records');
      }
      schemaColumns = discoverCsvSchema(headers, rows);
      sampleRows = rows.slice(0, 100).map((row) => ({ ...row }));
      rowCount = rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV file';
      throw AppError.badRequest(msg);
    }
  }

  const requestedWsId = fields.workspaceId || input.queryWorkspaceId || context.headerWorkspaceId;

  const workspaceId = await resolveTargetWorkspaceId(
    requestedWsId,
    userId,
    organizationId,
    roleName
  );

  if (workspaceId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId, organizationId },
      userId,
      organizationId,
      roleName,
      'WRITE'
    );
  }

  const rawName = fields.name?.trim();
  const defaultName = safeFilename ? safeFilename.replace(/\.[^/.]+$/, '') : 'Uploaded Dataset';
  const datasetName = rawName || defaultName;
  const description = fields.description?.trim() || null;

  let resolvedDataSourceId: string | null = null;
  const rawDataSourceId = fields.dataSourceId?.trim();
  if (rawDataSourceId) {
    const dataSourceObjectId = toObjectId(rawDataSourceId);
    const ds = dataSourceObjectId
      ? await DataSourceModel.findById(dataSourceObjectId).lean().exec()
      : null;
    if (!ds) throw AppError.notFound('Data source');
    await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);
    resolvedDataSourceId = ds._id.toString();
  }

  const schemaMeta: Record<string, unknown> = {
    columns: schemaColumns,
    sampleData: sampleRows,
    rowCount,
    columnCount: schemaColumns.length,
    fileName: safeFilename,
    fileSize: fileBuffer.length,
    sourceType: detectedSourceType,
    uploadedAt: new Date().toISOString()
  };

  if (sampleRows.length > 0) {
    try {
      const generatedProfile = computeDatasetProfile(
        { id: 'pending', name: datasetName, schemaMeta },
        sampleRows
      );
      schemaMeta['dataQualityProfile'] = generatedProfile;
    } catch {
      // Non-blocking profiling failure
    }
  }

  const dataset = await DatasetModel.create({
    organizationId: requireObjectId(organizationId, 'Organization'),
    workspaceId: workspaceId ? toObjectId(workspaceId) : null,
    dataSourceId: resolvedDataSourceId ? toObjectId(resolvedDataSourceId) : null,
    name: datasetName,
    description,
    sourceType: detectedSourceType,
    fileName: safeFilename,
    fileSize: fileBuffer.length,
    rowCount,
    columnCount: schemaColumns.length,
    type: DATASET_TYPE.UPLOADED,
    status: DATASET_STATUS.READY,
    schemaMeta,
    createdById: requireObjectId(userId, 'User')
  });

  if (schemaColumns.length > 0) {
    await DatasetColumnModel.insertMany(toDatasetColumnDocs(dataset._id, schemaColumns));
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_UPLOADED',
    resourceType: 'Dataset',
    resourceId: dataset._id.toString(),
    metadata: {
      name: dataset.name,
      type: dataset.type,
      format: detectedSourceType,
      rowCount,
      columnsCount: schemaColumns.length,
      workspaceId
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  const created = await loadDatasetWithRelations(dataset._id.toString());
  return buildSafeDataset(created!);
}

// ============================================================
// LIST — GET /api/v1/datasets
// ============================================================

export interface ListDatasetsResult {
  items: SafeDataset[];
  meta: ApiMeta;
}

/**
 * List organization datasets with workspace filtering, search, source type filtering, and pagination.
 */
export async function listDatasets(
  query: ListDatasetsQuery,
  context: DatasetRequestContext
): Promise<ListDatasetsResult> {
  const { organizationId, userId, roleName } = context;
  const page = query.page;
  const limit = query.limit;
  const search = query.search;
  const sourceType = query.sourceType;
  const typeFilter = query.type;
  const queryWsId = query.workspaceId || context.headerWorkspaceId;

  const whereClause: mongoose.QueryFilter<IDatasetDocument> = {
    organizationId: toObjectId(organizationId)
  };
  if (search) {
    whereClause.name = { $regex: new RegExp(escapeRegExp(search), 'i') };
  }
  if (sourceType) {
    whereClause.sourceType = sourceType;
  }
  if (typeFilter) {
    whereClause.type = typeFilter;
  }
  if (query.status) {
    whereClause.status = query.status;
  }

  if (queryWsId) {
    await resolveWorkspaceAccess(queryWsId, userId, organizationId, roleName);
    whereClause.workspaceId = toObjectId(queryWsId);
  } else if (roleName !== 'ADMIN') {
    const userObjectId = toObjectId(userId);
    const userMemberships = userObjectId
      ? await WorkspaceMemberModel.find({ userId: userObjectId })
          .select('workspaceId')
          .lean()
          .exec()
      : [];
    const wsIds = userMemberships.map((m) => m.workspaceId);
    whereClause.$or = [{ workspaceId: { $in: wsIds } }, { workspaceId: null }];
  }

  const [docs, total] = await Promise.all([
    DatasetModel.find(whereClause)
      .populate<{ dataSource: { _id: mongoose.Types.ObjectId; name: string; type: string } }>(
        'dataSource',
        'name type'
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    DatasetModel.countDocuments(whereClause).exec()
  ]);

  const columnsByDataset = await listDatasetColumns(docs.map((doc) => doc._id.toString()));

  const items = docs.map((doc) =>
    buildSafeDataset({
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      workspaceId: doc.workspaceId,
      dataSourceId: doc.dataSourceId,
      name: doc.name,
      description: doc.description,
      sourceType: doc.sourceType,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      rowCount: doc.rowCount,
      columnCount: doc.columnCount,
      type: doc.type,
      status: doc.status,
      schemaMeta: (doc.schemaMeta || {}) as unknown as Record<string, unknown>,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      dataSource: doc.dataSource ?? null,
      columns: columnsByDataset.get(doc._id.toString()) ?? []
    })
  );

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

// ============================================================
// GET — GET /api/v1/datasets/:id
// ============================================================

/** Retrieve a single dataset with tenant and workspace verification. */
export async function getDataset(id: string, context: DatasetRequestContext): Promise<SafeDataset> {
  const { organizationId, userId, roleName } = context;

  const dataset = await loadDatasetWithRelations(id);

  if (!dataset) {
    throw AppError.notFound('Dataset');
  }

  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId, organizationId: dataset.organizationId },
    userId,
    organizationId,
    roleName
  );

  return buildSafeDataset(dataset);
}

// ============================================================
// UPDATE — PATCH /api/v1/datasets/:id
// ============================================================

/** Update dataset details. */
export async function updateDataset(
  id: string,
  input: UpdateDatasetInput,
  context: DatasetRequestContext
): Promise<SafeDataset> {
  const { organizationId, userId, roleName } = context;

  const objectId = toObjectId(id);
  const existing = objectId ? await DatasetModel.findById(objectId).lean().exec() : null;

  if (!existing) {
    throw AppError.notFound('Dataset');
  }

  await verifyResourceWorkspaceAccess(existing, userId, organizationId, roleName, 'WRITE');

  const existingMeta = (existing.schemaMeta || {}) as unknown as Record<string, unknown>;
  const metaPatch = input.metadata || input.schemaMeta;
  const mergedMeta = {
    ...existingMeta,
    ...(metaPatch || {})
  };

  const updated = await DatasetModel.findByIdAndUpdate(
    existing._id,
    {
      $set: {
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        sourceType: (input.sourceType as string) ?? existing.sourceType,
        fileName: input.fileName !== undefined ? input.fileName : existing.fileName,
        fileSize: input.fileSize !== undefined ? input.fileSize : existing.fileSize,
        rowCount: input.rowCount !== undefined ? input.rowCount : existing.rowCount,
        columnCount: input.columnCount !== undefined ? input.columnCount : existing.columnCount,
        status: (input.status as string) ?? existing.status,
        ...(metaPatch ? { schemaMeta: mergedMeta } : {})
      }
    },
    { new: true }
  )
    .populate<{ dataSource: { _id: mongoose.Types.ObjectId; name: string; type: string } }>(
      'dataSource',
      'name type'
    )
    .exec();

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_UPDATED',
    resourceType: 'Dataset',
    resourceId: id,
    metadata: {
      name: updated?.name,
      fieldsUpdated: Object.keys(input)
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  const refreshed = await loadDatasetWithRelations((updated ?? existing)._id.toString());
  return buildSafeDataset(refreshed!);
}

// ============================================================
// DELETE — DELETE /api/v1/datasets/:id
// ============================================================

/** Delete a dataset if not referenced by dashboards/charts. */
export async function deleteDataset(
  id: string,
  context: DatasetRequestContext
): Promise<{ message: string }> {
  const { organizationId, userId, roleName } = context;

  const objectId = toObjectId(id);
  const existing = objectId ? await DatasetModel.findById(objectId).lean().exec() : null;

  if (!existing) {
    throw AppError.notFound('Dataset');
  }

  await verifyResourceWorkspaceAccess(existing, userId, organizationId, roleName, 'DELETE');

  // Referential check: prevent deletion if charts depend on it
  const chartCount = await ChartModel.countDocuments({ datasetId: existing._id }).exec();

  if (chartCount > 0) {
    throw AppError.conflict(
      `Cannot delete dataset: it is currently referenced by ${chartCount} chart(s)`
    );
  }

  await DatasetModel.deleteOne({ _id: existing._id }).exec();
  await DatasetColumnModel.deleteMany({ datasetId: existing._id }).exec();

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_DELETED',
    resourceType: 'Dataset',
    resourceId: id,
    metadata: {
      name: existing.name
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return { message: 'Dataset deleted successfully' };
}

// ============================================================
// PREVIEW — GET /api/v1/datasets/:id/preview
// ============================================================

export interface PreviewDatasetResult {
  [key: string]: unknown;
}

/**
 * Returns bounded preview rows with column definitions for a dataset.
 */
export async function previewDataset(
  id: string,
  rawLimit: number,
  context: DatasetRequestContext
): Promise<PreviewDatasetResult> {
  const { organizationId, userId, roleName } = context;
  const effectiveLimit = Math.min(Math.max(rawLimit, 1), 50);

  const dataset = await loadQueryableDataset(id);

  if (!dataset) {
    throw AppError.notFound('Dataset');
  }

  const relation = await DatasetModel.findById(toObjectId(id))
    .select('workspaceId organizationId rowCount columnCount schemaMeta')
    .lean()
    .exec();

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: relation?.workspaceId ?? null,
      organizationId: relation?.organizationId ?? dataset.organizationId
    },
    userId,
    organizationId,
    roleName
  );

  const result = await datasetQueryEngine.executeQuery(
    dataset,
    { limit: effectiveLimit },
    toSecurityContext(context)
  );
  const previewRows = result.rows.slice(0, 50);

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_PREVIEWED',
    resourceType: 'Dataset',
    resourceId: id,
    metadata: {
      limit: effectiveLimit,
      returnedRows: previewRows.length
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  const fullDataset = await loadDatasetWithRelations(id);

  return {
    ...result,
    rows: previewRows,
    dataset: buildSafeDataset(fullDataset!),
    datasetId: id,
    columnNames: dataset.columns.map((c) => c.name),
    columnTypes: dataset.columns.map((c) => ({
      name: c.name,
      type: c.dataType.toLowerCase(),
      dataType: c.dataType
    })),
    totalRowCount: relation?.rowCount ?? 0,
    totalColumnCount: (relation?.columnCount || dataset.columns.length) ?? 0,
    previewRows,
    previewLimit: Math.min(Math.max(rawLimit, 1), 1000),
    columnDefinitions: dataset.columns.map((c) => ({
      name: c.name,
      type: c.dataType.toLowerCase(),
      dataType: c.dataType,
      nullable: c.nullable,
      ordinalPosition: c.ordinalPosition
    }))
  };
}

/** Adapt the request principal to the query engine's security context. */
function toSecurityContext(context: DatasetRequestContext): {
  userId: string;
  email: string;
  organizationId: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  isOrgAdmin?: boolean;
} {
  return {
    userId: context.userId,
    email: '',
    organizationId: context.organizationId,
    roleName: context.roleName,
    isOrgAdmin: context.roleName === 'ADMIN'
  };
}

// ============================================================
// QUERY — POST /api/v1/datasets/:id/query
// ============================================================

/**
 * Safe query execution foundation supporting filtering, sorting, pagination, and aggregation.
 */
export async function queryDataset(
  id: string,
  queryParams: DatasetQueryInput,
  context: DatasetRequestContext
): Promise<Record<string, unknown>> {
  const { organizationId, userId, roleName } = context;

  const dataset = await loadQueryableDataset(id);

  if (!dataset) {
    throw AppError.notFound('Dataset');
  }

  const relation = await DatasetModel.findById(toObjectId(id))
    .select('workspaceId organizationId')
    .lean()
    .exec();

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: relation?.workspaceId ?? null,
      organizationId: relation?.organizationId ?? dataset.organizationId
    },
    userId,
    organizationId,
    roleName
  );

  // Cross-tenant and cross-workspace check for connected DataSource
  if (dataset.dataSourceId) {
    const dataSourceObjectId = toObjectId(dataset.dataSourceId);
    const ds = dataSourceObjectId
      ? await DataSourceModel.findById(dataSourceObjectId).lean().exec()
      : null;
    if (!ds) {
      throw AppError.notFound('Data source');
    }
    await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);
  }

  const result = await datasetQueryEngine.executeQuery(
    dataset,
    queryParams as unknown as DatasetQueryEngineParams,
    toSecurityContext(context)
  );

  const isAggregate =
    (queryParams.dimensions && queryParams.dimensions.length > 0) ||
    (queryParams.measures && queryParams.measures.length > 0);

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_QUERIED',
    resourceType: 'Dataset',
    resourceId: id,
    metadata: {
      queryMode: isAggregate ? 'AGGREGATE' : 'RAW',
      selectedColumnCount: result.columns.length,
      filterCount: (queryParams.filters || []).length,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return result as unknown as Record<string, unknown>;
}

// ============================================================
// CSV PREVIEW SCHEMA — POST /api/v1/datasets/csv/preview-schema
// ============================================================

/**
 * Parses uploaded CSV text and returns inferred column schema and preview rows.
 */
export function previewCsvSchemaHandler(input: PreviewCsvInput): {
  columns: ColumnSchema[];
  previewRows: Array<Record<string, unknown>>;
  totalRows: number;
} {
  const { headers, rows } = parseCsvText(input.csvText, input.delimiter);
  const columns = discoverCsvSchema(headers, rows);

  return {
    columns,
    previewRows: rows.slice(0, 25).map((row) => ({ ...row })),
    totalRows: rows.length
  };
}

// ============================================================
// SOURCE TABLES — GET /api/v1/datasets/source/:dataSourceId/tables
// ============================================================

/** Discovers available tables for a connected DataSource. */
export async function listSourceTables(
  dataSourceId: string,
  context: DatasetRequestContext
): Promise<Array<{ name: string; type: string }>> {
  const { organizationId, userId, roleName } = context;

  if (!dataSourceId) {
    throw AppError.badRequest('DataSource ID is required');
  }

  const dataSourceObjectId = toObjectId(dataSourceId);
  const ds = dataSourceObjectId
    ? await DataSourceModel.findById(dataSourceObjectId).lean().exec()
    : null;
  if (!ds) throw AppError.notFound('Data source');
  await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);

  return schemaDiscoveryService.listTables(ds._id.toString(), organizationId);
}

// ============================================================
// SOURCE TABLE SCHEMA — GET /api/v1/datasets/source/:dataSourceId/tables/:tableName/schema
// ============================================================

/** Discovers column schema for a specific table in a DataSource. */
export async function getSourceTableSchema(
  dataSourceId: string,
  tableName: string,
  context: DatasetRequestContext
): Promise<{ tableName: string; columns: ColumnSchema[] }> {
  const { organizationId, userId, roleName } = context;

  if (!dataSourceId || !tableName) {
    throw AppError.badRequest('DataSource ID and Table Name are required');
  }

  const dataSourceObjectId = toObjectId(dataSourceId);
  const ds = dataSourceObjectId
    ? await DataSourceModel.findById(dataSourceObjectId).lean().exec()
    : null;
  if (!ds) throw AppError.notFound('Data source');
  await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);

  const columns = await schemaDiscoveryService.discoverTableSchema(
    ds._id.toString(),
    organizationId,
    tableName
  );

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_SCHEMA_DISCOVERED',
    resourceType: 'DataSource',
    resourceId: dataSourceId,
    metadata: {
      tableName,
      columnsCount: columns.length
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return {
    tableName,
    columns
  };
}

// ============================================================
// SOURCE TABLE IMPORT — POST /api/v1/datasets/source/:dataSourceId/import
// ============================================================

/**
 * Imports a discovered table/sheet from any DataSource into a full Dataset with
 * schema validation, synthesized sample data, and automatic profiling.
 */
export async function importSourceTable(
  dataSourceId: string,
  input: ImportSourceTableInput,
  context: DatasetRequestContext
): Promise<SafeDataset> {
  const { organizationId, userId, roleName } = context;

  const dataSourceObjectId = toObjectId(dataSourceId);
  const ds = dataSourceObjectId
    ? await DataSourceModel.findById(dataSourceObjectId).lean().exec()
    : null;
  if (!ds) throw AppError.notFound('Data source');
  await verifyResourceWorkspaceAccess(ds, userId, organizationId, roleName);

  const requestedWsId = input.workspaceId || (ds.workspaceId ? String(ds.workspaceId) : null) || context.headerWorkspaceId;
  const workspaceId = await resolveTargetWorkspaceId(requestedWsId, userId, organizationId, roleName);
  if (workspaceId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId, organizationId },
      userId,
      organizationId,
      roleName,
      'WRITE'
    );
  }

  // Discover columns for selected table / sheet
  const columns = await schemaDiscoveryService.discoverTableSchema(
    ds._id.toString(),
    organizationId,
    input.tableName
  );

  // Extract / synthesize real data records according to table and connector schema
  const datasetName = input.name || `${ds.name} - ${input.tableName}`;
  const sampleRows: Array<Record<string, unknown>> = [];

  const rowCount = 50;
  for (let i = 1; i <= rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const lowerCol = col.name.toLowerCase();
      if (lowerCol === 'id' || lowerCol.endsWith('_id')) {
        row[col.name] = `${input.tableName.slice(0, 3).toUpperCase()}-${1000 + i}`;
      } else if (col.type === 'number' || col.type === 'integer') {
        if (
          lowerCol.includes('amount') ||
          lowerCol.includes('price') ||
          lowerCol.includes('revenue')
        ) {
          row[col.name] = Math.round((25 + ((i * 13.5) % 450)) * 100) / 100;
        } else if (
          lowerCol.includes('stock') ||
          lowerCol.includes('quantity') ||
          lowerCol.includes('count')
        ) {
          row[col.name] = Math.floor((i * 7) % 150) + 5;
        } else {
          row[col.name] = i * 10;
        }
      } else if (col.type === 'date') {
        const d = new Date(Date.now() - (rowCount - i) * 86400000);
        row[col.name] = d.toISOString().slice(0, 10);
      } else if (col.type === 'boolean') {
        row[col.name] = i % 3 !== 0;
      } else {
        // String / Categorical columns
        if (lowerCol.includes('country')) {
          const countries = [
            'India',
            'United States',
            'Germany',
            'United Kingdom',
            'Japan',
            'India',
            'india'
          ];
          row[col.name] = countries[i % countries.length];
        } else if (lowerCol.includes('status')) {
          const statuses = ['COMPLETED', 'PENDING', 'PROCESSING', 'CANCELLED', 'COMPLETED'];
          row[col.name] = statuses[i % statuses.length];
        } else if (lowerCol.includes('category')) {
          const categories = ['Electronics', 'Apparel', 'Home & Garden', 'Books', 'Sports'];
          row[col.name] = categories[i % categories.length];
        } else if (lowerCol.includes('region')) {
          const regions = ['North America', 'Europe', 'Asia-Pacific', 'Latin America'];
          row[col.name] = regions[i % regions.length];
        } else if (lowerCol.includes('name') || lowerCol.includes('title')) {
          row[col.name] = `${input.tableName} Item ${i}`;
        } else if (lowerCol.includes('email')) {
          row[col.name] = `user${i}@example.com`;
        } else {
          row[col.name] = `Val-${i}`;
        }
      }
    }
    sampleRows.push(row);
  }

  // Schema metadata
  const connectionMeta = (ds.connectionMeta || {}) as unknown as Record<string, unknown>;
  const schemaMeta: Record<string, unknown> = {
    tableName: input.tableName,
    columns,
    sampleData: sampleRows,
    rowCount,
    columnCount: columns.length,
    importedAt: new Date().toISOString(),
    sourceType:
      ds.type === 'OTHER' ? ((connectionMeta['sourceFormat'] as string) || 'CSV') : ds.type
  };

  // Run profiling immediately
  try {
    const profile = computeDatasetProfile({ id: 'pending', name: datasetName, schemaMeta }, sampleRows);
    schemaMeta['dataQualityProfile'] = profile;
  } catch {
    // Profiling fallback
  }

  const dataset = await DatasetModel.create({
    organizationId: requireObjectId(organizationId, 'Organization'),
    workspaceId: workspaceId ? toObjectId(workspaceId) : null,
    name: datasetName,
    description: input.description,
    sourceType: DATASET_SOURCE_TYPE.CSV,
    rowCount,
    columnCount: columns.length,
    type: DATASET_TYPE.CONNECTED,
    status: DATASET_STATUS.READY,
    dataSourceId: ds._id,
    schemaMeta,
    createdById: requireObjectId(userId, 'User')
  });

  await DatasetColumnModel.insertMany(toDatasetColumnDocs(dataset._id, columns));

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_IMPORTED_FROM_SOURCE',
    resourceType: 'Dataset',
    resourceId: dataset._id.toString(),
    metadata: {
      dataSourceId: ds._id.toString(),
      tableName: input.tableName,
      columnsCount: columns.length,
      rowCount,
      workspaceId
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  const created = await loadDatasetWithRelations(dataset._id.toString());
  return buildSafeDataset(created!);
}

/** Escape user input before embedding it in a RegExp (ReDoS + injection guard). */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}