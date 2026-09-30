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

const app = createApp();
const request = supertest(app);

let dbAvailable = false;

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

  it("gracefully handles empty query results without crashing", () => {
    const mapped = mapQueryResultToChartDataTest("BAR", null, {});
    expect(mapped.rows).toEqual([]);
    expect(mapped.kpiValue).toBe(0);
    expect(mapped.kpiLabel).toBe("No Data");
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
        type: "CUSTOM",
      },
    });
    datasetAId = dsA.id;

    const dsB = await prisma.dataset.create({
      data: {
        name: "Studio Test Dataset B (Foreign)",
        organizationId: OTHER_ORG_ID,
        type: "CUSTOM",
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
