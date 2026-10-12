// ========================================
// Chart Query Mapper & Data Transformer
// ========================================
// Converts chart configurations into query engine payloads,
// and maps query results into visualization-ready chart datasets.
// ========================================

import type {
  ChartConfig,
  ChartType,
  DatasetQueryParams,
  DatasetQueryResult,
  DatasetQueryFilter,
  DatasetQueryMeasure,
  AggregationFunction,
  FilterOperator,
  DatasetColumn,
} from "./api";

export interface MappedChartData {
  chartType: ChartType;
  rows: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  groupKey?: string;
  measureKeys: string[];
  kpiValue?: number | string;
  kpiLabel?: string;
  pieSlices?: { name: string; value: number }[];
  columns: { name: string; type: string }[];
}

/**
 * Returns allowed aggregations based on column type to prevent incompatible aggregations (e.g. SUM of string).
 */
export function getAllowedAggregations(dataType?: string): AggregationFunction[] {
  if (!dataType) return ["COUNT", "SUM", "AVG", "MIN", "MAX"];
  const normalized = dataType.toLowerCase();

  if (normalized === "string" || normalized === "boolean") {
    return ["COUNT"];
  }

  if (normalized === "date" || normalized === "timestamp" || normalized === "datetime") {
    return ["COUNT", "MIN", "MAX"];
  }

  // numeric: number, integer, float, decimal
  return ["SUM", "AVG", "COUNT", "MIN", "MAX"];
}

/**
 * Validates if an aggregation function is compatible with a field data type.
 */
export function isAggregationCompatible(
  agg: AggregationFunction,
  dataType?: string
): boolean {
  return getAllowedAggregations(dataType).includes(agg);
}

/**
 * Intelligently categorizes dataset columns into Dimensions and Measures.
 */
export function categorizeColumns(columns: DatasetColumn[]): {
  dimensions: DatasetColumn[];
  measures: DatasetColumn[];
} {
  const dimensions: DatasetColumn[] = [];
  const measures: DatasetColumn[] = [];

  for (const col of columns) {
    const t = col.type.toLowerCase();
    if (t === "number" || t === "integer") {
      measures.push(col);
    } else {
      dimensions.push(col);
    }
  }

  return { dimensions, measures };
}

/**
 * Builds the query engine request parameters from a Chart configuration.
 * Strictly adheres to allowed aggregations, filters, dimensions, and measures.
 */
export function buildChartQueryParams(
  config: ChartConfig,
  limit = 100,
  filterLogic: "AND" | "OR" = "AND"
): DatasetQueryParams {
  const params: DatasetQueryParams = {
    limit,
    filterLogic,
  };

  const effectiveMeasures =
    config.measures && config.measures.length > 0
      ? config.measures
      : (config.yAxis || (config as Record<string, unknown>).value)
        ? [
            {
              column: String(config.yAxis || (config as Record<string, unknown>).value),
              aggregation: ((config as Record<string, unknown>).aggregation as AggregationFunction) || "SUM",
              alias: String(config.yAxis || (config as Record<string, unknown>).value),
            },
          ]
        : [];

  const effectiveDimensions =
    config.dimensions && config.dimensions.length > 0
      ? config.dimensions
      : (config.xAxis || (config as Record<string, unknown>).category)
        ? [String(config.xAxis || (config as Record<string, unknown>).category)]
        : [];

  // Measures & Dimensions (Aggregation mode)
  if (effectiveMeasures.length > 0) {
    const validMeasures: DatasetQueryMeasure[] = effectiveMeasures.map((m) => ({
      column: m.column,
      aggregation: m.aggregation as AggregationFunction,
      alias: m.alias || `${m.aggregation.toLowerCase()}_${m.column}`,
    }));
    params.measures = validMeasures;

    if (effectiveDimensions.length > 0) {
      params.dimensions = effectiveDimensions;
    }
  } else if (effectiveDimensions.length > 0) {
    // Raw column selection
    params.columns = effectiveDimensions;
  }

  // Geospatial Map Specific Dimensions/Columns mapping
  const opts = (config.options || {}) as Record<string, unknown>;
  const latCol = opts.latColumn as string | undefined;
  const lngCol = opts.lngColumn as string | undefined;
  if (latCol && lngCol) {
    if (params.measures && params.measures.length > 0) {
      const mergedDims = new Set([...(params.dimensions || []), latCol, lngCol]);
      params.dimensions = Array.from(mergedDims);
    } else if (params.columns) {
      const mergedCols = new Set([...params.columns, latCol, lngCol]);
      params.columns = Array.from(mergedCols);
    } else {
      params.columns = [latCol, lngCol];
    }
  }

  // Filters
  if (config.filters && config.filters.length > 0) {
    const validFilters: DatasetQueryFilter[] = config.filters.map((f) => ({
      column: f.column,
      operator: f.operator as FilterOperator,
      value: f.value,
    }));
    params.filters = validFilters;
  }

  // Sorting
  if (config.sort && config.sort.column) {
    const dir = config.sort.direction.toLowerCase() as "asc" | "desc";
    params.orderBy = {
      column: config.sort.column,
      direction: dir,
    };
  }

  return params;
}

/**
 * Pure Query Builder Adapter specifically for Visualization Studio.
 */
export function buildVisualizationQuery(
  config: ChartConfig,
  limit = 100,
  filterLogic: "AND" | "OR" = "AND"
): DatasetQueryParams {
  return buildChartQueryParams(config, limit, filterLogic);
}

/**
 * Maps query result rows to chart-ready format for Recharts and custom visualizations.
 */
export function mapQueryResultToChartData(
  chartType: ChartType,
  result: DatasetQueryResult | null,
  config: ChartConfig
): MappedChartData {
  if (!result || !result.rows || result.rows.length === 0) {
    return {
      chartType,
      rows: [],
      measureKeys: [],
      columns: result?.columns || [],
      kpiValue: 0,
      kpiLabel: "No Data",
      pieSlices: [],
    };
  }

  const columns = result.columns || [];
  const rawRows = result.rows;

  // Determine Primary Dimension / X-Axis Key
  const xKey =
    config.dimensions?.[0] ||
    config.xAxis ||
    (columns.length > 0 ? columns[0].name : "dimension");

  // Determine Measure Keys
  let measureKeys: string[] = [];
  if (config.measures && config.measures.length > 0) {
    measureKeys = config.measures.map(
      (m) => m.alias || `${m.aggregation.toLowerCase()}_${m.column}`
    );
  } else if (columns.length > 1) {
    measureKeys = columns.slice(1).map((c) => c.name);
  } else if (columns.length === 1) {
    measureKeys = [columns[0].name];
  }

  // Ensure rows have numeric values for measure keys
  const sanitizedRows = rawRows.map((row) => {
    const mappedRow: Record<string, unknown> = { ...row };
    for (const key of measureKeys) {
      if (mappedRow[key] !== undefined && mappedRow[key] !== null) {
        const num = Number(mappedRow[key]);
        mappedRow[key] = isNaN(num) ? mappedRow[key] : num;
      }
    }
    return mappedRow;
  });

  // Handle KPI
  if (chartType === "KPI") {
    const primaryKey = measureKeys[0] || (columns[0]?.name ?? "value");
    const firstVal = rawRows[0]?.[primaryKey];
    const num = Number(firstVal);
    const kpiValue = isNaN(num) ? String(firstVal ?? 0) : num;
    const kpiLabel = config.measures?.[0]
      ? `${config.measures[0].aggregation} of ${config.measures[0].column}`
      : primaryKey;

    return {
      chartType,
      rows: sanitizedRows,
      xKey,
      measureKeys,
      columns,
      kpiValue,
      kpiLabel,
    };
  }

  // Handle PIE / DONUT
  if (chartType === "PIE" || chartType === "DONUT") {
    const valKey = measureKeys[0] || (columns[1]?.name ?? columns[0]?.name ?? "value");
    const pieSlices = rawRows.map((row) => ({
      name: String(row[xKey] ?? "Unknown"),
      value: Math.max(0, Number(row[valKey]) || 0),
    }));

    return {
      chartType,
      rows: sanitizedRows,
      xKey,
      measureKeys,
      columns,
      pieSlices,
    };
  }

  // Handle SCATTER
  if (chartType === "SCATTER") {
    const yKey =
      (typeof config.yAxis === "string" ? config.yAxis : config.yAxis?.[0]) ||
      measureKeys[0] ||
      (columns[1]?.name ?? "y");

    const groupKey =
      ((config as Record<string, unknown>).groupCol as string) ||
      config.dimensions?.[1] ||
      ((config as Record<string, unknown>).series as string) ||
      undefined;

    return {
      chartType,
      rows: sanitizedRows,
      xKey,
      yKey,
      groupKey,
      measureKeys,
      columns,
    };
  }

  const groupKey =
    ((config as Record<string, unknown>).groupCol as string) ||
    config.dimensions?.[1] ||
    ((config as Record<string, unknown>).series as string) ||
    undefined;

  // Default: BAR, LINE, AREA, TABLE, RADAR, FUNNEL, HEATMAP
  return {
    chartType,
    rows: sanitizedRows,
    xKey,
    groupKey,
    measureKeys,
    columns,
  };
}
