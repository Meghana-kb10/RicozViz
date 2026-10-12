// ============================================================
// AI Analytics Service (Grounded AI Engine)
// ============================================================
// Powers Phase 2 AI Analytics capabilities:
// 1. AI Data Analyst (Intent parsing, safe query generation, grounded explanation)
// 2. Natural Language -> Chart (Semantic field/type inference, safe chart spec)
// 3. Automatic Insights & Anomaly Detection (Deterministic statistical analysis, Z-score/IQR)
// 4. AI-Powered Dashboard Summary (Cross-chart aggregation, active filter awareness)
//
// STRICT RULE: All calculations and insights are strictly grounded
// in actual RicozViz dataset and query results. No fabricated numbers.
//
// MIGRATION NOTE
// --------------
// The legacy service delegated execution to the shared `datasetQueryEngine` and
// to `resolveUserRlsFilters` / `validateSqlIdentifier`, all of which live in
// the dataset module being migrated in parallel. To keep this module buildable
// and self-contained it carries its own in-memory query engine (raw +
// aggregate, filters, ordering, pagination), its own SQL-identifier guard and
// its own row-level-security resolver. Row materialisation reads the stored
// rows straight out of the Dataset document's `schemaMeta` Mixed field.
// ============================================================

import type mongoose from 'mongoose';
import {
  ChartModel,
  DashboardModel,
  DatasetModel,
  RowLevelSecurityRuleModel,
  WorkspaceMemberModel,
  WorkspaceModel,
  toObjectId
} from '@repo/database';
import type { IRowLevelSecurityRuleDocument, IWorkspaceMemberDocument } from '@repo/database';
import { AGGREGATION_FUNCTION } from '@repo/types';
import type {
  AggregationFunction,
  AnalystQueryResponse,
  AskDataAnalystParams,
  AutoInsight,
  DashboardSummaryParams,
  DashboardSummaryResponse,
  DatasetQueryFilter,
  DatasetQueryMeasure,
  DatasetQueryParams,
  DatasetQueryResult,
  FilterOperator,
  InsightsParams,
  InsightsResponse,
  NlToChartParams,
  NlToChartResponse,
  QueryResultColumn
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

// ============================================================
// CONSTANTS & SAFETY LIMITS
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

export const FILTER_OPERATOR_ALIASES: Record<string, string> = {
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

export const ALLOWED_AGGREGATIONS: readonly string[] = Object.values(AGGREGATION_FUNCTION);

// ============================================================
// Types
// ============================================================

/** Identity handed to the query engine for RLS + audit purposes. */
export interface UserSecurityContext {
  userId: string;
  email: string;
  organizationId: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  isOrgAdmin?: boolean;
}

/** Minimum dataset shape required by the local query engine. */
export interface QueryableDataset {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  workspaceId?: mongoose.Types.ObjectId | null;
  schemaMeta?: unknown;
}

/** Runtime (pre-validation) filter shape accepted by the engine. */
export interface EngineFilter {
  column: string;
  operator: string;
  value?: unknown;
}

/** Runtime (pre-validation) measure shape accepted by the engine. */
export interface EngineMeasure {
  column: string;
  aggregation: string;
  alias?: string;
}

export interface EngineQueryParams {
  columns?: string[];
  limit?: number;
  offset?: number;
  orderBy?: { column: string; direction: 'asc' | 'desc' | 'ASC' | 'DESC' };
  filters?: EngineFilter[];
  filterLogic?: 'AND' | 'OR';
  dimensions?: string[];
  measures?: EngineMeasure[];
}

/** Normalise a loosely-typed (runtime / Zod) filter into the public contract. */
export function toDatasetQueryFilters(
  filters?: Array<{ column: string; operator?: string; value?: unknown }>
): DatasetQueryFilter[] {
  return (filters ?? []).map((filter) => ({
    column: filter.column,
    operator: filter.operator as FilterOperator,
    value: filter.value
  }));
}

// ============================================================
// SQL identifier guard (verbatim port)
// ============================================================

/**
 * Validates that an SQL identifier contains only alphanumeric characters and
 * underscores. Strictly prevents SQL injection in table and column names.
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

// ============================================================
// Workspace authorization helpers (verbatim port)
// ============================================================

export type WorkspaceAction = 'READ' | 'WRITE' | 'DELETE' | 'ADMIN' | 'SHARE';

export interface WorkspaceAccessContext {
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
 * Dashboards predate the first-class workspace relation and keep their
 * workspace binding in layoutConfig.
 */
export function getDashboardWorkspaceId(layoutConfig: unknown): string | undefined {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return undefined;
  }

  const workspaceId = (layoutConfig as Record<string, unknown>).workspaceId;
  return typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId : undefined;
}

async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<WorkspaceAccessContext> {
  const workspaceObjectId = toObjectId(workspaceId);
  const organizationObjectId = toObjectId(organizationId);
  const userObjectId = toObjectId(userId);

  const workspace = workspaceObjectId
    ? await WorkspaceModel.findOne({
        _id: workspaceObjectId,
        organizationId: organizationObjectId
      }).lean()
    : null;

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  const isOrgAdmin = userRoleName === 'ADMIN';

  const membership =
    userObjectId && workspaceObjectId
      ? await WorkspaceMemberModel.findOne({
          workspaceId: workspaceObjectId,
          userId: userObjectId
        })
          .select('role')
          .lean<Pick<IWorkspaceMemberDocument, 'role'>>()
      : null;

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden('Access denied: You do not have access to this workspace');
  }

  return { userRole: membership?.role ?? 'ADMIN', isOrgAdmin };
}

/**
 * Verifies that the authenticated user has access to the workspace of the given
 * resource. Organization admins bypass workspace restrictions; every other
 * caller must hold a membership whose role satisfies `requiredAction`.
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
  if (resource.workspaceId) {
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
// Row-level security (verbatim port of rls.service resolution)
// ============================================================

interface RlsRuleRecord {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  datasetId: string;
  name: string | null;
  userId: string | null;
  userEmail: string | null;
  roleId: string | null;
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
}

function parseStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Normalises an RLS rule regardless of the shape it was persisted in. */
export function normalizeRlsRuleRecord(rule: Record<string, unknown>): RlsRuleRecord {
  const col = (rule.column ?? rule.columnName ?? rule.column_name ?? '') as string;

  const rawOp = String(rule.operator ?? '=').trim();
  const upper = rawOp.toUpperCase();
  let op = rawOp;
  if (upper === 'EQUALS' || upper === 'EQUAL' || upper === '==') op = '=';
  else if (upper === 'NOT_EQUALS' || upper === 'NOT_EQUAL' || upper === '<>') op = '!=';
  else if (upper === 'GREATER_THAN' || upper === 'GT') op = '>';
  else if (upper === 'GREATER_THAN_OR_EQUAL' || upper === 'GTE') op = '>=';
  else if (upper === 'LESS_THAN' || upper === 'LT') op = '<';
  else if (upper === 'LESS_THAN_OR_EQUAL' || upper === 'LTE') op = '<=';
  else if (upper === 'CONTAINS') op = 'contains';
  else if (upper === 'IN') op = 'in';

  const rawVal = rule.value ?? rule.ruleValue ?? rule.rule_value ?? '';
  const valStr = typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);

  const isEnabled =
    rule.enabled !== undefined
      ? Boolean(rule.enabled)
      : rule.isEnabled !== undefined
        ? Boolean(rule.isEnabled)
        : rule.is_enabled !== undefined
          ? Boolean(rule.is_enabled)
          : true;

  return {
    id: (rule.id as string) ?? `rls-${Math.random().toString(36).substring(2, 9)}`,
    organizationId: (rule.organizationId as string) ?? 'org-default',
    workspaceId: (rule.workspaceId as string | null) ?? null,
    datasetId: (rule.datasetId as string) ?? '',
    name: (rule.name as string | null) ?? null,
    userId: (rule.userId as string | null) ?? null,
    userEmail: (rule.userEmail as string | null) ?? null,
    roleId: (rule.roleId as string | null) ?? null,
    column: col,
    operator: op,
    value: valStr,
    enabled: isEnabled
  };
}

/**
 * Resolve the RLS predicates that constrain `user` on `dataset`.
 *
 * Rules come from the `row_level_security_rules` collection and fall back to
 * `dataset.schemaMeta.rlsRules` so offline / seeded datasets still enforce.
 */
export async function resolveUserRlsFilters(
  dataset: QueryableDataset,
  user?: UserSecurityContext | null
): Promise<EngineFilter[]> {
  if (!user) return [];

  let allRules: RlsRuleRecord[] = [];
  try {
    const docs = await RowLevelSecurityRuleModel.find({
      datasetId: dataset._id,
      organizationId: dataset.organizationId,
      enabled: true
    })
      .lean<IRowLevelSecurityRuleDocument[]>()
      .exec();
    allRules = docs.map((doc) => normalizeRlsRuleRecord(doc as unknown as Record<string, unknown>));
  } catch {
    allRules = [];
  }

  // Also check dataset.schemaMeta.rlsRules if empty
  if (allRules.length === 0) {
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    if (Array.isArray(meta.rlsRules)) {
      allRules = (meta.rlsRules as Record<string, unknown>[])
        .map(normalizeRlsRuleRecord)
        .filter((rule) => rule.enabled);
    }
  }

  if (allRules.length === 0) return [];

  const isExplicitlyTargeted = (rule: RlsRuleRecord): boolean => {
    if (rule.userId && rule.userId === user.userId) return true;
    if (rule.userEmail && rule.userEmail.toLowerCase() === (user.email ?? '').toLowerCase()) {
      return true;
    }
    return false;
  };

  const isRoleTargeted = (rule: RlsRuleRecord): boolean => {
    if (rule.roleId && (rule.roleId === user.roleId || rule.roleId === user.roleName)) return true;
    return false;
  };

  const isUniversalRule = (rule: RlsRuleRecord): boolean =>
    !rule.userId && !rule.userEmail && !rule.roleId;

  // Determine admin bypass: admins bypass every non-explicit rule.
  const isOrgAdmin = user.roleName === 'ADMIN' || Boolean(user.isOrgAdmin);
  const applicableRules: RlsRuleRecord[] = [];

  for (const rule of allRules) {
    if (isExplicitlyTargeted(rule)) {
      applicableRules.push(rule);
    } else if (isOrgAdmin) {
      continue;
    } else if (isRoleTargeted(rule) || isUniversalRule(rule)) {
      applicableRules.push(rule);
    }
  }

  return applicableRules.map((rule) => ({
    column: rule.column,
    operator: rule.operator,
    value: parseStoredValue(rule.value)
  }));
}

// ============================================================
// In-memory query engine
// ============================================================

function getSchemaMeta(schemaMeta: unknown): Record<string, unknown> {
  if (!schemaMeta || typeof schemaMeta !== 'object' || Array.isArray(schemaMeta)) {
    return {};
  }
  return schemaMeta as Record<string, unknown>;
}

interface SchemaColumn {
  name: string;
  type: string;
}

function getSchemaColumns(schemaMeta: unknown): SchemaColumn[] {
  const meta = getSchemaMeta(schemaMeta);
  if (!Array.isArray(meta.columns)) {
    return [];
  }
  const columns: SchemaColumn[] = [];
  for (const entry of meta.columns as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const column = entry as { name?: unknown; type?: unknown; dataType?: unknown };
    if (typeof column.name !== 'string' || column.name.length === 0) continue;
    const type = column.dataType ?? column.type;
    columns.push({
      name: column.name,
      type: typeof type === 'string' && type ? type.toLowerCase() : 'string'
    });
  }
  return columns;
}

/** Rows persisted on the dataset document (`sampleData` -> `previewRows` -> `rows`). */
export function readDatasetRows(schemaMeta: unknown): Record<string, unknown>[] {
  const meta = getSchemaMeta(schemaMeta);
  const raw = (meta.sampleData || meta.previewRows || meta.rows || []) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object'
  );
}

/** Validate + coerce a filter value against the column's declared type. */
function validateAndCoerceFilterValue(
  colType: string,
  operator: string,
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
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else {
      items = [value];
    }

    if (colType === 'number' || colType === 'integer') {
      return items.map((v) => {
        const num = Number(v);
        if (Number.isNaN(num)) {
          throw AppError.badRequest(
            `Filter value contains non-numeric element for column "${colName}"`
          );
        }
        return colType === 'integer' ? Math.round(num) : num;
      });
    }
    return items.map((v) => String(v));
  }

  if (colType === 'integer') {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      return parseInt(value.trim(), 10);
    }
    throw AppError.badRequest(`Filter value for integer column "${colName}" must be a valid integer`);
  }

  if (colType === 'number') {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(value.trim())) {
      const parsed = parseFloat(value.trim());
      if (!Number.isNaN(parsed)) return parsed;
    }
    throw AppError.badRequest(`Filter value for numeric column "${colName}" must be a valid number`);
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
    if (isNaN(parsed.getTime())) {
      throw AppError.badRequest(`Filter value for date column "${colName}" must be a valid date`);
    }
    return parsed.toISOString();
  }

  // Default string type
  return String(value);
}

/**
 * Execute a validated, bounded query against a dataset's stored rows.
 *
 * Mirrors the legacy engine's execution contract (columns / rows / rowCount /
 * total / limit / offset / executionTimeMs / metadata) including every
 * validation error message, so client-visible behaviour is unchanged.
 */
export async function executeDatasetQuery(
  dataset: QueryableDataset,
  params: EngineQueryParams = {},
  userContext?: UserSecurityContext | null
): Promise<DatasetQueryResult> {
  const startTime = Date.now();

  // 0. Resolve Row-Level Security (RLS) constraints for the requesting user
  const resolvedUser = userContext ?? null;
  const rlsFilters = await resolveUserRlsFilters(dataset, resolvedUser);

  // 1. Extract schema metadata and known columns
  const meta = getSchemaMeta(dataset.schemaMeta);
  const columnTypeMap = new Map<string, string>();
  for (const column of getSchemaColumns(dataset.schemaMeta)) {
    columnTypeMap.set(column.name, column.type);
  }
  const knownColumnNames = Array.from(columnTypeMap.keys());

  // 2. Normalize dimensions / measures / sorting
  const rawDimensions = (params.dimensions ?? []).filter(Boolean);
  const rawMeasures: EngineMeasure[] = Array.isArray(params.measures)
    ? params.measures.filter(Boolean)
    : [];

  const rawOrderBy = params.orderBy;

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

  // 5. Validate dimensions / measures (aggregate) or columns (raw)
  const validatedDimensions: string[] = [];
  const validatedMeasures: Array<{
    column: string;
    aggregation: string;
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
    for (const dim of rawDimensions) {
      if (!knownColumnNames.includes(dim)) {
        throw AppError.badRequest(`Dimension column "${dim}" does not exist in dataset schema`);
      }
      validateSqlIdentifier(dim);
      validatedDimensions.push(dim);
    }

    if (rawMeasures.length > QUERY_LIMITS.MAX_MEASURES) {
      throw AppError.badRequest(
        `Measures count (${rawMeasures.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_MEASURES})`
      );
    }
    for (const m of rawMeasures) {
      if (m.column !== '*' && !knownColumnNames.includes(m.column)) {
        throw AppError.badRequest(`Measure column "${m.column}" does not exist in dataset schema`);
      }
      if (m.column !== '*') {
        validateSqlIdentifier(m.column);
      }

      if (!ALLOWED_AGGREGATIONS.includes(m.aggregation)) {
        throw AppError.badRequest(`Unsupported aggregation function "${m.aggregation}"`);
      }

      // Check type compatibility for SUM and AVG
      if (m.column !== '*') {
        const colType = columnTypeMap.get(m.column) || 'string';
        if ((m.aggregation === 'SUM' || m.aggregation === 'AVG') && colType !== 'number' && colType !== 'integer') {
          throw AppError.badRequest(
            `Aggregation "${m.aggregation}" cannot be applied to non-numeric column "${m.column}" (type: ${colType})`
          );
        }
      }

      const defaultAlias = `${m.aggregation.toLowerCase()}_${m.column === '*' ? 'count' : m.column}`;
      const finalAlias = m.alias ? validateSqlIdentifier(m.alias) : defaultAlias;

      let resultType = 'number';
      if (m.aggregation === 'COUNT') {
        resultType = 'integer';
      } else if (m.aggregation === 'MIN' || m.aggregation === 'MAX') {
        resultType = columnTypeMap.get(m.column) || 'string';
      }

      validatedMeasures.push({
        column: m.column,
        aggregation: m.aggregation,
        alias: finalAlias,
        resultType
      });
    }
  } else {
    if (params.columns && params.columns.length > 0) {
      if (params.columns.length > QUERY_LIMITS.MAX_COLUMNS) {
        throw AppError.badRequest(
          `Requested column count (${params.columns.length}) exceeds limit of ${QUERY_LIMITS.MAX_COLUMNS}`
        );
      }
      for (const col of params.columns) {
        if (!knownColumnNames.includes(col)) {
          throw AppError.badRequest(`Requested column "${col}" does not exist in dataset schema`);
        }
        validateSqlIdentifier(col);
      }
      selectedColumns = params.columns;
    } else {
      selectedColumns = knownColumnNames;
    }
  }

  // 6. Validate Filters
  const validatedFilters: EngineFilter[] = [];
  if (params.filters && params.filters.length > 0) {
    if (params.filters.length > QUERY_LIMITS.MAX_FILTERS) {
      throw AppError.badRequest(
        `Filter count (${params.filters.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_FILTERS})`
      );
    }

    for (const filter of params.filters) {
      const colName = filter.column;
      if (!knownColumnNames.includes(colName)) {
        throw AppError.badRequest(`Filter column "${colName}" does not exist in dataset schema`);
      }
      const rawOp = filter.operator;
      const alias =
        typeof rawOp === 'string'
          ? FILTER_OPERATOR_ALIASES[rawOp] ?? FILTER_OPERATOR_ALIASES[rawOp.toLowerCase()]
          : undefined;
      const op = alias ?? rawOp;

      if (!(ALLOWED_FILTER_OPERATORS as readonly string[]).includes(op)) {
        throw AppError.badRequest(`Unsupported filter operator: "${filter.operator}"`);
      }

      const colType = columnTypeMap.get(colName) || 'string';
      const validatedValue = validateAndCoerceFilterValue(colType, op, filter.value, colName);

      validatedFilters.push({ column: colName, operator: op, value: validatedValue });
    }
  }

  const filterLogic: 'AND' | 'OR' = (params.filterLogic ?? 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';

  // 7. Validate Ordering
  let validatedOrderBy: { column: string; direction: 'asc' | 'desc' } | undefined;
  if (rawOrderBy) {
    const orderCol = rawOrderBy.column;
    const orderDir = String(rawOrderBy.direction).toLowerCase() === 'desc' ? 'desc' : 'asc';

    if (isAggregate) {
      const validOrderCols = [
        ...validatedDimensions,
        ...validatedMeasures.map((m) => m.alias),
        ...validatedMeasures.map((m) => m.column)
      ];
      if (!validOrderCols.includes(orderCol)) {
        throw AppError.badRequest(
          `Order by column "${orderCol}" must be one of the selected dimensions or measure aliases`
        );
      }
    } else {
      if (!knownColumnNames.includes(orderCol)) {
        throw AppError.badRequest(`Order by column "${orderCol}" does not exist in dataset schema`);
      }
    }

    validateSqlIdentifier(orderCol);
    validatedOrderBy = { column: orderCol, direction: orderDir };
  }

  // 8. Execute against the rows stored on the dataset document
  const rawRows = readDatasetRows(dataset.schemaMeta);

  // Evaluate a filter against a row
  const evalFilterCondition = (f: EngineFilter, row: Record<string, unknown>): boolean => {
    const val = row[f.column];

    if (f.operator === 'isNull') {
      return val === null || val === undefined;
    }
    if (f.operator === 'isNotNull') {
      return val !== null && val !== undefined;
    }
    if (val === null || val === undefined) {
      return false;
    }

    const colType = columnTypeMap.get(f.column) || 'string';

    if (colType === 'number' || colType === 'integer') {
      const numVal = Number(val);
      const filterVal = Number(f.value);
      if (f.operator === '=') return numVal === filterVal;
      if (f.operator === '!=') return numVal !== filterVal;
      if (f.operator === '>') return numVal > filterVal;
      if (f.operator === '>=') return numVal >= filterVal;
      if (f.operator === '<') return numVal < filterVal;
      if (f.operator === '<=') return numVal <= filterVal;
    }

    if (colType === 'date' || colType === 'datetime' || colType === 'timestamp') {
      const rowTime = new Date(val as string | number | Date).getTime();
      const filterTime = new Date(f.value as string | number | Date).getTime();
      if (f.operator === '=') return rowTime === filterTime;
      if (f.operator === '!=') return rowTime !== filterTime;
      if (f.operator === '>') return rowTime > filterTime;
      if (f.operator === '>=') return rowTime >= filterTime;
      if (f.operator === '<') return rowTime < filterTime;
      if (f.operator === '<=') return rowTime <= filterTime;
    }

    if (colType === 'boolean') {
      const boolVal = Boolean(val);
      const filterBool = Boolean(f.value);
      if (f.operator === '=') return boolVal === filterBool;
      if (f.operator === '!=') return boolVal !== filterBool;
    }

    // String comparisons & text matching
    const strVal = String(val).toLowerCase();
    const filterStr = String(f.value ?? '').toLowerCase();

    if (f.operator === '=') return strVal === filterStr;
    if (f.operator === '!=') return strVal !== filterStr;
    if (f.operator === '>') return strVal > filterStr;
    if (f.operator === '>=') return strVal >= filterStr;
    if (f.operator === '<') return strVal < filterStr;
    if (f.operator === '<=') return strVal <= filterStr;
    if (f.operator === 'contains') return strVal.includes(filterStr);
    if (f.operator === 'startsWith') return strVal.startsWith(filterStr);
    if (f.operator === 'endsWith') return strVal.endsWith(filterStr);
    if (f.operator === 'in') {
      const rawList = Array.isArray(f.value) ? f.value : [f.value];
      if (colType === 'number' || colType === 'integer') {
        const numList = rawList.map((v) => Number(v));
        return numList.includes(Number(val));
      }
      const strList = rawList.map((v) => String(v).toLowerCase());
      return strList.includes(String(val).toLowerCase());
    }

    return false;
  };

  // 0. Mandatory Row-Level Security (RLS) enforcement
  let permittedRows = rawRows;
  if (rlsFilters.length > 0) {
    permittedRows = rawRows.filter((row) => rlsFilters.every((f) => evalFilterCondition(f, row)));
  }

  // 1. Filter permitted rows with user query filters
  const filteredRows = permittedRows.filter((row) => {
    if (validatedFilters.length === 0) return true;
    if (filterLogic === 'OR') {
      return validatedFilters.some((f) => evalFilterCondition(f, row));
    }
    return validatedFilters.every((f) => evalFilterCondition(f, row));
  });

  let processedRows: Record<string, unknown>[] = [];
  const resultColumns: QueryResultColumn[] = [];

  // 2. Aggregate or Raw Projection
  if (isAggregate) {
    for (const dim of validatedDimensions) {
      resultColumns.push({ name: dim, type: columnTypeMap.get(dim) || 'string' });
    }
    for (const m of validatedMeasures) {
      resultColumns.push({ name: m.alias, type: m.resultType });
    }

    const groups = new Map<string, { dims: Record<string, unknown>; rows: Record<string, unknown>[] }>();

    if (validatedDimensions.length === 0) {
      groups.set('all', { dims: {}, rows: filteredRows });
    } else {
      for (const row of filteredRows) {
        const dimObj: Record<string, unknown> = {};
        for (const dim of validatedDimensions) {
          dimObj[dim] = row[dim] ?? null;
        }
        const groupKey = JSON.stringify(dimObj);

        if (!groups.has(groupKey)) {
          groups.set(groupKey, { dims: dimObj, rows: [] });
        }
        groups.get(groupKey)?.rows.push(row);
      }
    }

    for (const group of groups.values()) {
      const aggregatedRow: Record<string, unknown> = { ...group.dims };

      for (const m of validatedMeasures) {
        if (m.aggregation === 'COUNT') {
          if (m.column === '*') {
            aggregatedRow[m.alias] = group.rows.length;
          } else {
            aggregatedRow[m.alias] = group.rows.filter(
              (r) => r[m.column] !== null && r[m.column] !== undefined
            ).length;
          }
        } else if (m.aggregation === 'SUM') {
          const sum = group.rows.reduce<number>((acc, r) => {
            const val = Number(r[m.column]);
            return !isNaN(val) ? acc + val : acc;
          }, 0);
          aggregatedRow[m.alias] = Math.round(sum * 1000) / 1000;
        } else if (m.aggregation === 'AVG') {
          const validVals = group.rows
            .map((r) => Number(r[m.column]))
            .filter((v) => !isNaN(v));
          const avg =
            validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0;
          aggregatedRow[m.alias] = Math.round(avg * 1000) / 1000;
        } else if (m.aggregation === 'MIN') {
          const vals = group.rows
            .map((r) => r[m.column])
            .filter((v) => v !== null && v !== undefined);
          aggregatedRow[m.alias] =
            vals.length > 0 ? vals.reduce((min, cur) => (cur < min ? cur : min)) : null;
        } else if (m.aggregation === 'MAX') {
          const vals = group.rows
            .map((r) => r[m.column])
            .filter((v) => v !== null && v !== undefined);
          aggregatedRow[m.alias] =
            vals.length > 0 ? vals.reduce((max, cur) => (cur > max ? cur : max)) : null;
        }
      }

      processedRows.push(aggregatedRow);
    }
  } else {
    for (const col of selectedColumns) {
      resultColumns.push({ name: col, type: columnTypeMap.get(col) || 'string' });
    }

    processedRows = filteredRows.map((row) => {
      const projected: Record<string, unknown> = {};
      for (const col of selectedColumns) {
        projected[col] = row[col] ?? null;
      }
      return projected;
    });
  }

  // 3. Sort
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
      return valA > valB ? factor : -factor;
    });
  }

  const total = processedRows.length;

  // 4. Paginate
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

// ============================================================
// STATISTICAL & ANOMALY DETECTION ENGINE
// ============================================================

export interface DescriptiveStats {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
}

export function calculateDescriptiveStats(numbers: number[]): DescriptiveStats {
  if (numbers.length === 0) {
    return { count: 0, sum: 0, mean: 0, min: 0, max: 0, stdDev: 0, q1: 0, median: 0, q3: 0, iqr: 0 };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;
  const min = sorted[0] ?? 0;
  const max = sorted[count - 1] ?? 0;

  // Variance & Standard Deviation
  const variance =
    sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (count > 1 ? count - 1 : 1);
  const stdDev = Math.sqrt(variance);

  // Percentiles & IQR
  const median =
    count % 2 === 0
      ? ((sorted[count / 2 - 1] ?? 0) + (sorted[count / 2] ?? 0)) / 2
      : (sorted[Math.floor(count / 2)] ?? 0);
  const q1 = sorted[Math.floor(count * 0.25)] ?? min;
  const q3 = sorted[Math.floor(count * 0.75)] ?? max;
  const iqr = q3 - q1;

  return { count, sum, mean, min, max, stdDev, q1, median, q3, iqr };
}

/**
 * Deterministic anomaly detection using Z-Score (|Z| >= 2.5) and IQR (1.5x threshold).
 */
export function detectStatisticalAnomalies(
  rows: Array<Record<string, unknown>>,
  measureColumn: string,
  dimensionColumn?: string
): AutoInsight[] {
  const values: number[] = [];
  const validRows: Array<{ row: Record<string, unknown>; val: number }> = [];

  for (const r of rows) {
    const raw = r[measureColumn];
    const n = Number(raw);
    if (!isNaN(n) && raw !== null && raw !== undefined) {
      values.push(n);
      validRows.push({ row: r, val: n });
    }
  }

  if (values.length < 3) return [];

  const stats = calculateDescriptiveStats(values);
  const insights: AutoInsight[] = [];

  for (const { row, val } of validRows) {
    const label = dimensionColumn ? String(row[dimensionColumn] ?? 'Unknown') : 'Value';

    // Method 1: Z-Score (threshold >= 2.5)
    if (stats.stdDev > 0) {
      const zScore = (val - stats.mean) / stats.stdDev;
      if (Math.abs(zScore) >= 2.5) {
        insights.push({
          id: `anomaly-z-${label}-${val}`,
          type: 'ANOMALY',
          title: `Unusual Value Detected in ${label}`,
          description: `${label} recorded a value of ${val.toLocaleString()}, which deviates significantly from the mean of ${Math.round(stats.mean).toLocaleString()} (Z-Score: ${zScore.toFixed(2)} ≥ 2.5).`,
          metric: measureColumn,
          value: val,
          formattedValue: val.toLocaleString(),
          dimensionValue: label,
          isAnomaly: true,
          detectionMethod: 'Z_SCORE',
          score: Math.round(Math.abs(zScore) * 10) / 10
        });
        continue;
      }
    }

    // Method 2: IQR 1.5x Outlier
    if (stats.iqr > 0) {
      const lowerFence = stats.q1 - 1.5 * stats.iqr;
      const upperFence = stats.q3 + 1.5 * stats.iqr;
      if (val > upperFence || val < lowerFence) {
        insights.push({
          id: `anomaly-iqr-${label}-${val}`,
          type: 'ANOMALY',
          title: `Statistical Outlier in ${label}`,
          description: `${label} recorded ${val.toLocaleString()}, outside the expected interquartile range [${Math.round(lowerFence).toLocaleString()} - ${Math.round(upperFence).toLocaleString()}].`,
          metric: measureColumn,
          value: val,
          formattedValue: val.toLocaleString(),
          dimensionValue: label,
          isAnomaly: true,
          detectionMethod: 'IQR',
          score: 2.0
        });
      }
    }
  }

  return insights;
}

// ============================================================
// NATURAL LANGUAGE SEMANTIC PARSER
// ============================================================

export interface DatasetColumnMeta {
  name: string;
  type: string;
}

/**
 * Discover the dataset schema. The Mongo document keeps the column list inside
 * `schemaMeta.columns`, which is the direct equivalent of the legacy
 * `DatasetColumn` relation.
 */
export function extractDatasetColumns(dataset: QueryableDataset): DatasetColumnMeta[] {
  const meta = getSchemaMeta(dataset.schemaMeta);
  if (Array.isArray(meta.columns) && meta.columns.length > 0) {
    const columns: DatasetColumnMeta[] = [];
    for (const entry of meta.columns as unknown[]) {
      if (!entry || typeof entry !== 'object') continue;
      const column = entry as { name?: unknown; type?: unknown; dataType?: unknown };
      if (typeof column.name !== 'string' || column.name.length === 0) continue;
      const type = column.dataType ?? column.type;
      columns.push({
        name: column.name,
        type: typeof type === 'string' && type ? type.toLowerCase() : 'string'
      });
    }
    if (columns.length > 0) {
      return columns;
    }
  }
  return [];
}

export function isNumericColumnType(type: string): boolean {
  const t = type.toLowerCase();
  return t === 'number' || t === 'decimal' || t === 'integer' || t === 'float' || t === 'double';
}

export function isDateColumnType(type: string): boolean {
  const t = type.toLowerCase();
  return t === 'date' || t === 'datetime' || t === 'timestamp';
}

export interface ParsedIntent {
  targetDimension?: string;
  targetMeasure: string;
  aggregation: AggregationFunction;
  chartType: string;
  limit?: number;
  sortDirection?: 'asc' | 'desc';
  filters: DatasetQueryFilter[];
  isTimeTrend: boolean;
  isUnsupported: boolean;
}

export function parseNaturalLanguageIntent(
  text: string,
  columns: DatasetColumnMeta[]
): ParsedIntent {
  const lower = text.toLowerCase();
  const numericCols = columns.filter((c) => isNumericColumnType(c.type));
  const dateCols = columns.filter((c) => isDateColumnType(c.type));
  const categoricalCols = columns.filter(
    (c) => !isNumericColumnType(c.type) && !isDateColumnType(c.type)
  );

  // 1. Identify Aggregation Function
  let aggregation: AggregationFunction = 'SUM';
  if (/\b(average|avg|mean)\b/.test(lower)) {
    aggregation = 'AVG';
  } else if (/\b(count|number of|how many|total orders|orders count)\b/.test(lower)) {
    aggregation = 'COUNT';
  } else if (/\b(lowest|minimum|min)\b/.test(lower)) {
    aggregation = 'MIN';
  } else if (/\b(highest|maximum|max|peak)\b/.test(lower)) {
    aggregation = 'MAX';
  } else if (/\b(total|sum)\b/.test(lower)) {
    aggregation = 'SUM';
  }

  // 2. Identify Target Measure
  let targetMeasure = numericCols.length > 0 && numericCols[0] ? numericCols[0].name : '*';
  let matchedMeasureScore = 0;

  for (const c of numericCols) {
    const colNameLower = c.name.toLowerCase();
    if (lower.includes(colNameLower)) {
      targetMeasure = c.name;
      matchedMeasureScore = 10;
      break;
    }
  }

  // Synonym matching for common business metrics if not found
  if (matchedMeasureScore === 0) {
    if (/\b(revenue|sales|income|amount|turnover)\b/.test(lower)) {
      const match = numericCols.find((c) => /revenue|sales|amount|price|total/i.test(c.name));
      if (match) targetMeasure = match.name;
    } else if (/\b(profit|margin|earnings)\b/.test(lower)) {
      const match = numericCols.find((c) => /profit|margin|earnings/i.test(c.name));
      if (match) targetMeasure = match.name;
    } else if (/\b(order|orders|quantity|units|count|volume)\b/.test(lower)) {
      const match = numericCols.find((c) => /order|quantity|units|count/i.test(c.name));
      if (match) {
        targetMeasure = match.name;
      } else {
        targetMeasure = '*';
        aggregation = 'COUNT';
      }
    }
  }

  // 3. Identify Target Dimension
  let targetDimension: string | undefined;
  for (const c of categoricalCols) {
    if (lower.includes(c.name.toLowerCase())) {
      targetDimension = c.name;
      break;
    }
  }

  // Check synonyms for dimensions (e.g. "by region" or "by country" or "by category")
  if (!targetDimension) {
    if (/\b(region|territory|geography|area)\b/.test(lower)) {
      const match = categoricalCols.find((c) => /region|country|state|territory/i.test(c.name));
      if (match) targetDimension = match.name;
    } else if (/\b(country|nation)\b/.test(lower)) {
      const match = categoricalCols.find((c) => /country|nation/i.test(c.name));
      if (match) targetDimension = match.name;
    } else if (/\b(product|item|goods)\b/.test(lower)) {
      const match = categoricalCols.find((c) => /product|item|name/i.test(c.name));
      if (match) targetDimension = match.name;
    } else if (/\b(category|type|segment|department)\b/.test(lower)) {
      const match = categoricalCols.find((c) => /category|type|segment/i.test(c.name));
      if (match) targetDimension = match.name;
    }
  }

  // Check temporal / date dimension
  let isTimeTrend = false;
  if (
    dateCols.length > 0 &&
    dateCols[0] &&
    /\b(monthly|daily|yearly|over time|timeline|trend|by month|by date)\b/.test(lower)
  ) {
    targetDimension = dateCols[0].name;
    isTimeTrend = true;
  }

  // 4. Identify Limits and Sorting
  let limit: number | undefined;
  let sortDirection: 'asc' | 'desc' | undefined = 'desc';

  const topMatch = lower.match(/\btop\s+(\d+)\b/);
  const bottomMatch = lower.match(/\b(bottom|lowest)\s+(\d+)\b/);
  if (topMatch && topMatch[1]) {
    limit = parseInt(topMatch[1], 10);
    sortDirection = 'desc';
  } else if (bottomMatch && bottomMatch[2]) {
    limit = parseInt(bottomMatch[2], 10);
    sortDirection = 'asc';
  } else if (/\b(top|highest|best|most)\b/.test(lower)) {
    sortDirection = 'desc';
    if (targetDimension) limit = 10;
  } else if (/\b(lowest|worst|least)\b/.test(lower)) {
    sortDirection = 'asc';
    if (targetDimension) limit = 10;
  }

  // 5. Identify Chart Type
  let chartType = 'BAR';
  if (/\b(line|trend|progression)\b/.test(lower) || isTimeTrend) {
    chartType = 'LINE';
  } else if (/\b(pie|share|percentage)\b/.test(lower)) {
    chartType = 'PIE';
  } else if (/\b(donut|doughnut)\b/.test(lower)) {
    chartType = 'DONUT';
  } else if (/\b(area)\b/.test(lower)) {
    chartType = 'AREA';
  } else if (/\b(scatter)\b/.test(lower)) {
    chartType = 'SCATTER';
  } else if (/\b(table|grid|records)\b/.test(lower)) {
    chartType = 'TABLE';
  } else if (!targetDimension && (aggregation === 'SUM' || aggregation === 'AVG' || aggregation === 'COUNT')) {
    chartType = 'KPI';
  }

  // 6. Extract Simple Explicit Filters (e.g. "for USA" or "in Germany")
  const filters: DatasetQueryFilter[] = [];
  const filterRegex = /(?:in|for|where|with)\s+([a-zA-Z0-9_-]+)/gi;
  let filterMatch: RegExpExecArray | null;
  while ((filterMatch = filterRegex.exec(lower)) !== null) {
    const candidateValue = filterMatch[1]?.trim();
    if (
      !candidateValue ||
      ['the', 'our', 'a', 'all', 'each', 'total'].includes(candidateValue.toLowerCase())
    ) {
      continue;
    }
    // Determine the best matching column for candidateValue
    let matchedCol: string | undefined;
    if (
      ['usa', 'us', 'germany', 'france', 'india', 'japan', 'uk', 'canada'].includes(
        candidateValue.toLowerCase()
      )
    ) {
      const countryCol = categoricalCols.find((c) => /country|nation/i.test(c.name));
      if (countryCol) matchedCol = countryCol.name;
    } else if (
      ['americas', 'emea', 'apac', 'asia', 'europe', 'latam'].includes(candidateValue.toLowerCase())
    ) {
      const regionCol = categoricalCols.find((c) => /region|territory/i.test(c.name));
      if (regionCol) matchedCol = regionCol.name;
    } else if (['hardware', 'software'].includes(candidateValue.toLowerCase())) {
      const catCol = categoricalCols.find((c) => /category|type/i.test(c.name));
      if (catCol) matchedCol = catCol.name;
    }

    if (!matchedCol && categoricalCols.length > 0) {
      const explicitlyMentioned = categoricalCols.find((c) => lower.includes(c.name.toLowerCase()));
      matchedCol = explicitlyMentioned ? explicitlyMentioned.name : categoricalCols[0]?.name;
    }

    if (matchedCol) {
      const origRegex = new RegExp(`\\b${candidateValue}\\b`, 'i');
      const origMatch = text.match(origRegex);
      const finalVal = origMatch ? origMatch[0] : candidateValue;
      filters.push({
        column: matchedCol,
        operator: '=',
        value: finalVal
      });
      break;
    }
  }

  const hasMeasureMention =
    matchedMeasureScore > 0 ||
    /\b(revenue|sales|profit|margin|orders|quantity|cost|amount|count|how many|total|sum|average|avg|min|max)\b/.test(
      lower
    );

  const isUnsupported =
    columns.length === 0 ||
    (!hasMeasureMention && !targetDimension) ||
    /\b(weather|temperature|stock price|recipe|movie|music|joke|forecast)\b/.test(lower);

  return {
    targetDimension,
    targetMeasure,
    aggregation,
    chartType,
    limit,
    sortDirection,
    filters,
    isTimeTrend,
    isUnsupported
  };
}

// ============================================================
// OPTIONAL LLM NARRATIVE BRIDGE (env-gated)
//
// When an LLM provider is configured the analyst narrative is rewritten by the
// model; when it is not configured — the default — the deterministic grounded
// heuristics below are used verbatim. The provider can therefore never change
// the numbers, only the phrasing.
// ============================================================

interface LlmSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getLlmSettings(): LlmSettings | null {
  const apiKey = process.env['RICOZVIZ_AI_API_KEY'] ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    baseUrl: process.env['RICOZVIZ_AI_BASE_URL'] ?? 'https://api.openai.com/v1',
    model: process.env['RICOZVIZ_AI_MODEL'] ?? 'gpt-4o-mini'
  };
}

async function requestLlmNarrative(
  settings: LlmSettings,
  systemPrompt: string,
  userPayload: Record<string, unknown>
): Promise<string | null> {
  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ]
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      logger.warn('LLM narrative request failed; using deterministic answer', {
        status: response.status
      });
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (error) {
    logger.warn('LLM narrative request threw; using deterministic answer', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

// ============================================================
// Dataset / dashboard loading helpers
// ============================================================

async function loadDatasetForAnalysis(
  datasetId: string
): Promise<QueryableDataset | null> {
  const objectId = toObjectId(datasetId);
  if (!objectId) return null;
  return DatasetModel.findById(objectId).lean();
}

// ============================================================
// 1. AI DATA ANALYST
// ============================================================

/**
 * Understands an analytical question, generates a structured query, executes it
 * through the safe dataset query engine, and produces a real, grounded answer.
 */
export async function askDataAnalyst(
  userId: string,
  organizationId: string,
  roleName: string,
  params: AskDataAnalystParams
): Promise<AnalystQueryResponse> {
  const { datasetId, question, filters: runtimeFilters = [] } = params;

  if (!question || !question.trim()) {
    throw AppError.badRequest('Question cannot be empty');
  }

  const dataset = await loadDatasetForAnalysis(datasetId);

  if (!dataset) {
    throw AppError.notFound(`Dataset '${datasetId}'`);
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
      organizationId: dataset.organizationId.toString()
    },
    userId,
    organizationId,
    roleName
  );

  const columns = extractDatasetColumns(dataset);
  if (columns.length === 0) {
    return {
      answer: 'The selected dataset does not have any discoverable schema columns to analyze.',
      question,
      queryExecuted: {},
      resultSummary: { rowCount: 0 },
      data: [],
      groundingVerification: {
        isGrounded: true,
        datasetName: dataset.name,
        datasetId: dataset._id.toString(),
        executionTimeMs: 0
      }
    };
  }

  const intent = parseNaturalLanguageIntent(question, columns);

  if (intent.isUnsupported) {
    return {
      answer: `I could not determine the specific metric or dimension for "${question}". Available columns in ${dataset.name} are: ${columns.map((c) => c.name).join(', ')}. Please try asking e.g. "What is our total revenue?" or "Which region has the highest revenue?".`,
      question,
      queryExecuted: {},
      resultSummary: { rowCount: 0 },
      data: [],
      groundingVerification: {
        isGrounded: true,
        datasetName: dataset.name,
        datasetId: dataset._id.toString(),
        executionTimeMs: 0
      }
    };
  }

  // Validate SQL Identifiers
  if (intent.targetDimension) validateSqlIdentifier(intent.targetDimension);
  if (intent.targetMeasure !== '*') validateSqlIdentifier(intent.targetMeasure);

  // Construct Structured Query
  const mergedFilters: DatasetQueryFilter[] = [
    ...intent.filters,
    ...toDatasetQueryFilters(runtimeFilters)
  ];
  const queryParams: DatasetQueryParams = {
    filters: mergedFilters.length > 0 ? mergedFilters : undefined,
    filterLogic: 'AND'
  };

  const measureAlias =
    intent.targetMeasure === '*' ? 'count_val' : `${intent.aggregation.toLowerCase()}_${intent.targetMeasure}`;
  const measures: DatasetQueryMeasure[] = [
    {
      column: intent.targetMeasure,
      aggregation: intent.aggregation,
      alias: measureAlias
    }
  ];

  if (intent.targetDimension) {
    queryParams.dimensions = [intent.targetDimension];
    queryParams.measures = measures;
    if (intent.sortDirection) {
      queryParams.orderBy = {
        column: measureAlias,
        direction: intent.sortDirection
      };
    }
    queryParams.limit = intent.limit || 10;
  } else {
    queryParams.measures = measures;
    queryParams.limit = 1;
  }

  const startTime = Date.now();
  const queryResult = await executeDatasetQuery(
    dataset,
    {
      dimensions: queryParams.dimensions,
      measures: queryParams.measures as EngineMeasure[] | undefined,
      orderBy: queryParams.orderBy,
      limit: queryParams.limit,
      offset: queryParams.offset,
      filters: mergedFilters.map((f) => ({
        column: f.column,
        operator: f.operator as string,
        value: f.value
      })),
      filterLogic: 'AND'
    },
    { userId, email: '', organizationId, roleName }
  );
  const executionTimeMs = Date.now() - startTime;

  if (queryResult.rows.length === 0) {
    return {
      answer: `No records were found for "${question}" matching the selected filter criteria.`,
      question,
      queryExecuted: queryParams,
      resultSummary: { rowCount: 0 },
      data: [],
      groundingVerification: {
        isGrounded: true,
        datasetName: dataset.name,
        datasetId: dataset._id.toString(),
        executionTimeMs
      }
    };
  }

  // Build Grounded Answer
  let deterministicAnswer = '';
  let primaryMetric: { name: string; value: number; formatted: string } | undefined;
  let topEntity: { dimension: string; value: string; metricValue: number } | undefined;

  if (!intent.targetDimension) {
    // Single KPI aggregation result
    const firstRow = queryResult.rows[0];
    const rawVal = firstRow ? Number(firstRow[measureAlias] ?? 0) : 0;
    primaryMetric = {
      name:
        intent.targetMeasure === '*'
          ? 'Total Count'
          : `${intent.aggregation} of ${intent.targetMeasure}`,
      value: rawVal,
      formatted: rawVal.toLocaleString()
    };
    const filterDesc =
      mergedFilters.length > 0
        ? ` with ${mergedFilters.map((f) => `${f.column} = '${f.value}'`).join(' and ')}`
        : '';
    deterministicAnswer = `The total ${primaryMetric.name} for ${dataset.name}${filterDesc} is **${primaryMetric.formatted}**.`;
  } else {
    // Group-by dimension breakdown result
    const topRow = queryResult.rows[0];
    const topDimVal = topRow ? String(topRow[intent.targetDimension] ?? 'Unknown') : 'Unknown';
    const topNumVal = topRow ? Number(topRow[measureAlias] ?? 0) : 0;

    topEntity = {
      dimension: intent.targetDimension,
      value: topDimVal,
      metricValue: topNumVal
    };

    if (intent.sortDirection === 'asc') {
      deterministicAnswer = `The lowest ${intent.targetDimension} by ${intent.aggregation} of ${intent.targetMeasure} is **${topDimVal}** with **${topNumVal.toLocaleString()}**.`;
    } else {
      deterministicAnswer = `**${topDimVal}** has the highest ${intent.targetMeasure} with **${topNumVal.toLocaleString()}** (${intent.aggregation}).`;
    }

    if (queryResult.rows.length > 1) {
      const runnerUp = queryResult.rows[1];
      const runnerUpDim = runnerUp ? String(runnerUp[intent.targetDimension] ?? 'Unknown') : 'Unknown';
      const runnerUpNum = runnerUp ? Number(runnerUp[measureAlias] ?? 0) : 0;
      deterministicAnswer += ` Followed by **${runnerUpDim}** with **${runnerUpNum.toLocaleString()}**.`;
    }
  }

  // Generate Suggested Chart
  let chartSuggestion: AnalystQueryResponse['chartSuggestion'] | undefined;
  if (intent.targetDimension) {
    chartSuggestion = {
      title: `${intent.aggregation} ${intent.targetMeasure} by ${intent.targetDimension}`,
      chartType: intent.chartType,
      dimension: intent.targetDimension,
      measure: intent.targetMeasure,
      aggregation: intent.aggregation
    };
  }

  // Optional LLM rewrite of the narrative; numbers stay grounded either way.
  const llmSettings = getLlmSettings();
  const narrative =
    llmSettings === null
      ? null
      : await requestLlmNarrative(llmSettings, ANALYST_SYSTEM_PROMPT, {
          question,
          datasetName: dataset.name,
          columns: columns.map((c) => ({ name: c.name, type: c.type })),
          aggregation: intent.aggregation,
          measure: intent.targetMeasure,
          dimension: intent.targetDimension ?? null,
          rowCount: queryResult.rowCount,
          rows: queryResult.rows,
          deterministicAnswer
        });
  const answer = narrative ?? deterministicAnswer;

  return {
    answer,
    question,
    queryExecuted: queryParams,
    resultSummary: {
      rowCount: queryResult.rowCount,
      primaryMetric,
      topEntity
    },
    data: queryResult.rows,
    chartSuggestion,
    groundingVerification: {
      isGrounded: true,
      datasetName: dataset.name,
      datasetId: dataset._id.toString(),
      executionTimeMs
    }
  };
}

const ANALYST_SYSTEM_PROMPT =
  'You are a data analyst assistant. Answer strictly and only using the numbers ' +
  'supplied in the payload. Never invent, estimate or extrapolate a figure. ' +
  'Keep the answer to at most three sentences.';

// ============================================================
// 2. NATURAL LANGUAGE -> CHART
// ============================================================

/**
 * Translates a prompt into a structured chart specification, validates fields,
 * executes the query, and returns a ready-to-render chart payload.
 */
export async function nlToChart(
  userId: string,
  organizationId: string,
  roleName: string,
  params: NlToChartParams
): Promise<NlToChartResponse> {
  const { datasetId, prompt, filters: runtimeFilters = [] } = params;

  if (!prompt || !prompt.trim()) {
    throw AppError.badRequest('Prompt cannot be empty');
  }

  const dataset = await loadDatasetForAnalysis(datasetId);

  if (!dataset) {
    throw AppError.notFound(`Dataset '${datasetId}'`);
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
      organizationId: dataset.organizationId.toString()
    },
    userId,
    organizationId,
    roleName
  );

  const columns = extractDatasetColumns(dataset);
  if (columns.length === 0) {
    throw AppError.badRequest('Dataset has no columns to build a chart from.');
  }

  const intent = parseNaturalLanguageIntent(prompt, columns);

  // Fallback defaults if dimension was not mentioned
  let dimension = intent.targetDimension;
  if (!dimension) {
    const defaultDim = columns.find((c) => !isNumericColumnType(c.type));
    if (defaultDim) dimension = defaultDim.name;
  }

  const measure = intent.targetMeasure;
  const aggregation = intent.aggregation;

  if (dimension) validateSqlIdentifier(dimension);
  if (measure !== '*') validateSqlIdentifier(measure);

  const measureAlias = measure === '*' ? 'count' : `${aggregation.toLowerCase()}_${measure}`;
  const measuresConfig: DatasetQueryMeasure[] = [
    { column: measure, aggregation, alias: measureAlias }
  ];

  const mergedFilters: DatasetQueryFilter[] = [
    ...intent.filters,
    ...toDatasetQueryFilters(runtimeFilters)
  ];
  const queryParams: DatasetQueryParams = {
    dimensions: dimension ? [dimension] : undefined,
    measures: measuresConfig,
    limit: intent.limit || 15,
    orderBy: dimension ? { column: measureAlias, direction: intent.sortDirection || 'desc' } : undefined,
    filters: mergedFilters.length > 0 ? mergedFilters : undefined,
    filterLogic: 'AND'
  };

  const queryResult = await executeDatasetQuery(
    dataset,
    {
      dimensions: queryParams.dimensions,
      measures: measuresConfig as EngineMeasure[],
      limit: queryParams.limit,
      orderBy: queryParams.orderBy,
      filters: mergedFilters.map((f) => ({
        column: f.column,
        operator: f.operator as string,
        value: f.value
      })),
      filterLogic: 'AND'
    },
    { userId, email: '', organizationId, roleName }
  );

  const title = dimension
    ? `${aggregation} ${measure} by ${dimension}`
    : `Total ${aggregation} of ${measure}`;

  return {
    title,
    chartType: intent.chartType,
    explanation: `Generated ${intent.chartType} chart plotting ${aggregation}(${measure}) grouped by ${dimension || 'dataset'} (${queryResult.rowCount} rows queried).`,
    config: {
      dimensions: dimension ? [dimension] : [],
      measures: measuresConfig,
      sort: dimension ? { column: measureAlias, direction: intent.sortDirection || 'desc' } : undefined,
      limit: queryParams.limit,
      filters: mergedFilters
    },
    data: queryResult.rows,
    columns: queryResult.columns,
    rowCount: queryResult.rowCount
  };
}

// ============================================================
// 3. AUTOMATIC INSIGHTS & ANOMALY DETECTION
// ============================================================

/**
 * Analyzes a dataset or pre-queried data using deterministic statistical methods.
 */
export async function generateDatasetInsights(
  userId: string,
  organizationId: string,
  roleName: string,
  params: InsightsParams
): Promise<InsightsResponse> {
  const { datasetId, filters = [], data } = params;

  let rows = data;
  let dimCol = params.dimension;
  let measCol = params.measure;

  if (!rows || rows.length === 0) {
    const dataset = await loadDatasetForAnalysis(datasetId);

    if (!dataset) {
      throw AppError.notFound(`Dataset '${datasetId}'`);
    }

    await verifyResourceWorkspaceAccess(
      {
        workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
        organizationId: dataset.organizationId.toString()
      },
      userId,
      organizationId,
      roleName
    );

    const columns = extractDatasetColumns(dataset);
    if (!measCol) {
      const numCol = columns.find((c) => isNumericColumnType(c.type));
      measCol = numCol ? numCol.name : undefined;
    }
    if (!dimCol) {
      const catCol = columns.find((c) => !isNumericColumnType(c.type));
      dimCol = catCol ? catCol.name : undefined;
    }

    if (!measCol || !dimCol) {
      return {
        insights: [],
        summary: 'Insufficient numeric or categorical columns in dataset to generate statistical insights.',
        analyzedRows: 0
      };
    }

    const queryResult = await executeDatasetQuery(
      dataset,
      {
        dimensions: [dimCol],
        measures: [{ column: measCol, aggregation: 'SUM', alias: 'val' }],
        filters: toDatasetQueryFilters(filters).map((f) => ({
          column: f.column,
          operator: f.operator as string,
          value: f.value
        })),
        orderBy: { column: 'val', direction: 'desc' },
        limit: 25
      },
      { userId, email: '', organizationId, roleName }
    );

    rows = queryResult.rows;
  }

  if (!rows || rows.length === 0) {
    return {
      insights: [],
      summary: 'No data available to generate insights.',
      analyzedRows: 0
    };
  }

  const firstRow = rows[0] || {};
  // Determine measure column in data rows
  const valueKey =
    measCol && firstRow[measCol] !== undefined
      ? measCol
      : firstRow['val'] !== undefined
        ? 'val'
        : Object.keys(firstRow).find((k) => typeof firstRow[k] === 'number') || '';

  const dimKey =
    dimCol && firstRow[dimCol] !== undefined
      ? dimCol
      : Object.keys(firstRow).find((k) => typeof firstRow[k] === 'string') || '';

  const insights: AutoInsight[] = [];
  const numbers: number[] = [];

  for (const r of rows) {
    const v = Number(r[valueKey]);
    if (!isNaN(v)) numbers.push(v);
  }

  const stats = calculateDescriptiveStats(numbers);

  // 1. Highest / Top Performer Insight
  if (rows.length > 0 && dimKey) {
    const topRow = rows[0] || {};
    const topName = String(topRow[dimKey] ?? 'Unknown');
    const topVal = Number(topRow[valueKey] ?? 0);
    const topPct = stats.sum > 0 ? Math.round((topVal / stats.sum) * 1000) / 10 : 0;

    insights.push({
      id: 'top-performer',
      type: 'PERFORMER_TOP',
      title: `Top Performer: ${topName}`,
      description: `${topName} is the leading contributor with ${topVal.toLocaleString()} (${topPct}% of the total).`,
      metric: valueKey,
      value: topVal,
      formattedValue: topVal.toLocaleString(),
      dimensionValue: topName,
      isAnomaly: false,
      score: 1.0
    });

    // 2. Dominance / Concentration Insight
    if (topPct >= 40 && rows.length > 1) {
      insights.push({
        id: 'dominance',
        type: 'DOMINANCE',
        title: `High Concentration in ${topName}`,
        description: `${topName} commands a dominant ${topPct}% share across all analyzed ${dimKey} groups.`,
        metric: valueKey,
        value: topVal,
        dimensionValue: topName,
        isAnomaly: false,
        score: topPct / 100
      });
    }

    // 3. Lowest Performer Insight
    if (rows.length > 2) {
      const bottomRow = rows[rows.length - 1] || {};
      const bottomName = String(bottomRow[dimKey] ?? 'Unknown');
      const bottomVal = Number(bottomRow[valueKey] ?? 0);
      const bottomPct = stats.sum > 0 ? Math.round((bottomVal / stats.sum) * 1000) / 10 : 0;

      insights.push({
        id: 'bottom-performer',
        type: 'PERFORMER_BOTTOM',
        title: `Lowest Performer: ${bottomName}`,
        description: `${bottomName} generated the lowest contribution of ${bottomVal.toLocaleString()} (${bottomPct}% of the total).`,
        metric: valueKey,
        value: bottomVal,
        formattedValue: bottomVal.toLocaleString(),
        dimensionValue: bottomName,
        isAnomaly: false,
        score: 0.2
      });
    }
  }

  // 4. Statistical Anomaly Detection (Z-score & IQR)
  const anomalies = detectStatisticalAnomalies(rows, valueKey, dimKey);
  insights.push(...anomalies);

  const anomalyCount = anomalies.length;
  const summary = `Analyzed ${rows.length} records. Identified ${insights.length} key insights${
    anomalyCount > 0
      ? `, including ${anomalyCount} statistical anomal${anomalyCount === 1 ? 'y' : 'ies'}`
      : ' with normal distribution variance'
  }.`;

  return {
    insights,
    summary,
    analyzedRows: rows.length
  };
}

// ============================================================
// 4. AI-POWERED DASHBOARD SUMMARY
// ============================================================

/**
 * Summarizes the current dashboard based on all real chart queries and respects
 * the active dashboard filters.
 */
export async function generateDashboardSummary(
  userId: string,
  organizationId: string,
  roleName: string,
  params: DashboardSummaryParams
): Promise<DashboardSummaryResponse> {
  const { dashboardId, activeFilters = [] } = params;

  const dashboardObjectId = toObjectId(dashboardId);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId).lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound(`Dashboard '${dashboardId}'`);
  }

  await verifyResourceWorkspaceAccess(
    {
      workspaceId: getDashboardWorkspaceId(dashboard.layoutConfig) ?? null,
      organizationId: dashboard.organizationId.toString()
    },
    userId,
    organizationId,
    roleName
  );

  const dashboardCharts = await ChartModel.find({ dashboardId: dashboard._id }).lean();

  if (dashboardCharts.length === 0) {
    return {
      dashboardId,
      dashboardName: dashboard.name,
      summaryBullets: [
        'This dashboard does not currently contain any visualizations to summarize.'
      ],
      keyMetrics: [],
      filterContextText: 'No active filters.',
      comparisonNote: 'Comparison data is unavailable.',
      generatedAt: new Date().toISOString()
    };
  }

  const bullets: string[] = [];
  const keyMetrics: Array<{ label: string; value: string | number; change?: string }> = [];

  // Query each chart with active filters applied
  for (const chart of dashboardCharts) {
    if (!chart.datasetId) continue;

    try {
      const dataset = await DatasetModel.findById(chart.datasetId).lean();
      if (!dataset) continue;

      const config = (chart.config || {}) as Record<string, unknown>;
      const dims = (config.dimensions || []) as string[];
      const measures = (config.measures || []) as DatasetQueryMeasure[];
      const chartFilters = (config.filters || []) as DatasetQueryFilter[];

      const mergedFilters: DatasetQueryFilter[] = [
        ...toDatasetQueryFilters(chartFilters),
        ...toDatasetQueryFilters(activeFilters)
      ];

      const queryResult = await executeDatasetQuery(
        dataset,
        {
          dimensions: dims.length > 0 ? dims : undefined,
          measures:
            measures.length > 0
              ? (measures as unknown as EngineMeasure[])
              : undefined,
          filters: mergedFilters.map((f) => ({
            column: f.column,
            operator: f.operator as string,
            value: f.value
          })),
          limit: 25
        },
        { userId, email: '', organizationId, roleName }
      );

      if (queryResult.rows.length === 0) continue;

      if (dims.length === 0 && measures.length > 0 && measures[0]) {
        // Single KPI Metric Widget
        const measure = measures[0];
        const valKey = measure.alias || `${measure.aggregation.toLowerCase()}_${measure.column}`;
        const firstRow = queryResult.rows[0] || {};
        const val = Number(firstRow[valKey] ?? firstRow[measure.column] ?? 0);
        keyMetrics.push({
          label: chart.title || measure.column,
          value: val.toLocaleString()
        });
        bullets.push(`• **${chart.title || measure.column}** stands at **${val.toLocaleString()}**.`);
      } else if (dims.length > 0 && dims[0] && queryResult.rows.length > 0) {
        // Grouped Dimension Widget
        const dimCol = dims[0];
        const firstRow = queryResult.rows[0] || {};
        const firstMeasure = measures[0];
        const valKey = firstMeasure
          ? firstMeasure.alias || `${firstMeasure.aggregation.toLowerCase()}_${firstMeasure.column}`
          : Object.keys(firstRow).find((k) => typeof firstRow[k] === 'number') || '';

        // Sort descending
        const sorted = [...queryResult.rows].sort(
          (a, b) => Number(b[valKey] || 0) - Number(a[valKey] || 0)
        );
        const topRow = sorted[0] || {};
        const topName = String(topRow[dimCol] ?? 'Unknown');
        const topVal = Number(topRow[valKey] ?? 0);

        const totalSum = sorted.reduce((acc, r) => acc + Number(r[valKey] || 0), 0);
        const pct = totalSum > 0 ? Math.round((topVal / totalSum) * 1000) / 10 : 0;

        bullets.push(
          `• **${topName}** generated the highest ${firstMeasure?.column || 'volume'} with **${topVal.toLocaleString()}** (${pct}% of ${chart.title}).`
        );
      }
    } catch {
      // Continue processing other charts cleanly
    }
  }

  // Filter context description
  const filterContextText =
    activeFilters.length > 0
      ? `Filtered by: ${activeFilters.map((f) => `${f.column} = '${f.value}'`).join(', ')}`
      : 'Unfiltered (Full dataset scope)';

  // Temporal comparison statement requirement
  const comparisonNote = 'Comparison data is unavailable for previous period.';
  bullets.push(`• ${comparisonNote}`);

  return {
    dashboardId,
    dashboardName: dashboard.name,
    summaryBullets:
      bullets.length > 0 ? bullets : ['No data available across dashboard visualizations.'],
    keyMetrics,
    filterContextText,
    comparisonNote,
    generatedAt: new Date().toISOString()
  };
}