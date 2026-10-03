// ============================================================
// Intelligent Chart Recommender & Compatibility Engine
// ============================================================
// Inspects dataset column data types and semantics to:
// 1. Suggest tailored chart types and field mappings for any dataset.
// 2. Validate live field selections against chart type constraints.
// ============================================================

import type { DatasetColumn, ChartType, AggregationFunction } from "./api";

export interface ChartRecommendation {
  id: string;
  chartType: ChartType;
  title: string;
  description: string;
  categoryCol: string;
  valueCol: string;
  secondaryValueCol?: string;
  groupCol?: string;
  aggregation: AggregationFunction;
  suitabilityScore: number; // 0 - 100
  badge: "Primary" | "Trend" | "Distribution" | "Correlation" | "KPI" | "Matrix";
}

export type ColumnClassification = "numeric" | "date" | "categorical" | "boolean";

/**
 * Classifies a dataset column into a standardized type category.
 */
export function classifyColumn(col: DatasetColumn): ColumnClassification {
  const t = (col.type || "").toLowerCase();
  if (
    t === "number" ||
    t === "integer" ||
    t === "int" ||
    t === "bigint" ||
    t === "decimal" ||
    t === "float" ||
    t === "double" ||
    t === "numeric"
  ) {
    return "numeric";
  }

  if (
    t === "date" ||
    t === "datetime" ||
    t === "timestamp" ||
    t === "timestamptz" ||
    t.includes("date") ||
    t.includes("time")
  ) {
    return "date";
  }

  if (t === "boolean" || t === "bool") {
    return "boolean";
  }

  return "categorical";
}

/**
 * Evaluates a dataset's columns and returns intelligent, ranked visualization recommendations.
 */
export function getRecommendedVisualizations(columns: DatasetColumn[]): ChartRecommendation[] {
  if (!columns || columns.length === 0) return [];

  const numerics = columns.filter((c) => classifyColumn(c) === "numeric");
  const dates = columns.filter((c) => classifyColumn(c) === "date");
  const categoricals = columns.filter(
    (c) => classifyColumn(c) === "categorical" || classifyColumn(c) === "boolean"
  );

  const recommendations: ChartRecommendation[] = [];

  // Helper to pick default aggregation for a column name
  const pickDefaultAgg = (colName: string): AggregationFunction => {
    const lower = colName.toLowerCase();
    if (
      lower.includes("rate") ||
      lower.includes("price") ||
      lower.includes("avg") ||
      lower.includes("score") ||
      lower.includes("rating") ||
      lower.includes("percent") ||
      lower.includes("temp") ||
      lower.includes("age")
    ) {
      return "AVG";
    }
    return "SUM";
  };

  // 1. DATE + NUMERIC -> LINE & AREA
  if (dates.length > 0 && numerics.length > 0) {
    const dateCol = dates[0].name;
    const numCol = numerics[0].name;
    const agg = pickDefaultAgg(numCol);

    recommendations.push({
      id: `line-${dateCol}-${numCol}`,
      chartType: "LINE",
      title: `Line: ${numCol} over ${dateCol}`,
      description: `Track chronological progression and trends of ${numCol}`,
      categoryCol: dateCol,
      valueCol: numCol,
      aggregation: agg,
      suitabilityScore: 98,
      badge: "Trend",
    });

    recommendations.push({
      id: `area-${dateCol}-${numCol}`,
      chartType: "AREA",
      title: `Area: Cumulative ${numCol} over ${dateCol}`,
      description: `Visualize volume progression and magnitude over time`,
      categoryCol: dateCol,
      valueCol: numCol,
      aggregation: agg,
      suitabilityScore: 92,
      badge: "Trend",
    });
  }

  // 2. CATEGORICAL + NUMERIC -> BAR, PIE, DONUT
  if (categoricals.length > 0 && numerics.length > 0) {
    const catCol = categoricals[0].name;
    const numCol = numerics[0].name;
    const agg = pickDefaultAgg(numCol);

    recommendations.push({
      id: `bar-${catCol}-${numCol}`,
      chartType: "BAR",
      title: `Bar: ${numCol} by ${catCol}`,
      description: `Compare ${numCol} aggregates across ${catCol} groups`,
      categoryCol: catCol,
      valueCol: numCol,
      aggregation: agg,
      suitabilityScore: 95,
      badge: "Primary",
    });

    recommendations.push({
      id: `pie-${catCol}-${numCol}`,
      chartType: "PIE",
      title: `Pie: ${catCol} share of ${numCol}`,
      description: `Show proportion and percentage distribution of ${numCol}`,
      categoryCol: catCol,
      valueCol: numCol,
      aggregation: agg,
      suitabilityScore: 88,
      badge: "Distribution",
    });

    recommendations.push({
      id: `donut-${catCol}-${numCol}`,
      chartType: "DONUT",
      title: `Donut: ${catCol} breakdown`,
      description: `Ring chart showing relative proportions with center readout`,
      categoryCol: catCol,
      valueCol: numCol,
      aggregation: agg,
      suitabilityScore: 86,
      badge: "Distribution",
    });
  }

  // 3. MULTIPLE NUMERICS -> SCATTER & MULTI-SERIES RADAR
  if (numerics.length >= 2) {
    const xNum = numerics[0].name;
    const yNum = numerics[1].name;

    recommendations.push({
      id: `scatter-${xNum}-${yNum}`,
      chartType: "SCATTER",
      title: `Scatter: ${yNum} vs ${xNum}`,
      description: `Examine correlation, clusters, and distribution between ${xNum} and ${yNum}`,
      categoryCol: xNum,
      valueCol: yNum,
      aggregation: "AVG",
      suitabilityScore: 90,
      badge: "Correlation",
    });

    if (categoricals.length > 0) {
      const catCol = categoricals[0].name;
      recommendations.push({
        id: `radar-${catCol}-${xNum}-${yNum}`,
        chartType: "RADAR",
        title: `Radar: Multi-metric profile by ${catCol}`,
        description: `Radial polygon comparing ${xNum} & ${yNum} across ${catCol}`,
        categoryCol: catCol,
        valueCol: xNum,
        secondaryValueCol: yNum,
        aggregation: "AVG",
        suitabilityScore: 84,
        badge: "Distribution",
      });
    }
  }

  // 4. CATEGORY × CATEGORY × NUMERIC -> HEATMAP
  if (categoricals.length >= 2 && numerics.length > 0) {
    const cat1 = categoricals[0].name;
    const cat2 = categoricals[1].name;
    const num = numerics[0].name;

    recommendations.push({
      id: `heatmap-${cat1}-${cat2}-${num}`,
      chartType: "HEATMAP",
      title: `Heatmap: ${cat1} × ${cat2} (${num})`,
      description: `Cross-tabular matrix showing color density of ${num}`,
      categoryCol: cat1,
      groupCol: cat2,
      valueCol: num,
      aggregation: pickDefaultAgg(num),
      suitabilityScore: 82,
      badge: "Matrix",
    });
  }

  // 5. STAGES / CATEGORICAL WITH PIPELINE/FUNNEL PATTERN
  if (categoricals.length > 0 && numerics.length > 0) {
    const catCol = categoricals[0].name;
    const numCol = numerics[0].name;
    recommendations.push({
      id: `funnel-${catCol}-${numCol}`,
      chartType: "FUNNEL",
      title: `Funnel: Stages of ${catCol} (${numCol})`,
      description: `Visual progression through sequential categories or stages`,
      categoryCol: catCol,
      valueCol: numCol,
      aggregation: pickDefaultAgg(numCol),
      suitabilityScore: 80,
      badge: "Distribution",
    });
  }

  // 6. NUMERIC STATISTIC -> METRIC/KPI CARD
  if (numerics.length > 0) {
    const numCol = numerics[0].name;
    recommendations.push({
      id: `kpi-${numCol}`,
      chartType: "KPI",
      title: `KPI Card: Total ${numCol}`,
      description: `Single high-impact summary metric`,
      categoryCol: "",
      valueCol: numCol,
      aggregation: "SUM",
      suitabilityScore: 85,
      badge: "KPI",
    });
  }

  // 7. CATEGORICAL ONLY (FREQUENCY COUNTS)
  if (categoricals.length > 0 && numerics.length === 0) {
    const catCol = categoricals[0].name;
    recommendations.push({
      id: `bar-count-${catCol}`,
      chartType: "BAR",
      title: `Bar: Count by ${catCol}`,
      description: `Frequency distribution across ${catCol} categories`,
      categoryCol: catCol,
      valueCol: catCol,
      aggregation: "COUNT",
      suitabilityScore: 85,
      badge: "Primary",
    });
    recommendations.push({
      id: `kpi-count`,
      chartType: "KPI",
      title: `KPI Card: Total Records`,
      description: `Total count of rows in the dataset`,
      categoryCol: "",
      valueCol: catCol,
      aggregation: "COUNT",
      suitabilityScore: 80,
      badge: "KPI",
    });
  }

  return recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

/**
 * Validates whether a specific chart type is compatible with selected columns.
 */
export function validateChartCompatibility(
  chartType: ChartType,
  params: {
    categoryCol?: string;
    valueCol?: string;
    secondaryValueCol?: string;
    groupCol?: string;
    aggregation?: AggregationFunction;
    columns: DatasetColumn[];
  }
): {
  isCompatible: boolean;
  severity: "none" | "warning" | "error";
  message: string;
} {
  const { categoryCol, valueCol, columns } = params;
  const colMap = new Map(columns.map((c) => [c.name, c]));

  const catColObj = categoryCol ? colMap.get(categoryCol) : undefined;
  const valColObj = valueCol ? colMap.get(valueCol) : undefined;

  const catClassification = catColObj ? classifyColumn(catColObj) : null;
  const valClassification = valColObj ? classifyColumn(valColObj) : null;

  // KPI
  if (chartType === "KPI") {
    if (!valueCol && !categoryCol) {
      return {
        isCompatible: false,
        severity: "error",
        message: "Please select a metric column for the KPI Card.",
      };
    }
    return { isCompatible: true, severity: "none", message: "Suitable KPI configuration." };
  }

  // TABLE
  if (chartType === "TABLE") {
    return { isCompatible: true, severity: "none", message: "Data table compatible with all columns." };
  }

  // Requires Category/X-Axis
  if (!categoryCol) {
    return {
      isCompatible: false,
      severity: "error",
      message: `${chartType} requires an X-axis / category column.`,
    };
  }

  // Requires Value/Measure
  if (!valueCol) {
    return {
      isCompatible: false,
      severity: "error",
      message: `${chartType} requires a Y-axis / value measure.`,
    };
  }

  // SCATTER: best with two numeric axes
  if (chartType === "SCATTER") {
    if (catClassification !== "numeric" && valClassification !== "numeric") {
      return {
        isCompatible: false,
        severity: "warning",
        message: "Scatter Plot works best when both X and Y columns are numeric.",
      };
    }
    return { isCompatible: true, severity: "none", message: "Optimal scatter plot configuration." };
  }

  // HEATMAP: works best with 2 dimensions (categoryCol + groupCol) and 1 numeric value
  if (chartType === "HEATMAP") {
    if (!params.groupCol) {
      return {
        isCompatible: false,
        severity: "warning",
        message: "Heatmap requires a second category (Y-dimension) to form a matrix.",
      };
    }
    return { isCompatible: true, severity: "none", message: "Two-dimensional matrix configuration." };
  }

  // LINE & AREA: best with date or continuous category
  if (chartType === "LINE" || chartType === "AREA") {
    if (catClassification === "date") {
      return { isCompatible: true, severity: "none", message: "Optimal chronological trend sequence." };
    }
    return {
      isCompatible: true,
      severity: "none",
      message: "Sequential or categorical line rendering.",
    };
  }

  // PIE & DONUT: best with categorical X and single positive numeric Y
  if (chartType === "PIE" || chartType === "DONUT") {
    if (valClassification !== "numeric" && params.aggregation !== "COUNT") {
      return {
        isCompatible: false,
        severity: "error",
        message: `${chartType} requires a numeric measure or COUNT aggregation.`,
      };
    }
    return { isCompatible: true, severity: "none", message: "Proportional slice distribution." };
  }

  return { isCompatible: true, severity: "none", message: "Compatible configuration." };
}
