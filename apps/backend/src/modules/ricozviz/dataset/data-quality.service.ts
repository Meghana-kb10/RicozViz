// ========================================
// Data Quality & Profiling Service (Phase 4)
// ========================================
// Ported from the legacy Express API
// (`RicozViz_old/apps/api/src/services/dataset/data-quality.service.ts`).
//
// Safely profiles datasets without modifying data.
// Computes completeness, distinctness, statistical distributions,
// duplicate row counts, IQR outliers, invalid/type issues and a quality score.
// Persists profiling results into `dataset.schemaMeta.dataQualityProfile`.
//
// ------------------------------------------------------------------
// SHARED DATASET HELPERS
// ------------------------------------------------------------------
// The advanced dataset services (transformations, versioning, calculated
// fields and blending) all need the same three primitives:
//
//   1. `readDatasetRows`        — the in-memory row set of a dataset
//   2. `extractDatasetColumnsAndRows`
//   3. `verifyResourceWorkspaceAccess` / `resolveWorkspaceAccess`
//   4. `buildSafeDataset`       — the API representation of a dataset
//
// They live here (rather than in `query-engine.ts` / `dataset.service.ts`,
// which are owned by the dataset-core module) so this module graph stays
// acyclic and never depends on a file that may not exist yet.
// ========================================

import mongoose from 'mongoose';
import {
  DatasetModel,
  WorkspaceModel,
  WorkspaceMemberModel,
  toObjectId,
  serializeDoc
} from '@repo/database';
import { DATASET_COLUMN_TYPE, DATASET_STATUS, WORKSPACE_ROLE } from '@repo/types';
import type {
  CategoricalValueDistribution,
  ColumnProfile,
  DataQualityWarning,
  DatasetData,
  DatasetProfileResult,
  DatasetQualitySummary,
  DatasetStatus,
  DatasetType,
  QualityScoreBreakdown
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';
import {
  compileCalculatedField,
  evaluateExpression,
  type ASTNode
} from './calculated-field.engine.js';

// ============================================================
// SHARED HELPERS — dataset row / column access
// ============================================================

/** Minimum dataset shape the advanced services need to read rows and columns. */
export interface DatasetRowSource {
  id: string;
  name?: string;
  type?: string;
  schemaMeta?: Record<string, unknown> | null;
  columns?: Array<{ name: string; dataType?: string | null }> | null;
}

/** Serialised dataset projection accepted by `buildSafeDataset`. */
export interface SerializedDataset {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  sourceType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  rowCount?: number;
  columnCount?: number;
  type?: string;
  status?: string;
  dataSourceId?: string | null;
  dataSource?: { id: string; name: string; type: string } | null;
  schemaMeta?: Record<string, unknown> | null;
  currentVersion?: number;
  parentDatasetId?: string | null;
  transformationSteps?: unknown;
  columns?: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }> | null;
  createdAt: string;
  updatedAt: string;
}

/** API representation of a dataset (`buildSafeDataset` output). */
export interface SafeDataset extends DatasetData {
  schema: Record<string, unknown>;
  schemaMeta: Record<string, unknown>;
}

const DEFAULT_QUERY_ROW_LIMIT = 1000;

/** Normalise `schemaMeta` into a plain record. */
export function readSchemaMeta(schemaMeta: unknown): Record<string, unknown> {
  if (!schemaMeta || typeof schemaMeta !== 'object' || Array.isArray(schemaMeta)) {
    return {};
  }
  return schemaMeta as Record<string, unknown>;
}

/**
 * Raw stored rows of a dataset.
 *
 * Mirrors the legacy `DatasetQueryEngine.executeInMemoryQuery` row source:
 * `schemaMeta.sampleData` with `previewRows` / `rows` fallbacks.
 */
export function readStoredRows(schemaMeta: unknown): Record<string, unknown>[] {
  const meta = readSchemaMeta(schemaMeta);
  const raw = (meta.sampleData ?? meta.previewRows ?? meta.rows ?? []) as unknown;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

/**
 * Column name -> lowercased type map, in the exact precedence used by the
 * legacy query engine: relational columns, then `schemaMeta.columns`, then
 * calculated fields.
 */
export function buildColumnTypeMap(dataset: DatasetRowSource): Map<string, string> {
  const columnTypeMap = new Map<string, string>();
  const meta = readSchemaMeta(dataset.schemaMeta);

  if (Array.isArray(dataset.columns) && dataset.columns.length > 0) {
    for (const c of dataset.columns) {
      columnTypeMap.set(c.name, (c.dataType || 'STRING').toLowerCase());
    }
  }

  const metaColumns = Array.isArray(meta.columns)
    ? (meta.columns as Array<{ name: string; type?: string }>)
    : [];
  for (const c of metaColumns) {
    if (!columnTypeMap.has(c.name)) {
      columnTypeMap.set(c.name, (c.type || 'string').toLowerCase());
    }
  }

  const calculatedFields = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as Array<{ name: string; dataType?: string }>)
    : [];
  for (const cf of calculatedFields) {
    if (!columnTypeMap.has(cf.name)) {
      columnTypeMap.set(cf.name, (cf.dataType || 'NUMBER').toLowerCase());
    }
  }

  return columnTypeMap;
}

/**
 * Execute an unbounded raw query (no filters, no aggregation, no RLS — exactly
 * the call shape the advanced services used) against the dataset's stored rows.
 *
 * Reproduces the legacy `datasetQueryEngine.executeQuery(dataset, { limit, offset })`
 * raw path: calculated fields are materialised first, then every row is
 * projected onto the known column list (missing values become `null`).
 */
export function readDatasetRows(
  dataset: DatasetRowSource,
  limit: number = DEFAULT_QUERY_ROW_LIMIT,
  offset = 0
): Record<string, unknown>[] {
  const meta = readSchemaMeta(dataset.schemaMeta);
  const rawRows = readStoredRows(meta);
  const columnTypeMap = buildColumnTypeMap(dataset);

  let processedSourceRows = rawRows;
  const calculatedFields = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as Array<{ name: string; expression: string; dataType?: string }>)
    : [];

  if (calculatedFields.length > 0 && rawRows.length > 0) {
    const knownCols = Array.from(columnTypeMap.entries()).map(([name, type]) => ({ name, type }));
    const compiledFields: Array<{ name: string; ast: ASTNode }> = [];
    for (const cf of calculatedFields) {
      try {
        const compiled = compileCalculatedField(cf.expression, knownCols);
        compiledFields.push({ name: cf.name, ast: compiled.ast });
      } catch {
        // If compile fails on a legacy expression, continue safely
      }
    }

    if (compiledFields.length > 0) {
      processedSourceRows = rawRows.map((r) => {
        const copy = { ...r };
        for (const cf of compiledFields) {
          copy[cf.name] = evaluateExpression(cf.ast, copy);
        }
        return copy;
      });
    }
  }

  const selectedColumns = Array.from(columnTypeMap.keys());
  const projected = processedSourceRows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const col of selectedColumns) {
      next[col] = row[col] ?? null;
    }
    return next;
  });

  return projected.slice(Math.max(offset, 0), Math.max(offset, 0) + limit);
}

/**
 * Columns + rows used by the calculated-field and blend previews.
 *
 * Mirrors the legacy `extractDatasetColumnsAndRows` helper from
 * `calculated-field.service.ts` / `dataset-blend.service.ts`.
 */
export async function extractDatasetColumnsAndRows(
  dataset: DatasetRowSource
): Promise<{ columns: Array<{ name: string; type: string }>; rows: Record<string, unknown>[] }> {
  const meta = readSchemaMeta(dataset.schemaMeta);
  let columns: Array<{ name: string; type: string }> = [];

  if (Array.isArray(dataset.columns) && dataset.columns.length > 0) {
    columns = dataset.columns.map((c) => ({
      name: c.name,
      type: String(c.dataType || 'STRING').toUpperCase()
    }));
  } else if (Array.isArray(meta.columns)) {
    columns = (meta.columns as Array<{ name: string; type?: string }>).map((c) => ({
      name: c.name,
      type: String(c.type || 'STRING').toUpperCase()
    }));
  }

  let rows = readStoredRows(meta);
  if (rows.length === 0 && dataset.type === 'CONNECTED') {
    try {
      const columnTypeMap = buildColumnTypeMap(dataset);
      rows = readDatasetRows(dataset, 1000, 0);
      if (columns.length === 0) {
        columns = Array.from(columnTypeMap.entries()).map(([name, type]) => ({
          name,
          type: type.toUpperCase()
        }));
      }
    } catch {
      // Fallback
    }
  }

  return { columns, rows };
}

/** Map an arbitrary column type onto the persisted `DatasetColumnType` enum. */
export function mapColumnDataType(type: string): string {
  switch (type) {
    case 'NUMBER':
      return DATASET_COLUMN_TYPE.NUMBER;
    case 'BOOLEAN':
      return DATASET_COLUMN_TYPE.BOOLEAN;
    case 'DATE':
      return DATASET_COLUMN_TYPE.DATE;
    case 'STRING':
    default:
      return DATASET_COLUMN_TYPE.STRING;
  }
}

/**
 * Cast a JSON payload for a `Schema.Types.Mixed` field.
 *
 * Mongoose's strict `Mixed` typing rejects arrays and nested objects unless
 * they go through an explicit widening cast, which is what the legacy
 * `Prisma.InputJsonValue` casts did.
 */
export function asMixed(value: unknown): mongoose.Schema.Types.Mixed {
  return value as mongoose.Schema.Types.Mixed;
}

// ============================================================
// SHARED HELPERS — workspace authorization
// ============================================================

export type WorkspaceAction = 'READ' | 'WRITE' | 'DELETE' | 'ADMIN' | 'SHARE';

export interface WorkspaceAccessContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    organizationId: string;
  };
  userRole: string;
  isOrgAdmin: boolean;
}

const inMemoryWorkspaceRoleStore = new Map<string, string>();

/** Register a workspace role without a database round-trip (tests / offline). */
export function registerInMemoryWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: string
): void {
  inMemoryWorkspaceRoleStore.set(`${workspaceId}:${userId}`, role);
}

/** Drop every in-memory workspace membership. */
export function clearInMemoryWorkspaceMembers(): void {
  inMemoryWorkspaceRoleStore.clear();
}

/**
 * Resolve the caller's workspace role.
 *
 * Mongoose translation of the legacy `resolveWorkspaceAccess`:
 * `workspace.findFirst({ id, organizationId })` + `workspaceMember.findUnique({ workspaceId, userId })`.
 */
export async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<WorkspaceAccessContext> {
  const workspaceObjectId = toObjectId(workspaceId);
  const organizationObjectId = toObjectId(organizationId);

  const workspace =
    workspaceObjectId && organizationObjectId
      ? await WorkspaceModel.findOne({
          _id: workspaceObjectId,
          organizationId: organizationObjectId
        }).lean()
      : null;

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  const isOrgAdmin = userRoleName === 'ADMIN';

  const userObjectId = toObjectId(userId);
  const membership =
    workspaceObjectId && userObjectId
      ? await WorkspaceMemberModel.findOne({
          workspaceId: workspaceObjectId,
          userId: userObjectId
        }).lean()
      : null;

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden('Access denied: You do not have access to this workspace');
  }

  return {
    workspace: {
      id: workspace._id.toString(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description ?? null,
      organizationId: workspace.organizationId.toString()
    },
    userRole: membership?.role ?? WORKSPACE_ROLE.ADMIN,
    isOrgAdmin
  };
}

/**
 * Verify the authenticated user may act on a workspace-scoped resource.
 *
 * Enforces the role hierarchy OWNER -> ADMIN -> EDITOR/MEMBER -> VIEWER so a
 * Workspace A member can never reach a Workspace B resource.
 */
export async function verifyResourceWorkspaceAccess(
  resource: { workspaceId?: string | null; organizationId: string },
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: WorkspaceAction = 'READ'
): Promise<void> {
  // 1. Organization tenant isolation
  if (resource.organizationId !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  // 2. Organization admins bypass workspace restrictions
  if (userRoleName === 'ADMIN') {
    return;
  }

  // 3. Workspace scoping
  if (!resource.workspaceId) {
    return;
  }

  let userRole = inMemoryWorkspaceRoleStore.get(`${resource.workspaceId}:${userId}`);

  if (!userRole) {
    try {
      const access = await resolveWorkspaceAccess(
        resource.workspaceId,
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
    if (userRole === WORKSPACE_ROLE.VIEWER) {
      throw AppError.forbidden('Access denied: Viewers have read-only access to this workspace');
    }
    return;
  }

  if (requiredAction === 'DELETE') {
    if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN) {
      throw AppError.forbidden(
        'Access denied: Only workspace owners and admins can delete this resource'
      );
    }
    return;
  }

  if (requiredAction === 'SHARE') {
    if (userRole === WORKSPACE_ROLE.VIEWER) {
      throw AppError.forbidden('Access denied: Viewers cannot share workspace resources');
    }
    return;
  }

  if (requiredAction === 'ADMIN') {
    if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN) {
      throw AppError.forbidden(
        'Access denied: Only workspace owners and admins have administrative permissions'
      );
    }
    return;
  }
}

// ============================================================
// SHARED HELPERS — dataset API representation
// ============================================================

/**
 * Build the API representation of a dataset.
 *
 * Ported verbatim from the legacy `buildSafeDataset` in `dataset.service.ts`
 * (that file is owned by the dataset-core module, so it is re-implemented here
 * rather than imported).
 */
export function buildSafeDataset(ds: SerializedDataset): SafeDataset {
  const meta = readSchemaMeta(ds.schemaMeta);

  const calculatedFields = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as CalculatedFieldConfigLike[])
    : [];
  const calcFieldMap = new Map(calculatedFields.map((cf) => [cf.name.toLowerCase(), cf]));

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
      expression: calcFieldMap.get(c.name.toLowerCase())?.expression || undefined
    }));
  } else if (Array.isArray(meta.columns)) {
    columns = (meta.columns as Array<{
      name: string;
      type?: string;
      nullable?: boolean;
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

  const sampleData = (meta.sampleData as unknown[]) || [];
  const storedRowCount =
    typeof ds.rowCount === 'number' && ds.rowCount > 0
      ? ds.rowCount
      : typeof meta.rowCount === 'number'
        ? (meta.rowCount as number)
        : sampleData.length;

  const storedColumnCount =
    typeof ds.columnCount === 'number' && ds.columnCount > 0
      ? ds.columnCount
      : typeof meta.columnCount === 'number'
        ? (meta.columnCount as number)
        : columns.length;

  const clientStatus: DatasetStatus =
    ds.status === DATASET_STATUS.ACTIVE
      ? DATASET_STATUS.READY
      : ds.status === DATASET_STATUS.ERROR
        ? DATASET_STATUS.FAILED
        : ((ds.status ?? DATASET_STATUS.DRAFT) as DatasetStatus);

  const clientSourceType = ds.sourceType ?? (meta.sourceType as string) ?? 'CSV';
  const clientFileName =
    ds.fileName ?? (meta.filename as string) ?? (meta.fileName as string) ?? null;
  const clientFileSize = ds.fileSize ?? (meta.fileSize as number) ?? null;

  return {
    id: ds.id,
    workspaceId: ds.workspaceId ?? null,
    name: ds.name,
    description: ds.description ?? null,
    sourceType: clientSourceType as DatasetData['sourceType'],
    fileName: clientFileName,
    fileSize: clientFileSize,
    rowCount: storedRowCount,
    columnCount: storedColumnCount,
    type: (ds.type ?? 'UPLOADED') as DatasetType,
    status: clientStatus,
    dataSourceId: ds.dataSourceId ?? null,
    dataSourceName: ds.dataSource?.name || null,
    dataSourceType: ds.dataSource?.type || null,
    dataSource: ds.dataSource
      ? {
          id: ds.dataSource.id,
          name: ds.dataSource.name,
          type: ds.dataSource.type === 'CSV_UPLOAD' ? 'CSV' : ds.dataSource.type
        }
      : null,
    columns: columns as DatasetData['columns'],
    calculatedFields: calculatedFields as DatasetData['calculatedFields'],
    currentVersion: ds.currentVersion,
    parentDatasetId: ds.parentDatasetId ?? null,
    transformationSteps: ds.transformationSteps,
    tableName: (meta.tableName as string) || null,
    metadata: meta,
    createdAt: ds.createdAt,
    updatedAt: ds.updatedAt,
    schema: meta,
    schemaMeta: meta
  };
}

interface CalculatedFieldConfigLike {
  name: string;
  expression: string;
  dataType: string;
}

// ============================================================
// DATA QUALITY PROFILING
// ============================================================

export const MAX_PROFILE_SAMPLE_ROWS = 5000;

/** Profileable dataset projection (serialised document). */
export interface DatasetProfileSource extends DatasetRowSource {
  id: string;
  name: string;
}

/**
 * Pure calculation function: evaluates dataset columns and records to produce
 * a comprehensive profiling result.
 */
export function computeDatasetProfile(
  dataset: DatasetProfileSource,
  rows: Record<string, unknown>[]
): DatasetProfileResult {
  const totalRows = rows.length;

  // 1. Identify schema columns and column types
  const meta = readSchemaMeta(dataset.schemaMeta);
  const schemaCols = (meta.columns || []) as Array<{ name: string; type?: string }>;
  const dbCols = dataset.columns || [];

  const columnNames = new Set<string>();
  const columnTypeMap = new Map<string, string>();

  for (const c of dbCols) {
    columnNames.add(c.name);
    columnTypeMap.set(c.name, (c.dataType || 'STRING').toLowerCase());
  }

  for (const c of schemaCols) {
    columnNames.add(c.name);
    if (!columnTypeMap.has(c.name)) {
      columnTypeMap.set(c.name, (c.type || 'string').toLowerCase());
    }
  }

  if (totalRows > 0 && rows[0]) {
    for (const row of rows) {
      Object.keys(row).forEach((k) => columnNames.add(k));
    }
    for (const col of columnNames) {
      if (!columnTypeMap.has(col)) {
        let inferred = 'string';
        for (const r of rows) {
          const v = r[col];
          if (v === null || v === undefined) continue;
          if (typeof v === 'number' && !isNaN(v)) {
            inferred = 'number';
            break;
          } else if (typeof v === 'boolean') {
            inferred = 'boolean';
            break;
          } else if (typeof v === 'string') {
            const trimmed = v.trim();
            if (
              trimmed.length >= 8 &&
              (trimmed.includes('-') || trimmed.includes('/') || trimmed.includes('T')) &&
              !isNaN(Date.parse(trimmed))
            ) {
              inferred = 'date';
              break;
            }
          }
        }
        columnTypeMap.set(col, inferred);
      }
    }
  }

  const columnList = Array.from(columnNames);
  const totalColumns = columnList.length;

  // Data-type distribution
  const dataTypeDistribution: Record<string, number> = {};
  for (const colName of columnList) {
    const rawType = (columnTypeMap.get(colName) || 'string').toLowerCase();
    dataTypeDistribution[rawType] = (dataTypeDistribution[rawType] || 0) + 1;
  }

  // 2. Handle empty dataset gracefully
  if (totalRows === 0) {
    const emptyBreakdown: QualityScoreBreakdown = {
      completeness: 100,
      validity: 100,
      consistency: 100,
      uniqueness: 100,
      weights: { completeness: 0.35, validity: 0.25, consistency: 0.2, uniqueness: 0.2 },
      formula:
        'Quality Score = (Completeness × 35%) + (Validity × 25%) + (Consistency × 20%) + (Uniqueness × 20%)'
    };

    const summary: DatasetQualitySummary = {
      dataQualityScore: 100,
      completenessPercentage: 100,
      missingDataCount: 0,
      missingDataPercentage: 0,
      duplicateRowsCount: 0,
      duplicateRowsPercentage: 0,
      typeIssuesCount: 0,
      potentialOutliersCount: 0,
      grade: 'EXCELLENT',
      scoreBreakdown: emptyBreakdown,
      dataTypeDistribution
    };

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      totalRows: 0,
      totalColumns,
      duplicateRowsCount: 0,
      completenessPercentage: 100,
      dataTypeDistribution,
      qualityScore: 100,
      scoreBreakdown: emptyBreakdown,
      summary,
      columns: columnList.map((colName) => ({
        name: colName,
        type: columnTypeMap.get(colName) || 'string',
        totalCount: 0,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 0,
        uniquePercentage: 0,
        cardinality: 0,
        sampleValues: [],
        invalidCount: 0,
        invalidPercentage: 0
      })),
      warnings: [
        {
          severity: 'INFO',
          rule: 'EMPTY_DATASET',
          message: 'The dataset currently contains no records.'
        }
      ],
      evaluatedAt: new Date().toISOString()
    };
  }

  // 3. Compute duplicate rows
  const seenRowSignatures = new Set<string>();
  let duplicateRowsCount = 0;

  for (const row of rows) {
    const signature = JSON.stringify(row);
    if (seenRowSignatures.has(signature)) {
      duplicateRowsCount++;
    } else {
      seenRowSignatures.add(signature);
    }
  }

  // 4. Profile each column
  const columnProfiles: ColumnProfile[] = [];
  const warnings: DataQualityWarning[] = [];
  let totalNullCells = 0;
  let totalTypeIssues = 0;
  let totalOutliersFound = 0;
  let inconsistentCategoricalCols = 0;

  const duplicatePercentage = Math.round((duplicateRowsCount / totalRows) * 1000) / 10;
  if (duplicateRowsCount > 0) {
    warnings.push({
      severity: duplicatePercentage > 10 ? 'HIGH' : 'MEDIUM',
      rule: 'DUPLICATE_ROWS',
      message: `Detected ${duplicateRowsCount} duplicate record(s) (${duplicatePercentage}% of dataset sample).`
    });
  }

  for (const colName of columnList) {
    const rawType = (columnTypeMap.get(colName) || 'string').toLowerCase();
    const isNumeric =
      rawType === 'number' ||
      rawType === 'integer' ||
      rawType === 'float' ||
      rawType === 'decimal';
    const isDate =
      rawType === 'date' || rawType === 'datetime' || rawType === 'timestamp';
    const isBoolean = rawType === 'boolean' || rawType === 'bool';

    let nullCount = 0;
    let blankCount = 0;
    let invalidCount = 0;
    const distinctSet = new Set<string>();
    const sampleValues: unknown[] = [];
    const numericValues: number[] = [];
    const validDates: number[] = [];
    let minLength: number | null = null;
    let maxLength: number | null = null;

    // Value counts for categorical distribution
    const rawValueCounts = new Map<string, number>();
    // For case inconsistency detection: norm -> Map<raw, count>
    const casingVariantsMap = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const val = row[colName];

      if (val === null || val === undefined) {
        nullCount++;
        continue;
      }

      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.length === 0) {
          blankCount++;
          nullCount++;
          continue;
        }
        if (minLength === null || trimmed.length < minLength) minLength = trimmed.length;
        if (maxLength === null || trimmed.length > maxLength) maxLength = trimmed.length;

        // Categorical tracking
        const strVal = trimmed;
        rawValueCounts.set(strVal, (rawValueCounts.get(strVal) || 0) + 1);

        const normKey = strVal.toLowerCase();
        if (!casingVariantsMap.has(normKey)) {
          casingVariantsMap.set(normKey, new Map());
        }
        const vMap = casingVariantsMap.get(normKey)!;
        vMap.set(strVal, (vMap.get(strVal) || 0) + 1);
      }

      const stringVal = String(val);
      if (!distinctSet.has(stringVal)) {
        distinctSet.add(stringVal);
        if (sampleValues.length < 5) {
          sampleValues.push(val);
        }
      }

      // Type integrity validation
      if (isNumeric) {
        if (typeof val === 'number') {
          if (isNaN(val)) {
            invalidCount++;
          } else {
            numericValues.push(val);
          }
        } else {
          const parsedNum = Number(val);
          if (isNaN(parsedNum)) {
            invalidCount++;
          } else {
            numericValues.push(parsedNum);
          }
        }
      } else if (isDate) {
        const parsedTimestamp = Date.parse(String(val));
        if (isNaN(parsedTimestamp)) {
          invalidCount++;
        } else {
          validDates.push(parsedTimestamp);
        }
      } else if (isBoolean) {
        const lower = String(val).toLowerCase().trim();
        if (
          lower !== 'true' &&
          lower !== 'false' &&
          lower !== '1' &&
          lower !== '0' &&
          typeof val !== 'boolean'
        ) {
          invalidCount++;
        }
      }
    }

    totalNullCells += nullCount;
    totalTypeIssues += invalidCount;

    const nullPercentage = Math.round((nullCount / totalRows) * 1000) / 10;
    const invalidPercentage = Math.round((invalidCount / totalRows) * 1000) / 10;
    const uniqueCount = distinctSet.size;
    const uniquePercentage = Math.round((uniqueCount / totalRows) * 1000) / 10;

    const profile: ColumnProfile = {
      name: colName,
      type: rawType,
      totalCount: totalRows,
      nullCount,
      nullPercentage,
      uniqueCount,
      uniquePercentage,
      cardinality: uniqueCount,
      sampleValues,
      blankCount: blankCount > 0 ? blankCount : undefined,
      minLength: minLength !== null ? minLength : undefined,
      maxLength: maxLength !== null ? maxLength : undefined,
      invalidCount,
      invalidPercentage
    };

    // Date statistics
    if (isDate) {
      profile.invalidDates = invalidCount;
      profile.missingDates = nullCount;
      if (validDates.length > 0) {
        validDates.sort((a, b) => a - b);
        profile.minDate = new Date(validDates[0]).toISOString();
        profile.maxDate = new Date(validDates[validDates.length - 1]).toISOString();
      }
    }

    // Categorical statistics (Top values, Frequency & Distribution)
    if (!isNumeric && !isDate && rawValueCounts.size > 0) {
      const sortedValues = Array.from(rawValueCounts.entries()).sort((a, b) => b[1] - a[1]);
      const nonNullRowCount = totalRows - nullCount || 1;

      const topValues: CategoricalValueDistribution[] = sortedValues
        .slice(0, 10)
        .map(([val, cnt]) => ({
          value: val,
          count: cnt,
          percentage: Math.round((cnt / nonNullRowCount) * 1000) / 10
        }));

      const frequency: Record<string, number> = {};
      const distribution: Record<string, number> = {};
      sortedValues.slice(0, 15).forEach(([val, cnt]) => {
        frequency[val] = cnt;
        distribution[val] = Math.round((cnt / nonNullRowCount) * 1000) / 10;
      });

      profile.topValues = topValues;
      profile.frequency = frequency;
      profile.distribution = distribution;

      // Inconsistent categorical values detection (e.g. India / india / INDIA)
      const foundInconsistencies: string[] = [];
      for (const [, vMap] of casingVariantsMap.entries()) {
        if (vMap.size > 1) {
          const variantsStr = Array.from(vMap.entries())
            .map(([varName, count]) => `${varName} (${Math.round((count / nonNullRowCount) * 100)}%)`)
            .join(' / ');
          foundInconsistencies.push(variantsStr);
        }
      }

      if (foundInconsistencies.length > 0) {
        inconsistentCategoricalCols++;
        warnings.push({
          column: colName,
          severity: 'MEDIUM',
          rule: 'INCONSISTENT_CATEGORICAL_VALUES',
          message: `Potential casing/formatting inconsistency in "${colName}": ${foundInconsistencies
            .slice(0, 3)
            .join('; ')}. Standardize values to a consistent representation.`
        });
      }

      // High-cardinality detection on categorical columns
      if (totalRows >= 20 && uniquePercentage > 95 && !/id|_id|uuid|key/i.test(colName)) {
        warnings.push({
          column: colName,
          severity: 'LOW',
          rule: 'HIGH_CARDINALITY',
          message: `Column "${colName}" has high cardinality (${uniquePercentage}% distinct values). Likely an identifier or freeform text rather than a categorizable attribute.`
        });
      }
    }

    // Numeric statistics & Outlier detection
    if (isNumeric && numericValues.length > 0) {
      numericValues.sort((a, b) => a - b);
      const n = numericValues.length;
      const min = numericValues[0];
      const max = numericValues[n - 1];
      const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
      const avg = Math.round((sum / n) * 100) / 100;

      // Median
      const mid = Math.floor(n / 2);
      const median =
        n % 2 !== 0
          ? numericValues[mid]
          : Math.round(((numericValues[mid - 1] + numericValues[mid]) / 2) * 100) / 100;

      // Standard Deviation
      const variance =
        numericValues.reduce((acc, curr) => acc + Math.pow(curr - avg, 2), 0) / n;
      const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

      // Outlier detection using 1.5 * IQR rule
      const q1Index = Math.floor(n * 0.25);
      const q3Index = Math.floor(n * 0.75);
      const q1 = numericValues[q1Index] ?? min;
      const q3 = numericValues[q3Index] ?? max;
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      const outlierValues: number[] = [];
      let outliersCount = 0;
      for (const num of numericValues) {
        if (num < lowerFence || num > upperFence) {
          outliersCount++;
          if (outlierValues.length < 10) outlierValues.push(num);
        }
      }

      totalOutliersFound += outliersCount;
      const outlierPercentage = Math.round((outliersCount / n) * 1000) / 10;

      profile.min = min;
      profile.max = max;
      profile.avg = avg;
      profile.mean = avg;
      profile.median = median;
      profile.stdDev = stdDev;
      profile.outliers = outlierValues;
      profile.outliersCount = outliersCount;
      profile.outlierPercentage = outlierPercentage;

      if (outliersCount > 0 && n >= 4) {
        if (outlierPercentage > 5) {
          warnings.push({
            column: colName,
            severity: 'LOW',
            rule: 'STATISTICAL_OUTLIERS',
            message: `Column "${colName}" has ${outliersCount} statistical outlier values (${outlierPercentage}%) outside 1.5x IQR range.`
          });
        }
      }

      // Suspicious negative values in positive domains (price, amount, age, quantity, stock)
      const negativeValuesCount = numericValues.filter((v) => v < 0).length;
      if (
        negativeValuesCount > 0 &&
        /price|amount|age|quantity|count|stock|cost|revenue|sales/i.test(colName)
      ) {
        warnings.push({
          column: colName,
          severity: 'HIGH',
          rule: 'SUSPICIOUS_VALUES',
          message: `Column "${colName}" contains ${negativeValuesCount} suspicious negative value(s) in a domain where values should typically be non-negative.`
        });
      }
    }

    // Type issues warning
    if (invalidCount > 0) {
      warnings.push({
        column: colName,
        severity: invalidPercentage > 10 ? 'HIGH' : 'MEDIUM',
        rule: 'TYPE_INCONSISTENCY',
        message: `Column "${colName}" contains ${invalidCount} value(s) (${invalidPercentage}%) that do not conform to expected type "${rawType}".`
      });

      if (isDate) {
        warnings.push({
          column: colName,
          severity: 'HIGH',
          rule: 'INVALID_DATES',
          message: `Column "${colName}" contains ${invalidCount} invalid date value(s) that could not be parsed.`
        });
      }
    }

    // Warnings on nulls and empty columns
    if (nullPercentage >= 100) {
      warnings.push({
        column: colName,
        severity: 'HIGH',
        rule: 'COMPLETELY_EMPTY_COLUMN',
        message: `Column "${colName}" is 100% empty (contains no non-null records).`
      });
    } else if (nullPercentage >= 40) {
      warnings.push({
        column: colName,
        severity: 'HIGH',
        rule: 'HIGH_NULL_RATE',
        message: `Column "${colName}" has ${nullPercentage}% missing values.`
      });
    } else if (nullPercentage >= 15) {
      warnings.push({
        column: colName,
        severity: 'MEDIUM',
        rule: 'MODERATE_NULL_RATE',
        message: `Column "${colName}" has ${nullPercentage}% missing values.`
      });
    }

    if (totalRows >= 10 && uniqueCount === 1) {
      warnings.push({
        column: colName,
        severity: 'LOW',
        rule: 'ZERO_VARIANCE',
        message: `Column "${colName}" contains only 1 constant value across all rows.`
      });
    }

    columnProfiles.push(profile);
  }

  // 5. Deterministic Quality Score Calculation
  const totalCells = totalRows * totalColumns || 1;
  const missingDataPercentage = Math.round((totalNullCells / totalCells) * 1000) / 10;
  const completenessPercentage = Math.max(
    0,
    Math.min(100, Math.round(((totalCells - totalNullCells) / totalCells) * 1000) / 10)
  );

  const nonNullCells = Math.max(1, totalCells - totalNullCells);
  const totalValidCells = Math.max(0, nonNullCells - totalTypeIssues);
  const validityPercentage = Math.max(
    0,
    Math.min(100, Math.round((totalValidCells / nonNullCells) * 1000) / 10)
  );

  const uniquenessPercentage = Math.max(
    0,
    Math.min(100, Math.round((100 - duplicatePercentage) * 10) / 10)
  );

  let consistencyDeductions = 0;
  if (inconsistentCategoricalCols > 0) {
    consistencyDeductions += Math.min(30, inconsistentCategoricalCols * 10);
  }
  if (totalOutliersFound > 0) consistencyDeductions += 10;
  const consistencyPercentage = Math.max(0, Math.min(100, 100 - consistencyDeductions));

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completenessPercentage * 0.35 +
          validityPercentage * 0.25 +
          uniquenessPercentage * 0.2 +
          consistencyPercentage * 0.2
      )
    )
  );

  const scoreBreakdown: QualityScoreBreakdown = {
    completeness: completenessPercentage,
    validity: validityPercentage,
    consistency: consistencyPercentage,
    uniqueness: uniquenessPercentage,
    weights: {
      completeness: 0.35,
      validity: 0.25,
      consistency: 0.2,
      uniqueness: 0.2
    },
    formula:
      'Quality Score = (Completeness × 35%) + (Validity × 25%) + (Consistency × 20%) + (Uniqueness × 20%)'
  };

  const summary: DatasetQualitySummary = {
    dataQualityScore: qualityScore,
    completenessPercentage,
    missingDataCount: totalNullCells,
    missingDataPercentage,
    duplicateRowsCount,
    duplicateRowsPercentage: duplicatePercentage,
    typeIssuesCount: totalTypeIssues,
    potentialOutliersCount: totalOutliersFound,
    grade:
      qualityScore >= 90
        ? 'EXCELLENT'
        : qualityScore >= 75
          ? 'GOOD'
          : qualityScore >= 50
            ? 'FAIR'
            : 'POOR',
    scoreBreakdown,
    dataTypeDistribution
  };

  return {
    datasetId: dataset.id,
    datasetName: dataset.name,
    totalRows,
    totalColumns,
    duplicateRowsCount,
    completenessPercentage,
    dataTypeDistribution,
    qualityScore,
    scoreBreakdown,
    summary,
    columns: columnProfiles,
    warnings,
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * Profiles a dataset, enforcing workspace RBAC, computing all quality metrics,
 * and persisting the resulting profile in `dataset.schemaMeta.dataQualityProfile`.
 */
export async function profileDataset(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string,
  forceRefresh = false
): Promise<DatasetProfileResult> {
  // 1. Fetch dataset (`prisma.dataset.findFirst({ where: { id, organizationId }, include: { columns: true } })`)
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(organizationId);

  const dataset =
    datasetObjectId && organizationObjectId
      ? await DatasetModel.findOne({
          _id: datasetObjectId,
          organizationId: organizationObjectId
        })
          .populate<{
            columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
          }>('columns', 'name dataType nullable ordinalPosition')
          .exec()
      : null;

  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  // 2. Authorize workspace access
  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId?.toString() ?? null, organizationId: dataset.organizationId.toString() },
    userId,
    organizationId,
    userRoleName,
    'READ'
  );

  const serialized = serializeDoc<DatasetProfileSource>(dataset, { virtuals: true });
  const existingMeta = readSchemaMeta(serialized.schemaMeta);

  // 3. Check cached profile if not forcing refresh
  if (!forceRefresh && existingMeta.dataQualityProfile) {
    const cached = existingMeta.dataQualityProfile as DatasetProfileResult;
    if (cached.datasetId === serialized.id && Array.isArray(cached.columns) && cached.columns.length > 0) {
      return cached;
    }
  }

  // 4. Safely obtain rows
  let rows: Record<string, unknown>[] = [];
  try {
    rows = readDatasetRows(serialized, MAX_PROFILE_SAMPLE_ROWS, 0);
  } catch {
    // If the row source fails, fallback to sampleData in metadata safely
    rows = (existingMeta.sampleData || existingMeta.previewRows || []) as Record<string, unknown>[];
  }

  // 5. Compute comprehensive profile
  const profileResult = computeDatasetProfile(serialized, rows);

  // 6. Persist profile in dataset.schemaMeta.dataQualityProfile
  try {
    const updatedMeta = {
      ...existingMeta,
      dataQualityProfile: profileResult
    };
    await DatasetModel.updateOne(
      { _id: dataset._id },
      { $set: { schemaMeta: updatedMeta } }
    ).exec();
  } catch {
    // Non-blocking persistence in case DB is read-only
  }

  // 7. Audit log
  await logAuditEvent({
    organizationId,
    userId,
    action: 'DATASET_PROFILED',
    resourceType: 'Dataset',
    resourceId: datasetId,
    metadata: {
      totalRows: profileResult.totalRows,
      totalColumns: profileResult.totalColumns,
      duplicateRowsCount: profileResult.duplicateRowsCount,
      qualityScore: profileResult.qualityScore,
      warningsCount: profileResult.warnings.length,
      grade: profileResult.summary?.grade
    }
  });

  return profileResult;
}

/**
 * Automatically generates and persists a profile on dataset creation, upload
 * or refresh. Never throws — failures return `null`.
 */
export async function generateAndSaveDatasetProfile(
  datasetId: string,
  organizationId: string
): Promise<DatasetProfileResult | null> {
  try {
    const datasetObjectId = toObjectId(datasetId);
    const organizationObjectId = toObjectId(organizationId);

    const dataset =
      datasetObjectId && organizationObjectId
        ? await DatasetModel.findOne({
            _id: datasetObjectId,
            organizationId: organizationObjectId
          })
            .populate<{
              columns: Array<{ name: string; dataType: string; nullable: boolean; ordinalPosition: number }>;
            }>('columns', 'name dataType nullable ordinalPosition')
            .exec()
        : null;

    if (!dataset) return null;

    const serialized = serializeDoc<DatasetProfileSource>(dataset, { virtuals: true });
    const existingMeta = readSchemaMeta(serialized.schemaMeta);

    let rows: Record<string, unknown>[] = [];
    try {
      rows = readDatasetRows(serialized, MAX_PROFILE_SAMPLE_ROWS, 0);
    } catch {
      rows = (existingMeta.sampleData || existingMeta.previewRows || []) as Record<string, unknown>[];
    }

    const profileResult = computeDatasetProfile(serialized, rows);

    const updatedMeta = {
      ...existingMeta,
      dataQualityProfile: profileResult
    };

    await DatasetModel.updateOne({ _id: dataset._id }, { $set: { schemaMeta: updatedMeta } }).exec();

    return profileResult;
  } catch {
    return null;
  }
}