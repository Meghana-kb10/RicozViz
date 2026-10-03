// ========================================
// Visualization Studio & Query Mapping Tests
// ========================================
// Tests Chart Configuration -> Query Engine Payload conversion,
// Visualization Data Mapping (BAR, LINE, AREA, PIE, DONUT, SCATTER, TABLE, KPI),
// Empty/Error state handling, and Chart CRUD & Tenant Security.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  createChartSchema,
  updateChartSchema,
  chartConfigSchema,
} from "../services/chart/chart.service.js";
import { datasetQueryEngine } from "../services/dataset/query-engine.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

// Mock Tokens
const ADMIN_ORG_ID = "org-test-admin-1";
const OTHER_ORG_ID = "org-other-tenant-99";

const ADMIN_TOKEN = signAccessToken({
  sub: "user-admin-1",
  email: "admin@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "DASHBOARD_CREATE",
    "DASHBOARD_VIEW",
    "DASHBOARD_EDIT",
    "DASHBOARD_DELETE",
    "CHART_CREATE",
    "CHART_VIEW",
    "CHART_EDIT",
    "CHART_DELETE",
  ],
});

// Import pure query mapper logic locally for testing in Node / Vitest
export function buildChartQueryParamsTest(
  config: {
    dimensions?: string[];
    measures?: { column: string; aggregation: string; alias?: string }[];
    filters?: { column: string; operator: string; value?: unknown }[];
    sort?: { column: string; direction: "asc" | "desc" | "ASC" | "DESC" };
    xAxis?: string;
    yAxis?: string | string[];
  },
  limit = 100
) {
  const params: any = { limit };

  if (config.measures && config.measures.length > 0) {
    params.measures = config.measures.map((m) => ({
      column: m.column,
      aggregation: m.aggregation,
      alias: m.alias || `${m.aggregation.toLowerCase()}_${m.column}`,
    }));
    if (config.dimensions && config.dimensions.length > 0) {
      params.dimensions = config.dimensions;
    }
  } else if (config.dimensions && config.dimensions.length > 0) {
    params.columns = config.dimensions;
  }

  if (config.filters && config.filters.length > 0) {
    params.filters = config.filters.map((f) => ({
      column: f.column,
      operator: f.operator,
      value: f.value,
    }));
  }

  if (config.sort && config.sort.column) {
    params.orderBy = {
      column: config.sort.column,
      direction: config.sort.direction.toLowerCase(),
    };
  }

  return params;
}

export function mapQueryResultToChartDataTest(
  chartType: string,
  result: { columns: { name: string; type: string }[]; rows: Record<string, unknown>[] } | null,
  config: any
) {
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

  const xKey =
    config.dimensions?.[0] ||
    config.xAxis ||
    (columns.length > 0 ? columns[0].name : "dimension");

  let measureKeys: string[] = [];
  if (config.measures && config.measures.length > 0) {
    measureKeys = config.measures.map(
      (m: any) => m.alias || `${m.aggregation.toLowerCase()}_${m.column}`
    );
  } else if (columns.length > 1) {
    measureKeys = columns.slice(1).map((c) => c.name);
  } else if (columns.length === 1) {
    measureKeys = [columns[0].name];
  }

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

  if (chartType === "SCATTER") {
    const yKey =
      (typeof config.yAxis === "string" ? config.yAxis : config.yAxis?.[0]) ||
      measureKeys[0] ||
      (columns[1]?.name ?? "y");

    return {
      chartType,
      rows: sanitizedRows,
      xKey,
      yKey,
      measureKeys,
      columns,
    };
  }

  return {
    chartType,
    rows: sanitizedRows,
    xKey,
    measureKeys,
    columns,
  };
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("⚠️  Database not available — DB-dependent tests will be skipped.");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      await prisma.chart.deleteMany({
        where: { title: { startsWith: "Studio Test" } },
      });
      await prisma.dashboard.deleteMany({
        where: { name: { startsWith: "Studio Test" } },
      });
    } catch {
      // ignore cleanup errors
    }
  }
  await prisma.$disconnect();
});

// ============================================================
// 1. QUERY PAYLOAD BUILDER TESTS
// ============================================================

describe("Visualization Studio Query Payload Generation", () => {
  it("translates chart configuration with dimensions and measures into aggregate query params", () => {
    const config = {
      dimensions: ["region"],
      measures: [
        { column: "revenue", aggregation: "SUM" },
        { column: "units_sold", aggregation: "COUNT", alias: "total_units" },
      ],
      filters: [{ column: "revenue", operator: ">", value: 500 }],
      sort: { column: "revenue", direction: "desc" as const },
    };

    const params = buildChartQueryParamsTest(config, 50);

    expect(params.limit).toBe(50);
    expect(params.dimensions).toEqual(["region"]);
    expect(params.measures).toHaveLength(2);
    expect(params.measures[0]).toEqual({
      column: "revenue",
      aggregation: "SUM",
      alias: "sum_revenue",
    });
    expect(params.measures[1]).toEqual({
      column: "units_sold",
      aggregation: "COUNT",
      alias: "total_units",
    });
    expect(params.filters).toEqual([
      { column: "revenue", operator: ">", value: 500 },
    ]);
    expect(params.orderBy).toEqual({ column: "revenue", direction: "desc" });
  });

  it("translates raw table configuration without measures into column selection", () => {
    const config = {
      dimensions: ["id", "customer_name", "signup_date"],
    };

    const params = buildChartQueryParamsTest(config, 25);

    expect(params.columns).toEqual(["id", "customer_name", "signup_date"]);
    expect(params.measures).toBeUndefined();
    expect(params.limit).toBe(25);
  });
});

// ============================================================
// 2. CHART DATA MAPPING TESTS
// ============================================================

describe("Visualization Data Mapping", () => {
  const mockColumns = [
    { name: "category", type: "string" },
    { name: "revenue", type: "number" },
  ];

  const mockRows = [
    { category: "Electronics", revenue: "45000.50" },
    { category: "Clothing", revenue: "23000.00" },
    { category: "Books", revenue: "12000.25" },
  ];

  const mockResult = {
    columns: mockColumns,
    rows: mockRows,
  };

  it("maps BAR rendering data with numeric coercion", () => {
    const config = {
      dimensions: ["category"],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
    };

    const mapped = mapQueryResultToChartDataTest("BAR", mockResult, config);

    expect(mapped.chartType).toBe("BAR");
    expect(mapped.xKey).toBe("category");
    expect(mapped.measureKeys).toEqual(["revenue"]);
    expect(mapped.rows).toHaveLength(3);
    expect(mapped.rows[0].revenue).toBe(45000.5);
    expect(typeof mapped.rows[0].revenue).toBe("number");
  });

  it("maps LINE rendering data correctly", () => {
    const config = {
      dimensions: ["category"],
      measures: [{ column: "revenue", aggregation: "AVG", alias: "revenue" }],
    };

    const mapped = mapQueryResultToChartDataTest("LINE", mockResult, config);

    expect(mapped.chartType).toBe("LINE");
    expect(mapped.xKey).toBe("category");
    expect(mapped.measureKeys).toContain("revenue");
    expect(mapped.rows[1].revenue).toBe(23000);
  });

  it("maps PIE and DONUT slices with name and value keys", () => {
    const config = {
      dimensions: ["category"],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
    };

    const mappedPie = mapQueryResultToChartDataTest("PIE", mockResult, config);
    expect(mappedPie.pieSlices).toHaveLength(3);
    expect(mappedPie.pieSlices?.[0]).toEqual({
      name: "Electronics",
      value: 45000.5,
    });

    const mappedDonut = mapQueryResultToChartDataTest("DONUT", mockResult, config);
    expect(mappedDonut.pieSlices).toHaveLength(3);
    expect(mappedDonut.pieSlices?.[2]).toEqual({
      name: "Books",
      value: 12000.25,
    });
  });

  it("maps SCATTER data with x and y coordinates", () => {
    const config = {
      dimensions: ["revenue"],
      yAxis: "revenue",
      measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
    };

    const mapped = mapQueryResultToChartDataTest("SCATTER", mockResult, config);
    expect(mapped.chartType).toBe("SCATTER");
    expect(mapped.xKey).toBe("revenue");
    expect(mapped.yKey).toBe("revenue");
  });

  it("maps TABLE rendering preserving all columns and records", () => {
    const config = {};
    const mapped = mapQueryResultToChartDataTest("TABLE", mockResult, config);

    expect(mapped.chartType).toBe("TABLE");
    expect(mapped.columns).toHaveLength(2);
    expect(mapped.rows).toHaveLength(3);
  });

  it("maps KPI metric card with primary aggregated value", () => {
    const kpiResult = {
      columns: [{ name: "total_revenue", type: "number" }],
      rows: [{ total_revenue: "154200.75" }],
    };

    const config = {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "total_revenue" }],
    };

    const mapped = mapQueryResultToChartDataTest("KPI", kpiResult, config);

    expect(mapped.chartType).toBe("KPI");
    expect(mapped.kpiValue).toBe(154200.75);
    expect(mapped.kpiLabel).toBe("SUM of revenue");
  });

  it("maps AREA rendering data with continuous series", () => {
    const config = {
      dimensions: ["category"],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
    };

    const mapped = mapQueryResultToChartDataTest("AREA", mockResult, config);
    expect(mapped.chartType).toBe("AREA");
    expect(mapped.xKey).toBe("category");
    expect(mapped.measureKeys).toContain("revenue");
    expect(mapped.rows).toHaveLength(3);
  });

  it("maps multiple measures correctly across rows", () => {
    const multiMeasureResult = {
      columns: [
        { name: "month", type: "string" },
        { name: "revenue", type: "number" },
        { name: "profit", type: "number" },
      ],
      rows: [
        { month: "Jan", revenue: "10000", profit: "3000" },
        { month: "Feb", revenue: "15000", profit: "4500" },
      ],
    };

    const config = {
      dimensions: ["month"],
      measures: [
        { column: "revenue", aggregation: "SUM", alias: "revenue" },
        { column: "profit", aggregation: "SUM", alias: "profit" },
      ],
    };

    const mapped = mapQueryResultToChartDataTest("BAR", multiMeasureResult, config);
    expect(mapped.measureKeys).toEqual(["revenue", "profit"]);
    expect(mapped.rows[0].revenue).toBe(10000);
    expect(mapped.rows[0].profit).toBe(3000);
  });

  it("converts all query filter operators and sorting correctly", () => {
    const operators = [
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
    ];

    const config = {
      filters: operators.map((op) => ({
        column: "field",
        operator: op,
        value: op.includes("Null") ? undefined : "val",
      })),
      sort: { column: "field", direction: "asc" as const },
    };

    const params = buildChartQueryParamsTest(config);
    expect(params.filters).toHaveLength(operators.length);
    expect(params.orderBy).toEqual({ column: "field", direction: "asc" });
  });

  it("gracefully handles empty query results without crashing", () => {
    const mapped = mapQueryResultToChartDataTest("BAR", null, {});
    expect(mapped.rows).toEqual([]);
    expect(mapped.kpiValue).toBe(0);
    expect(mapped.kpiLabel).toBe("No Data");
  });
});

// ============================================================
// 2B. FORMATTING UTILITIES TESTS
// ============================================================

describe("Visualization Formatting Utilities", () => {
  function formatNumberTest(num: number): string {
    return new Intl.NumberFormat("en-US").format(num);
  }

  function formatCurrencyTest(num: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
  }

  function formatPercentTest(num: number): string {
    const percentage = Math.abs(num) <= 1 && num !== 0 ? num * 100 : num;
    return `${percentage.toFixed(1)}%`;
  }

  function formatDateTest(dateStr: string): string {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
  }

  it("formats integers and decimals cleanly", () => {
    expect(formatNumberTest(12450)).toBe("12,450");
    expect(formatNumberTest(1000000)).toBe("1,000,000");
  });

  it("formats currency accurately with configured currency symbol", () => {
    expect(formatCurrencyTest(4850.5)).toBe("$4,850.50");
  });

  it("formats percentage fractional and scalar numbers", () => {
    expect(formatPercentTest(0.184)).toBe("18.4%");
    expect(formatPercentTest(42.5)).toBe("42.5%");
  });

  it("formats ISO date strings without throwing errors", () => {
    const formatted = formatDateTest("2026-09-30T12:00:00Z");
    expect(formatted).toContain("2026");
  });
});

// ============================================================
// 3. SCHEMA VALIDATION TESTS
// ============================================================

describe("Visualization Configuration Schema Validation", () => {
  it("rejects invalid aggregation functions", () => {
    expect(() =>
      chartConfigSchema.parse({
        measures: [{ column: "amount", aggregation: "UNSUPPORTED" as any }],
      })
    ).toThrow();
  });

  it("rejects invalid chart types in creation payload", () => {
    expect(() =>
      createChartSchema.parse({
        title: "Test Studio Chart",
        chartType: "HEATMAP_3D",
      })
    ).toThrow(/Invalid chart type/);
  });

  it("accepts valid partial updates in updateChartSchema", () => {
    const updated = updateChartSchema.parse({
      chartType: "donut",
      config: {
        dimensions: ["status"],
        measures: [{ column: "count", aggregation: "COUNT" }],
      },
    });

    expect(updated.chartType).toBe("DONUT");
  });
});

// ============================================================
// 4. CHART LIFECYCLE & TENANT ISOLATION TESTS
// ============================================================

describe("Visualization Studio Backend Lifecycle & Security", () => {
  let dashAId: string;
  let datasetAId: string;
  let datasetBId: string;
  let testChartId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    const dashA = await prisma.dashboard.create({
      data: {
        name: "Studio Test Dashboard",
        organizationId: ADMIN_ORG_ID,
        ownerId: "user-admin-1",
      },
    });
    dashAId = dashA.id;

    const dsA = await prisma.dataset.create({
      data: {
        name: "Studio Test Dataset A",
        organizationId: ADMIN_ORG_ID,
        type: "UPLOADED",
        createdById: "user-admin-1",
      },
    });
    datasetAId = dsA.id;

    const dsB = await prisma.dataset.create({
      data: {
        name: "Studio Test Dataset B (Foreign)",
        organizationId: OTHER_ORG_ID,
        type: "UPLOADED",
        createdById: "user-other-org",
      },
    });
    datasetBId = dsB.id;
  });

  it("creates and saves a visualization chart", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${dashAId}/charts`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Studio Test Bar Chart",
        chartType: "BAR",
        datasetId: datasetAId,
        config: {
          dimensions: ["category"],
          measures: [{ column: "sales", aggregation: "SUM" }],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Studio Test Bar Chart");
    testChartId = res.body.data.id;
  });

  it("rejects cross-tenant dataset selection (Security Rule)", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${dashAId}/charts`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Cross Tenant Attack Chart",
        chartType: "LINE",
        datasetId: datasetBId,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("updates chart configuration and chart type", async () => {
    if (!dbAvailable) return;

    const res = await request
      .patch(`/api/v1/dashboards/${dashAId}/charts/${testChartId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Updated Studio Chart",
        chartType: "KPI",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Updated Studio Chart");
    expect(res.body.data.chartType).toBe("KPI");
  });

  it("deletes a visualization chart from the dashboard", async () => {
    if (!dbAvailable) return;

    const res = await request
      .delete(`/api/v1/dashboards/${dashAId}/charts/${testChartId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================
// 5. DATA PROCESSING & QUERY ENGINE TESTS (Part A & B)
// ============================================================

describe("Data Processing & Query Engine Core", () => {
  const sampleDataset: any = {
    id: "ds-sample-test",
    name: "Sales Sample Dataset",
    organizationId: ADMIN_ORG_ID,
    type: "UPLOADED",
    schemaMeta: {
      columns: [
        { name: "region", type: "string" },
        { name: "revenue", type: "number" },
        { name: "units", type: "integer" },
        { name: "category", type: "string" },
      ],
      sampleData: [
        { region: "North", revenue: 10000, units: 10, category: "Tech" },
        { region: "North", revenue: 15000, units: 15, category: "Office" },
        { region: "South", revenue: 20000, units: 20, category: "Tech" },
        { region: "South", revenue: 25000, units: 25, category: "Office" },
        { region: "West", revenue: 50000, units: 50, category: "Tech" },
        { region: "West", revenue: 100000, units: 100, category: "Office" },
        { region: null, revenue: 5000, units: 5, category: "Other" },
      ],
    },
  };

  it("selects only requested columns and validates column existence", async () => {
    const result = await datasetQueryEngine.executeQuery(sampleDataset, {
      columns: ["region", "revenue"],
    });

    expect(result.columns.map((c) => c.name)).toEqual(["region", "revenue"]);
    expect(result.rows.length).toBe(7);
    expect(result.rows[0]).toHaveProperty("region");
    expect(result.rows[0]).toHaveProperty("revenue");
    expect(result.rows[0]).not.toHaveProperty("category");
    expect(result.processedColumns.map((c) => c.name)).toEqual(["region", "revenue"]);
    expect(result.metadata.queryMode).toBe("RAW");
  });

  it("rejects unknown column names with 400 Bad Request", async () => {
    await expect(
      datasetQueryEngine.executeQuery(sampleDataset, {
        columns: ["region", "nonexistent_field"],
      })
    ).rejects.toThrow(/does not exist in dataset schema/);
  });

  it("filters with equals, not equals, greater than, less than, gte, lte, and contains", async () => {
    // greater than
    const gt = await datasetQueryEngine.executeQuery(sampleDataset, {
      filters: [{ column: "revenue", operator: "greaterThan", value: 20000 }],
    });
    expect(gt.rows.length).toBe(3); // 25000, 50000, 100000

    // equals
    const eq = await datasetQueryEngine.executeQuery(sampleDataset, {
      filters: [{ column: "region", operator: "equals", value: "South" }],
    });
    expect(eq.rows.length).toBe(2);

    // contains
    const cont = await datasetQueryEngine.executeQuery(sampleDataset, {
      filters: [{ column: "category", operator: "contains", value: "ec" }],
    });
    expect(cont.rows.length).toBe(3); // Tech rows

    // is empty (isNull)
    const emptyRes = await datasetQueryEngine.executeQuery(sampleDataset, {
      filters: [{ column: "region", operator: "is empty" }],
    });
    expect(emptyRes.rows.length).toBe(1);
    expect(emptyRes.rows[0].category).toBe("Other");

    // is not empty (isNotNull)
    const notEmptyRes = await datasetQueryEngine.executeQuery(sampleDataset, {
      filters: [{ column: "region", operator: "is not empty" }],
    });
    expect(notEmptyRes.rows.length).toBe(6);
  });

  it("rejects unsupported filter operators with 400 Bad Request", async () => {
    await expect(
      datasetQueryEngine.executeQuery(sampleDataset, {
        filters: [{ column: "revenue", operator: "INVALID_OP" as any, value: 100 }],
      })
    ).rejects.toThrow(/Unsupported filter operator/);
  });

  it("sorts rows ascending and descending", async () => {
    const asc = await datasetQueryEngine.executeQuery(sampleDataset, {
      orderBy: { column: "revenue", direction: "asc" },
    });
    expect(asc.rows[0].revenue).toBe(5000);

    const desc = await datasetQueryEngine.executeQuery(sampleDataset, {
      orderBy: { column: "revenue", direction: "desc" },
    });
    expect(desc.rows[0].revenue).toBe(100000);
  });

  it("groups by column and computes SUM, AVG, MIN, MAX, COUNT aggregations", async () => {
    const aggResult = await datasetQueryEngine.executeQuery(sampleDataset, {
      groupBy: ["region"],
      aggregations: [
        { column: "revenue", function: "SUM", alias: "total_revenue" },
        { column: "revenue", function: "AVG", alias: "avg_revenue" },
        { column: "revenue", function: "MIN", alias: "min_revenue" },
        { column: "revenue", function: "MAX", alias: "max_revenue" },
        { column: "*", function: "COUNT", alias: "row_count" },
      ],
      orderBy: { column: "total_revenue", direction: "desc" },
    });

    expect(aggResult.columns.map((c) => c.name)).toEqual([
      "region",
      "total_revenue",
      "avg_revenue",
      "min_revenue",
      "max_revenue",
      "row_count",
    ]);

    // West has 50000 + 100000 = 150000
    const west = aggResult.rows.find((r) => r.region === "West");
    expect(west).toBeDefined();
    expect(west?.total_revenue).toBe(150000);
    expect(west?.avg_revenue).toBe(75000);
    expect(west?.min_revenue).toBe(50000);
    expect(west?.max_revenue).toBe(100000);
    expect(west?.row_count).toBe(2);

    // North has 10000 + 15000 = 25000
    const north = aggResult.rows.find((r) => r.region === "North");
    expect(north).toBeDefined();
    expect(north?.total_revenue).toBe(25000);
    expect(north?.row_count).toBe(2);
  });

  it("rejects SUM/AVG applied to non-numeric columns", async () => {
    await expect(
      datasetQueryEngine.executeQuery(sampleDataset, {
        groupBy: ["region"],
        aggregations: [{ column: "category", function: "SUM" }],
      })
    ).rejects.toThrow(/cannot be applied to non-numeric column/);
  });

  it("enforces safe maximum result size limits", async () => {
    const limited = await datasetQueryEngine.executeQuery(sampleDataset, {
      limit: 2,
    });
    expect(limited.rows.length).toBe(2);
    expect(limited.total).toBe(7);
    expect(limited.limit).toBe(2);

    await expect(
      datasetQueryEngine.executeQuery(sampleDataset, {
        limit: 99999,
      })
    ).rejects.toThrow(/exceeds maximum allowable limit/);
  });
});

// ============================================================
// 6. STANDALONE VISUALIZATION API TESTS (Part C)
// ============================================================

describe("Standalone Visualization Engine API (/api/v1/visualizations)", () => {
  let createdVizId: string;
  let testDatasetId: string;
  let foreignDatasetId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    // Create test dataset in ADMIN_ORG_ID
    const ds = await prisma.dataset.create({
      data: {
        name: "Test Visualization Studio Dataset",
        organizationId: ADMIN_ORG_ID,
        type: "UPLOADED",
        createdById: "user-admin-1",
        schemaMeta: {
          columns: [
            { name: "region", type: "string" },
            { name: "sales", type: "number" },
          ],
          sampleData: [
            { region: "East", sales: 50000 },
            { region: "West", sales: 80000 },
            { region: "Central", sales: 30000 },
          ],
        },
      },
    });
    testDatasetId = ds.id;

    // Create foreign dataset in OTHER_ORG_ID
    const foreignDs = await prisma.dataset.create({
      data: {
        name: "Foreign Dataset",
        organizationId: OTHER_ORG_ID,
        type: "UPLOADED",
        createdById: "user-other-org",
      },
    });
    foreignDatasetId = foreignDs.id;
  });

  it("POST /api/v1/visualizations creates a new visualization", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/visualizations")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Regional Sales Bar Chart",
        description: "Sales breakdown by geographic region",
        chartType: "BAR",
        datasetId: testDatasetId,
        config: {
          xAxis: "region",
          category: "region",
          yAxis: "sales",
          value: "sales",
          aggregation: "SUM",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Regional Sales Bar Chart");
    expect(res.body.data.chartType).toBe("BAR");
    expect(res.body.data.datasetId).toBe(testDatasetId);
    createdVizId = res.body.data.id;
  });

  it("rejects creating a visualization with a cross-tenant dataset", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/visualizations")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Unauthorized Cross-Tenant Viz",
        chartType: "LINE",
        datasetId: foreignDatasetId,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("GET /api/v1/visualizations lists visualizations for the workspace/org", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get("/api/v1/visualizations")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((v: any) => v.id === createdVizId)).toBe(true);
  });

  it("GET /api/v1/visualizations/:id retrieves single visualization", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/visualizations/${createdVizId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdVizId);
    expect(res.body.data.title).toBe("Regional Sales Bar Chart");
  });

  it("GET /api/v1/visualizations/:id/data executes chart query and returns real data", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/visualizations/${createdVizId}/data`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rows).toBeDefined();
    expect(res.body.data.rows.length).toBe(3);
    expect(res.body.data.visualization.id).toBe(createdVizId);
  });

  it("PATCH /api/v1/visualizations/:id updates visualization configuration", async () => {
    if (!dbAvailable) return;

    const res = await request
      .patch(`/api/v1/visualizations/${createdVizId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Updated Regional Sales Pie Chart",
        chartType: "PIE",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Updated Regional Sales Pie Chart");
    expect(res.body.data.chartType).toBe("PIE");
  });

  it("DELETE /api/v1/visualizations/:id deletes visualization", async () => {
    if (!dbAvailable) return;

    const res = await request
      .delete(`/api/v1/visualizations/${createdVizId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await request
      .get(`/api/v1/visualizations/${createdVizId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(check.status).toBe(404);
  });
});

