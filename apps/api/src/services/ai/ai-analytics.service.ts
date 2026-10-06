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
// ============================================================

import type { Dataset } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import {
  datasetQueryEngine,
  type DatasetQueryParams,
  type DatasetQueryFilter,
  type DatasetQueryMeasure,
  type AggregationFunction,
} from "../dataset/query-engine.js";
import { validateSqlIdentifier } from "../dataset/schema-discovery.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";

// ============================================================
// TYPES & INTERFACES
// ============================================================

export interface AnalystQueryResponse {
  answer: string;
  question: string;
  queryExecuted: DatasetQueryParams;
  resultSummary: {
    rowCount: number;
    primaryMetric?: { name: string; value: number; formatted: string };
    topEntity?: { dimension: string; value: string; metricValue: number };
  };
  data: Array<Record<string, unknown>>;
  chartSuggestion?: {
    title: string;
    chartType: string;
    dimension: string;
    measure: string;
    aggregation: string;
  };
  groundingVerification: {
    isGrounded: boolean;
    datasetName: string;
    datasetId: string;
    executionTimeMs: number;
  };
}

export interface NlToChartResponse {
  title: string;
  chartType: string;
  explanation: string;
  config: {
    dimensions: string[];
    measures: Array<{ column: string; aggregation: string; alias?: string }>;
    sort?: { column: string; direction: "asc" | "desc" };
    limit?: number;
    filters?: DatasetQueryFilter[];
  };
  data: Array<Record<string, unknown>>;
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
}

export interface AutoInsight {
  id: string;
  type: "PERFORMER_TOP" | "PERFORMER_BOTTOM" | "DOMINANCE" | "TREND" | "ANOMALY";
  title: string;
  description: string;
  metric: string;
  value?: number;
  formattedValue?: string;
  dimensionValue?: string;
  isAnomaly: boolean;
  detectionMethod?: "Z_SCORE" | "IQR" | "PERCENTAGE_CHANGE" | "DISTRIBUTION";
  score?: number;
}

export interface DashboardSummaryResponse {
  dashboardId: string;
  dashboardName: string;
  summaryBullets: string[];
  keyMetrics: Array<{ label: string; value: string | number; change?: string }>;
  filterContextText: string;
  comparisonNote: string;
  generatedAt: string;
}

// ============================================================
// STATISTICAL & ANOMALY DETECTION ENGINE
// ============================================================

export function calculateDescriptiveStats(numbers: number[]) {
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
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (count > 1 ? count - 1 : 1);
  const stdDev = Math.sqrt(variance);

  // Percentiles & IQR
  const median = count % 2 === 0
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
    const label = dimensionColumn ? String(row[dimensionColumn] ?? "Unknown") : "Value";

    // Method 1: Z-Score (threshold >= 2.5)
    if (stats.stdDev > 0) {
      const zScore = (val - stats.mean) / stats.stdDev;
      if (Math.abs(zScore) >= 2.5) {
        insights.push({
          id: `anomaly-z-${label}-${val}`,
          type: "ANOMALY",
          title: `Unusual Value Detected in ${label}`,
          description: `${label} recorded a value of ${val.toLocaleString()}, which deviates significantly from the mean of ${Math.round(stats.mean).toLocaleString()} (Z-Score: ${zScore.toFixed(2)} ≥ 2.5).`,
          metric: measureColumn,
          value: val,
          formattedValue: val.toLocaleString(),
          dimensionValue: label,
          isAnomaly: true,
          detectionMethod: "Z_SCORE",
          score: Math.round(Math.abs(zScore) * 10) / 10,
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
          type: "ANOMALY",
          title: `Statistical Outlier in ${label}`,
          description: `${label} recorded ${val.toLocaleString()}, outside the expected interquartile range [${Math.round(lowerFence).toLocaleString()} - ${Math.round(upperFence).toLocaleString()}].`,
          metric: measureColumn,
          value: val,
          formattedValue: val.toLocaleString(),
          dimensionValue: label,
          isAnomaly: true,
          detectionMethod: "IQR",
          score: 2.0,
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

export function extractDatasetColumns(dataset: Dataset & { columns?: Array<{ name: string; dataType?: string; type?: string }> }): DatasetColumnMeta[] {
  if (dataset.columns && dataset.columns.length > 0) {
    return dataset.columns.map((c) => ({
      name: c.name,
      type: (c.dataType || (c as any).type || "STRING").toLowerCase(),
    }));
  }
  const meta = (dataset.schemaMeta || {}) as { columns?: Array<{ name: string; type: string }> };
  if (Array.isArray(meta.columns) && meta.columns.length > 0) {
    return meta.columns.map((c) => ({
      name: c.name,
      type: (c.type || "string").toLowerCase(),
    }));
  }
  return [];
}

export function isNumericColumnType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "number" || t === "decimal" || t === "integer" || t === "float" || t === "double";
}

export function isDateColumnType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "date" || t === "datetime" || t === "timestamp";
}

export function parseNaturalLanguageIntent(
  text: string,
  columns: DatasetColumnMeta[]
): {
  targetDimension?: string;
  targetMeasure: string;
  aggregation: AggregationFunction;
  chartType: string;
  limit?: number;
  sortDirection?: "asc" | "desc";
  filters: DatasetQueryFilter[];
  isTimeTrend: boolean;
  isUnsupported: boolean;
} {
  const lower = text.toLowerCase();
  const numericCols = columns.filter((c) => isNumericColumnType(c.type));
  const dateCols = columns.filter((c) => isDateColumnType(c.type));
  const categoricalCols = columns.filter(
    (c) => !isNumericColumnType(c.type) && !isDateColumnType(c.type)
  );

  // 1. Identify Aggregation Function
  let aggregation: AggregationFunction = "SUM";
  if (/\b(average|avg|mean)\b/.test(lower)) {
    aggregation = "AVG";
  } else if (/\b(count|number of|how many|total orders|orders count)\b/.test(lower)) {
    aggregation = "COUNT";
  } else if (/\b(lowest|minimum|min)\b/.test(lower)) {
    aggregation = "MIN";
  } else if (/\b(highest|maximum|max|peak)\b/.test(lower)) {
    aggregation = "MAX";
  } else if (/\b(total|sum)\b/.test(lower)) {
    aggregation = "SUM";
  }

  // 2. Identify Target Measure
  let targetMeasure = numericCols.length > 0 && numericCols[0] ? numericCols[0].name : "*";
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
      const match = numericCols.find((c) =>
        /revenue|sales|amount|price|total/i.test(c.name)
      );
      if (match) targetMeasure = match.name;
    } else if (/\b(profit|margin|earnings)\b/.test(lower)) {
      const match = numericCols.find((c) => /profit|margin|earnings/i.test(c.name));
      if (match) targetMeasure = match.name;
    } else if (/\b(order|orders|quantity|units|count|volume)\b/.test(lower)) {
      const match = numericCols.find((c) => /order|quantity|units|count/i.test(c.name));
      if (match) {
        targetMeasure = match.name;
      } else {
        targetMeasure = "*";
        aggregation = "COUNT";
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
  if (dateCols.length > 0 && dateCols[0] && /\b(monthly|daily|yearly|over time|timeline|trend|by month|by date)\b/.test(lower)) {
    targetDimension = dateCols[0].name;
    isTimeTrend = true;
  }

  // 4. Identify Limits and Sorting
  let limit: number | undefined;
  let sortDirection: "asc" | "desc" | undefined = "desc";

  const topMatch = lower.match(/\btop\s+(\d+)\b/);
  const bottomMatch = lower.match(/\b(bottom|lowest)\s+(\d+)\b/);
  if (topMatch && topMatch[1]) {
    limit = parseInt(topMatch[1], 10);
    sortDirection = "desc";
  } else if (bottomMatch && bottomMatch[2]) {
    limit = parseInt(bottomMatch[2], 10);
    sortDirection = "asc";
  } else if (/\b(top|highest|best|most)\b/.test(lower)) {
    sortDirection = "desc";
    if (targetDimension) limit = 10;
  } else if (/\b(lowest|worst|least)\b/.test(lower)) {
    sortDirection = "asc";
    if (targetDimension) limit = 10;
  }

  // 5. Identify Chart Type
  let chartType = "BAR";
  if (/\b(line|trend|progression)\b/.test(lower) || isTimeTrend) {
    chartType = "LINE";
  } else if (/\b(pie|share|percentage)\b/.test(lower)) {
    chartType = "PIE";
  } else if (/\b(donut|doughnut)\b/.test(lower)) {
    chartType = "DONUT";
  } else if (/\b(area)\b/.test(lower)) {
    chartType = "AREA";
  } else if (/\b(scatter)\b/.test(lower)) {
    chartType = "SCATTER";
  } else if (/\b(table|grid|records)\b/.test(lower)) {
    chartType = "TABLE";
  } else if (!targetDimension && (aggregation === "SUM" || aggregation === "AVG" || aggregation === "COUNT")) {
    chartType = "KPI";
  }

  // 6. Extract Simple Explicit Filters (e.g. "for USA" or "in Germany")
  const filters: DatasetQueryFilter[] = [];
  const filterRegex = /(?:in|for|where|with)\s+([a-zA-Z0-9_-]+)/gi;
  let filterMatch: RegExpExecArray | null;
  while ((filterMatch = filterRegex.exec(lower)) !== null) {
    const candidateValue = filterMatch[1]?.trim();
    if (!candidateValue || ["the", "our", "a", "all", "each", "total"].includes(candidateValue.toLowerCase())) {
      continue;
    }
    // Determine the best matching column for candidateValue
    let matchedCol: string | undefined;
    if (["usa", "us", "germany", "france", "india", "japan", "uk", "canada"].includes(candidateValue.toLowerCase())) {
      const countryCol = categoricalCols.find((c) => /country|nation/i.test(c.name));
      if (countryCol) matchedCol = countryCol.name;
    } else if (["americas", "emea", "apac", "asia", "europe", "latam"].includes(candidateValue.toLowerCase())) {
      const regionCol = categoricalCols.find((c) => /region|territory/i.test(c.name));
      if (regionCol) matchedCol = regionCol.name;
    } else if (["hardware", "software"].includes(candidateValue.toLowerCase())) {
      const catCol = categoricalCols.find((c) => /category|type/i.test(c.name));
      if (catCol) matchedCol = catCol.name;
    }

    if (!matchedCol && categoricalCols.length > 0) {
      const explicitlyMentioned = categoricalCols.find((c) => lower.includes(c.name.toLowerCase()));
      matchedCol = explicitlyMentioned ? explicitlyMentioned.name : categoricalCols[0]?.name;
    }

    if (matchedCol) {
      const origRegex = new RegExp(`\\b${candidateValue}\\b`, "i");
      const origMatch = text.match(origRegex);
      const finalVal = origMatch ? origMatch[0] : candidateValue;
      filters.push({
        column: matchedCol,
        operator: "=",
        value: finalVal,
      });
      break;
    }
  }

  const hasMeasureMention =
    matchedMeasureScore > 0 ||
    /\b(revenue|sales|profit|margin|orders|quantity|cost|amount|count|how many|total|sum|average|avg|min|max)\b/.test(lower);

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
    isUnsupported,
  };
}

// ============================================================
// SERVICE IMPLEMENTATIONS
// ============================================================

/**
 * 1. AI DATA ANALYST
 * Understands analytical question, generates structured query,
 * executes via safe DatasetQueryEngine, and produces a real, grounded answer.
 */
export async function askDataAnalyst(
  userId: string,
  organizationId: string,
  roleName: string,
  params: {
    datasetId: string;
    question: string;
    filters?: DatasetQueryFilter[];
    dashboardId?: string;
  }
): Promise<AnalystQueryResponse> {
  const { datasetId, question, filters: runtimeFilters = [] } = params;

  if (!question || !question.trim()) {
    throw AppError.badRequest("Question cannot be empty");
  }

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset '${datasetId}'`);
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  const columns = extractDatasetColumns(dataset);
  if (columns.length === 0) {
    return {
      answer: "The selected dataset does not have any discoverable schema columns to analyze.",
      question,
      queryExecuted: {},
      resultSummary: { rowCount: 0 },
      data: [],
      groundingVerification: {
        isGrounded: true,
        datasetName: dataset.name,
        datasetId: dataset.id,
        executionTimeMs: 0,
      },
    };
  }

  const intent = parseNaturalLanguageIntent(question, columns);

  if (intent.isUnsupported) {
    return {
      answer: `I could not determine the specific metric or dimension for "${question}". Available columns in ${dataset.name} are: ${columns.map((c) => c.name).join(", ")}. Please try asking e.g. "What is our total revenue?" or "Which region has the highest revenue?".`,
      question,
      queryExecuted: {},
      resultSummary: { rowCount: 0 },
      data: [],
      groundingVerification: {
        isGrounded: true,
        datasetName: dataset.name,
        datasetId: dataset.id,
        executionTimeMs: 0,
      },
    };
  }

  // Validate SQL Identifiers
  if (intent.targetDimension) validateSqlIdentifier(intent.targetDimension);
  if (intent.targetMeasure !== "*") validateSqlIdentifier(intent.targetMeasure);

  // Construct Structured Query
  const mergedFilters: DatasetQueryFilter[] = [...intent.filters, ...runtimeFilters];
  const queryParams: DatasetQueryParams = {
    filters: mergedFilters.length > 0 ? mergedFilters : undefined,
    filterLogic: "AND",
  };

  const measureAlias = intent.targetMeasure === "*" ? "count_val" : `${intent.aggregation.toLowerCase()}_${intent.targetMeasure}`;
  const measures: DatasetQueryMeasure[] = [
    {
      column: intent.targetMeasure,
      aggregation: intent.aggregation,
      alias: measureAlias,
    },
  ];

  if (intent.targetDimension) {
    queryParams.dimensions = [intent.targetDimension];
    queryParams.measures = measures;
    if (intent.sortDirection) {
      queryParams.orderBy = {
        column: measureAlias,
        direction: intent.sortDirection,
      };
    }
    queryParams.limit = intent.limit || 10;
  } else {
    queryParams.measures = measures;
    queryParams.limit = 1;
  }

  const startTime = Date.now();
  const queryResult = await datasetQueryEngine.executeQuery(dataset, queryParams);
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
        datasetId: dataset.id,
        executionTimeMs,
      },
    };
  }

  // Build Grounded Answer
  let answer = "";
  let primaryMetric: { name: string; value: number; formatted: string } | undefined;
  let topEntity: { dimension: string; value: string; metricValue: number } | undefined;

  if (!intent.targetDimension) {
    // Single KPI aggregation result
    const firstRow = queryResult.rows[0];
    const rawVal = firstRow ? Number(firstRow[measureAlias] ?? 0) : 0;
    primaryMetric = {
      name: intent.targetMeasure === "*" ? "Total Count" : `${intent.aggregation} of ${intent.targetMeasure}`,
      value: rawVal,
      formatted: rawVal.toLocaleString(),
    };
    const filterDesc = mergedFilters.length > 0 ? ` with ${mergedFilters.map((f) => `${f.column} = '${f.value}'`).join(" and ")}` : "";
    answer = `The total ${primaryMetric.name} for ${dataset.name}${filterDesc} is **${primaryMetric.formatted}**.`;
  } else {
    // Group-by dimension breakdown result
    const topRow = queryResult.rows[0];
    const topDimVal = topRow ? String(topRow[intent.targetDimension] ?? "Unknown") : "Unknown";
    const topNumVal = topRow ? Number(topRow[measureAlias] ?? 0) : 0;

    topEntity = {
      dimension: intent.targetDimension,
      value: topDimVal,
      metricValue: topNumVal,
    };

    if (intent.sortDirection === "asc") {
      answer = `The lowest ${intent.targetDimension} by ${intent.aggregation} of ${intent.targetMeasure} is **${topDimVal}** with **${topNumVal.toLocaleString()}**.`;
    } else {
      answer = `**${topDimVal}** has the highest ${intent.targetMeasure} with **${topNumVal.toLocaleString()}** (${intent.aggregation}).`;
    }

    if (queryResult.rows.length > 1) {
      const runnerUp = queryResult.rows[1];
      const runnerUpDim = runnerUp ? String(runnerUp[intent.targetDimension] ?? "Unknown") : "Unknown";
      const runnerUpNum = runnerUp ? Number(runnerUp[measureAlias] ?? 0) : 0;
      answer += ` Followed by **${runnerUpDim}** with **${runnerUpNum.toLocaleString()}**.`;
    }
  }

  // Generate Suggested Chart
  let chartSuggestion: AnalystQueryResponse["chartSuggestion"] | undefined;
  if (intent.targetDimension) {
    chartSuggestion = {
      title: `${intent.aggregation} ${intent.targetMeasure} by ${intent.targetDimension}`,
      chartType: intent.chartType,
      dimension: intent.targetDimension,
      measure: intent.targetMeasure,
      aggregation: intent.aggregation,
    };
  }

  return {
    answer,
    question,
    queryExecuted: queryParams,
    resultSummary: {
      rowCount: queryResult.rowCount,
      primaryMetric,
      topEntity,
    },
    data: queryResult.rows,
    chartSuggestion,
    groundingVerification: {
      isGrounded: true,
      datasetName: dataset.name,
      datasetId: dataset.id,
      executionTimeMs,
    },
  };
}

/**
 * 2. NATURAL LANGUAGE -> CHART
 * Translates prompt into structured chart specification, validates fields,
 * executes query, and returns ready-to-render chart payload.
 */
export async function nlToChart(
  userId: string,
  organizationId: string,
  roleName: string,
  params: {
    datasetId: string;
    prompt: string;
    filters?: DatasetQueryFilter[];
  }
): Promise<NlToChartResponse> {
  const { datasetId, prompt, filters: runtimeFilters = [] } = params;

  if (!prompt || !prompt.trim()) {
    throw AppError.badRequest("Prompt cannot be empty");
  }

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset '${datasetId}'`);
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  const columns = extractDatasetColumns(dataset);
  if (columns.length === 0) {
    throw AppError.badRequest("Dataset has no columns to build a chart from.");
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
  if (measure !== "*") validateSqlIdentifier(measure);

  const measureAlias = measure === "*" ? "count" : `${aggregation.toLowerCase()}_${measure}`;
  const measuresConfig = [{ column: measure, aggregation, alias: measureAlias }];

  const mergedFilters = [...intent.filters, ...runtimeFilters];
  const queryParams: DatasetQueryParams = {
    dimensions: dimension ? [dimension] : undefined,
    measures: measuresConfig,
    limit: intent.limit || 15,
    orderBy: dimension ? { column: measureAlias, direction: intent.sortDirection || "desc" } : undefined,
    filters: mergedFilters.length > 0 ? mergedFilters : undefined,
    filterLogic: "AND",
  };

  const queryResult = await datasetQueryEngine.executeQuery(dataset, queryParams);

  const title = dimension
    ? `${aggregation} ${measure} by ${dimension}`
    : `Total ${aggregation} of ${measure}`;

  return {
    title,
    chartType: intent.chartType,
    explanation: `Generated ${intent.chartType} chart plotting ${aggregation}(${measure}) grouped by ${dimension || "dataset"} (${queryResult.rowCount} rows queried).`,
    config: {
      dimensions: dimension ? [dimension] : [],
      measures: measuresConfig,
      sort: dimension ? { column: measureAlias, direction: intent.sortDirection || "desc" } : undefined,
      limit: queryParams.limit,
      filters: mergedFilters,
    },
    data: queryResult.rows,
    columns: queryResult.columns,
    rowCount: queryResult.rowCount,
  };
}

/**
 * 3. AUTOMATIC INSIGHTS & ANOMALY DETECTION
 * Analyzes dataset or pre-queried data using deterministic statistical methods.
 */
export async function generateDatasetInsights(
  userId: string,
  organizationId: string,
  roleName: string,
  params: {
    datasetId: string;
    dimension?: string;
    measure?: string;
    filters?: DatasetQueryFilter[];
    data?: Array<Record<string, unknown>>;
  }
): Promise<{ insights: AutoInsight[]; summary: string; analyzedRows: number }> {
  const { datasetId, filters = [], data } = params;

  let rows = data;
  let dimCol = params.dimension;
  let measCol = params.measure;

  if (!rows || rows.length === 0) {
    const dataset = await prisma.dataset.findUnique({
      where: { id: datasetId },
      include: {
        columns: { orderBy: { ordinalPosition: "asc" } },
      },
    });

    if (!dataset) {
      throw AppError.notFound(`Dataset '${datasetId}'`);
    }

    await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

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
        summary: "Insufficient numeric or categorical columns in dataset to generate statistical insights.",
        analyzedRows: 0,
      };
    }

    const queryResult = await datasetQueryEngine.executeQuery(dataset, {
      dimensions: [dimCol],
      measures: [{ column: measCol, aggregation: "SUM", alias: "val" }],
      filters: filters.length > 0 ? filters : undefined,
      orderBy: { column: "val", direction: "desc" },
      limit: 25,
    });

    rows = queryResult.rows;
  }

  if (!rows || rows.length === 0) {
    return {
      insights: [],
      summary: "No data available to generate insights.",
      analyzedRows: 0,
    };
  }

  const firstRow = rows[0] || {};
  // Determine measure column in data rows
  const valueKey = measCol && firstRow[measCol] !== undefined
    ? measCol
    : firstRow["val"] !== undefined
      ? "val"
      : Object.keys(firstRow).find((k) => typeof firstRow[k] === "number") || "";

  const dimKey = dimCol && firstRow[dimCol] !== undefined
    ? dimCol
    : Object.keys(firstRow).find((k) => typeof firstRow[k] === "string") || "";

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
    const topName = String(topRow[dimKey] ?? "Unknown");
    const topVal = Number(topRow[valueKey] ?? 0);
    const topPct = stats.sum > 0 ? Math.round((topVal / stats.sum) * 1000) / 10 : 0;

    insights.push({
      id: "top-performer",
      type: "PERFORMER_TOP",
      title: `Top Performer: ${topName}`,
      description: `${topName} is the leading contributor with ${topVal.toLocaleString()} (${topPct}% of the total).`,
      metric: valueKey,
      value: topVal,
      formattedValue: topVal.toLocaleString(),
      dimensionValue: topName,
      isAnomaly: false,
      score: 1.0,
    });

    // 2. Dominance / Concentration Insight
    if (topPct >= 40 && rows.length > 1) {
      insights.push({
        id: "dominance",
        type: "DOMINANCE",
        title: `High Concentration in ${topName}`,
        description: `${topName} commands a dominant ${topPct}% share across all analyzed ${dimKey} groups.`,
        metric: valueKey,
        value: topVal,
        dimensionValue: topName,
        isAnomaly: false,
        score: topPct / 100,
      });
    }

    // 3. Lowest Performer Insight
    if (rows.length > 2) {
      const bottomRow = rows[rows.length - 1] || {};
      const bottomName = String(bottomRow[dimKey] ?? "Unknown");
      const bottomVal = Number(bottomRow[valueKey] ?? 0);
      const bottomPct = stats.sum > 0 ? Math.round((bottomVal / stats.sum) * 1000) / 10 : 0;

      insights.push({
        id: "bottom-performer",
        type: "PERFORMER_BOTTOM",
        title: `Lowest Performer: ${bottomName}`,
        description: `${bottomName} generated the lowest contribution of ${bottomVal.toLocaleString()} (${bottomPct}% of the total).`,
        metric: valueKey,
        value: bottomVal,
        formattedValue: bottomVal.toLocaleString(),
        dimensionValue: bottomName,
        isAnomaly: false,
        score: 0.2,
      });
    }
  }

  // 4. Statistical Anomaly Detection (Z-score & IQR)
  const anomalies = detectStatisticalAnomalies(rows, valueKey, dimKey);
  insights.push(...anomalies);

  const anomalyCount = anomalies.length;
  const summary = `Analyzed ${rows.length} records. Identified ${insights.length} key insights${
    anomalyCount > 0 ? `, including ${anomalyCount} statistical anomal${anomalyCount === 1 ? "y" : "ies"}` : " with normal distribution variance"
  }.`;

  return {
    insights,
    summary,
    analyzedRows: rows.length,
  };
}

/**
 * 4. AI-POWERED DASHBOARD SUMMARY
 * Summarizes the current dashboard based on all real chart queries
 * and respect active dashboard filters.
 */
export async function generateDashboardSummary(
  userId: string,
  organizationId: string,
  roleName: string,
  params: {
    dashboardId: string;
    activeFilters?: DatasetQueryFilter[];
  }
): Promise<DashboardSummaryResponse> {
  const { dashboardId, activeFilters = [] } = params;

  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    include: {
      charts: {
        include: {
          dataset: {
            include: {
              columns: { orderBy: { ordinalPosition: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!dashboard) {
    throw AppError.notFound(`Dashboard '${dashboardId}'`);
  }

  await verifyResourceWorkspaceAccess(dashboard, userId, organizationId, roleName);

  if (dashboard.charts.length === 0) {
    return {
      dashboardId,
      dashboardName: dashboard.name,
      summaryBullets: ["This dashboard does not currently contain any visualizations to summarize."],
      keyMetrics: [],
      filterContextText: "No active filters.",
      comparisonNote: "Comparison data is unavailable.",
      generatedAt: new Date().toISOString(),
    };
  }

  const bullets: string[] = [];
  const keyMetrics: Array<{ label: string; value: string | number; change?: string }> = [];

  // Query each chart with active filters applied
  for (const chart of dashboard.charts) {
    if (!chart.dataset) continue;

    try {
      const config = (chart.config || {}) as Record<string, unknown>;
      const dims = (config.dimensions || []) as string[];
      const measures = (config.measures || []) as DatasetQueryMeasure[];
      const chartFilters = ((config.filters || []) as DatasetQueryFilter[]);

      const mergedFilters = [...chartFilters, ...activeFilters];

      const queryResult = await datasetQueryEngine.executeQuery(chart.dataset, {
        dimensions: dims.length > 0 ? dims : undefined,
        measures: measures.length > 0 ? measures : undefined,
        filters: mergedFilters.length > 0 ? mergedFilters : undefined,
        limit: 25,
      });

      if (queryResult.rows.length === 0) continue;

      if (dims.length === 0 && measures.length > 0 && measures[0]) {
        // Single KPI Metric Widget
        const measure = measures[0];
        const valKey = measure.alias || `${measure.aggregation.toLowerCase()}_${measure.column}`;
        const firstRow = queryResult.rows[0] || {};
        const val = Number(firstRow[valKey] ?? firstRow[measure.column] ?? 0);
        keyMetrics.push({
          label: chart.title || measure.column,
          value: val.toLocaleString(),
        });
        bullets.push(`• **${chart.title || measure.column}** stands at **${val.toLocaleString()}**.`);
      } else if (dims.length > 0 && dims[0] && queryResult.rows.length > 0) {
        // Grouped Dimension Widget
        const dimCol = dims[0];
        const firstRow = queryResult.rows[0] || {};
        const firstMeasure = measures[0];
        const valKey = firstMeasure
          ? firstMeasure.alias || `${firstMeasure.aggregation.toLowerCase()}_${firstMeasure.column}`
          : Object.keys(firstRow).find((k) => typeof firstRow[k] === "number") || "";

        // Sort descending
        const sorted = [...queryResult.rows].sort((a, b) => Number(b[valKey] || 0) - Number(a[valKey] || 0));
        const topRow = sorted[0] || {};
        const topName = String(topRow[dimCol] ?? "Unknown");
        const topVal = Number(topRow[valKey] ?? 0);

        const totalSum = sorted.reduce((acc, r) => acc + Number(r[valKey] || 0), 0);
        const pct = totalSum > 0 ? Math.round((topVal / totalSum) * 1000) / 10 : 0;

        bullets.push(`• **${topName}** generated the highest ${firstMeasure?.column || "volume"} with **${topVal.toLocaleString()}** (${pct}% of ${chart.title}).`);
      }
    } catch {
      // Continue processing other charts cleanly
    }
  }

  // Filter context description
  const filterContextText = activeFilters.length > 0
    ? `Filtered by: ${activeFilters.map((f) => `${f.column} = '${f.value}'`).join(", ")}`
    : "Unfiltered (Full dataset scope)";

  // Temporal comparison statement requirement
  const comparisonNote = "Comparison data is unavailable for previous period.";
  bullets.push(`• ${comparisonNote}`);

  return {
    dashboardId,
    dashboardName: dashboard.name,
    summaryBullets: bullets.length > 0 ? bullets : ["No data available across dashboard visualizations."],
    keyMetrics,
    filterContextText,
    comparisonNote,
    generatedAt: new Date().toISOString(),
  };
}
