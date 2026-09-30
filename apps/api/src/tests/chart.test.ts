// ========================================
// Chart Configuration Backend Tests
// ========================================
// Tests Chart CRUD, Validation, Multi-Tenancy,
// Dataset Linkage, RBAC, Security & Audit Logging.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  ALLOWED_CHART_TYPES,
  chartConfigSchema,
  chartPositionSchema,
  createChartSchema,
  updateChartSchema,
  buildSafeChart,
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

const ANALYST_TOKEN = signAccessToken({
  sub: "user-analyst-1",
  email: "analyst@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-analyst",
  roleName: "ANALYST",
  permissions: [
    "DASHBOARD_VIEW",
    "DASHBOARD_EDIT",
    "CHART_CREATE",
    "CHART_VIEW",
    "CHART_EDIT",
  ],
});

const BUSINESS_USER_TOKEN = signAccessToken({
  sub: "user-business-1",
  email: "business@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-business",
  roleName: "BUSINESS_USER",
  permissions: ["DASHBOARD_VIEW", "CHART_VIEW"],
});

const NO_PERMS_TOKEN = signAccessToken({
  sub: "user-no-perms",
  email: "noperms@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-none",
  roleName: "GUEST",
  permissions: [],
});

const OTHER_ORG_TOKEN = signAccessToken({
  sub: "user-other-org",
  email: "other@other-org.test",
  organizationId: OTHER_ORG_ID,
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

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("⚠️  Database not available — DB-dependent chart tests will be skipped.");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      await prisma.chart.deleteMany({
        where: { title: { startsWith: "Test Chart" } },
      });
      await prisma.dashboard.deleteMany({
        where: { name: { startsWith: "Test Dashboard" } },
      });
    } catch {
      // ignore cleanup errors
    }
  }
  await prisma.$disconnect();
});

// ============================================================
// 1. ZOD VALIDATION & SERIALIZATION (Unit Tests — No DB required)
// ============================================================

describe("Chart Zod Validation & Schema Security", () => {
  it("supports all required chart types", () => {
    const requiredTypes = [
      "BAR",
      "LINE",
      "AREA",
      "PIE",
      "DONUT",
      "SCATTER",
      "TABLE",
      "KPI",
    ];

    for (const t of requiredTypes) {
      expect(ALLOWED_CHART_TYPES).toContain(t);
    }
  });

  it("validates valid chart creation payload with configuration", () => {
    const valid = createChartSchema.parse({
      title: "Quarterly Revenue by Region",
      description: "Regional sales breakdown",
      chartType: "BAR",
      config: {
        dimensions: ["region", "country"],
        measures: [
          { column: "revenue", aggregation: "SUM", alias: "total_revenue" },
        ],
        xAxis: "region",
        yAxis: "revenue",
        filters: [{ column: "revenue", operator: ">", value: 1000 }],
        sort: { column: "revenue", direction: "desc" },
      },
      position: { x: 0, y: 0, w: 12, h: 6 },
    });

    expect(valid.title).toBe("Quarterly Revenue by Region");
    expect(valid.chartType).toBe("BAR");
    expect(valid.config?.dimensions).toEqual(["region", "country"]);
    expect(valid.config?.measures?.[0]?.aggregation).toBe("SUM");
    expect(valid.position?.w).toBe(12);
  });

  it("normalizes lowercase chart type to uppercase", () => {
    const parsed = createChartSchema.parse({
      title: "Active Users Trend",
      chartType: "line",
    });

    expect(parsed.chartType).toBe("LINE");
  });

  it("rejects unsupported chart types", () => {
    expect(() =>
      createChartSchema.parse({
        title: "Invalid Chart",
        chartType: "3D_HOLOGRAM",
      })
    ).toThrow(/Invalid chart type/);
  });

  it("rejects empty or whitespace-only chart title", () => {
    expect(() =>
      createChartSchema.parse({
        title: "   ",
        chartType: "BAR",
      })
    ).toThrow(/Title is required/);
  });

  it("rejects chart title exceeding 100 characters", () => {
    expect(() =>
      createChartSchema.parse({
        title: "x".repeat(101),
        chartType: "BAR",
      })
    ).toThrow();
  });

  it("rejects chart description exceeding 500 characters", () => {
    expect(() =>
      createChartSchema.parse({
        title: "Valid Title",
        description: "y".repeat(501),
        chartType: "LINE",
      })
    ).toThrow();
  });

  it("rejects invalid aggregation types", () => {
    expect(() =>
      chartConfigSchema.parse({
        measures: [
          { column: "amount", aggregation: "MALICIOUS_AGG" as any },
        ],
      })
    ).toThrow();
  });

  it("rejects invalid filter operators", () => {
    expect(() =>
      chartConfigSchema.parse({
        filters: [
          { column: "status", operator: "EXECUTE_SQL" as any, value: "x" },
        ],
      })
    ).toThrow();
  });

  it("rejects malformed position layout bounds", () => {
    // Negative x coordinate
    expect(() =>
      chartPositionSchema.parse({ x: -1, y: 0, w: 6, h: 4 })
    ).toThrow();

    // Zero width
    expect(() =>
      chartPositionSchema.parse({ x: 0, y: 0, w: 0, h: 4 })
    ).toThrow();

    // Width exceeding 24 grid columns
    expect(() =>
      chartPositionSchema.parse({ x: 0, y: 0, w: 25, h: 4 })
    ).toThrow();
  });

  it("validates chart update schema with partial payload", () => {
    const valid = updateChartSchema.parse({
      title: "Updated Title",
      chartType: "kpi",
    });

    expect(valid.title).toBe("Updated Title");
    expect(valid.chartType).toBe("KPI");
  });

  it("rejects malformed dataset UUID", () => {
    expect(() =>
      createChartSchema.parse({
        title: "Chart With Malformed Dataset",
        chartType: "BAR",
        datasetId: "not-a-uuid",
      })
    ).toThrow(/Invalid Dataset ID/);
  });

  it("builds safe chart response without leaking secrets or credentials", () => {
    const mockChart: any = {
      id: "chart-uuid-1",
      dashboardId: "dash-uuid-1",
      datasetId: "dataset-uuid-1",
      title: "Revenue by Department",
      description: "Summary chart",
      chartType: "BAR",
      config: { dimensions: ["dept"], measures: [{ column: "sales", aggregation: "SUM" }] },
      position: { x: 0, y: 0, w: 6, h: 4 },
      sortOrder: 1,
      createdAt: new Date("2026-03-30T10:00:00Z"),
      updatedAt: new Date("2026-03-30T12:00:00Z"),
      dataset: {
        id: "dataset-uuid-1",
        name: "Sales Dataset",
        type: "POSTGRESQL",
        connectionString: "postgres://user:secretpassword@localhost:5432/db",
      },
    };

    const safe = buildSafeChart(mockChart);

    expect(safe.id).toBe("chart-uuid-1");
    expect(safe.title).toBe("Revenue by Department");
    expect(safe.datasetName).toBe("Sales Dataset");
    expect(safe.datasetType).toBe("POSTGRESQL");
    expect((safe as any).connectionString).toBeUndefined();
    expect((safe as any).password).toBeUndefined();
  });
});

// ============================================================
// 2. RBAC & HTTP GUARDS (No DB required)
// ============================================================

describe("Chart RBAC & HTTP Guards", () => {
  const dummyDashId = "d0000000-0000-0000-0000-000000000001";
  const dummyChartId = "c0000000-0000-0000-0000-000000000001";

  it("rejects unauthenticated requests to chart endpoints with 401", async () => {
    const res = await request.get(`/api/v1/dashboards/${dummyDashId}/charts`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects users without chart view permission with 403", async () => {
    const res = await request
      .get(`/api/v1/dashboards/${dummyDashId}/charts`)
      .set("Authorization", `Bearer ${NO_PERMS_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects BUSINESS_USER from creating charts with 403", async () => {
    const res = await request
      .post(`/api/v1/dashboards/${dummyDashId}/charts`)
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`)
      .send({
        title: "Unauthorized Chart",
        chartType: "BAR",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects BUSINESS_USER from editing charts with 403", async () => {
    const res = await request
      .patch(`/api/v1/dashboards/${dummyDashId}/charts/${dummyChartId}`)
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`)
      .send({
        title: "Tampered Chart",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects BUSINESS_USER from deleting charts with 403", async () => {
    const res = await request
      .delete(`/api/v1/dashboards/${dummyDashId}/charts/${dummyChartId}`)
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects ANALYST from deleting charts when missing CHART_DELETE permission", async () => {
    // ANALYST only has CHART_CREATE, CHART_VIEW, CHART_EDIT (no delete)
    const res = await request
      .delete(`/api/v1/dashboards/${dummyDashId}/charts/${dummyChartId}`)
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

// ============================================================
// 3. DATABASE INTEGRATION & TENANT ISOLATION (Skipped gracefully if no DB)
// ============================================================

describe("Chart Service DB Lifecycle & Multi-Tenancy", () => {
  let orgADashId: string;
  let orgBDashId: string;
  let orgADatasetId: string;
  let orgBDatasetId: string;
  let createdChartId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;

    // Seed test organizations & dashboards if DB is online
    const dashA = await prisma.dashboard.create({
      data: {
        name: "Test Dashboard Org A",
        organizationId: ADMIN_ORG_ID,
        ownerId: "user-admin-1",
      },
    });
    orgADashId = dashA.id;

    const dashB = await prisma.dashboard.create({
      data: {
        name: "Test Dashboard Org B",
        organizationId: OTHER_ORG_ID,
        ownerId: "user-other-org",
      },
    });
    orgBDashId = dashB.id;

    const datasetA = await prisma.dataset.create({
      data: {
        name: "Test Dataset Org A",
        organizationId: ADMIN_ORG_ID,
        type: "CUSTOM",
      },
    });
    orgADatasetId = datasetA.id;

    const datasetB = await prisma.dataset.create({
      data: {
        name: "Test Dataset Org B",
        organizationId: OTHER_ORG_ID,
        type: "CUSTOM",
      },
    });
    orgBDatasetId = datasetB.id;
  });

  it("creates a valid chart linked to a tenant dataset", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${orgADashId}/charts`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Test Chart Revenue",
        chartType: "BAR",
        datasetId: orgADatasetId,
        config: {
          dimensions: ["month"],
          measures: [{ column: "revenue", aggregation: "SUM" }],
        },
        position: { x: 0, y: 0, w: 8, h: 4 },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Test Chart Revenue");
    expect(res.body.data.datasetName).toBe("Test Dataset Org A");
    createdChartId = res.body.data.id;
  });

  it("rejects cross-tenant dataset linkage (Org A chart using Org B dataset)", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${orgADashId}/charts`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Test Chart Cross Tenant Dataset",
        chartType: "LINE",
        datasetId: orgBDatasetId, // Org B dataset
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/different organization/i);
  });

  it("rejects creating a chart on a foreign tenant dashboard", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${orgBDashId}/charts`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Test Chart On Foreign Dashboard",
        chartType: "BAR",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("lists all charts belonging to the dashboard", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/dashboards/${orgADashId}/charts`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("retrieves a chart by ID", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/dashboards/${orgADashId}/charts/${createdChartId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdChartId);
  });

  it("rejects IDOR: requesting chart via the wrong dashboard ID", async () => {
    if (!dbAvailable) return;

    // createdChartId belongs to orgADashId, requesting it under orgBDashId with Org B's token
    const res = await request
      .get(`/api/v1/dashboards/${orgBDashId}/charts/${createdChartId}`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("updates chart configuration and title", async () => {
    if (!dbAvailable) return;

    const res = await request
      .patch(`/api/v1/dashboards/${orgADashId}/charts/${createdChartId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        title: "Updated Revenue Chart",
        chartType: "LINE",
        config: {
          dimensions: ["quarter"],
          measures: [{ column: "profit", aggregation: "AVG" }],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Updated Revenue Chart");
    expect(res.body.data.chartType).toBe("LINE");
  });

  it("deletes a chart by ID", async () => {
    if (!dbAvailable) return;

    const res = await request
      .delete(`/api/v1/dashboards/${orgADashId}/charts/${createdChartId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is gone
    const getRes = await request
      .get(`/api/v1/dashboards/${orgADashId}/charts/${createdChartId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(getRes.status).toBe(404);
  });
});
