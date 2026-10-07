// ========================================
// Dataset Query Engine (Safe, Reusable Query Foundation)
// ========================================
// Powers raw table exploration, filtering, sorting, pagination,
// aggregations, and group-by querying for visualizations.
// Enforces strict allow-lists and parameterized execution to prevent SQL injection.
// ========================================

import type { Dataset } from "@prisma/client";
import { validateSqlIdentifier } from "./schema-discovery.service.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import {
  compileCalculatedField,
  evaluateExpression,
} from "./calculated-field.engine.js";
import {
  resolveUserRlsFilters,
  type UserSecurityContext,
} from "./rls.service.js";

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
  MAX_MEASURES: 20,
} as const;

export const ALLOWED_FILTER_OPERATORS = [
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "contains",
  "startsWith",
  "endsWith",
  "isNull",
  "isNotNull",
  "in",
] as const;

export type FilterOperator = (typeof ALLOWED_FILTER_OPERATORS)[number];

export const FILTER_OPERATOR_ALIASES: Record<string, FilterOperator> = {
  "in": "in",
  "IN": "in",
  "=": "=",
  "==": "=",
  "equals": "=",
  "equal": "=",
  "!=": "!=",
  "<>": "!=",
  "not equals": "!=",
  "not equal": "!=",
  "notEquals": "!=",
  ">": ">",
  "greater than": ">",
  "greaterThan": ">",
  "gt": ">",
  ">=": ">=",
  "greater than or equal": ">=",
  "greaterThanOrEqual": ">=",
  "gte": ">=",
  "<": "<",
  "less than": "<",
  "lessThan": "<",
  "lt": "<",
  "<=": "<=",
  "less than or equal": "<=",
  "lessThanOrEqual": "<=",
  "lte": "<=",
  "contains": "contains",
  "startsWith": "startsWith",
  "endsWith": "endsWith",
  "isNull": "isNull",
  "is empty": "isNull",
  "isEmpty": "isNull",
  "isNotNull": "isNotNull",
  "is not empty": "isNotNull",
  "isNotEmpty": "isNotNull",
};

export const ALLOWED_AGGREGATIONS = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
] as const;

export type AggregationFunction = (typeof ALLOWED_AGGREGATIONS)[number];

export interface DatasetQueryFilter {
  column: string;
  operator: FilterOperator | string;
  value?: unknown;
}

export interface DatasetQueryMeasure {
  column: string;
  aggregation: AggregationFunction;
  alias?: string;
}

export interface DatasetQueryParams {
  columns?: string[];
  limit?: number;
  offset?: number;
  orderBy?: {
    column: string;
    direction: "asc" | "desc" | "ASC" | "DESC";
  };
  sort?: {
    column: string;
    direction: "asc" | "desc" | "ASC" | "DESC";
  };
  sorting?:
    | {
        column: string;
        direction: "asc" | "desc" | "ASC" | "DESC";
      }
    | Array<{
        column: string;
        direction: "asc" | "desc" | "ASC" | "DESC";
      }>;
  filters?: DatasetQueryFilter[];
  filterLogic?: "AND" | "OR";
  logic?: "AND" | "OR"; // Alias for filterLogic
  dimensions?: string[];
  groupBy?: string[]; // Alias for dimensions
  measures?: DatasetQueryMeasure[];
  aggregations?: Array<{
    column: string;
    function?: string;
    aggregation?: AggregationFunction | string;
    alias?: string;
  }>;
  user?: UserSecurityContext | null;
  userContext?: UserSecurityContext | null;
}

export interface QueryResultColumn {
  name: string;
  type: string;
}

export interface QueryResultMetadata {
  rowCount: number;
  total: number;
  limit: number;
  offset: number;
  executionTimeMs: number;
  queryMode: "RAW" | "AGGREGATE";
}

export interface DatasetQueryResult {
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  processedColumns: QueryResultColumn[];
  processedRows: Record<string, unknown>[];
  rowCount: number;
  total: number;
  limit: number;
  offset: number;
  executionTimeMs: number;
  metadata: QueryResultMetadata;
}

// ============================================================
// QUERY ENGINE IMPLEMENTATION
// ============================================================

export class DatasetQueryEngine {
  /**
   * Main entry point: Executes a validated, bounded query against a dataset.
   */
  async executeQuery(
    dataset: Dataset,
    params: DatasetQueryParams = {},
    userContext?: UserSecurityContext | null
  ): Promise<DatasetQueryResult> {
    const startTime = Date.now();

    // 0. Resolve Row-Level Security (RLS) constraints for the requesting user
    const resolvedUser = userContext ?? params.userContext ?? params.user ?? null;
    const rlsFilters = await resolveUserRlsFilters(dataset, resolvedUser);

    // 1. Extract schema metadata and known columns
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    const knownColumnsList = ((meta.columns || []) as Array<{
      name: string;
      type: string;
      nullable?: boolean;
    }>);

    const columnTypeMap = new Map<string, string>();
    if (Array.isArray((dataset as any).columns) && (dataset as any).columns.length > 0) {
      for (const c of (dataset as any).columns) {
        columnTypeMap.set(c.name, (c.dataType || "STRING").toLowerCase());
      }
    }
    for (const c of knownColumnsList) {
      if (!columnTypeMap.has(c.name)) {
        columnTypeMap.set(c.name, (c.type || "string").toLowerCase());
      }
    }

    // Register calculated fields in columnTypeMap so dimensions/measures/filters accept them
    const calculatedFields: Array<{
      name: string;
      expression: string;
      dataType?: string;
    }> = Array.isArray(meta.calculatedFields) ? (meta.calculatedFields as any[]) : [];

    for (const cf of calculatedFields) {
      if (!columnTypeMap.has(cf.name)) {
        columnTypeMap.set(cf.name, (cf.dataType || "NUMBER").toLowerCase());
      }
    }

    const knownColumnNames = Array.from(columnTypeMap.keys());

    // 2. Normalize aliases for dimensions, measures, sorting
    const rawDimensions = (
      params.dimensions ||
      params.groupBy ||
      []
    ).filter(Boolean);

    let rawMeasures: DatasetQueryMeasure[] = [];
    if (Array.isArray(params.measures) && params.measures.length > 0) {
      rawMeasures = params.measures;
    } else if (Array.isArray(params.aggregations) && params.aggregations.length > 0) {
      rawMeasures = params.aggregations.map((a: any) => {
        const rawFn = String(a.function || a.aggregation || "COUNT").toUpperCase();
        const fn = ALLOWED_AGGREGATIONS.includes(rawFn as AggregationFunction)
          ? (rawFn as AggregationFunction)
          : ("COUNT" as AggregationFunction);
        const col = a.column ?? "*";
        return {
          column: col,
          aggregation: fn,
          alias:
            a.alias ||
            (col === "*"
              ? `${fn.toLowerCase()}_count`
              : `${fn.toLowerCase()}_${col}`),
        };
      });
    }

    let rawOrderBy = params.orderBy;
    if (!rawOrderBy) {
      if (params.sort) {
        rawOrderBy = Array.isArray(params.sort) ? params.sort[0] : params.sort;
      } else if (params.sorting) {
        if (Array.isArray(params.sorting) && params.sorting.length > 0) {
          rawOrderBy = params.sorting[0];
        } else if (typeof params.sorting === "object") {
          rawOrderBy = params.sorting as any;
        }
      }
    } else if (Array.isArray(rawOrderBy) && rawOrderBy.length > 0) {
      rawOrderBy = rawOrderBy[0];
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
    const validatedMeasures: Array<{
      column: string;
      aggregation: AggregationFunction;
      alias: string;
      resultType: string;
    }> = [];

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
        if (m.column !== "*" && !knownColumnNames.includes(m.column)) {
          throw AppError.badRequest(`Measure column "${m.column}" does not exist in dataset schema`);
        }
        if (m.column !== "*") {
          validateSqlIdentifier(m.column);
        }

        if (!ALLOWED_AGGREGATIONS.includes(m.aggregation)) {
          throw AppError.badRequest(`Unsupported aggregation function "${m.aggregation}"`);
        }

        // Check type compatibility for SUM and AVG
        if (m.column !== "*") {
          const colType = columnTypeMap.get(m.column) || "string";
          if ((m.aggregation === "SUM" || m.aggregation === "AVG") && colType !== "number" && colType !== "integer") {
            throw AppError.badRequest(
              `Aggregation "${m.aggregation}" cannot be applied to non-numeric column "${m.column}" (type: ${colType})`
            );
          }
        }

        // Alias handling & validation
        const defaultAlias = `${m.aggregation.toLowerCase()}_${m.column === "*" ? "count" : m.column}`;
        const finalAlias = m.alias ? validateSqlIdentifier(m.alias) : defaultAlias;

        // Compute result type
        let resultType = "number";
        if (m.aggregation === "COUNT") {
          resultType = "integer";
        } else if (m.aggregation === "MIN" || m.aggregation === "MAX") {
          resultType = columnTypeMap.get(m.column) || "string";
        }

        validatedMeasures.push({
          column: m.column,
          aggregation: m.aggregation,
          alias: finalAlias,
          resultType,
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
    const validatedFilters: DatasetQueryFilter[] = [];
    if (params.filters && params.filters.length > 0) {
      if (params.filters.length > QUERY_LIMITS.MAX_FILTERS) {
        throw AppError.badRequest(
          `Filter count (${params.filters.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_FILTERS})`
        );
      }

      for (const filter of params.filters) {
        if (!knownColumnNames.includes(filter.column)) {
          throw AppError.badRequest(`Filter column "${filter.column}" does not exist in dataset schema`);
        }
        const rawOp = filter.operator;
        const alias = typeof rawOp === "string" ? FILTER_OPERATOR_ALIASES[rawOp] : undefined;
        const op: FilterOperator | string = alias || rawOp;

        if (!ALLOWED_FILTER_OPERATORS.includes(op as FilterOperator)) {
          throw AppError.badRequest(`Unsupported filter operator: "${filter.operator}"`);
        }

        const colType = columnTypeMap.get(filter.column) || "string";
        const validatedValue = this.validateAndCoerceFilterValue(colType, op as FilterOperator, filter.value, filter.column);

        validatedFilters.push({
          column: filter.column,
          operator: op as FilterOperator,
          value: validatedValue,
        });
      }
    }

    const filterLogic: "AND" | "OR" = (params.filterLogic || params.logic || "AND").toUpperCase() === "OR" ? "OR" : "AND";

    // 7. Validate Ordering
    let validatedOrderBy: { column: string; direction: "asc" | "desc" } | undefined;
    if (rawOrderBy) {
      const orderCol = rawOrderBy.column;
      const orderDir = String(rawOrderBy.direction).toLowerCase() === "desc" ? "desc" : "asc";

      if (isAggregate) {
        const validOrderCols = [
          ...validatedDimensions,
          ...validatedMeasures.map((m) => m.alias),
          ...validatedMeasures.map((m) => m.column),
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
    const isPostgresConnected = dataset.type === "CONNECTED" && dataset.dataSourceId;
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
          startTime,
        });
        return liveResult;
      } catch (err) {
        // If error is an intentional AppError, rethrow
        if (err instanceof AppError) throw err;
        // In dev/test environments without a live PostgreSQL instance,
        // fallback gracefully to execute against stored sampleData
      }
    }

    // Fallback or Native In-Memory / Uploaded CSV Execution
    return this.executeInMemoryQuery({
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
    });
  }

  // ============================================================
  // POSTGRESQL QUERY EXECUTION (Parameterized & Injection Safe)
  // ============================================================

  private async executePostgresQuery(opts: {
    dataset: Dataset;
    tableName: string;
    isAggregate: boolean;
    selectedColumns: string[];
    dimensions: string[];
    measures: Array<{
      column: string;
      aggregation: AggregationFunction;
      alias: string;
      resultType: string;
    }>;
    filters: DatasetQueryFilter[];
    filterLogic: "AND" | "OR";
    rlsFilters?: DatasetQueryFilter[];
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit: number;
    offset: number;
    columnTypeMap: Map<string, string>;
    startTime: number;
  }): Promise<DatasetQueryResult> {
    const safeTable = validateSqlIdentifier(opts.tableName);
    const sqlParams: unknown[] = [];

    // Construct SELECT clause
    let selectClause = "";
    const resultColumns: QueryResultColumn[] = [];

    if (opts.isAggregate) {
      const selectParts: string[] = [];
      for (const dim of opts.dimensions) {
        selectParts.push(`"${dim}"`);
        resultColumns.push({
          name: dim,
          type: opts.columnTypeMap.get(dim) || "string",
        });
      }
      for (const m of opts.measures) {
        const colExpr = m.column === "*" ? "*" : `"${m.column}"`;
        selectParts.push(`${m.aggregation}(${colExpr}) AS "${m.alias}"`);
        resultColumns.push({
          name: m.alias,
          type: m.resultType,
        });
      }
      selectClause = selectParts.join(", ");
    } else {
      selectClause = opts.selectedColumns.map((col) => `"${col}"`).join(", ");
      for (const col of opts.selectedColumns) {
        resultColumns.push({
          name: col,
          type: opts.columnTypeMap.get(col) || "string",
        });
      }
    }

    // Construct WHERE clause with parameterized values
    const allWhereSegments: string[] = [];

    const buildFilterSql = (f: DatasetQueryFilter, outList: string[]) => {
      const quotedCol = `"${f.column}"`;
      if (f.operator === "isNull") {
        outList.push(`${quotedCol} IS NULL`);
      } else if (f.operator === "isNotNull") {
        outList.push(`${quotedCol} IS NOT NULL`);
      } else if (f.operator === "=") {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} = $${sqlParams.length}`);
      } else if (f.operator === "!=") {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} != $${sqlParams.length}`);
      } else if (f.operator === ">") {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} > $${sqlParams.length}`);
      } else if (f.operator === ">=") {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} >= $${sqlParams.length}`);
      } else if (f.operator === "<") {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} < $${sqlParams.length}`);
      } else if (f.operator === "<=") {
        sqlParams.push(f.value);
        outList.push(`${quotedCol} <= $${sqlParams.length}`);
      } else if (f.operator === "contains") {
        sqlParams.push(`%${String(f.value)}%`);
        outList.push(`${quotedCol}::text ILIKE $${sqlParams.length}`);
      } else if (f.operator === "startsWith") {
        sqlParams.push(`${String(f.value)}%`);
        outList.push(`${quotedCol}::text ILIKE $${sqlParams.length}`);
      } else if (f.operator === "endsWith") {
        sqlParams.push(`%${String(f.value)}`);
        outList.push(`${quotedCol}::text ILIKE $${sqlParams.length}`);
      } else if (f.operator === "in") {
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
        allWhereSegments.push(`(${rlsConditions.join(" AND ")})`);
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

    let whereClause = "";
    if (allWhereSegments.length > 0) {
      whereClause = ` WHERE ${allWhereSegments.join(" AND ")}`;
    }

    // Construct GROUP BY clause
    let groupByClause = "";
    if (opts.isAggregate && opts.dimensions.length > 0) {
      groupByClause = ` GROUP BY ${opts.dimensions.map((d) => `"${d}"`).join(", ")}`;
    }

    // Construct ORDER BY clause
    let orderByClause = "";
    if (opts.orderBy) {
      orderByClause = ` ORDER BY "${opts.orderBy.column}" ${opts.orderBy.direction.toUpperCase()}`;
    }

    // Limit and Offset parameters
    sqlParams.push(opts.limit);
    const limitPlaceholder = `$${sqlParams.length}`;
    sqlParams.push(opts.offset);
    const offsetPlaceholder = `$${sqlParams.length}`;

    const sql = `SELECT ${selectClause} FROM "${safeTable}"${whereClause}${groupByClause}${orderByClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...sqlParams);
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
        queryMode: opts.isAggregate ? "AGGREGATE" : "RAW",
      },
    };
  }

  // ============================================================
  // IN-MEMORY / CSV QUERY EXECUTION (Full feature support)
  // ============================================================

  private executeInMemoryQuery(opts: {
    meta: Record<string, unknown>;
    isAggregate: boolean;
    selectedColumns: string[];
    dimensions: string[];
    measures: Array<{
      column: string;
      aggregation: AggregationFunction;
      alias: string;
      resultType: string;
    }>;
    filters: DatasetQueryFilter[];
    filterLogic: "AND" | "OR";
    rlsFilters?: DatasetQueryFilter[];
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit: number;
    offset: number;
    columnTypeMap: Map<string, string>;
    startTime: number;
  }): Promise<DatasetQueryResult> {
    const rawRows =
      ((opts.meta.sampleData ||
        opts.meta.previewRows ||
        opts.meta.rows ||
        []) as Record<string, unknown>[]) || [];

    // Evaluate calculated fields on raw rows before filtering and grouping
    const calculatedFields: Array<{
      name: string;
      expression: string;
      dataType?: string;
    }> = Array.isArray(opts.meta.calculatedFields) ? (opts.meta.calculatedFields as any[]) : [];

    let processedSourceRows = rawRows;
    if (calculatedFields.length > 0 && rawRows.length > 0) {
      const knownCols = Array.from(opts.columnTypeMap.entries()).map(([k, v]) => ({ name: k, type: v }));
      const compiledFields: Array<{ name: string; ast: any }> = [];
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

    // Helper to evaluate a filter against a row
    const evalFilterCondition = (f: DatasetQueryFilter, row: Record<string, unknown>): boolean => {
      const val = row[f.column];

      if (f.operator === "isNull") {
        return val === null || val === undefined;
      }
      if (f.operator === "isNotNull") {
        return val !== null && val !== undefined;
      }
      if (val === null || val === undefined) {
        return false;
      }

      const colType = opts.columnTypeMap.get(f.column) || "string";

      if (colType === "number" || colType === "integer") {
        const numVal = Number(val);
        const filterVal = Number(f.value);
        if (f.operator === "=") return numVal === filterVal;
        if (f.operator === "!=") return numVal !== filterVal;
        if (f.operator === ">") return numVal > filterVal;
        if (f.operator === ">=") return numVal >= filterVal;
        if (f.operator === "<") return numVal < filterVal;
        if (f.operator === "<=") return numVal <= filterVal;
      }

      if (colType === "date") {
        const rowTime = new Date(val as string | number | Date).getTime();
        const filterTime = new Date(f.value as string | number | Date).getTime();
        if (f.operator === "=") return rowTime === filterTime;
        if (f.operator === "!=") return rowTime !== filterTime;
        if (f.operator === ">") return rowTime > filterTime;
        if (f.operator === ">=") return rowTime >= filterTime;
        if (f.operator === "<") return rowTime < filterTime;
        if (f.operator === "<=") return rowTime <= filterTime;
      }

      if (colType === "boolean") {
        const boolVal = Boolean(val);
        const filterBool = Boolean(f.value);
        if (f.operator === "=") return boolVal === filterBool;
        if (f.operator === "!=") return boolVal !== filterBool;
      }

      // String comparisons & text matching
      const strVal = String(val).toLowerCase();
      const filterStr = String(f.value ?? "").toLowerCase();

      if (f.operator === "=") return strVal === filterStr;
      if (f.operator === "!=") return strVal !== filterStr;
      if (f.operator === ">") return strVal > filterStr;
      if (f.operator === ">=") return strVal >= filterStr;
      if (f.operator === "<") return strVal < filterStr;
      if (f.operator === "<=") return strVal <= filterStr;
      if (f.operator === "contains") return strVal.includes(filterStr);
      if (f.operator === "startsWith") return strVal.startsWith(filterStr);
      if (f.operator === "endsWith") return strVal.endsWith(filterStr);
      if (f.operator === "in") {
        const rawList = Array.isArray(f.value) ? f.value : [f.value];
        if (colType === "number" || colType === "integer") {
          const numList = rawList.map((v) => Number(v));
          return numList.includes(Number(val));
        }
        const strList = rawList.map((v) => String(v).toLowerCase());
        return strList.includes(String(val).toLowerCase());
      }

      return false;
    };

    // 0. Mandatory Row-Level Security (RLS) enforcement
    // Drop all rows failing RLS so unauthorized rows are completely inaccessible
    let permittedSourceRows = processedSourceRows;
    if (opts.rlsFilters && opts.rlsFilters.length > 0) {
      permittedSourceRows = processedSourceRows.filter((row) => {
        return opts.rlsFilters!.every((f) => evalFilterCondition(f, row));
      });
    }

    // 1. Filter permitted rows with user query filters
    const filteredRows = permittedSourceRows.filter((row) => {
      if (opts.filters.length === 0) return true;

      const evalFilter = (f: DatasetQueryFilter): boolean => evalFilterCondition(f, row);

      if (opts.filterLogic === "OR") {
        return opts.filters.some(evalFilter);
      }
      return opts.filters.every(evalFilter);
    });

    let processedRows: Record<string, unknown>[] = [];
    const resultColumns: QueryResultColumn[] = [];

    // 2. Aggregate or Raw Projection
    if (opts.isAggregate) {
      // Build result column headers
      for (const dim of opts.dimensions) {
        resultColumns.push({
          name: dim,
          type: opts.columnTypeMap.get(dim) || "string",
        });
      }
      for (const m of opts.measures) {
        resultColumns.push({
          name: m.alias,
          type: m.resultType,
        });
      }

      // Group rows
      const groups = new Map<string, { dims: Record<string, unknown>; rows: Record<string, unknown>[] }>();

      if (opts.dimensions.length === 0) {
        groups.set("all", { dims: {}, rows: filteredRows });
      } else {
        for (const row of filteredRows) {
          const dimObj: Record<string, unknown> = {};
          for (const dim of opts.dimensions) {
            dimObj[dim] = row[dim] ?? null;
          }
          const groupKey = JSON.stringify(dimObj);

          if (!groups.has(groupKey)) {
            groups.set(groupKey, { dims: dimObj, rows: [] });
          }
          groups.get(groupKey)!.rows.push(row);
        }
      }

      // Calculate aggregations per group
      for (const group of groups.values()) {
        const aggregatedRow: Record<string, unknown> = { ...group.dims };

        for (const m of opts.measures) {
          if (m.aggregation === "COUNT") {
            if (m.column === "*") {
              aggregatedRow[m.alias] = group.rows.length;
            } else {
              aggregatedRow[m.alias] = group.rows.filter(
                (r) => r[m.column] !== null && r[m.column] !== undefined
              ).length;
            }
          } else if (m.aggregation === "SUM") {
            const sum = group.rows.reduce<number>((acc, r) => {
              const val = Number(r[m.column]);
              return !isNaN(val) ? acc + val : acc;
            }, 0);
            aggregatedRow[m.alias] = Math.round(sum * 1000) / 1000;
          } else if (m.aggregation === "AVG") {
            const validVals = group.rows
              .map((r) => Number(r[m.column]))
              .filter((v) => !isNaN(v));
            const avg = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0;
            aggregatedRow[m.alias] = Math.round(avg * 1000) / 1000;
          } else if (m.aggregation === "MIN") {
            const vals = group.rows
              .map((r) => r[m.column])
              .filter((v) => v !== null && v !== undefined);
            aggregatedRow[m.alias] = vals.length > 0 ? vals.reduce((min, cur) => (cur < min ? cur : min)) : null;
          } else if (m.aggregation === "MAX") {
            const vals = group.rows
              .map((r) => r[m.column])
              .filter((v) => v !== null && v !== undefined);
            aggregatedRow[m.alias] = vals.length > 0 ? vals.reduce((max, cur) => (cur > max ? cur : max)) : null;
          }
        }

        processedRows.push(aggregatedRow);
      }
    } else {
      // Raw Mode
      for (const col of opts.selectedColumns) {
        resultColumns.push({
          name: col,
          type: opts.columnTypeMap.get(col) || "string",
        });
      }

      processedRows = filteredRows.map((row) => {
        const projected: Record<string, unknown> = {};
        for (const col of opts.selectedColumns) {
          projected[col] = row[col] ?? null;
        }
        return projected;
      });
    }

    // 3. Sort
    if (opts.orderBy) {
      const { column, direction } = opts.orderBy;
      const factor = direction === "desc" ? -1 : 1;
      processedRows.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === "number" && typeof valB === "number") {
          return (valA - valB) * factor;
        }
        return valA > valB ? factor : -factor;
      });
    }

    const total = processedRows.length;

    // 4. Paginate
    const sliced = processedRows.slice(opts.offset, opts.offset + opts.limit);
    const executionTimeMs = Date.now() - opts.startTime;

    return Promise.resolve({
      columns: resultColumns,
      rows: sliced,
      processedColumns: resultColumns,
      processedRows: sliced,
      rowCount: sliced.length,
      total,
      limit: opts.limit,
      offset: opts.offset,
      executionTimeMs,
      metadata: {
        rowCount: sliced.length,
        total,
        limit: opts.limit,
        offset: opts.offset,
        executionTimeMs,
        queryMode: opts.isAggregate ? "AGGREGATE" : "RAW",
      },
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
    if (operator === "isNull" || operator === "isNotNull") {
      return null;
    }

    if (value === undefined || value === null) {
      throw AppError.badRequest(`Filter value is required for operator "${operator}" on column "${colName}"`);
    }

    if (operator === "in") {
      let items: unknown[] = [];
      if (Array.isArray(value)) {
        items = value;
      } else if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          items = Array.isArray(parsed) ? parsed : [value];
        } catch {
          items = value.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } else {
        items = [value];
      }

      if (colType === "number" || colType === "integer") {
        return items.map((v) => {
          const num = Number(v);
          if (Number.isNaN(num)) {
            throw AppError.badRequest(`Filter value contains non-numeric element for column "${colName}"`);
          }
          return colType === "integer" ? Math.round(num) : num;
        });
      }
      return items.map((v) => String(v));
    }

    if (colType === "integer") {
      if (typeof value === "number" && Number.isInteger(value)) {
        return value;
      }
      if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
        return parseInt(value.trim(), 10);
      }
      throw AppError.badRequest(`Filter value for integer column "${colName}" must be a valid integer`);
    }

    if (colType === "number") {
      if (typeof value === "number" && !Number.isNaN(value)) {
        return value;
      }
      if (typeof value === "string" && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(value.trim())) {
        const parsed = parseFloat(value.trim());
        if (!Number.isNaN(parsed)) return parsed;
      }
      throw AppError.badRequest(`Filter value for numeric column "${colName}" must be a valid number`);
    }

    if (colType === "boolean") {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (lower === "true" || lower === "1") return true;
        if (lower === "false" || lower === "0") return false;
      }
      if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
      }
      throw AppError.badRequest(`Filter value for boolean column "${colName}" must be a boolean`);
    }

    if (colType === "date") {
      const parsed = new Date(value as string | number | Date);
      if (isNaN(parsed.getTime())) {
        throw AppError.badRequest(`Filter value for date column "${colName}" must be a valid date`);
      }
      return parsed.toISOString();
    }

    // Default string type
    return String(value);
  }
}

export const datasetQueryEngine = new DatasetQueryEngine();
