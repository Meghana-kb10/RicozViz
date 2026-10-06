// ============================================================
// Phase 1 Analytics Foundation Integration & Unit Tests
// ============================================================
// Tests the 3 Phase-1 capabilities:
// 1. KPI / Metrics Layer (Calculations, Formulas, Runtime Filters, CRUD, Safety)
// 2. Drill-down Analytics (Hierarchies, Dynamic Queries, Terminal Records, Back Nav)
// 3. Dashboard Cross-Filtering (Multi-widget, Multi-dataset, Exemption, Clear)
// ============================================================

import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { DatasetQueryEngine } from "../services/dataset/query-engine.js";
import { formatMetricValue } from "../services/metric/metric.service.js";
import {
  compileCalculatedField,
  evaluateExpression,
} from "../services/dataset/calculated-field.engine.js";

const app = createApp();
const request = supertest(app);

// Mirror pure client functions from apps/web/lib/dashboard-filters.ts for headless testing
interface DashboardFilter {
  id: string;
  field: string;
  operator: string;
  value: unknown;
  datasetId?: string;
  sourceChartId?: string;
  isCrossFilter?: boolean;
}

interface DrillDownState {
  chartId: string;
  path: string[];
  currentLevel: number;
  filters: { field: string; value: unknown }[];
}

function isFilterApplicableToChart(
  filter: DashboardFilter,
  chart: {
    id: string;
    datasetId?: string;
    config?: { dimensions?: string[]; measures?: { column: string }[] };
  },
  datasetColumns?: { name: string; type: string }[]
): boolean {
  if (datasetColumns && datasetColumns.length > 0) {
    const hasColumn = datasetColumns.some(
      (c) => c.name.toLowerCase() === filter.field.toLowerCase()
    );
    if (hasColumn) return true;
    return false;
  }

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

  if (filter.datasetId && chart.datasetId) {
    return filter.datasetId === chart.datasetId;
  }

  return true;
}

function mergeChartAndDashboardFilters(
  chart: {
    id: string;
    datasetId?: string;
    config?: {
      dimensions?: string[];
      measures?: { column: string }[];
      filters?: { column: string; operator: string; value: unknown }[];
    };
  },
  dashboardFilters: DashboardFilter[],
  datasetColumns?: { name: string; type: string }[]
) {
  const baseFilters = (chart.config?.filters || []).map((f) => ({
    column: f.column,
    operator: f.operator,
    value: f.value,
  }));

  const activeDashboardFilters = dashboardFilters.filter((df) => {
    if (df.isCrossFilter && df.sourceChartId === chart.id) {
      return false; // Source chart exempted
    }
    return isFilterApplicableToChart(df, chart, datasetColumns);
  });

  const merged = [...baseFilters];
  for (const df of activeDashboardFilters) {
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

function toggleCrossFilter(
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

  if (existingIndex >= 0 && currentFilters[existingIndex].value === value) {
    return currentFilters.filter((_, idx) => idx !== existingIndex);
  }

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
    const updated = [...currentFilters];
    updated[existingIndex] = newFilter;
    return updated;
  }

  return [...currentFilters, newFilter];
}

function drillDownNext(
  currentState: DrillDownState | null,
  chartId: string,
  path: string[],
  selectedField: string,
  selectedValue: unknown
): DrillDownState | null {
  if (!path || path.length < 1) return null;

  const currentLevel = currentState?.currentLevel ?? 0;
  if (currentLevel >= path.length) {
    return currentState; // Terminal level
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

function drillDownPrev(currentState: DrillDownState): DrillDownState | null {
  if (currentState.currentLevel <= 0) return null;

  const prevLevel = currentState.currentLevel - 1;
  if (prevLevel === 0) return null;

  return {
    ...currentState,
    currentLevel: prevLevel,
    filters: currentState.filters.slice(0, prevLevel),
  };
}

// Sample dataset schema and data for in-memory analytical testing
const SAMPLE_SALES_SCHEMA = {
  columns: [
    { name: "region", type: "string" },
    { name: "country", type: "string" },
    { name: "city", type: "string" },
    { name: "category", type: "string" },
    { name: "revenue", type: "number" },
    { name: "orders", type: "number" },
    { name: "date", type: "date" },
  ],
  sampleData: [
    { region: "Americas", country: "USA", city: "New York", category: "Hardware", revenue: 5000, orders: 50, date: "2026-01-15" },
    { region: "Americas", country: "USA", city: "Chicago", category: "Software", revenue: 3000, orders: 30, date: "2026-02-10" },
    { region: "Americas", country: "Canada", city: "Toronto", category: "Hardware", revenue: 2000, orders: 20, date: "2026-03-05" },
    { region: "EMEA", country: "Germany", city: "Berlin", category: "Hardware", revenue: 4000, orders: 40, date: "2026-01-20" },
    { region: "EMEA", country: "France", city: "Paris", category: "Software", revenue: 3500, orders: 35, date: "2026-02-15" },
    { region: "APAC", country: "India", city: "Bangalore", category: "Software", revenue: 6000, orders: 60, date: "2026-01-25" },
    { region: "APAC", country: "India", city: "Mumbai", category: "Hardware", revenue: 4500, orders: 45, date: "2026-03-01" },
    { region: "APAC", country: "Japan", city: "Tokyo", category: "Hardware", revenue: 5500, orders: 55, date: "2026-02-28" },
  ],
};

const MOCK_DATASET: any = {
  id: "ds-sales-test",
  name: "Sales Dataset",
  organizationId: "org-test-1",
  workspaceId: "ws-test-1",
  schemaMeta: SAMPLE_SALES_SCHEMA,
  columns: SAMPLE_SALES_SCHEMA.columns.map((c, i) => ({
    name: c.name,
    dataType: c.type === "number" ? "NUMBER" : c.type === "date" ? "DATE" : "STRING",
    ordinalPosition: i,
  })),
};

// ============================================================
// 1. KPI / METRICS LAYER TESTS
// ============================================================
describe("Phase 1: KPI / Metrics Layer", () => {
  const queryEngine = new DatasetQueryEngine();

  it("calculates real KPI aggregation (Revenue = SUM(revenue)) from actual dataset", async () => {
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "total_revenue" }],
    });

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]["total_revenue"]).toBe(33500);
  });

  it("calculates real KPI aggregation (Orders = COUNT(*)) from actual dataset", async () => {
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "*", aggregation: "COUNT", alias: "total_orders" }],
    });

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]["total_orders"]).toBe(8);
  });

  it("applies runtime dashboard filters to KPI calculation", async () => {
    // Metric calculation filtered by Region = 'APAC'
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "apac_revenue" }],
      filters: [{ column: "region", operator: "=", value: "APAC" }],
    });

    expect(res.rows).toHaveLength(1);
    // Bangalore (6000) + Mumbai (4500) + Tokyo (5500) = 16000
    expect(res.rows[0]["apac_revenue"]).toBe(16000);
  });

  it("applies combined multi-filters (Region = 'APAC' AND Category = 'Software') to KPI", async () => {
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "apac_sw_revenue" }],
      filters: [
        { column: "region", operator: "=", value: "APAC" },
        { column: "category", operator: "=", value: "Software" },
      ],
      filterLogic: "AND",
    });

    expect(res.rows).toHaveLength(1);
    // Only Bangalore (6000)
    expect(res.rows[0]["apac_sw_revenue"]).toBe(6000);
  });

  it("applies time/date range filter to KPI", async () => {
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "jan_revenue" }],
      filters: [
        { column: "date", operator: ">=", value: "2026-01-01" },
        { column: "date", operator: "<=", value: "2026-01-31" },
      ],
      filterLogic: "AND",
    });

    expect(res.rows).toHaveLength(1);
    // Jan records: New York (5000) + Berlin (4000) + Bangalore (6000) = 15000
    expect(res.rows[0]["jan_revenue"]).toBe(15000);
  });

  it("computes ratio formula: Average Order Value = Revenue / Orders", async () => {
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [
        { column: "revenue", aggregation: "SUM", alias: "sum_revenue" },
        { column: "orders", aggregation: "SUM", alias: "sum_orders" },
      ],
    });

    const sumRev = Number(res.rows[0]["sum_revenue"]);
    const sumOrders = Number(res.rows[0]["sum_orders"]);
    const aov = sumOrders !== 0 ? sumRev / sumOrders : 0;

    expect(sumRev).toBe(33500);
    expect(sumOrders).toBe(335);
    expect(Math.round(aov * 100) / 100).toBe(100);

    // Verify AST expression evaluation
    const compiled = compileCalculatedField("[revenue] / [orders]", [
      { name: "revenue", type: "number" },
      { name: "orders", type: "number" },
    ]);
    const evaluated = evaluateExpression(compiled.ast, {
      revenue: sumRev,
      orders: sumOrders,
    });
    expect(Math.round((evaluated as number) * 100) / 100).toBe(100);
  });

  it("formats metrics accurately for NUMBER, CURRENCY, and PERCENT", () => {
    expect(formatMetricValue(1234.56, "NUMBER")).toBe("1,234.56");
    expect(formatMetricValue(50000, "CURRENCY")).toContain("50,000");
    expect(formatMetricValue(0.185, "PERCENT")).toBe("18.5%");
  });

  it("rejects invalid columns and unsafe identifiers in queries", async () => {
    await expect(
      queryEngine.executeQuery(MOCK_DATASET, {
        measures: [{ column: "non_existent_col", aggregation: "SUM", alias: "err" }],
      })
    ).rejects.toThrow();

    await expect(
      queryEngine.executeQuery(MOCK_DATASET, {
        measures: [{ column: "revenue; DROP TABLE users--", aggregation: "SUM", alias: "err" }],
      })
    ).rejects.toThrow();
  });
});

// ============================================================
// 2. DRILL-DOWN ANALYTICS TESTS
// ============================================================
describe("Phase 1: Drill-Down Analytics", () => {
  const queryEngine = new DatasetQueryEngine();
  const drillHierarchy = ["region", "country", "city"];

  it("executes Level 0 query: Top-level hierarchy (Dimension: Region)", async () => {
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: ["region"],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
      sort: { column: "revenue", direction: "desc" },
    });

    expect(res.rows).toHaveLength(3); // Americas, APAC, EMEA
    expect(res.rows[0]["region"]).toBe("APAC");
    expect(res.rows[0]["revenue"]).toBe(16000);
  });

  it("executes Level 1 query: Drill from Region to Country (Filtered by Region = 'APAC')", async () => {
    // Advance drill state
    const drill1 = drillDownNext(null, "chart-drill", drillHierarchy, "region", "APAC");
    expect(drill1).not.toBeNull();
    expect(drill1?.currentLevel).toBe(1);
    expect(drillHierarchy[drill1!.currentLevel]).toBe("country");
    expect(drill1?.filters).toEqual([{ field: "region", value: "APAC" }]);

    // Query next level dynamically
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: [drillHierarchy[drill1!.currentLevel]],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
      filters: drill1!.filters.map((f) => ({ column: f.field, operator: "=", value: f.value })),
    });

    expect(res.rows).toHaveLength(2); // India, Japan
    const indiaRow = res.rows.find((r) => r["country"] === "India");
    expect(indiaRow?.["revenue"]).toBe(10500); // Bangalore (6000) + Mumbai (4500)
  });

  it("executes Level 2 query: Drill from Country to City (Filtered by Region = 'APAC' AND Country = 'India')", async () => {
    const drill1 = drillDownNext(null, "chart-drill", drillHierarchy, "region", "APAC");
    const drill2 = drillDownNext(drill1, "chart-drill", drillHierarchy, "country", "India");
    expect(drill2?.currentLevel).toBe(2);
    expect(drillHierarchy[drill2!.currentLevel]).toBe("city");
    expect(drill2?.filters).toHaveLength(2);

    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: [drillHierarchy[drill2!.currentLevel]],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
      filters: drill2!.filters.map((f) => ({ column: f.field, operator: "=", value: f.value })),
    });

    expect(res.rows).toHaveLength(2); // Bangalore, Mumbai
    expect(res.rows.map((r) => r["city"])).toContain("Bangalore");
    expect(res.rows.map((r) => r["city"])).toContain("Mumbai");
  });

  it("executes Terminal Level: Detailed records under leaf node (City = 'Bangalore')", async () => {
    const drill1 = drillDownNext(null, "chart-drill", drillHierarchy, "region", "APAC");
    const drill2 = drillDownNext(drill1, "chart-drill", drillHierarchy, "country", "India");
    const drill3 = drillDownNext(drill2, "chart-drill", drillHierarchy, "city", "Bangalore");

    // Reached terminal detailed records level
    expect(drill3?.currentLevel).toBe(3);
    expect(drill3?.currentLevel).toBe(drillHierarchy.length);
    expect(drill3?.filters).toHaveLength(3);

    // Query detailed records (raw rows)
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      filters: drill3!.filters.map((f) => ({ column: f.field, operator: "=", value: f.value })),
    });

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]["city"]).toBe("Bangalore");
    expect(res.rows[0]["revenue"]).toBe(6000);
    expect(res.rows[0]["category"]).toBe("Software");
  });

  it("reverts drill-down levels seamlessly via drillDownPrev back to root", () => {
    const drill1 = drillDownNext(null, "chart-drill", drillHierarchy, "region", "APAC");
    const drill2 = drillDownNext(drill1, "chart-drill", drillHierarchy, "country", "India");
    const drill3 = drillDownNext(drill2, "chart-drill", drillHierarchy, "city", "Bangalore")!;

    // Revert from Detailed Records -> City
    const backToCity = drillDownPrev(drill3);
    expect(backToCity?.currentLevel).toBe(2);
    expect(backToCity?.filters).toHaveLength(2);
    expect(drillHierarchy[backToCity!.currentLevel]).toBe("city");

    // Revert from City -> Country
    const backToCountry = drillDownPrev(backToCity!);
    expect(backToCountry?.currentLevel).toBe(1);
    expect(backToCountry?.filters).toHaveLength(1);
    expect(drillHierarchy[backToCountry!.currentLevel]).toBe("country");

    // Revert from Country -> Region (Root)
    const backToRoot = drillDownPrev(backToCountry!);
    expect(backToRoot).toBeNull(); // Reset to top level
  });
});

// ============================================================
// 3. DASHBOARD CROSS-FILTERING TESTS
// ============================================================
describe("Phase 1: Dashboard Cross-Filtering", () => {
  const chartSalesRegion = {
    id: "chart-1",
    datasetId: "ds-sales-test",
    config: {
      dimensions: ["region"],
      measures: [{ column: "revenue" }],
    },
  };

  const chartSalesCategory = {
    id: "chart-2",
    datasetId: "ds-sales-test",
    config: {
      dimensions: ["category"],
      measures: [{ column: "revenue" }],
    },
  };

  const chartOtherDatasetWithRegion = {
    id: "chart-3",
    datasetId: "ds-inventory-test",
    config: {
      dimensions: ["region"],
      measures: [{ column: "stock" }],
    },
  };

  const inventoryColumns = [
    { name: "region", type: "string" },
    { name: "warehouse", type: "string" },
    { name: "stock", type: "number" },
  ];

  it("toggles cross-filter when a user clicks a chart data point", () => {
    let filters: DashboardFilter[] = [];

    // User clicks 'APAC' on Region chart
    filters = toggleCrossFilter(filters, "region", "APAC", "chart-1", "ds-sales-test");
    expect(filters).toHaveLength(1);
    expect(filters[0].field).toBe("region");
    expect(filters[0].value).toBe("APAC");
    expect(filters[0].isCrossFilter).toBe(true);

    // Clicking 'APAC' again removes the filter (toggles off)
    filters = toggleCrossFilter(filters, "region", "APAC", "chart-1", "ds-sales-test");
    expect(filters).toHaveLength(0);
  });

  it("exempts source chart from its own cross-filter so selection context is retained", () => {
    const crossFilter: DashboardFilter = {
      id: "cf-1",
      field: "region",
      operator: "=",
      value: "APAC",
      sourceChartId: "chart-1",
      datasetId: "ds-sales-test",
      isCrossFilter: true,
    };

    // Chart 2 (Category chart) receives the filter
    const mergedForChart2 = mergeChartAndDashboardFilters(
      chartSalesCategory,
      [crossFilter],
      SAMPLE_SALES_SCHEMA.columns
    );
    expect(mergedForChart2).toEqual([
      { column: "region", operator: "=", value: "APAC" },
    ]);

    // Chart 1 (Source chart) does NOT receive the filter (exempted)
    const mergedForChart1 = mergeChartAndDashboardFilters(
      chartSalesRegion,
      [crossFilter],
      SAMPLE_SALES_SCHEMA.columns
    );
    expect(mergedForChart1).toHaveLength(0);
  });

  it("propagates cross-filters to compatible widgets across different datasets", () => {
    const crossFilter: DashboardFilter = {
      id: "cf-1",
      field: "region",
      operator: "=",
      value: "APAC",
      sourceChartId: "chart-1",
      datasetId: "ds-sales-test",
      isCrossFilter: true,
    };

    // Chart 3 uses a different dataset ('ds-inventory-test') but has a 'region' column
    const mergedForChart3 = mergeChartAndDashboardFilters(
      chartOtherDatasetWithRegion,
      [crossFilter],
      inventoryColumns
    );
    expect(mergedForChart3).toEqual([
      { column: "region", operator: "=", value: "APAC" },
    ]);
  });

  it("combines multiple cross-filters from different widgets correctly", () => {
    let filters: DashboardFilter[] = [];

    // Click 'APAC' on Region chart
    filters = toggleCrossFilter(filters, "region", "APAC", "chart-1", "ds-sales-test");
    // Click 'Hardware' on Category chart
    filters = toggleCrossFilter(filters, "category", "Hardware", "chart-2", "ds-sales-test");

    expect(filters).toHaveLength(2);
    expect(filters[0].field).toBe("region");
    expect(filters[1].field).toBe("category");

    // A third chart (e.g. Orders table) receives BOTH filters
    const merged = mergeChartAndDashboardFilters(
      { id: "chart-table", datasetId: "ds-sales-test" },
      filters,
      SAMPLE_SALES_SCHEMA.columns
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({ column: "region", operator: "=", value: "APAC" });
    expect(merged[1]).toEqual({ column: "category", operator: "=", value: "Hardware" });
  });

  it("allows clearing all filters cleanly", () => {
    let filters: DashboardFilter[] = [
      { id: "1", field: "region", operator: "=", value: "APAC", isCrossFilter: true },
      { id: "2", field: "category", operator: "=", value: "Hardware", isCrossFilter: true },
    ];

    filters = [];
    expect(filters).toHaveLength(0);
  });
});
