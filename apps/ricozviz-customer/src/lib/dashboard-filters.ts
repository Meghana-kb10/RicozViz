// ========================================
// RicozViz Dashboard Interactive Filters
// ========================================
// Pure functions for dashboard filter state, cross-filtering,
// drill-down state, URL encoding, and query merging.
// ========================================

import type {
  ChartConfig,
  ChartData,
  DatasetColumn,
  DatasetQueryFilter,
  FilterOperator,
} from "./api";

export interface DashboardFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
  datasetId?: string; // Optional: restrict to specific dataset, or apply globally across matching field names
  sourceChartId?: string; // Populated if created via cross-filtering
  isCrossFilter?: boolean;
  label?: string; // Optional human-readable description for UI chip
}

export interface DrillDownState {
  chartId: string;
  path: string[];
  currentLevel: number;
  filters: { field: string; value: unknown }[];
}

/**
 * Checks if a dashboard filter is applicable to a specific chart based on its dataset columns or configuration.
 */
export function isFilterApplicableToChart(
  filter: DashboardFilter,
  chart: ChartData,
  datasetColumns?: DatasetColumn[]
): boolean {
  // If columns are provided, verify if the chart's dataset has this field
  if (datasetColumns && datasetColumns.length > 0) {
    const hasColumn = datasetColumns.some(
      (c) => c.name.toLowerCase() === filter.field.toLowerCase()
    );
    if (hasColumn) return true;
    return false;
  }

  // If chart config defines dimensions or measures, check if field is used
  const config = chart.config || {};
  const dimensions = config.dimensions || [];
  const measures = (config.measures || []).map((m) => m.column);
  const chartCols = [...dimensions, ...measures];

  if (chartCols.length > 0) {
    const matchesChartField = chartCols.some(
      (f) => f.toLowerCase() === filter.field.toLowerCase()
    );
    if (matchesChartField) return true;
  }

  // If filter is explicitly pinned to a datasetId, verify match
  if (filter.datasetId && chart.datasetId) {
    return filter.datasetId === chart.datasetId;
  }

  // If no columns known, allow by default if dataset matches or is global
  return true;
}

/**
 * Merges chart-specific filters with dashboard-level filters, avoiding duplicates.
 * Cross-filters for the chart itself are excluded so the source chart remains intact for other selections.
 */
export function mergeChartAndDashboardFilters(
  chart: ChartData,
  dashboardFilters: DashboardFilter[],
  datasetColumns?: DatasetColumn[]
): DatasetQueryFilter[] {
  const baseFilters: DatasetQueryFilter[] = (chart.config?.filters || []).map((f) => ({
    column: f.column,
    operator: f.operator as FilterOperator,
    value: f.value,
  }));

  const activeDashboardFilters = dashboardFilters.filter((df) => {
    // If it's a cross-filter created by this exact chart, do not filter this chart
    // so the user can see their current selection in context
    if (df.isCrossFilter && df.sourceChartId === chart.id) {
      return false;
    }
    return isFilterApplicableToChart(df, chart, datasetColumns);
  });

  const merged: DatasetQueryFilter[] = [...baseFilters];

  for (const df of activeDashboardFilters) {
    // Avoid exact duplicate column filter if already present with same operator
    const exists = merged.some(
      (f) =>
        f.column.toLowerCase() === df.field.toLowerCase() &&
        f.operator === df.operator &&
        f.value === df.value
    );
    if (!exists) {
      merged.push({
        column: df.field,
        operator: df.operator,
        value: df.value,
      });
    }
  }

  return merged;
}

/**
 * Toggles a cross-filter. If already active for the same field and value, removes it.
 * Otherwise, replaces or adds the filter.
 */
export function toggleCrossFilter(
  currentFilters: DashboardFilter[],
  field: string,
  value: unknown,
  sourceChartId?: string,
  datasetId?: string
): DashboardFilter[] {
  const existingIndex = currentFilters.findIndex(
    (f) =>
      f.field.toLowerCase() === field.toLowerCase() &&
      f.isCrossFilter &&
      f.sourceChartId === sourceChartId
  );

  // If clicking the same value, toggle off
  if (existingIndex >= 0 && currentFilters[existingIndex].value === value) {
    return currentFilters.filter((_, idx) => idx !== existingIndex);
  }

  // Create new cross filter
  const newFilter: DashboardFilter = {
    id: `cross-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    field,
    operator: "=",
    value,
    sourceChartId,
    datasetId,
    isCrossFilter: true,
  };

  if (existingIndex >= 0) {
    // Replace with new value
    const updated = [...currentFilters];
    updated[existingIndex] = newFilter;
    return updated;
  }

  return [...currentFilters, newFilter];
}

/**
 * Encodes active simple filters into URL search params.
 */
export function encodeFiltersToUrl(filters: DashboardFilter[]): string {
  const params = new URLSearchParams();
  for (const f of filters) {
    if (f.operator === "=" && f.value !== undefined && f.value !== null) {
      params.set(`f_${f.field}`, String(f.value));
    }
  }
  return params.toString();
}

/**
 * Parses URL search params into DashboardFilter objects.
 */
export function parseFiltersFromUrl(
  searchParams: URLSearchParams | string
): DashboardFilter[] {
  const params =
    typeof searchParams === "string"
      ? new URLSearchParams(searchParams)
      : searchParams;
  const filters: DashboardFilter[] = [];

  params.forEach((value, key) => {
    if (key.startsWith("f_")) {
      const field = key.substring(2);
      filters.push({
        id: `url-${field}`,
        field,
        operator: "=",
        value,
      });
    }
  });

  return filters;
}

/**
 * Handles drill-down hierarchy transition including terminal detailed records.
 */
export function drillDownNext(
  currentState: DrillDownState | null,
  chartId: string,
  path: string[],
  selectedField: string,
  selectedValue: unknown
): DrillDownState | null {
  if (!path || path.length < 1) return null;

  const currentLevel = currentState?.currentLevel ?? 0;
  if (currentLevel >= path.length) {
    return currentState; // Already at deepest level (detailed records)
  }

  const existingFilters = currentState?.filters || [];
  const nextLevel = currentLevel + 1;

  return {
    chartId,
    path,
    currentLevel: nextLevel,
    filters: [
      ...existingFilters,
      { field: selectedField, value: selectedValue },
    ],
  };
}

/**
 * Reverts drill-down to previous level.
 */
export function drillDownPrev(currentState: DrillDownState): DrillDownState | null {
  if (currentState.currentLevel <= 0) return null;

  const prevLevel = currentState.currentLevel - 1;
  if (prevLevel === 0) return null;

  return {
    ...currentState,
    currentLevel: prevLevel,
    filters: currentState.filters.slice(0, prevLevel),
  };
}
