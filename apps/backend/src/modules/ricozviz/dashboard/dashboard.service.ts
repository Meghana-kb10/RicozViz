// ========================================
// Dashboard Management Service
// ========================================
// Handles dashboard CRUD, multi-tenant isolation,
// layout configuration, sharing links, schedules and
// report snapshots, and audit logging.
// Never exposes credentials or sensitive secrets.
//
// NOTE: this file also ships a self-contained dataset row reader / query
// evaluator (`getDatasetRows`, `executeLocalDatasetQuery`). Dashboard chart
// payloads must be rendered server-side, and reading rows from the Dataset
// document's `schemaMeta` Mixed field keeps the module independent from the
// concurrent dataset service while preserving the legacy response contract.
// ========================================

import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  DashboardModel,
  ChartModel,
  DatasetColumnModel,
  DatasetModel,
  RowLevelSecurityRuleModel,
  ReportModel,
  WorkspaceMemberModel,
  WorkspaceModel,
  toObjectId,
  serializeDoc,
  serializeDocs
} from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  resolveTargetWorkspaceId,
  resolveWorkspaceAccess,
  requireObjectId,
  verifyResourceWorkspaceAccess,
  getDashboardWorkspaceId
} from './dashboard-access.service.js';
import { createDashboardVersionSnapshot } from './dashboard-version.service.js';
import { DASHBOARD_STATUS, DASHBOARD_VISIBILITY, REPORT_FORMAT } from '@repo/types';
import type { IDashboardDocument } from '@repo/database';

/** The dashboard DTO carries an extra computed `layout` array (legacy contract). */
export type SafeDashboardData = DashboardData & { layout: unknown[] };
import type {
  AuthenticatedUser,
  DashboardChart,
  DashboardData,
  DashboardListResponse,
  DatasetQueryFilter,
  DatasetQueryParams,
  DatasetQueryResult,
  QueryResultColumn,
  ShareLinkStatusResponse
} from '@repo/types';

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDashboardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT').optional(),
  visibility: z.enum(['PRIVATE', 'ORGANIZATION', 'PUBLIC']).default('PRIVATE').optional(),
  layoutConfig: z.record(z.unknown()).default({}).optional(),
  layout: z.array(z.record(z.unknown())).optional(),
  workspaceId: z.string().optional().nullable()
});

export const updateDashboardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  visibility: z.enum(['PRIVATE', 'ORGANIZATION', 'PUBLIC']).optional(),
  layoutConfig: z.record(z.unknown()).optional()
});

export const listDashboardsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'ALL']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================
// REQUEST CONTEXT
// ============================================================

/** Everything a service function needs about the caller + transport. */
export interface DashboardRequestContext extends AuthenticatedUser {
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================
// HELPER: BUILD SAFE DASHBOARD RESPONSE
// ============================================================

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date(value as string | number).toISOString();
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

/** Minimal shape accepted by {@link buildSafeDashboard}. */
export interface SafeDashboardSource {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  organizationId: string;
  ownerId: string;
  layoutConfig?: Record<string, unknown> | null;
  shareToken?: string | null;
  shareTokenActive?: boolean;
  sharedAt?: Date | string | null;
  shareExpiresAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  owner?: { id: string; name: string; email: string } | null;
  charts?: DashboardChart[] | null;
  chartCount?: number;
}

export function buildSafeDashboard(dash: SafeDashboardSource): SafeDashboardData {
  const meta = (dash.layoutConfig || {}) as Record<string, unknown>;
  const layout = Array.isArray(meta.layout)
    ? (meta.layout as unknown[])
    : (dash.charts || []).map((chart, index) => ({
        id: chart.id,
        visualizationId: chart.id,
        ...((chart.position as Record<string, unknown>) || {
          x: (index * 6) % 12,
          y: Math.floor(index / 2) * 4,
          w: 6,
          h: 4
        })
      }));

  return {
    id: dash.id,
    name: dash.name,
    description: dash.description,
    status: dash.status as DashboardData['status'],
    visibility: dash.visibility as DashboardData['visibility'],
    organizationId: dash.organizationId,
    ownerId: dash.ownerId,
    ownerName: dash.owner?.name || null,
    ownerEmail: dash.owner?.email || null,
    layoutConfig: dash.layoutConfig || {},
    layout,
    chartCount: dash.chartCount ?? dash.charts?.length ?? 0,
    charts: dash.charts || [],
    shareToken: dash.shareToken || null,
    shareTokenActive: Boolean(dash.shareTokenActive),
    sharedAt: toIsoOrNull(dash.sharedAt),
    shareExpiresAt: toIsoOrNull(dash.shareExpiresAt),
    createdAt: toIso(dash.createdAt),
    updatedAt: toIso(dash.updatedAt)
  };
}

/** Populated owner shape used by the dashboard queries below. */
type PopulatedOwner = { _id: mongoose.Types.ObjectId; name: string; email: string };

function mapOwner(owner?: PopulatedOwner | null): { id: string; name: string; email: string } | null {
  if (!owner) return null;
  return { id: owner._id.toString(), name: owner.name, email: owner.email };
}

/** Batch chart counts for a list of dashboards (avoids the N+1 `_count` query). */
async function countChartsByDashboard(dashboardIds: mongoose.Types.ObjectId[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (dashboardIds.length === 0) return counts;

  const rows = await ChartModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { dashboardId: { $in: dashboardIds } } },
    { $group: { _id: '$dashboardId', count: { $sum: 1 } } }
  ]).exec();

  for (const row of rows) {
    counts.set(row._id.toString(), row.count);
  }
  return counts;
}

/** Serialise a dashboard document (optionally owner-populated) into the safe DTO source. */
function toSafeSource(
  dash: Record<string, unknown>,
  extras: { owner?: PopulatedOwner | null; charts?: DashboardChart[]; chartCount?: number } = {}
): SafeDashboardSource {
  const ownerValue = extras.owner;
  return {
    id: String(dash.id ?? dash._id ?? ''),
    name: String(dash.name ?? ''),
    description: (dash.description ?? null) as string | null,
    status: String(dash.status ?? DASHBOARD_STATUS.DRAFT),
    visibility: String(dash.visibility ?? DASHBOARD_VISIBILITY.PRIVATE),
    organizationId: String(dash.organizationId ?? ''),
    ownerId: String(dash.ownerId ?? ''),
    layoutConfig: (dash.layoutConfig ?? {}) as Record<string, unknown>,
    shareToken: (dash.shareToken ?? null) as string | null,
    shareTokenActive: Boolean(dash.shareTokenActive),
    sharedAt: (dash.sharedAt ?? null) as Date | null,
    shareExpiresAt: (dash.shareExpiresAt ?? null) as Date | null,
    createdAt: dash.createdAt as Date,
    updatedAt: dash.updatedAt as Date,
    owner: mapOwner(ownerValue),
    charts: extras.charts ?? [],
    chartCount: extras.chartCount ?? 0
  };
}

// ============================================================
// LOCAL DATASET ROW READER / QUERY EVALUATOR
// ============================================================

export const QUERY_LIMITS = {
  DEFAULT_ROW_LIMIT: 100,
  MAX_ROW_LIMIT: 1000,
  MAX_OFFSET: 100000,
  MAX_FILTERS: 20,
  MAX_COLUMNS: 50,
  MAX_DIMENSIONS: 10,
  MAX_MEASURES: 20
} as const;

export const ALLOWED_FILTER_OPERATORS = [
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'contains',
  'startsWith',
  'endsWith',
  'isNull',
  'isNotNull',
  'in'
] as const;

export type LocalFilterOperator = (typeof ALLOWED_FILTER_OPERATORS)[number];

export const FILTER_OPERATOR_ALIASES: Record<string, LocalFilterOperator> = {
  in: 'in',
  IN: 'in',
  '=': '=',
  '==': '=',
  equals: '=',
  equal: '=',
  '!=': '!=',
  '<>': '!=',
  'not equals': '!=',
  'not equal': '!=',
  notEquals: '!=',
  '>': '>',
  'greater than': '>',
  greaterThan: '>',
  gt: '>',
  '>=': '>=',
  'greater than or equal': '>=',
  greaterThanOrEqual: '>=',
  gte: '>=',
  '<': '<',
  'less than': '<',
  lessThan: '<',
  lt: '<',
  '<=': '<=',
  'less than or equal': '<=',
  lessThanOrEqual: '<=',
  lte: '<=',
  contains: 'contains',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
  isNull: 'isNull',
  'is empty': 'isNull',
  isEmpty: 'isNull',
  isNotNull: 'isNotNull',
  'is not empty': 'isNotNull',
  isNotEmpty: 'isNotNull'
};

export const ALLOWED_AGGREGATIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const;

export type LocalAggregationFunction = (typeof ALLOWED_AGGREGATIONS)[number];

/**
 * Validates that an identifier contains only alphanumeric characters and
 * underscores. Strictly prevents injection through column/alias names.
 */
export function validateSqlIdentifier(name: string): string {
  const clean = name.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(clean)) {
    throw AppError.badRequest(
      `Invalid SQL identifier: "${name}". Identifiers must start with a letter/underscore and contain only alphanumeric characters.`
    );
  }
  return clean;
}

/** Identity used for RLS evaluation when no principal is attached (public links). */
export interface DatasetSecurityContext {
  userId: string;
  email: string;
  organizationId: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  isOrgAdmin?: boolean;
}

/** Dataset fields the local reader needs. */
export interface DatasetQuerySource {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  type: string;
  schemaMeta: unknown;
}

/** Read the raw row payload stored on the Dataset document's `schemaMeta`. */
export function getDatasetRows(schemaMeta: unknown): Record<string, unknown>[] {
  const meta = (schemaMeta || {}) as Record<string, unknown>;
  const rows = (meta.sampleData ?? meta.previewRows ?? meta.rows ?? []) as Record<
    string,
    unknown
  >[];
  return Array.isArray(rows) ? rows : [];
}

/** Resolve the dataset column catalog from `schemaMeta.columns` + `dataset_columns`. */
export async function getDatasetColumns(
  dataset: DatasetQuerySource
): Promise<Array<{ name: string; type: string; nullable?: boolean }>> {
  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const metaColumns = Array.isArray(meta.columns)
    ? (meta.columns as Array<{ name: string; type?: string; nullable?: boolean }>)
    : [];

  const columnDocs = await DatasetColumnModel.find({ datasetId: dataset._id })
    .sort({ ordinalPosition: 1 })
    .lean()
    .catch(() => []);

  const merged = new Map<string, { name: string; type: string; nullable?: boolean }>();
  for (const column of columnDocs) {
    merged.set(column.name, { name: column.name, type: column.dataType, nullable: column.nullable });
  }
  for (const column of metaColumns) {
    if (!merged.has(column.name)) {
      merged.set(column.name, {
        name: column.name,
        type: column.type || 'string',
        nullable: column.nullable
      });
    }
  }

  if (merged.size === 0) {
    // Fall back to the keys present in the first stored row.
    const [firstRow] = getDatasetRows(dataset.schemaMeta);
    if (firstRow) {
      for (const key of Object.keys(firstRow)) {
        merged.set(key, { name: key, type: typeof firstRow[key] });
      }
    }
  }

  return Array.from(merged.values());
}

interface LocalRlsRule {
  column: string;
  operator: string;
  value: unknown;
  enabled: boolean;
  userId: string | null;
  userEmail: string | null;
  roleId: string | null;
}

/**
 * Resolve the mandatory Row-Level Security filters for a dataset.
 * Mirrors the legacy precedence: explicit targeting > org-admin bypass >
 * role / dataset-wide rules.
 */
export async function resolveUserRlsFilters(
  dataset: DatasetQuerySource,
  user?: DatasetSecurityContext | null
): Promise<DatasetQueryFilter[]> {
  if (!user) return [];

  let rules: LocalRlsRule[] = [];

  const ruleDocs = await RowLevelSecurityRuleModel.find({
    datasetId: dataset._id,
    organizationId: dataset.organizationId,
    enabled: true
  })
    .lean()
    .catch(() => []);

  rules = ruleDocs.map((rule) => ({
    column: rule.column,
    operator: rule.operator,
    value: rule.value,
    enabled: rule.enabled,
    userId: rule.userId ? rule.userId.toString() : null,
    userEmail: rule.userEmail,
    roleId: rule.roleId ? rule.roleId.toString() : null
  }));

  // Also check dataset.schemaMeta.rlsRules when the collection has no rows
  if (rules.length === 0) {
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    if (Array.isArray(meta.rlsRules)) {
      rules = (meta.rlsRules as Array<Partial<LocalRlsRule>>)
        .map((rule) => ({
          column: String(rule.column ?? ''),
          operator: String(rule.operator ?? 'EQUALS'),
          value: rule.value,
          enabled: rule.enabled ?? true,
          userId: rule.userId ?? null,
          userEmail: rule.userEmail ?? null,
          roleId: rule.roleId ?? null
        }))
        .filter((rule) => rule.enabled && rule.column);
    }
  }

  if (rules.length === 0) return [];

  const isExplicitlyTargeted = (rule: LocalRlsRule): boolean => {
    if (rule.userId && rule.userId === user.userId) return true;
    if (rule.userEmail && rule.userEmail.toLowerCase() === String(user.email).toLowerCase()) return true;
    return false;
  };
  const isRoleTargeted = (rule: LocalRlsRule): boolean =>
    Boolean(rule.roleId) && (rule.roleId === user.roleId || rule.roleId === user.roleName);
  const isUniversalRule = (rule: LocalRlsRule): boolean =>
    !rule.userId && !rule.userEmail && !rule.roleId;

  const isOrgAdmin = user.roleName === 'ADMIN' || Boolean(user.isOrgAdmin);
  const applicableRules = rules.filter((rule) => {
    if (isExplicitlyTargeted(rule)) return true;
    if (isOrgAdmin) return false;
    return isRoleTargeted(rule) || isUniversalRule(rule);
  });

  const RLS_OPERATOR_MAP: Record<string, LocalFilterOperator> = {
    EQUALS: '=',
    NOT_EQUALS: '!=',
    GREATER_THAN: '>',
    LESS_THAN: '<',
    CONTAINS: 'contains',
    IN: 'in',
    NOT_IN: '!='
  };

  return applicableRules.map((rule) => ({
    column: rule.column,
    operator: RLS_OPERATOR_MAP[String(rule.operator).toUpperCase()] ?? ('=' as LocalFilterOperator),
    value: rule.value
  })) as DatasetQueryFilter[];
}

/** Coerce a raw filter value to the column's declared type. */
function coerceFilterValue(
  colType: string,
  operator: LocalFilterOperator,
  value: unknown,
  colName: string
): unknown {
  if (operator === 'isNull' || operator === 'isNotNull') {
    return null;
  }

  if (value === undefined || value === null) {
    throw AppError.badRequest(
      `Filter value is required for operator "${operator}" on column "${colName}"`
    );
  }

  if (operator === 'in') {
    let items: unknown[] = [];
    if (Array.isArray(value)) {
      items = value;
    } else if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        items = Array.isArray(parsed) ? parsed : [value];
      } catch {
        items = value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
    } else {
      items = [value];
    }

    if (colType === 'number' || colType === 'integer') {
      return items.map((entry) => {
        const num = Number(entry);
        if (Number.isNaN(num)) {
          throw AppError.badRequest(
            `Filter value contains non-numeric element for column "${colName}"`
          );
        }
        return colType === 'integer' ? Math.round(num) : num;
      });
    }
    return items.map((entry) => String(entry));
  }

  if (colType === 'integer') {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      return parseInt(value.trim(), 10);
    }
    throw AppError.badRequest(`Filter value for integer column "${colName}" must be a valid integer`);
  }

  if (colType === 'number') {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(value.trim())) {
      const parsed = parseFloat(value.trim());
      if (!Number.isNaN(parsed)) return parsed;
    }
    throw AppError.badRequest(
      `Filter value for numeric column "${colName}" must be a valid number`
    );
  }

  if (colType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    throw AppError.badRequest(`Filter value for boolean column "${colName}" must be a boolean`);
  }

  if (colType === 'date') {
    const parsed = new Date(value as string | number | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw AppError.badRequest(`Filter value for date column "${colName}" must be a valid date`);
    }
    return parsed.toISOString();
  }

  return String(value);
}

/**
 * Execute a bounded, validated query against a dataset's stored rows.
 *
 * Ported from the legacy in-memory query engine: allow-listed operators and
 * aggregations, mandatory RLS, validated dimensions/measures/columns/filters,
 * optional ordering and pagination.
 */
export async function executeLocalDatasetQuery(
  dataset: DatasetQuerySource,
  params: DatasetQueryParams = {},
  securityContext?: DatasetSecurityContext | null
): Promise<DatasetQueryResult> {
  const startTime = Date.now();

  // 0. Resolve Row-Level Security (RLS) constraints for the requesting user
  const rlsFilters = await resolveUserRlsFilters(dataset, securityContext);

  // 1. Extract schema metadata and known columns
  const columns = await getDatasetColumns(dataset);
  const columnTypeMap = new Map<string, string>();
  for (const column of columns) {
    columnTypeMap.set(column.name, String(column.type || 'string').toLowerCase());
  }

  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const calculatedFields = Array.isArray(meta.calculatedFields)
    ? (meta.calculatedFields as Array<{ name: string; dataType?: string }>)
    : [];
  for (const field of calculatedFields) {
    if (!columnTypeMap.has(field.name)) {
      columnTypeMap.set(field.name, String(field.dataType || 'NUMBER').toLowerCase());
    }
  }

  const knownColumnNames = Array.from(columnTypeMap.keys());

  // 2. Normalize aliases for dimensions, measures, sorting
  const rawDimensions = (params.dimensions || params.groupBy || []).filter(Boolean);

  let rawMeasures: Array<{ column: string; aggregation: string; alias?: string }> = [];
  if (Array.isArray(params.measures) && params.measures.length > 0) {
    rawMeasures = params.measures;
  } else if (Array.isArray(params.aggregations) && params.aggregations.length > 0) {
    rawMeasures = params.aggregations.map((aggregation) => {
      const rawFn = String(aggregation.function || aggregation.aggregation || 'COUNT').toUpperCase();
      const fn = (ALLOWED_AGGREGATIONS as readonly string[]).includes(rawFn)
        ? rawFn
        : 'COUNT';
      const col = aggregation.column ?? '*';
      return {
        column: col,
        aggregation: fn,
        alias:
          aggregation.alias ||
          (col === '*' ? `${fn.toLowerCase()}_count` : `${fn.toLowerCase()}_${col}`)
      };
    });
  }

  let rawOrderBy = params.orderBy;
  if (!rawOrderBy) {
    if (params.sort) {
      rawOrderBy = Array.isArray(params.sort) ? params.sort[0] : (params.sort as never);
    } else if (params.sorting) {
      if (Array.isArray(params.sorting) && params.sorting.length > 0) {
        rawOrderBy = params.sorting[0];
      } else if (typeof params.sorting === 'object') {
        rawOrderBy = params.sorting as never;
      }
    }
  }

  // 3. Validate row limits & offset
  const requestedLimit = params.limit ?? QUERY_LIMITS.DEFAULT_ROW_LIMIT;
  if (requestedLimit > QUERY_LIMITS.MAX_ROW_LIMIT) {
    throw AppError.badRequest(
      `Requested limit ${requestedLimit} exceeds maximum allowable limit of ${QUERY_LIMITS.MAX_ROW_LIMIT}`
    );
  }
  const limit = Math.min(Math.max(requestedLimit, 1), QUERY_LIMITS.MAX_ROW_LIMIT);

  const requestedOffset = params.offset ?? 0;
  if (requestedOffset < 0 || requestedOffset > QUERY_LIMITS.MAX_OFFSET) {
    throw AppError.badRequest(`Invalid offset: must be between 0 and ${QUERY_LIMITS.MAX_OFFSET}`);
  }
  const offset = requestedOffset;

  // 4. Determine Query Mode (Raw vs Aggregate)
  const isAggregate = rawDimensions.length > 0 || rawMeasures.length > 0;

  // 5. Validate dimensions/measures (aggregate) or columns (raw)
  const validatedDimensions: string[] = [];
  const validatedMeasures: Array<{
    column: string;
    aggregation: LocalAggregationFunction;
    alias: string;
    resultType: string;
  }> = [];

  let selectedColumns: string[] = [];

  if (isAggregate) {
    if (rawDimensions.length > QUERY_LIMITS.MAX_DIMENSIONS) {
      throw AppError.badRequest(
        `Dimensions count (${rawDimensions.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_DIMENSIONS})`
      );
    }
    for (const dimension of rawDimensions) {
      if (!knownColumnNames.includes(dimension)) {
        throw AppError.badRequest(`Dimension column "${dimension}" does not exist in dataset schema`);
      }
      validateSqlIdentifier(dimension);
      validatedDimensions.push(dimension);
    }

    if (rawMeasures.length > QUERY_LIMITS.MAX_MEASURES) {
      throw AppError.badRequest(
        `Measures count (${rawMeasures.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_MEASURES})`
      );
    }
    for (const measure of rawMeasures) {
      if (measure.column !== '*' && !knownColumnNames.includes(measure.column)) {
        throw AppError.badRequest(
          `Measure column "${measure.column}" does not exist in dataset schema`
        );
      }
      if (measure.column !== '*') {
        validateSqlIdentifier(measure.column);
      }

      if (!(ALLOWED_AGGREGATIONS as readonly string[]).includes(measure.aggregation)) {
        throw AppError.badRequest(`Unsupported aggregation function "${measure.aggregation}"`);
      }

      // Type compatibility for SUM and AVG
      if (measure.column !== '*') {
        const colType = columnTypeMap.get(measure.column) || 'string';
        if (
          (measure.aggregation === 'SUM' || measure.aggregation === 'AVG') &&
          colType !== 'number' &&
          colType !== 'integer'
        ) {
          throw AppError.badRequest(
            `Aggregation "${measure.aggregation}" cannot be applied to non-numeric column "${measure.column}" (type: ${colType})`
          );
        }
      }

      const defaultAlias = `${measure.aggregation.toLowerCase()}_${
        measure.column === '*' ? 'count' : measure.column
      }`;
      const finalAlias = measure.alias ? validateSqlIdentifier(measure.alias) : defaultAlias;

      let resultType = 'number';
      if (measure.aggregation === 'COUNT') {
        resultType = 'integer';
      } else if (measure.aggregation === 'MIN' || measure.aggregation === 'MAX') {
        resultType = columnTypeMap.get(measure.column) || 'string';
      }

      validatedMeasures.push({
        column: measure.column,
        aggregation: measure.aggregation as LocalAggregationFunction,
        alias: finalAlias,
        resultType
      });
    }
  } else if (params.columns && params.columns.length > 0) {
    if (params.columns.length > QUERY_LIMITS.MAX_COLUMNS) {
      throw AppError.badRequest(
        `Requested column count (${params.columns.length}) exceeds limit of ${QUERY_LIMITS.MAX_COLUMNS}`
      );
    }
    for (const column of params.columns) {
      if (!knownColumnNames.includes(column)) {
        throw AppError.badRequest(`Requested column "${column}" does not exist in dataset schema`);
      }
      validateSqlIdentifier(column);
    }
    selectedColumns = params.columns;
  } else {
    selectedColumns = knownColumnNames;
  }

  // 6. Validate filters
  const validatedFilters: DatasetQueryFilter[] = [];
  if (params.filters && params.filters.length > 0) {
    if (params.filters.length > QUERY_LIMITS.MAX_FILTERS) {
      throw AppError.badRequest(
        `Filter count (${params.filters.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_FILTERS})`
      );
    }

    for (const filter of params.filters) {
      const colName = String(
        filter.column || (filter as unknown as { field?: string }).field || ''
      );
      if (!knownColumnNames.includes(colName)) {
        throw AppError.badRequest(`Filter column "${colName}" does not exist in dataset schema`);
      }
      const rawOp = filter.operator;
      const alias =
        typeof rawOp === 'string'
          ? FILTER_OPERATOR_ALIASES[rawOp] || FILTER_OPERATOR_ALIASES[rawOp.toLowerCase()]
          : undefined;
      const op = alias || rawOp;

      if (!(ALLOWED_FILTER_OPERATORS as readonly string[]).includes(op)) {
        throw AppError.badRequest(`Unsupported filter operator: "${rawOp}"`);
      }

      const colType = columnTypeMap.get(colName) || 'string';
      const validatedValue = coerceFilterValue(colType, op as LocalFilterOperator, filter.value, colName);

      validatedFilters.push({
        column: colName,
        operator: op as LocalFilterOperator,
        value: validatedValue
      });
    }
  }

  const filterLogic: 'AND' | 'OR' =
    String(params.filterLogic || params.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';

  // 7. Validate ordering
  let validatedOrderBy: { column: string; direction: 'asc' | 'desc' } | undefined;
  if (rawOrderBy) {
    const orderCol = rawOrderBy.column;
    const orderDir = String(rawOrderBy.direction).toLowerCase() === 'desc' ? 'desc' : 'asc';

    if (isAggregate) {
      const validOrderCols = [
        ...validatedDimensions,
        ...validatedMeasures.map((measure) => measure.alias),
        ...validatedMeasures.map((measure) => measure.column)
      ];
      if (!validOrderCols.includes(orderCol)) {
        throw AppError.badRequest(
          `Order by column "${orderCol}" must be one of the selected dimensions or measure aliases`
        );
      }
    } else if (!knownColumnNames.includes(orderCol)) {
      throw AppError.badRequest(`Order by column "${orderCol}" does not exist in dataset schema`);
    }

    validateSqlIdentifier(orderCol);
    validatedOrderBy = { column: orderCol, direction: orderDir };
  }

  // 8. Evaluate against the stored rows
  const sourceRows = getDatasetRows(dataset.schemaMeta);

  const evalFilterCondition = (
    filter: DatasetQueryFilter,
    row: Record<string, unknown>
  ): boolean => {
    const val = row[filter.column];
    const operator = filter.operator as LocalFilterOperator;

    if (operator === 'isNull') return val === null || val === undefined;
    if (operator === 'isNotNull') return val !== null && val !== undefined;
    if (val === null || val === undefined) return false;

    const colType = columnTypeMap.get(filter.column) || 'string';

    if (colType === 'number' || colType === 'integer') {
      const numVal = Number(val);
      const filterVal = Number(filter.value);
      if (operator === '=') return numVal === filterVal;
      if (operator === '!=') return numVal !== filterVal;
      if (operator === '>') return numVal > filterVal;
      if (operator === '>=') return numVal >= filterVal;
      if (operator === '<') return numVal < filterVal;
      if (operator === '<=') return numVal <= filterVal;
    }

    if (colType === 'date') {
      const rowTime = new Date(val as string | number | Date).getTime();
      const filterTime = new Date(filter.value as string | number | Date).getTime();
      if (operator === '=') return rowTime === filterTime;
      if (operator === '!=') return rowTime !== filterTime;
      if (operator === '>') return rowTime > filterTime;
      if (operator === '>=') return rowTime >= filterTime;
      if (operator === '<') return rowTime < filterTime;
      if (operator === '<=') return rowTime <= filterTime;
    }

    if (colType === 'boolean') {
      const boolVal = Boolean(val);
      const filterBool = Boolean(filter.value);
      if (operator === '=') return boolVal === filterBool;
      if (operator === '!=') return boolVal !== filterBool;
    }

    const strVal = String(val).toLowerCase();
    const filterStr = String(filter.value ?? '').toLowerCase();

    if (operator === '=') return strVal === filterStr;
    if (operator === '!=') return strVal !== filterStr;
    if (operator === '>') return strVal > filterStr;
    if (operator === '>=') return strVal >= filterStr;
    if (operator === '<') return strVal < filterStr;
    if (operator === '<=') return strVal <= filterStr;
    if (operator === 'contains') return strVal.includes(filterStr);
    if (operator === 'startsWith') return strVal.startsWith(filterStr);
    if (operator === 'endsWith') return strVal.endsWith(filterStr);
    if (operator === 'in') {
      const rawList = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (colType === 'number' || colType === 'integer') {
        return rawList.map((entry) => Number(entry)).includes(Number(val));
      }
      return rawList.map((entry) => String(entry).toLowerCase()).includes(String(val).toLowerCase());
    }

    return false;
  };

  // Mandatory RLS: drop every row failing the policy.
  let permittedSourceRows = sourceRows;
  if (rlsFilters.length > 0) {
    permittedSourceRows = sourceRows.filter((row) =>
      rlsFilters.every((filter) => evalFilterCondition(filter, row))
    );
  }

  const filteredRows =
    validatedFilters.length === 0
      ? permittedSourceRows
      : permittedSourceRows.filter((row) =>
          filterLogic === 'OR'
            ? validatedFilters.some((filter) => evalFilterCondition(filter, row))
            : validatedFilters.every((filter) => evalFilterCondition(filter, row))
        );

  let processedRows: Record<string, unknown>[] = [];
  const resultColumns: QueryResultColumn[] = [];

  if (isAggregate) {
    for (const dimension of validatedDimensions) {
      resultColumns.push({ name: dimension, type: columnTypeMap.get(dimension) || 'string' });
    }
    for (const measure of validatedMeasures) {
      resultColumns.push({ name: measure.alias, type: measure.resultType });
    }

    const groups = new Map<string, { dims: Record<string, unknown>; rows: Record<string, unknown>[] }>();

    if (validatedDimensions.length === 0) {
      groups.set('all', { dims: {}, rows: filteredRows });
    } else {
      for (const row of filteredRows) {
        const dimObj: Record<string, unknown> = {};
        for (const dimension of validatedDimensions) {
          dimObj[dimension] = row[dimension] ?? null;
        }
        const groupKey = JSON.stringify(dimObj);

        if (!groups.has(groupKey)) {
          groups.set(groupKey, { dims: dimObj, rows: [] });
        }
        groups.get(groupKey)!.rows.push(row);
      }
    }

    for (const group of groups.values()) {
      const aggregatedRow: Record<string, unknown> = { ...group.dims };

      for (const measure of validatedMeasures) {
        if (measure.aggregation === 'COUNT') {
          aggregatedRow[measure.alias] =
            measure.column === '*'
              ? group.rows.length
              : group.rows.filter(
                  (row) => row[measure.column] !== null && row[measure.column] !== undefined
                ).length;
        } else if (measure.aggregation === 'SUM') {
          const sum = group.rows.reduce<number>((acc, row) => {
            const value = Number(row[measure.column]);
            return !Number.isNaN(value) ? acc + value : acc;
          }, 0);
          aggregatedRow[measure.alias] = Math.round(sum * 1000) / 1000;
        } else if (measure.aggregation === 'AVG') {
          const validValues = group.rows
            .map((row) => Number(row[measure.column]))
            .filter((value) => !Number.isNaN(value));
          const avg =
            validValues.length > 0
              ? validValues.reduce((a, b) => a + b, 0) / validValues.length
              : 0;
          aggregatedRow[measure.alias] = Math.round(avg * 1000) / 1000;
        } else if (measure.aggregation === 'MIN') {
          const values = group.rows
            .map((row) => row[measure.column])
            .filter((value) => value !== null && value !== undefined);
          aggregatedRow[measure.alias] =
            values.length > 0 ? values.reduce((min, current) => (current < min ? current : min)) : null;
        } else if (measure.aggregation === 'MAX') {
          const values = group.rows
            .map((row) => row[measure.column])
            .filter((value) => value !== null && value !== undefined);
          aggregatedRow[measure.alias] =
            values.length > 0 ? values.reduce((max, current) => (current > max ? current : max)) : null;
        }
      }

      processedRows.push(aggregatedRow);
    }
  } else {
    for (const column of selectedColumns) {
      resultColumns.push({ name: column, type: columnTypeMap.get(column) || 'string' });
    }

    processedRows = filteredRows.map((row) => {
      const projected: Record<string, unknown> = {};
      for (const column of selectedColumns) {
        projected[column] = row[column] ?? null;
      }
      return projected;
    });
  }

  if (validatedOrderBy) {
    const { column, direction } = validatedOrderBy;
    const factor = direction === 'desc' ? -1 : 1;
    processedRows.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * factor;
      }
      return (valA as never) > (valB as never) ? factor : -factor;
    });
  }

  const total = processedRows.length;
  const sliced = processedRows.slice(offset, offset + limit);
  const executionTimeMs = Date.now() - startTime;

  return {
    columns: resultColumns,
    rows: sliced,
    processedColumns: resultColumns,
    processedRows: sliced,
    rowCount: sliced.length,
    total,
    limit,
    offset,
    executionTimeMs,
    metadata: {
      rowCount: sliced.length,
      total,
      limit,
      offset,
      executionTimeMs,
      queryMode: isAggregate ? 'AGGREGATE' : 'RAW'
    }
  };
}

/** Load a dataset document shaped for the local query evaluator. */
export async function loadDatasetForQuery(datasetId: mongoose.Types.ObjectId): Promise<DatasetQuerySource | null> {
  const dataset = await DatasetModel.findById(datasetId).lean().catch(() => null);
  if (!dataset) return null;
  return {
    _id: dataset._id,
    organizationId: dataset.organizationId,
    name: dataset.name,
    type: dataset.type,
    schemaMeta: dataset.schemaMeta
  };
}

// ============================================================
// DASHBOARD CRUD
// ============================================================

/**
 * POST /api/v1/dashboards — create a new dashboard.
 */
export async function createDashboard(
  ctx: DashboardRequestContext,
  input: z.infer<typeof createDashboardSchema>
): Promise<DashboardData> {
  const { organizationId, userId, roleName } = ctx;

  const workspaceId = await resolveTargetWorkspaceId(
    input.workspaceId,
    userId,
    organizationId,
    roleName
  );

  const initialLayoutConfig: Record<string, unknown> = { ...(input.layoutConfig || {}) };
  if (workspaceId) initialLayoutConfig.workspaceId = workspaceId;
  if (Array.isArray(input.layout)) {
    initialLayoutConfig['layout'] = input.layout;
  }
  if (input.workspaceId) {
    initialLayoutConfig['workspaceId'] = input.workspaceId;
    await verifyResourceWorkspaceAccess(
      { workspaceId: input.workspaceId, organizationId },
      userId,
      organizationId,
      roleName,
      'WRITE'
    );
  }

  const dashboard = await DashboardModel.create({
    organizationId: requireObjectId(organizationId, 'Organization'),
    ownerId: requireObjectId(userId, 'User'),
    name: input.name,
    description: input.description || null,
    status: (input.status as string) || DASHBOARD_STATUS.DRAFT,
    visibility: (input.visibility as string) || DASHBOARD_VISIBILITY.PRIVATE,
    layoutConfig: initialLayoutConfig
  });

  const dashboardId = dashboard._id;

  if (Array.isArray(input.layout)) {
    for (const item of input.layout) {
      const vizId = (item.visualizationId || item.chartId) as string | undefined;
      if (vizId) {
        await ChartModel.updateMany({ _id: toObjectId(vizId) }, { $set: { dashboardId } })
          .catch(() => null);
      }
    }

    const defaultStudio = await DashboardModel.findOne({
      organizationId: toObjectId(organizationId),
      name: 'Visualizations Studio'
    }).lean();

    if (defaultStudio) {
      const studioCharts = await ChartModel.countDocuments({
        dashboardId: defaultStudio._id
      }).exec();
      if (studioCharts === 0) {
        await DashboardModel.deleteOne({ _id: defaultStudio._id }).catch(() => null);
      }
    }
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DASHBOARD_CREATED',
    resourceType: 'Dashboard',
    resourceId: dashboardId.toString(),
    metadata: {
      name: dashboard.name,
      status: dashboard.status,
      visibility: dashboard.visibility
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  void createDashboardVersionSnapshot(
    dashboardId.toString(),
    'Initial dashboard creation',
    userId,
    ctx.email,
    ctx.roleName
  );

  const chartCount = await ChartModel.countDocuments({ dashboardId }).exec();
  const owner = await dashboard.populate<{ ownerId: PopulatedOwner }>('ownerId', 'name email');

  return buildSafeDashboard(
    toSafeSource(
      {
        ...(dashboard.toObject() as unknown as Record<string, unknown>),
        organizationId,
        ownerId: userId
      },
      { owner: owner.ownerId, chartCount }
    )
  );
}

/**
 * GET /api/v1/dashboards — list dashboards belonging to the user's organization.
 */
export async function listDashboards(
  ctx: DashboardRequestContext,
  query: z.infer<typeof listDashboardsQuerySchema>
): Promise<DashboardListResponse> {
  const { organizationId, userId, roleName } = ctx;

  const filter: mongoose.QueryFilter<IDashboardDocument> = {
    organizationId: requireObjectId(organizationId, 'Organization')
  };

  if (query.status && query.status !== 'ALL') {
    filter.status = query.status;
  }

  if (query.search) {
    const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { description: rx }];
  }

  let accessibleWorkspaceIds: Set<string> | null = null;
  if (roleName !== 'ADMIN') {
    const userObjectId = toObjectId(userId);
    const organizationObjectId = toObjectId(organizationId);
    const workspaces = await WorkspaceModel.find({ organizationId: organizationObjectId })
      .select('_id')
      .lean();
    const workspaceIds = workspaces.map((workspace) => workspace._id);

    const memberships =
      userObjectId && workspaceIds.length > 0
        ? await WorkspaceMemberModel.find({
            userId: userObjectId,
            workspaceId: { $in: workspaceIds }
          })
            .select('workspaceId')
            .lean()
        : [];

    accessibleWorkspaceIds = new Set(memberships.map((member) => member.workspaceId.toString()));
  }

  // Dashboard workspace bindings live in layoutConfig for compatibility with
  // the original schema. Filter before pagination so users cannot infer or
  // access another workspace's dashboards through collection endpoints.
  const allDashboards = await DashboardModel.find(filter)
    .sort({ [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1 })
    .populate<{ ownerId: PopulatedOwner }>('ownerId', 'name email')
    .lean();

  const visibleDashboards = allDashboards.filter((dashboard) => {
    const dashboardWorkspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);
    return (
      !dashboardWorkspaceId ||
      accessibleWorkspaceIds === null ||
      accessibleWorkspaceIds.has(dashboardWorkspaceId)
    );
  });

  const skip = (query.page - 1) * query.limit;
  const pageSlice = visibleDashboards.slice(skip, skip + query.limit);
  const total = visibleDashboards.length;

  const chartCounts = await countChartsByDashboard(pageSlice.map((dashboard) => dashboard._id));

  return {
    dashboards: pageSlice.map((dashboard) =>
      buildSafeDashboard(
        toSafeSource(serializeDoc<Record<string, unknown>>(dashboard), {
          owner: dashboard.ownerId as unknown as PopulatedOwner,
          chartCount: chartCounts.get(dashboard._id.toString()) ?? 0
        })
      )
    ),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1
    }
  };
}

/**
 * GET /api/v1/dashboards/:id — retrieve a single dashboard with layout and charts.
 */
export async function getDashboardById(
  ctx: DashboardRequestContext,
  id: string
): Promise<DashboardData> {
  const { organizationId, userId, roleName } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(id);
  if (!dashboardObjectId) {
    throw AppError.notFound('Dashboard');
  }

  const dashboard = await DashboardModel.findById(dashboardObjectId)
    .populate<{ ownerId: PopulatedOwner }>('ownerId', 'name email')
    .lean();

  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  if (dashboard.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: getDashboardWorkspaceId(dashboard.layoutConfig),
      organizationId: dashboard.organizationId.toString()
    },
    userId,
    organizationId,
    roleName,
    'READ'
  );

  const charts = await ChartModel.find({ dashboardId: dashboardObjectId })
    .sort({ sortOrder: 1 })
    .lean();

  const dashboardCharts: DashboardChart[] = serializeDocs<DashboardChart>(charts);

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DASHBOARD_VIEWED',
    resourceType: 'Dashboard',
    resourceId: dashboard._id.toString(),
    metadata: {
      name: dashboard.name,
      chartCount: dashboardCharts.length
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return buildSafeDashboard(
    toSafeSource(serializeDoc<Record<string, unknown>>(dashboard), {
      owner: dashboard.ownerId as unknown as PopulatedOwner,
      charts: dashboardCharts,
      chartCount: dashboardCharts.length
    })
  );
}

/**
 * PATCH /api/v1/dashboards/:id — update dashboard metadata, layout config, or status.
 */
export async function updateDashboard(
  ctx: DashboardRequestContext,
  id: string,
  input: z.infer<typeof updateDashboardSchema>
): Promise<DashboardData> {
  const { organizationId, userId, roleName } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(id);
  const existing = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId).lean()
    : null;

  if (!existing) {
    throw AppError.notFound('Dashboard');
  }

  if (existing.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  const workspaceId = getDashboardWorkspaceId(existing.layoutConfig);
  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (input.layoutConfig !== undefined) {
    const nextLayoutConfig = { ...input.layoutConfig };
    const existingWorkspaceId = getDashboardWorkspaceId(existing.layoutConfig);
    const requestedWorkspaceId = getDashboardWorkspaceId(nextLayoutConfig);
    if (requestedWorkspaceId && requestedWorkspaceId !== existingWorkspaceId) {
      await verifyResourceWorkspaceAccess(
        { workspaceId: requestedWorkspaceId, organizationId },
        userId,
        organizationId,
        roleName,
        'WRITE'
      );
    }
    if (existingWorkspaceId) nextLayoutConfig.workspaceId = existingWorkspaceId;
    data.layoutConfig = nextLayoutConfig;
  }

  const updated = await DashboardModel.findByIdAndUpdate(
    existing._id,
    { $set: data },
    { new: true }
  )
    .populate<{ ownerId: PopulatedOwner }>('ownerId', 'name email')
    .lean();

  if (!updated) {
    throw AppError.notFound('Dashboard');
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DASHBOARD_UPDATED',
    resourceType: 'Dashboard',
    resourceId: updated._id.toString(),
    metadata: {
      name: updated.name,
      updatedFields: Object.keys(data)
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  void createDashboardVersionSnapshot(
    updated._id.toString(),
    input.name ? `Updated name to "${input.name}"` : 'Updated dashboard layout and configuration',
    userId,
    ctx.email,
    ctx.roleName
  );

  const chartCount = await ChartModel.countDocuments({ dashboardId: updated._id }).exec();

  return buildSafeDashboard(
    toSafeSource(serializeDoc<Record<string, unknown>>(updated), {
      owner: updated.ownerId as unknown as PopulatedOwner,
      chartCount
    })
  );
}

/**
 * DELETE /api/v1/dashboards/:id — delete a dashboard and cascade related items safely.
 */
export async function deleteDashboard(
  ctx: DashboardRequestContext,
  id: string
): Promise<{ message: string }> {
  const { organizationId, userId, roleName } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(id);
  const existing = dashboardObjectId ? await DashboardModel.findById(dashboardObjectId).lean() : null;

  if (!existing) {
    throw AppError.notFound('Dashboard');
  }

  if (existing.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  const deleteWsId = getDashboardWorkspaceId(existing.layoutConfig);
  await verifyResourceWorkspaceAccess(
    { workspaceId: deleteWsId, organizationId },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  if (existing.ownerId.toString() !== userId && roleName !== 'ADMIN') {
    if (deleteWsId) {
      const access = await resolveWorkspaceAccess(deleteWsId, userId, organizationId, roleName);
      if (
        access.userRole !== 'OWNER' &&
        access.userRole !== 'ADMIN' &&
        !access.isOrgAdmin
      ) {
        throw AppError.forbidden('Only workspace owners or admins can delete this dashboard');
      }
    }
  }

  // Delete associated reports first to satisfy the foreign key constraint
  await ReportModel.deleteMany({ dashboardId: existing._id }).exec();

  await DashboardModel.deleteOne({ _id: existing._id }).exec();

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DASHBOARD_DELETED',
    resourceType: 'Dashboard',
    resourceId: id,
    metadata: {
      name: existing.name
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return { message: 'Dashboard deleted successfully' };
}

// ============================================================
// DASHBOARD SHARING
// ============================================================

/**
 * POST /api/v1/dashboards/:id/share — generate or activate a secure share token.
 */
export async function createShareLink(
  ctx: DashboardRequestContext,
  id: string,
  body: { expiresAt?: unknown } = {}
): Promise<ShareLinkStatusResponse> {
  const { organizationId, userId, roleName } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(id);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId).lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  if (dashboard.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: dashboard belongs to a different organization');
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: getDashboardWorkspaceId(dashboard.layoutConfig),
      organizationId: dashboard.organizationId.toString()
    },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  const expiresAtInput = body?.expiresAt;
  let shareExpiresAt: Date | null = null;
  if (expiresAtInput !== undefined && expiresAtInput !== null && String(expiresAtInput).trim()) {
    shareExpiresAt = new Date(String(expiresAtInput));
    if (Number.isNaN(shareExpiresAt.getTime()) || shareExpiresAt.getTime() <= Date.now()) {
      throw AppError.badRequest('Share expiration must be a valid future date');
    }
  }

  // Generate 48-char cryptographically secure token
  const shareToken = crypto.randomBytes(24).toString('hex');

  const updated = await DashboardModel.findByIdAndUpdate(
    dashboardObjectId,
    {
      $set: {
        shareToken,
        shareTokenActive: true,
        sharedAt: new Date(),
        shareExpiresAt
      }
    },
    { new: true }
  ).lean();

  if (!updated) {
    throw AppError.notFound('Dashboard');
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DASHBOARD_UPDATED',
    resourceType: 'Dashboard',
    resourceId: id,
    metadata: {
      action: 'SHARE_LINK_CREATED',
      shareToken: updated.shareToken
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return {
    shareToken: updated.shareToken,
    shareTokenActive: updated.shareTokenActive,
    sharedAt: toIsoOrNull(updated.sharedAt),
    active: updated.shareTokenActive,
    token: updated.shareToken,
    shareUrl: `/dashboards/shared/${updated.shareToken}`,
    shareExpiresAt: toIsoOrNull(updated.shareExpiresAt)
  };
}

/**
 * GET /api/v1/dashboards/:id/share — retrieve the current share status.
 */
export async function getShareLinkStatus(
  ctx: DashboardRequestContext,
  id: string
): Promise<ShareLinkStatusResponse> {
  const { organizationId, userId, roleName } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(id);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId)
        .select('organizationId shareToken shareTokenActive sharedAt layoutConfig shareExpiresAt')
        .lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  if (dashboard.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: dashboard belongs to a different organization');
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: getDashboardWorkspaceId(dashboard.layoutConfig),
      organizationId: dashboard.organizationId.toString()
    },
    userId,
    organizationId,
    roleName,
    'READ'
  );

  return {
    shareToken: dashboard.shareToken,
    shareTokenActive: dashboard.shareTokenActive,
    sharedAt: toIsoOrNull(dashboard.sharedAt),
    active: dashboard.shareTokenActive,
    token: dashboard.shareToken,
    shareUrl:
      dashboard.shareTokenActive && dashboard.shareToken
        ? `/dashboards/shared/${dashboard.shareToken}`
        : null,
    shareExpiresAt: toIsoOrNull(dashboard.shareExpiresAt)
  };
}

/**
 * DELETE /api/v1/dashboards/:id/share — disable the active share link.
 */
export async function disableShareLink(
  ctx: DashboardRequestContext,
  id: string
): Promise<{ message: string; shareTokenActive: boolean; active: boolean }> {
  const { organizationId, userId, roleName } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(id);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId).lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  if (dashboard.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: dashboard belongs to a different organization');
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: getDashboardWorkspaceId(dashboard.layoutConfig),
      organizationId: dashboard.organizationId.toString()
    },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  await DashboardModel.updateOne(
    { _id: dashboardObjectId },
    { $set: { shareTokenActive: false } }
  ).exec();

  await logAuditEvent({
    organizationId,
    userId,
    action: 'DASHBOARD_UPDATED',
    resourceType: 'Dashboard',
    resourceId: id,
    metadata: {
      action: 'SHARE_LINK_DISABLED'
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return {
    message: 'Share link disabled successfully',
    shareTokenActive: false,
    active: false
  };
}

// ============================================================
// PUBLIC SHARED DASHBOARD
// ============================================================

/** Lean dashboard document shape returned by the share-token loader. */
interface SharedDashboardDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  layoutConfig: Record<string, unknown>;
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Load a dashboard by its public share token and assert the link is usable. */
async function loadDashboardByShareToken(shareToken: string): Promise<SharedDashboardDoc> {
  const dashboard = await DashboardModel.findOne({ shareToken }).lean();

  if (!dashboard || !dashboard.shareTokenActive) {
    throw AppError.notFound('Shared dashboard not found or link has been disabled');
  }

  if (dashboard.shareExpiresAt && dashboard.shareExpiresAt <= new Date()) {
    throw AppError.notFound('Shared dashboard link has expired');
  }

  return dashboard as SharedDashboardDoc;
}

/**
 * GET /api/v1/dashboards/shared/:shareToken — public read-only retrieval.
 * Does NOT expose internal workspace IDs or tenant credentials.
 */
export async function getSharedDashboard(
  ctx: DashboardRequestContext,
  shareToken: string
): Promise<Record<string, unknown>> {
  if (!shareToken) {
    throw AppError.badRequest('Share token is required');
  }

  const dashboard = await loadDashboardByShareToken(shareToken);
  const dashboardId = dashboard._id.toString();

  const charts = await ChartModel.find({ dashboardId: dashboard._id })
    .sort({ sortOrder: 1 })
    .lean();

  const datasetIds = charts
    .map((chart) => chart.datasetId)
    .filter((value): value is mongoose.Types.ObjectId => value instanceof mongoose.Types.ObjectId);

  const datasetDocs = datasetIds.length
    ? await DatasetModel.find({ _id: { $in: datasetIds } })
        .select('name type')
        .lean()
    : [];
  const datasetsById = new Map<string, { _id: mongoose.Types.ObjectId; name: string; type: string }>();
  for (const dataset of datasetDocs) {
    datasetsById.set(dataset._id.toString(), {
      _id: dataset._id,
      name: dataset.name,
      type: dataset.type
    });
  }

  const datasetColumnDocs = datasetIds.length
    ? await DatasetColumnModel.find({ datasetId: { $in: datasetIds } })
        .sort({ ordinalPosition: 1 })
        .lean()
    : [];
  const columnsByDataset = new Map<string, typeof datasetColumnDocs>();
  for (const column of datasetColumnDocs) {
    const key = column.datasetId.toString();
    const bucket = columnsByDataset.get(key) ?? [];
    bucket.push(column);
    columnsByDataset.set(key, bucket);
  }

  // Safe read-only DTO for public consumption
  const safeData = {
    id: dashboardId,
    name: dashboard.name,
    description: dashboard.description,
    layoutConfig: dashboard.layoutConfig || {},
    createdAt: dashboard.createdAt.toISOString(),
    updatedAt: dashboard.updatedAt.toISOString(),
    charts: charts.map((chart) => {
      const datasetKey = chart.datasetId ? chart.datasetId.toString() : null;
      const populatedDataset = datasetKey ? datasetsById.get(datasetKey) : undefined;
      const datasetColumns = datasetKey
        ? columnsByDataset.get(datasetKey) ?? []
        : [];
      return {
        id: chart._id.toString(),
        title: chart.title,
        description: chart.description,
        chartType: chart.chartType,
        config: chart.config,
        position: chart.position,
        sortOrder: chart.sortOrder,
        datasetId: datasetKey,
        datasetName: populatedDataset?.name || null,
        datasetColumns: datasetColumns.map((column) => ({
          id: column._id.toString(),
          name: column.name,
          type: column.dataType,
          nullable: column.nullable
        }))
      };
    })
  };

  // Public link access has no principal; the dashboard owner is recorded as the
  // acting account so the audit row can still be attributed to a real user.
  await logAuditEvent({
    organizationId: dashboard.organizationId.toString(),
    userId: dashboard.ownerId.toString(),
    action: 'DASHBOARD_PUBLIC_ACCESSED',
    resourceType: 'Dashboard',
    resourceId: dashboardId,
    metadata: { shareToken },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return safeData;
}

/**
 * POST /api/v1/dashboards/shared/:shareToken/charts/:chartId/data
 * Public chart data execution. Strictly verifies the chart belongs to the
 * shared dashboard.
 */
export async function getSharedChartData(
  ctx: DashboardRequestContext,
  shareToken: string,
  chartId: string,
  body: { filters?: unknown } = {}
): Promise<DatasetQueryResult> {
  if (!shareToken || !chartId) {
    throw AppError.badRequest('Share token and Chart ID are required');
  }

  const dashboard = await loadDashboardByShareToken(shareToken);
  const dashboardId = dashboard._id.toString();

  const chart = await ChartModel.findOne({
    _id: toObjectId(chartId),
    dashboardId: dashboard._id
  }).lean();

  if (!chart) {
    throw AppError.notFound('Chart not found on this shared dashboard');
  }

  const emptyResult: DatasetQueryResult = {
    columns: [],
    rows: [],
    rowCount: 0,
    total: 0,
    limit: 100,
    offset: 0,
    executionTimeMs: 0,
    metadata: { rowCount: 0, total: 0, limit: 100, offset: 0, executionTimeMs: 0, queryMode: 'RAW' }
  };

  if (!chart.datasetId) {
    return emptyResult;
  }

  const dataset = await loadDatasetForQuery(chart.datasetId);
  if (!dataset) {
    return emptyResult;
  }

  const rawConfig = (chart.config || {}) as Record<string, unknown>;

  const passedFilters = (Array.isArray(body?.filters) ? (body.filters as Array<Record<string, unknown>>) : [])
    .map((filter) => ({
      column: (filter.column || filter.field) as string,
      operator: (filter.operator || '=') as string,
      value: filter.value
    }))
    .filter((filter) => Boolean(filter.column));

  const configFilters = (Array.isArray(rawConfig.filters)
    ? (rawConfig.filters as Array<Record<string, unknown>>)
    : []
  )
    .map((filter) => ({
      column: (filter.column || filter.field) as string,
      operator: (filter.operator || '=') as string,
      value: filter.value
    }))
    .filter((filter) => Boolean(filter.column));

  const queryParams: DatasetQueryParams = {
    limit: typeof rawConfig.limit === 'number' ? Math.min(rawConfig.limit, 1000) : 1000,
    filters: [...configFilters, ...passedFilters] as DatasetQueryFilter[]
  };

  if (rawConfig.sort) queryParams.sort = rawConfig.sort as DatasetQueryParams['sort'];
  if (rawConfig.orderBy) queryParams.orderBy = rawConfig.orderBy as DatasetQueryParams['orderBy'];
  if (Array.isArray(rawConfig.dimensions) && rawConfig.dimensions.length > 0) {
    queryParams.dimensions = rawConfig.dimensions as string[];
  }
  if (Array.isArray(rawConfig.measures) && rawConfig.measures.length > 0) {
    queryParams.measures = rawConfig.measures as DatasetQueryParams['measures'];
  }
  if (Array.isArray(rawConfig.groupBy) && rawConfig.groupBy.length > 0) {
    queryParams.groupBy = rawConfig.groupBy as string[];
  }
  if (Array.isArray(rawConfig.aggregations) && rawConfig.aggregations.length > 0) {
    queryParams.aggregations = rawConfig.aggregations as DatasetQueryParams['aggregations'];
  }
  if (Array.isArray(rawConfig.columns) && rawConfig.columns.length > 0) {
    queryParams.columns = rawConfig.columns as string[];
  }

  // Normalize fallback for xAxis/category and yAxis/value
  if (
    (!queryParams.measures || queryParams.measures.length === 0) &&
    (!queryParams.aggregations || queryParams.aggregations.length === 0)
  ) {
    const yVal = rawConfig.yAxis || rawConfig.value;
    if (yVal) {
      queryParams.measures = [
        {
          column: String(yVal),
          aggregation: (rawConfig.aggregation as never) || 'SUM',
          alias: String(yVal)
        }
      ];
    }
  }
  if (
    (!queryParams.dimensions || queryParams.dimensions.length === 0) &&
    (!queryParams.groupBy || queryParams.groupBy.length === 0)
  ) {
    const xVal = rawConfig.xAxis || rawConfig.category;
    if (xVal) {
      queryParams.dimensions = [String(xVal)];
    }
  }

  const securityContext: DatasetSecurityContext = ctx.email
    ? {
        userId: ctx.userId,
        email: ctx.email,
        organizationId: ctx.organizationId,
        roleId: ctx.roleId,
        roleName: ctx.roleName,
        permissions: ctx.permissions
      }
    : {
        userId: 'public-viewer',
        email: 'public@viewer.link',
        organizationId: dashboard.organizationId.toString(),
        roleName: 'VIEWER'
      };

  return executeLocalDatasetQuery(dataset, queryParams, securityContext);
}

// ============================================================
// REPORT SNAPSHOT ENGINE
// ============================================================

export interface DashboardReportSnapshot {
  reportId: string;
  dashboardId: string;
  dashboardName: string;
  generatedAt: string;
  chartCount: number;
  format?: string;
  csvContent?: string;
  charts: Array<{
    chartId: string;
    title: string;
    chartType: string;
    rowCount: number;
    columns: Array<{ name: string; type: string }>;
    data: Record<string, unknown>[];
  }>;
  summary: {
    totalCharts: number;
    totalRecords: number;
    executionTimeMs: number;
    appliedFiltersCount?: number;
  };
}

/** Build the effective chart query params from a chart's stored config. */
function buildChartQueryParams(
  rawConfig: Record<string, unknown>,
  baseFilters: Array<Record<string, unknown>>
): DatasetQueryParams {
  const queryParams: DatasetQueryParams = {
    filters: baseFilters as unknown as DatasetQueryFilter[]
  };

  if (rawConfig.sort) queryParams.sort = rawConfig.sort as DatasetQueryParams['sort'];
  if (rawConfig.orderBy) queryParams.orderBy = rawConfig.orderBy as DatasetQueryParams['orderBy'];
  if (Array.isArray(rawConfig.dimensions) && rawConfig.dimensions.length > 0) {
    queryParams.dimensions = rawConfig.dimensions as string[];
  }
  if (Array.isArray(rawConfig.measures) && rawConfig.measures.length > 0) {
    queryParams.measures = rawConfig.measures as DatasetQueryParams['measures'];
  }
  if (Array.isArray(rawConfig.groupBy) && rawConfig.groupBy.length > 0) {
    queryParams.groupBy = rawConfig.groupBy as string[];
  }
  if (Array.isArray(rawConfig.aggregations) && rawConfig.aggregations.length > 0) {
    queryParams.aggregations = rawConfig.aggregations as DatasetQueryParams['aggregations'];
  }
  if (Array.isArray(rawConfig.columns) && rawConfig.columns.length > 0) {
    queryParams.columns = rawConfig.columns as string[];
  }

  if (
    (!queryParams.measures || queryParams.measures.length === 0) &&
    (!queryParams.aggregations || queryParams.aggregations.length === 0)
  ) {
    const yVal = rawConfig.yAxis || rawConfig.value;
    if (yVal) {
      queryParams.measures = [
        {
          column: String(yVal),
          aggregation: (rawConfig.aggregation as never) || 'SUM',
          alias: String(yVal)
        }
      ];
    }
  }
  if (
    (!queryParams.dimensions || queryParams.dimensions.length === 0) &&
    (!queryParams.groupBy || queryParams.groupBy.length === 0)
  ) {
    const xVal = rawConfig.xAxis || rawConfig.category;
    if (xVal) {
      queryParams.dimensions = [String(xVal)];
    }
  }

  return queryParams;
}

/** Merge dashboard-level saved filters into a chart's own filters. */
function mergeDashboardFilters(
  chartConfigFilters: Array<Record<string, unknown>>,
  rawDashboardFilters: Array<Record<string, unknown>>,
  chart: { id: string; datasetId: string | null },
  datasetColumnNames: string[]
): Array<Record<string, unknown>> {
  const baseChartFilters: Array<Record<string, unknown>> = [...chartConfigFilters];

  for (const dashboardFilter of rawDashboardFilters) {
    const colName = (dashboardFilter.column || dashboardFilter.field) as string | undefined;
    if (!colName) continue;
    // If cross filter originating from this chart, exempt source chart
    if (dashboardFilter.isCrossFilter && dashboardFilter.sourceChartId === chart.id) continue;
    // If datasetId specified on filter and doesn't match chart dataset, skip
    const filterDatasetId = dashboardFilter.datasetId as string | undefined;
    if (filterDatasetId && chart.datasetId && filterDatasetId !== chart.datasetId) continue;
    // If dataset columns available, verify column belongs to this dataset
    if (
      datasetColumnNames.length > 0 &&
      !datasetColumnNames.includes(String(colName).toLowerCase())
    ) {
      continue;
    }
    baseChartFilters.push({
      column: String(colName),
      operator: dashboardFilter.operator || '=',
      value: dashboardFilter.value
    });
  }

  return baseChartFilters;
}

/**
 * Standalone report snapshot generation engine.
 * Reusable by both HTTP request handlers and background workers.
 */
export async function generateDashboardReportSnapshot(
  dashboardId: string,
  organizationId: string,
  options: {
    dashboardFilters?: Array<Record<string, unknown>>;
    format?: string;
    user?: DatasetSecurityContext;
  } = {}
): Promise<DashboardReportSnapshot> {
  const startTime = Date.now();

  const dashboardObjectId = toObjectId(dashboardId);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId).lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  if (dashboard.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: dashboard belongs to a different organization');
  }

  const charts = await ChartModel.find({ dashboardId: dashboardObjectId })
    .sort({ sortOrder: 1 })
    .lean();

  // Extract dashboard layout-level saved filters
  const layout = (dashboard.layoutConfig || {}) as Record<string, unknown>;
  const rawDashboardFilters: Array<Record<string, unknown>> = Array.isArray(options.dashboardFilters)
    ? options.dashboardFilters
    : Array.isArray(layout.dashboardFilters)
      ? (layout.dashboardFilters as Array<Record<string, unknown>>)
      : Array.isArray(layout.filters)
        ? (layout.filters as Array<Record<string, unknown>>)
        : [];

  const reportCharts: DashboardReportSnapshot['charts'] = [];
  let totalRecords = 0;

  for (const chart of charts) {
    const chartId = chart._id.toString();
    const dataset = chart.datasetId ? await loadDatasetForQuery(chart.datasetId) : null;

    if (!dataset) {
      reportCharts.push({
        chartId,
        title: chart.title,
        chartType: chart.chartType,
        rowCount: 0,
        columns: [],
        data: []
      });
      continue;
    }

    const rawConfig = (chart.config || {}) as Record<string, unknown>;
    const chartConfigFilters: Array<Record<string, unknown>> = Array.isArray(rawConfig.filters)
      ? (rawConfig.filters as Array<Record<string, unknown>>)
      : [];

    const datasetColumns = await getDatasetColumns(dataset);
    const datasetColumnNames = datasetColumns.map((column) => column.name.toLowerCase());

    const baseChartFilters = mergeDashboardFilters(
      chartConfigFilters,
      rawDashboardFilters,
      {
        id: chartId,
        datasetId: chart.datasetId ? chart.datasetId.toString() : null
      },
      datasetColumnNames
    );

    const queryParams = buildChartQueryParams(rawConfig, baseChartFilters);

    try {
      const queryResult = await executeLocalDatasetQuery(dataset, queryParams, options.user);
      totalRecords += queryResult.rowCount;
      reportCharts.push({
        chartId,
        title: chart.title,
        chartType: chart.chartType,
        rowCount: queryResult.rowCount,
        columns: queryResult.columns,
        data: queryResult.rows
      });
    } catch {
      reportCharts.push({
        chartId,
        title: chart.title,
        chartType: chart.chartType,
        rowCount: 0,
        columns: [],
        data: []
      });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const requestedFormat = String(options.format || REPORT_FORMAT.PDF).toUpperCase();

  // If CSV format requested, serialize chart data to CSV
  let csvContent: string | undefined;
  if (requestedFormat === 'CSV') {
    const csvSections: string[] = [];
    for (const reportChart of reportCharts) {
      if (reportChart.data.length > 0) {
        const colNames = reportChart.columns.map((column) => column.name);
        const header = colNames.join(',');
        const rows = reportChart.data.map((row) =>
          colNames
            .map((column) => {
              const value = row[column];
              if (value === null || value === undefined) return '';
              const text = String(value);
              return text.includes(',') || text.includes('"') || text.includes('\n')
                ? `"${text.replace(/"/g, '""')}"`
                : text;
            })
            .join(',')
        );
        csvSections.push(
          `--- Chart: ${reportChart.title} (${reportChart.rowCount} records) ---\r\n${header}\r\n${rows.join('\r\n')}`
        );
      }
    }
    csvContent = csvSections.join('\r\n\r\n');
  }

  return {
    reportId: crypto.randomUUID(),
    dashboardId: dashboard._id.toString(),
    dashboardName: dashboard.name,
    generatedAt: new Date().toISOString(),
    chartCount: reportCharts.length,
    format: requestedFormat,
    csvContent,
    charts: reportCharts,
    summary: {
      totalCharts: reportCharts.length,
      totalRecords,
      executionTimeMs,
      appliedFiltersCount: rawDashboardFilters.length
    }
  };
}
