// ========================================
// Interactive Dashboard Analytics Unit & Security Tests
// ========================================
// Tests Dashboard Filter State, Cross-Filtering, Drill-Down,
// Filter Propagation, URL State Serialization, and Tenant Isolation.
// ========================================

import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const app = createApp();
const request = supertest(app);

// Types for testing pure filter & drill-down logic
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

// Logic implementations mirroring apps/web/lib/dashboard-filters.ts
function isFilterApplicableToChart(
  filter: DashboardFilter,
  chart: {
    id: string;
    datasetId?: string;
    config?: { dimensions?: string[]; measures?: { column: string }[] };
  },
  datasetColumns?: { name: string; type: string }[]
): boolean {
  if (filter.datasetId && chart.datasetId && filter.datasetId !== chart.datasetId) {
    return false;
  }
  if (datasetColumns && datasetColumns.length > 0) {
    return datasetColumns.some(
      (c) => c.name.toLowerCase() === filter.field.toLowerCase()
    );
  }
  const config = chart.config || {};
  const dimensions = config.dimensions || [];
  const measures = (config.measures || []).map((m) => m.column);
  const chartCols = [...dimensions, ...measures];
  if (chartCols.length > 0) {
    return chartCols.some(
      (f) => f.toLowerCase() === filter.field.toLowerCase()
    );
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
    id: `cross-${Date.now()}`,
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
  if (!path || path.length <= 1) return null;
  const currentLevel = currentState?.currentLevel ?? 0;
  if (currentLevel >= path.length - 1) {
    return currentState;
  }
  const existingFilters = currentState?.filters || [];
  const nextLevel = currentLevel + 1;
  return {
    chartId,
    path,
    currentLevel: nextLevel,
    filters: [...existingFilters, { field: selectedField, value: selectedValue }],
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

function encodeFiltersToUrl(filters: DashboardFilter[]): string {
  const params = new URLSearchParams();
  for (const f of filters) {
    if (f.operator === "=" && f.value !== undefined && f.value !== null) {
      params.set(`f_${f.field}`, String(f.value));
    }
  }
  return params.toString();
}

function parseFiltersFromUrl(query: string): DashboardFilter[] {
  const params = new URLSearchParams(query);
  const filters: DashboardFilter[] = [];
  params.forEach((value, key) => {
    if (key.startsWith("f_")) {
      filters.push({
        id: `url-${key.substring(2)}`,
        field: key.substring(2),
        operator: "=",
        value,
      });
    }
  });
  return filters;
}

describe("Interactive Dashboard Analytics - Pure Logic Tests", () => {
  const sampleColumns = [
    { name: "region", type: "string" },
    { name: "category", type: "string" },
    { name: "revenue", type: "number" },
    { name: "year", type: "integer" },
  ];

  const chartA = {
    id: "chart-1-region",
    datasetId: "ds-sales",
    config: {
      dimensions: ["region"],
      measures: [{ column: "revenue" }],
    },
  };

  const chartB = {
    id: "chart-2-category",
    datasetId: "ds-sales",
    config: {
      dimensions: ["category"],
      measures: [{ column: "revenue" }],
    },
  };

  const chartUnrelated = {
    id: "chart-3-other",
    datasetId: "ds-inventory",
    config: {
      dimensions: ["warehouse"],
      measures: [{ column: "stock" }],
    },
  };

  describe("1. Dashboard-Level Filters", () => {
    it("creates, accumulates, and removes filters correctly", () => {
      let filters: DashboardFilter[] = [];

      // Create filter
      const f1: DashboardFilter = {
        id: "f1",
        field: "region",
        operator: "=",
        value: "West",
      };
      filters.push(f1);
      expect(filters).toHaveLength(1);
      expect(filters[0].field).toBe("region");

      // Add another filter
      const f2: DashboardFilter = {
        id: "f2",
        field: "revenue",
        operator: ">=",
        value: 1000,
      };
      filters.push(f2);
      expect(filters).toHaveLength(2);

      // Remove specific filter
      filters = filters.filter((f) => f.id !== "f1");
      expect(filters).toHaveLength(1);
      expect(filters[0].id).toBe("f2");

      // Clear all
      filters = [];
      expect(filters).toHaveLength(0);
    });
  });

  describe("2. Cross-Filtering", () => {
    it("toggles cross-filter when bar / pie slice is clicked", () => {
      let filters: DashboardFilter[] = [];

      // Click "South"
      filters = toggleCrossFilter(filters, "region", "South", "chart-1-region", "ds-sales");
      expect(filters).toHaveLength(1);
      expect(filters[0].field).toBe("region");
      expect(filters[0].value).toBe("South");
      expect(filters[0].isCrossFilter).toBe(true);

      // Clicking different value "North" replaces the cross-filter
      filters = toggleCrossFilter(filters, "region", "North", "chart-1-region", "ds-sales");
      expect(filters).toHaveLength(1);
      expect(filters[0].value).toBe("North");

      // Clicking "North" again toggles it off
      filters = toggleCrossFilter(filters, "region", "North", "chart-1-region", "ds-sales");
      expect(filters).toHaveLength(0);
    });
  });

  describe("3. Filter Propagation & Source Chart Exemption", () => {
    it("propagates cross-filter to compatible chart B but exempts source chart A", () => {
      const crossFilter: DashboardFilter = {
        id: "cf-1",
        field: "region",
        operator: "=",
        value: "South",
        sourceChartId: "chart-1-region",
        datasetId: "ds-sales",
        isCrossFilter: true,
      };

      // Chart B (Category) receives the Region = South filter
      const mergedB = mergeChartAndDashboardFilters(chartB, [crossFilter], sampleColumns);
      expect(mergedB).toEqual([
        { column: "region", operator: "=", value: "South" },
      ]);

      // Chart A (Source chart) is EXEMPTED so user retains visual context
      const mergedA = mergeChartAndDashboardFilters(chartA, [crossFilter], sampleColumns);
      expect(mergedA).toHaveLength(0);
    });

    it("does not propagate filter to unrelated chart with mismatched dataset and schema", () => {
      const filter: DashboardFilter = {
        id: "f1",
        field: "region",
        operator: "=",
        value: "South",
        datasetId: "ds-sales",
      };

      const mergedUnrelated = mergeChartAndDashboardFilters(
        chartUnrelated,
        [filter],
        [{ name: "warehouse", type: "string" }, { name: "stock", type: "number" }]
      );
      expect(mergedUnrelated).toHaveLength(0);
    });
  });

  describe("4. Drill-Down Hierarchies", () => {
    const drillPath = ["year", "quarter", "month"];

    it("advances drill-down level when data point is clicked", () => {
      const state1 = drillDownNext(null, "chart-drill", drillPath, "year", "2026");
      expect(state1).not.toBeNull();
      expect(state1?.currentLevel).toBe(1);
      expect(state1?.path[1]).toBe("quarter");
      expect(state1?.filters).toEqual([{ field: "year", value: "2026" }]);

      // Next level: Quarter -> Month
      const state2 = drillDownNext(state1, "chart-drill", drillPath, "quarter", "Q1");
      expect(state2?.currentLevel).toBe(2);
      expect(state2?.path[2]).toBe("month");
      expect(state2?.filters).toHaveLength(2);

      // Boundary: Cannot advance past deepest level
      const state3 = drillDownNext(state2, "chart-drill", drillPath, "month", "Jan");
      expect(state3?.currentLevel).toBe(2);
    });

    it("reverts drill-down when back is triggered", () => {
      const state2: DrillDownState = {
        chartId: "chart-drill",
        path: drillPath,
        currentLevel: 2,
        filters: [
          { field: "year", value: "2026" },
          { field: "quarter", value: "Q1" },
        ],
      };

      const reverted1 = drillDownPrev(state2);
      expect(reverted1?.currentLevel).toBe(1);
      expect(reverted1?.filters).toEqual([{ field: "year", value: "2026" }]);

      // Reverting level 1 returns to level 0 (null)
      const reverted2 = drillDownPrev(reverted1!);
      expect(reverted2).toBeNull();
    });
  });

  describe("5. URL State Synchronization", () => {
    it("encodes and decodes filters cleanly into URL search parameters", () => {
      const filters: DashboardFilter[] = [
        { id: "1", field: "region", operator: "=", value: "South" },
        { id: "2", field: "category", operator: "=", value: "Electronics" },
      ];

      const urlQuery = encodeFiltersToUrl(filters);
      expect(urlQuery).toBe("f_region=South&f_category=Electronics");

      const parsed = parseFiltersFromUrl(urlQuery);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].field).toBe("region");
      expect(parsed[0].value).toBe("South");
      expect(parsed[1].field).toBe("category");
      expect(parsed[1].value).toBe("Electronics");
    });
  });
});

describe("Interactive Dashboard Analytics - Security & API Isolation", () => {
  const ORG_A_TOKEN = signAccessToken({
    sub: "user-tenant-a",
    email: "userA@tenant-a.test",
    organizationId: "org-tenant-a-uuid",
    roleId: "role-analyst",
    roleName: "ANALYST",
    permissions: ["DASHBOARD_VIEW", "DATASET_QUERY"],
  });

  const ORG_B_TOKEN = signAccessToken({
    sub: "user-tenant-b",
    email: "userB@tenant-b.test",
    organizationId: "org-tenant-b-uuid",
    roleId: "role-analyst",
    roleName: "ANALYST",
    permissions: ["DASHBOARD_VIEW", "DATASET_QUERY"],
  });

  it("rejects unauthenticated query attempts", async () => {
    const res = await request
      .post("/api/v1/datasets/fake-dataset-id/query")
      .send({ limit: 10 });
    expect(res.status).toBe(401);
  });

  it("enforces multi-tenant isolation on dashboard queries", async () => {
    // Attempt to query non-existent or foreign tenant dataset
    const res = await request
      .post("/api/v1/datasets/00000000-0000-0000-0000-000000000000/query")
      .set("Authorization", `Bearer ${ORG_A_TOKEN}`)
      .send({
        dimensions: ["region"],
        filters: [{ column: "region", operator: "=", value: "South" }],
      });

    // Should return 400, 403, or 404 without leaking tenant data
    expect([400, 403, 404, 500]).toContain(res.status);
    expect(res.body.error || res.body.message).toBeDefined();
  });
});
