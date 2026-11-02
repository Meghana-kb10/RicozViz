// ========================================
// Dataset Query Engine (Safe, Reusable Query Foundation)
// ========================================
// Powers raw table exploration, filtering, sorting, pagination,
// aggregations, and group-by querying for visualizations.
// Enforces strict allow-lists and parameterized execution to prevent SQL injection.
// ========================================

import type { Client } from 'pg';
import { AppError } from '../../../utils/errors.js';
import { duckdbStore } from './duckdb-store.js';
import { validateSqlIdentifier } from './schema-discovery.js';
import { compileCalculatedField, evaluateExpression } from './calculated-field.engine.js';
import { resolveUserRlsFilters, type UserSecurityContext } from './rls.service.js';
import type {
  AggregationFunction,
  DatasetQueryParams,
  DatasetQueryResult,
  FilterOperator,
  QueryResultColumn
} from '@repo/types';

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

export const FILTER_OPERATOR_ALIASES: Record<string, FilterOperator> = {
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

function isAllowedAggregation(value: string): value is AggregationFunction {
  return (ALLOWED_AGGREGATIONS as readonly string[]).includes(value);
}

function isAllowedFilterOperator(value: string): value is FilterOperator {
  return (ALLOWED_FILTER_OPERATORS as readonly string[]).includes(value);
}

/**
 * The minimal dataset projection the engine needs. Structurally compatible with
 * the RLS resolver's target type, and satisfied by the lean/serialized dataset.
 */
export interface QueryableDataset {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  type?: string;
  dataSourceId?: string | null;
  schemaMeta?: Record<string, unknown> | null;
  columns?: Array<{ name: string; dataType?: string | null }> | null;
}

/** A filter whose operator survived alias normalisation and allow-list checks. */
interface ValidatedFilter {
  column: string;
  operator: FilterOperator | string;
  value?: unknown;
}

/** A measure whose aggregation, column and alias all passed validation. */
interface ValidatedMeasure {
  column: string;
  aggregation: AggregationFunction;
  alias: string;
  resultType: string;
}

/** Query params enriched with the optional caller security context. */
export interface DatasetQueryEngineParams extends DatasetQueryParams {
  user?: UserSecurityContext | null;
  userContext?: UserSecurityContext | null;
  timeoutMs?: number;
  timeout?: number;
}

/** Normalised, lower-cased ordering directive. */
interface OrderBySpec {
  column: string;
  direction: 'asc' | 'desc';
}

/** Ordering directive as it arrives from the (case-insensitive) request payload. */
interface RawOrderBySpec {
  column: string;
  direction: string;
}

/**
 * Legacy `prisma.$queryRawUnsafe` equivalent: a lazily created `pg` client
 * built from `DATABASE_URL`. When the variable is absent (the default in dev
 * and CI) the constructor throws and the engine transparently falls back to
 * in-memory execution against the stored sample data.
 */
let pgClientPromise: Promise<Client> | null = null;

async function getPostgresClient(): Promise<Client> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!pgClientPromise) {
    pgClientPromise = (async () => {
      const { Client: PgClient } = await import('pg');
      const client = new PgClient({ connectionString });
      await client.connect();
      return client;
    })().catch((error: unknown) => {
      pgClientPromise = null;
      throw error;
    });
  }
  return pgClientPromise;
}

/** Release the memoized live connection (used on process shutdown). */
export async function closeQueryEngineConnection(): Promise<void> {
  if (!pgClientPromise) return;
  const pending = pgClientPromise;
  pgClientPromise = null;
  try {
    const client = await pending;
    await client.end();
  } catch {
    // Nothing to close.
  }
}

// ============================================================
// QUERY ENGINE IMPLEMENTATION
// ============================================================

export class DatasetQueryEngine {
  /**
   * Main entry point: Executes a validated, bounded query against a dataset.
   */
  async executeQuery(
    dataset: QueryableDataset,
    params: DatasetQueryEngineParams = {},
    userContext?: UserSecurityContext | null
  ): Promise<DatasetQueryResult> {
    const startTime = Date.now();

    // 0. Resolve Row-Level Security (RLS) constraints for the requesting user
    const resolvedUser = userContext ?? params.userContext ?? params.user ?? null;
    const rlsFilters = await resolveUserRlsFilters(dataset, resolvedUser);

    // 1. Extract schema metadata and known columns
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    const knownColumnsList = (meta.columns || []) as Array<{
      name: string;
      type: string;
      nullable?: boolean;
    }>;

    const columnTypeMap = new Map<string, string>();
    if (Array.isArray(dataset.columns) && dataset.columns.length > 0) {
      for (const c of dataset.columns) {
        columnTypeMap.set(c.name, (c.dataType || 'STRING').toLowerCase());
      }
    }
    for (const c of knownColumnsList) {
      if (!columnTypeMap.has(c.name)) {
        columnTypeMap.set(c.name, (c.type || 'string').toLowerCase());
      }
    }

    // Register calculated fields in columnTypeMap so dimensions/measures/filters accept them
    const calculatedFields: Array<{
      name: string;
      expression: string;
      dataType?: string;
    }> = Array.isArray(meta.calculatedFields)
      ? (meta.calculatedFields as Array<{
          name: string;
          expression: string;
          dataType?: string;
        }>)
      : [];

    for (const cf of calculatedFields) {
      if (!columnTypeMap.has(cf.name)) {
        columnTypeMap.set(cf.name, (cf.dataType || 'NUMBER').toLowerCase());
      }
    }

    const knownColumnNames = Array.from(columnTypeMap.keys());

    // 2. Normalize aliases for dimensions, measures, sorting
    const rawDimensions = (params.dimensions || params.groupBy || []).filter(Boolean);

    let rawMeasures: Array<{ column: string; aggregation: string; alias?: string }> = [];
    if (Array.isArray(params.measures) && params.measures.length > 0) {
      rawMeasures = params.measures as Array<{
        column: string;
        aggregation: string;
        alias?: string;
      }>;
    } else if (Array.isArray(params.aggregations) && params.aggregations.length > 0) {
      rawMeasures = params.aggregations.map((a) => {
        const rawFn = String(a.function || a.aggregation || 'COUNT').toUpperCase();
        const fn: AggregationFunction = isAllowedAggregation(rawFn) ? rawFn : 'COUNT';
        const col = a.column ?? '*';
        return {
          column: col,
          aggregation: fn,
          alias:
            a.alias || (col === '*' ? `${fn.toLowerCase()}_count` : `${fn.toLowerCase()}_${col}`)
        };
      });
    }

    let rawOrderBy: RawOrderBySpec | undefined = params.orderBy as RawOrderBySpec | undefined;
    if (!rawOrderBy) {
      if (params.sort) {
        rawOrderBy = (
          Array.isArray(params.sort) ? params.sort[0] : params.sort
        ) as RawOrderBySpec;
      } else if (params.sorting) {
        if (Array.isArray(params.sorting) && params.sorting.length > 0) {
          rawOrderBy = params.sorting[0] as RawOrderBySpec;
        } else if (typeof params.sorting === 'object') {
          rawOrderBy = params.sorting as RawOrderBySpec;
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
      throw AppError.badRequest(
        `Invalid offset: must be between 0 and ${QUERY_LIMITS.MAX_OFFSET}`
      );
    }
    const offset = requestedOffset;

    // 4. Determine Query Mode (Raw vs Aggregate)
    const hasDimensions = rawDimensions.length > 0;
    const hasMeasures = rawMeasures.length > 0;
    const isAggregate = hasDimensions || hasMeasures;

    // 5. Validate Dimensions & Measures (if aggregate) or Columns (if raw)
    const validatedDimensions: string[] = [];
    const validatedMeasures: ValidatedMeasure[] = [];

    let selectedColumns: string[] = [];

    if (isAggregate) {
      // Validate dimensions
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

      // Validate measures
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

        if (!isAllowedAggregation(m.aggregation)) {
          throw AppError.badRequest(`Unsupported aggregation function "${m.aggregation}"`);
        }

        // Check type compatibility for SUM and AVG
        if (m.column !== '*') {
          const colType = columnTypeMap.get(m.column) || 'string';
          if (
            (m.aggregation === 'SUM' || m.aggregation === 'AVG') &&
            colType !== 'number' &&
            colType !== 'integer'
          ) {
            throw AppError.badRequest(
              `Aggregation "${m.aggregation}" cannot be applied to non-numeric column "${m.column}" (type: ${colType})`
            );
          }
        }

        // Alias handling & validation
        const defaultAlias = `${m.aggregation.toLowerCase()}_${m.column === '*' ? 'count' : m.column}`;
        const finalAlias = m.alias ? validateSqlIdentifier(m.alias) : defaultAlias;

        // Compute result type
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
      // Raw Mode: Validate requested columns
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
    const validatedFilters: ValidatedFilter[] = [];
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
        const rawOp = filter.operator as string;
        const alias =
          typeof rawOp === 'string'
            ? FILTER_OPERATOR_ALIASES[rawOp] || FILTER_OPERATOR_ALIASES[rawOp.toLowerCase()]
            : undefined;
        const op: FilterOperator | string = alias || rawOp;

        if (!isAllowedFilterOperator(op)) {
          throw AppError.badRequest(`Unsupported filter operator: "${filter.operator}"`);
        }

        const colType = columnTypeMap.get(colName) || 'string';
        const validatedValue = this.validateAndCoerceFilterValue(
          colType,
          op as FilterOperator,
          filter.value,
          colName
        );

        validatedFilters.push({
          column: colName,
          operator: op,
          value: validatedValue
        });
      }
    }

    const filterLogic: 'AND' | 'OR' =
      (params.filterLogic || params.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';

    // 7. Validate Ordering
    let validatedOrderBy: OrderBySpec | undefined;
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

    // 8. Choose Execution Backend: Live PostgreSQL vs. In-Memory / CSV
    const isPostgresConnected = dataset.type === 'CONNECTED' && dataset.dataSourceId;
    const tableName = (meta.tableName as string) || null;

    if (isPostgresConnected && tableName) {
      try {
        const liveResult = await this.executePostgresQuery({
          dataset,
          tableName,
          isAggregate,
          selectedColumns,
          dimensions: validatedDimensions,
          measures: validatedMeasures,
          filters: validatedFilters,
          filterLogic,
          rlsFilters,
          orderBy: validatedOrderBy,
          limit,
          offset,
          columnTypeMap,
          startTime
        });
        return liveResult;
      } catch (err) {
        // If error is an intentional AppError, rethrow
        if (err instanceof AppError) throw err;
        // In dev/test environments without a live PostgreSQL instance,
        // fallback gracefully to execute against stored sampleData
      }
    }

    // DuckDB Vectorized In-Memory OLAP Execution
    return this.executeDuckDBQuery({
      dataset,
      meta,
      isAggregate,
      selectedColumns,
      dimensions: validatedDimensions,
      measures: validatedMeasures,
      filters: validatedFilters,
      filterLogic,
      rlsFilters,
      orderBy: validatedOrderBy,
      limit,
      offset,
      columnTypeMap,
      startTime,
      timeoutMs: params.timeoutMs ?? params.timeout ?? 5000
    });
  }

  // ============================================================
  // POSTGRESQL QUERY EXECUTION (Parameterized & Injection Safe)
  // ============================================================

  private async executePostgresQuery(opts: {
    dataset: QueryableDataset;
    tableName: string;
    isAggregate: boolean;
    selectedColumns: string[];
    dimensions: string[];
    measures: ValidatedMeasure[];
    filters: ValidatedFilter[];
    filterLogic: 'AND' | 'OR';
    rlsFilters?: ValidatedFilter[];
    orderBy?: OrderBySpec;
    limit: number;
    offset: number;
    columnTypeMap: Map<string, string>;
    startTime: number;
  }): Promise<DatasetQueryResult> {
    const safeTable = validateSqlIdentifier(opts.tableName);
    const sqlParams: unknown[] = [];

    // Construct SELECT clause
    let selectClause = '';
    const resultColumns: QueryResultColumn[] = [];

    if (opts.isAggregate) {
      const selectParts: string[] = [];
      for (const dim of opts.dimensions) {
        selectParts.push(`"${dim}"`);
        resultColumns.push({
          name: dim,
          type: opts.columnTypeMap.get(dim) || 'string'
        });
      }
      for (const m of opts.measures) {
        const colExpr = m.column === '*' ? '*' : `"${m.column}"`;
        selectParts.push(`${m.aggregation}(${colExpr}) AS "${m.alias}"`);
        resultColumns.push({
          name: m.alias,
          type: m.resultType
        });
      }
      selectClause = selectParts.join(', ');
    } else {
      selectClause = opts.selectedColumns.map((col) => `"${col}"`).join(', ');
      for (const col of opts.selectedColumns) {
        resultColumns.push({
          name: col,
          type: opts.columnTypeMap.get(col) || 'string'
        });
      }
    }

    // Construct WHERE clause with parameterized values
    const allWhereSegments: string[] = [];

    const buildFilterSql = (f: ValidatedFilter, outList: string[]): void => {
      const quotedCol = `"${f.column}"`;
      if (f.operator === 'isNull') {
        outList.push(`${quotedCol} IS NULL`);
      } else if (f.operator === 'isNotNull') {
        outList.push(`${quotedCol} IS NOT NULL`);
      } else if (f.operator === '=') {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} = $${sqlParams.length}`);
      } else if (f.operator === '!=') {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} != $${sqlParams.length}`);
      } else if (f.operator === '>') {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} > $${sqlParams.length}`);
      } else if (f.operator === '>=') {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} >= $${sqlParams.length}`);
      } else if (f.operator === '<') {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} < $${sqlParams.length}`);
      } else if (f.operator === '<=') {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} <= $${sqlParams.length}`);
      } else if (f.operator === 'contains') {
        sqlParams.push(`%${String(f.value)}%`);
        outList.push(`${quotedCol}::text ILIKE $${sqlParams.length}`);
      } else if (f.operator === 'startsWith') {
        sqlParams.push(`${String(f.value)}%`);
        outList.push(`${quotedCol}::text ILIKE $${sqlParams.length}`);
      } else if (f.operator === 'endsWith') {
        sqlParams.push(`%${String(f.value)}`);
        outList.push(`${quotedCol}::text ILIKE $${sqlParams.length}`);
      } else if (f.operator === 'in') {
        const rawItems = Array.isArray(f.value) ? f.value : [f.value];
        sqlParams.push(rawItems.map((v) => String(v)));
        outList.push(`${quotedCol}::text = ANY($${sqlParams.length}::text[])`);
      }
    };

    // 1. Mandatory Row-Level Security (RLS) constraints
    if (opts.rlsFilters && opts.rlsFilters.length > 0) {
      const rlsConditions: string[] = [];
      for (const f of opts.rlsFilters) {
        buildFilterSql(f, rlsConditions);
      }
      if (rlsConditions.length > 0) {
        allWhereSegments.push(`(${rlsConditions.join(' AND ')})`);
      }
    }

    // 2. User query filters
    if (opts.filters.length > 0) {
      const filterConditions: string[] = [];
      for (const f of opts.filters) {
        buildFilterSql(f, filterConditions);
      }
      if (filterConditions.length > 0) {
        allWhereSegments.push(`(${filterConditions.join(` ${opts.filterLogic} `)})`);
      }
    }

    let whereClause = '';
    if (allWhereSegments.length > 0) {
      whereClause = ` WHERE ${allWhereSegments.join(' AND ')}`;
    }

    // Construct GROUP BY clause
    let groupByClause = '';
    if (opts.isAggregate && opts.dimensions.length > 0) {
      groupByClause = ` GROUP BY ${opts.dimensions.map((d) => `"${d}"`).join(', ')}`;
    }

    // Construct ORDER BY clause
    let orderByClause = '';
    if (opts.orderBy) {
      orderByClause = ` ORDER BY "${opts.orderBy.column}" ${opts.orderBy.direction.toUpperCase()}`;
    }

    // Limit and Offset parameters
    sqlParams.push(opts.limit);
    const limitPlaceholder = `$${sqlParams.length}`;
    sqlParams.push(opts.offset);
    const offsetPlaceholder = `$${sqlParams.length}`;

    const sql = `SELECT ${selectClause} FROM "${safeTable}"${whereClause}${groupByClause}${orderByClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

    const client = await getPostgresClient();
    const queryResult = await client.query(sql, sqlParams);
    const rows = (queryResult.rows ?? []) as Record<string, unknown>[];
    const count = rows ? rows.length : 0;
    const executionTimeMs = Date.now() - opts.startTime;

    return {
      columns: resultColumns,
      rows: rows || [],
      processedColumns: resultColumns,
      processedRows: rows || [],
      rowCount: count,
      total: count,
      limit: opts.limit,
      offset: opts.offset,
      executionTimeMs,
      metadata: {
        rowCount: count,
        total: count,
        limit: opts.limit,
        offset: opts.offset,
        executionTimeMs,
        queryMode: opts.isAggregate ? 'AGGREGATE' : 'RAW'
      }
    };
  }

  // ============================================================
  // DUCKDB VECTORIZED IN-MEMORY OLAP ENGINE
  // ============================================================

  /**
   * DuckDB Vectorized In-Memory OLAP Engine Query Execution:
   * Real execution via DuckDB C++ embedded engine for sub-second aggregations.
   * Supports SUM/AVG/COUNT/MIN/MAX, GROUP BY, ORDER BY, filters, calculated columns,
   * row limits, and query timeouts with RLS WHERE rewriting.
   */
  private async executeDuckDBQuery(opts: {
    dataset: QueryableDataset;
    meta: Record<string, unknown>;
    isAggregate: boolean;
    selectedColumns: string[];
    dimensions: string[];
    measures: ValidatedMeasure[];
    filters: ValidatedFilter[];
    filterLogic: 'AND' | 'OR';
    rlsFilters?: ValidatedFilter[];
    orderBy?: OrderBySpec;
    limit: number;
    offset: number;
    columnTypeMap: Map<string, string>;
    startTime: number;
    timeoutMs?: number;
  }): Promise<DatasetQueryResult> {
    const tableName = await duckdbStore.ensureDatasetTable(opts.dataset);
    const resultColumns: QueryResultColumn[] = [];
    const selectParts: string[] = [];

    if (opts.isAggregate) {
      for (const dim of opts.dimensions) {
        selectParts.push(`"${dim}"`);
        resultColumns.push({
          name: dim,
          type: opts.columnTypeMap.get(dim) || 'string'
        });
      }
      for (const m of opts.measures) {
        const colExpr = m.column === '*' ? '*' : `"${m.column}"`;
        if (m.aggregation === 'AVG' || m.aggregation === 'SUM') {
          selectParts.push(`ROUND(${m.aggregation}(${colExpr}), 3) AS "${m.alias}"`);
        } else {
          selectParts.push(`${m.aggregation}(${colExpr}) AS "${m.alias}"`);
        }
        resultColumns.push({
          name: m.alias,
          type: m.resultType
        });
      }
    } else {
      for (const col of opts.selectedColumns) {
        selectParts.push(`"${col}"`);
        resultColumns.push({
          name: col,
          type: opts.columnTypeMap.get(col) || 'string'
        });
      }
    }

    // Helper to format a filter into DuckDB SQL
    const formatFilterSql = (f: ValidatedFilter): string => {
      const col = `"${f.column}"`;
      const colType = (opts.columnTypeMap.get(f.column) || 'string').toLowerCase();

      if (f.operator === 'isNull') {
        return `${col} IS NULL`;
      }
      if (f.operator === 'isNotNull') {
        return `${col} IS NOT NULL`;
      }
      if (f.operator === 'in') {
        const rawList = Array.isArray(f.value) ? f.value : [f.value];
        if (colType === 'number' || colType === 'integer') {
          const nums = rawList.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
          if (nums.length === 0) return '1=0';
          return `${col} IN (${nums.join(', ')})`;
        }
        const strList = rawList.map((v) => `'${String(v).replace(/'/g, "''")}'`);
        if (strList.length === 0) return '1=0';
        return `CAST(${col} AS VARCHAR) IN (${strList.join(', ')})`;
      }

      if (colType === 'number' || colType === 'integer') {
        const num = Number(f.value);
        if (Number.isNaN(num)) return '1=0';
        return `${col} ${f.operator} ${num}`;
      }

      if (colType === 'boolean') {
        const boolVal = Boolean(f.value);
        return `${col} ${f.operator === '!=' ? '!=' : '='} ${boolVal ? 'TRUE' : 'FALSE'}`;
      }

      if (colType === 'date' || colType === 'datetime') {
        const d = new Date(f.value as any);
        const iso = !Number.isNaN(d.getTime()) ? d.toISOString() : String(f.value);
        return `${col} ${f.operator} TIMESTAMP '${iso}'`;
      }

      const strVal = String(f.value ?? '').replace(/'/g, "''");
      if (f.operator === '=') {
        return `LOWER(CAST(${col} AS VARCHAR)) = LOWER('${strVal}')`;
      }
      if (f.operator === '!=') {
        return `(LOWER(CAST(${col} AS VARCHAR)) != LOWER('${strVal}') OR ${col} IS NULL)`;
      }
      if (f.operator === '>') {
        return `LOWER(CAST(${col} AS VARCHAR)) > LOWER('${strVal}')`;
      }
      if (f.operator === '>=') {
        return `LOWER(CAST(${col} AS VARCHAR)) >= LOWER('${strVal}')`;
      }
      if (f.operator === '<') {
        return `LOWER(CAST(${col} AS VARCHAR)) < LOWER('${strVal}')`;
      }
      if (f.operator === '<=') {
        return `LOWER(CAST(${col} AS VARCHAR)) <= LOWER('${strVal}')`;
      }
      if (f.operator === 'contains') {
        return `LOWER(CAST(${col} AS VARCHAR)) LIKE '%${strVal.toLowerCase()}%'`;
      }
      if (f.operator === 'startsWith') {
        return `LOWER(CAST(${col} AS VARCHAR)) LIKE '${strVal.toLowerCase()}%'`;
      }
      if (f.operator === 'endsWith') {
        return `LOWER(CAST(${col} AS VARCHAR)) LIKE '%${strVal.toLowerCase()}'`;
      }

      return '1=1';
    };

    const whereSegments: string[] = [];

    // 1. Mandatory Row-Level Security (RLS) constraints
    if (opts.rlsFilters && opts.rlsFilters.length > 0) {
      const rlsParts = opts.rlsFilters.map(formatFilterSql);
      if (rlsParts.length > 0) {
        whereSegments.push(`(${rlsParts.join(' AND ')})`);
      }
    }

    // 2. User query filters
    if (opts.filters.length > 0) {
      const filterParts = opts.filters.map(formatFilterSql);
      if (filterParts.length > 0) {
        whereSegments.push(`(${filterParts.join(` ${opts.filterLogic} `)})`);
      }
    }

    const whereClause = whereSegments.length > 0 ? ` WHERE ${whereSegments.join(' AND ')}` : '';

    let groupByClause = '';
    if (opts.isAggregate && opts.dimensions.length > 0) {
      groupByClause = ` GROUP BY ${opts.dimensions.map((d) => `"${d}"`).join(', ')}`;
    }

    let orderByClause = '';
    if (opts.orderBy) {
      orderByClause = ` ORDER BY "${opts.orderBy.column}" ${opts.orderBy.direction.toUpperCase()} NULLS LAST`;
    }

    const selectSql = [...selectParts, 'COUNT(*) OVER() AS "__total_count"'].join(', ');
    const mainSql = `SELECT ${selectSql} FROM "${tableName}"${whereClause}${groupByClause}${orderByClause} LIMIT ${opts.limit} OFFSET ${opts.offset}`;

    const timeoutMs = opts.timeoutMs ?? 5000;
    const queryResult = await duckdbStore.executeSql(mainSql, timeoutMs);

    const rows = queryResult.rows;
    let total = 0;

    if (rows.length > 0) {
      total = Number(rows[0]['__total_count'] ?? rows.length);
      for (const r of rows) {
        delete r['__total_count'];
      }
    } else {
      const countSql = `SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM "${tableName}"${whereClause}${groupByClause}) AS sub`;
      try {
        const countRes = await duckdbStore.executeSql(countSql, timeoutMs);
        total = Number(countRes.rows[0]?.['cnt'] ?? 0);
      } catch {
        total = 0;
      }
    }

    const executionTimeMs = Date.now() - opts.startTime;

    return {
      columns: resultColumns,
      rows,
      processedColumns: resultColumns,
      processedRows: rows,
      rowCount: rows.length,
      total,
      limit: opts.limit,
      offset: opts.offset,
      executionTimeMs,
      metadata: {
        rowCount: rows.length,
        total,
        limit: opts.limit,
        offset: opts.offset,
        executionTimeMs,
        queryMode: opts.isAggregate ? 'AGGREGATE' : 'RAW'
      }
    };
  }

  /** Backward-compatible forwarder delegating in-memory queries directly to DuckDB */
  private async executeInMemoryQuery(opts: {
    meta: Record<string, unknown>;
    isAggregate: boolean;
    selectedColumns: string[];
    dimensions: string[];
    measures: ValidatedMeasure[];
    filters: ValidatedFilter[];
    filterLogic: 'AND' | 'OR';
    rlsFilters?: ValidatedFilter[];
    orderBy?: OrderBySpec;
    limit: number;
    offset: number;
    columnTypeMap: Map<string, string>;
    startTime: number;
    dataset?: QueryableDataset;
    timeoutMs?: number;
  }): Promise<DatasetQueryResult> {
    const dataset: QueryableDataset = opts.dataset ?? {
      id: `in_mem_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      organizationId: 'in_mem',
      workspaceId: null,
      schemaMeta: opts.meta
    };
    return this.executeDuckDBQuery({
      ...opts,
      dataset
    });
  }

  // ============================================================
  // FILTER VALUE VALIDATION & COERCION
  // ============================================================

  private validateAndCoerceFilterValue(
    colType: string,
    operator: FilterOperator,
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
      throw AppError.badRequest(
        `Filter value for integer column "${colName}" must be a valid integer`
      );
    }

    if (colType === 'number') {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
      }
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
      throw AppError.badRequest(
        `Filter value for boolean column "${colName}" must be a boolean`
      );
    }

    if (colType === 'date') {
      const parsed = new Date(value as string | number | Date);
      if (Number.isNaN(parsed.getTime())) {
        throw AppError.badRequest(`Filter value for date column "${colName}" must be a valid date`);
      }
      return parsed.toISOString();
    }

    // Default string type
    return String(value);
  }
}

export const datasetQueryEngine = new DatasetQueryEngine();