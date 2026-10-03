// ========================================
// Dashboard Report Schedule & Snapshot Tests
// ========================================
// Tests Dashboard Report Scheduling, Daily/Weekly frequency,
// Enable/Disable toggles, Deletion, RBAC/Tenant Isolation,
// and On-Demand Server-Side Report Snapshot Generation.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;
let testOrgId = "";
let testWorkspaceId = "";
let testUserId = "";
let testDashboardId = "";
let testDatasetId = "";
let testChartId = "";

const ORG_ID = "org-test-admin-1";
const USER_ID = "user-admin-1";

const OWNER_TOKEN = signAccessToken({
  sub: USER_ID,
  email: "admin@ricozviz.test",
  organizationId: ORG_ID,
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "DASHBOARD_CREATE",
    "DASHBOARD_VIEW",
    "DASHBOARD_EDIT",
    "DASHBOARD_DELETE",
    "DATASET_CREATE",
    "DATASET_VIEW",
  ],
});

const OTHER_TENANT_TOKEN = signAccessToken({
  sub: "user-other-org",
  email: "other@other-org.test",
  organizationId: "org-other-tenant-99",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: ["DASHBOARD_VIEW", "DASHBOARD_EDIT"],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
    testOrgId = ORG_ID;
    testUserId = USER_ID;

    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Report Schedule Test Workspace",
        slug: `schedule-ws-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testWorkspaceId = workspace.id;

    // Create test dataset
    const dataset = await prisma.dataset.create({
      data: {
        name: "Schedule Test Dataset",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 3,
        columns: {
          create: [
            { name: "category", dataType: "STRING", ordinalPosition: 1 },
            { name: "revenue", dataType: "NUMBER", ordinalPosition: 2 },
          ],
        },
        schemaMeta: {
          sampleData: [
            { category: "Hardware", revenue: 5000 },
            { category: "Software", revenue: 8500 },
            { category: "Services", revenue: 3200 },
          ],
        },
      },
    });
    testDatasetId = dataset.id;

    // Create test dashboard
    const dashboard = await prisma.dashboard.create({
      data: {
        name: "Scheduled Report Test Dashboard",
        description: "Testing automated report schedule & snapshot",
        organizationId: testOrgId,
        ownerId: testUserId,
        status: "PUBLISHED",
        visibility: "ORGANIZATION",
      },
    });
    testDashboardId = dashboard.id;

    // Create test chart
    const chart = await prisma.chart.create({
      data: {
        title: "Revenue by Category",
        dashboardId: testDashboardId,
        datasetId: testDatasetId,
        chartType: "BAR",
        config: {
          dimensions: ["category"],
          measures: [{ column: "revenue", aggregation: "SUM", alias: "revenue" }],
        },
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
    });
    testChartId = chart.id;
  } catch (err) {
    console.warn("⚠️  Database setup failed or unavailable — schedule tests will be skipped:", err);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      if (testDashboardId) {
        await prisma.report.deleteMany({ where: { dashboardId: testDashboardId } });
        await prisma.chart.deleteMany({ where: { dashboardId: testDashboardId } });
        await prisma.dashboard.delete({ where: { id: testDashboardId } });
      }
      if (testDatasetId) await prisma.dataset.delete({ where: { id: testDatasetId } });
      if (testWorkspaceId) await prisma.workspace.delete({ where: { id: testWorkspaceId } });
    } catch {
      // Ignore cleanup error
    }
  }
});

describe("Dashboard Report Schedule API", () => {
  it("GET /api/v1/dashboards/:id/schedule returns null when not scheduled", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it("POST /api/v1/dashboards/:id/schedule creates a DAILY schedule", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        frequency: "DAILY",
        enabled: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      dashboardId: testDashboardId,
      frequency: "DAILY",
      enabled: true,
    });
    expect(res.body.data.nextRunAt).toBeDefined();
    expect(typeof res.body.data.id).toBe("string");
  });

  it("GET /api/v1/dashboards/:id/schedule retrieves the active schedule", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.frequency).toBe("DAILY");
    expect(res.body.data.enabled).toBe(true);
  });

  it("POST /api/v1/dashboards/:id/schedule updates schedule to WEEKLY and disabled", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        frequency: "WEEKLY",
        enabled: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      dashboardId: testDashboardId,
      frequency: "WEEKLY",
      enabled: false,
    });
  });

  it("POST /api/v1/dashboards/:id/schedule rejects invalid frequency", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        frequency: "HOURLY_INVALID",
        enabled: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/v1/dashboards/:id/reports/generate produces structured dashboard snapshot", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardId}/reports/generate`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const report = res.body.data;
    expect(report.dashboardId).toBe(testDashboardId);
    expect(report.dashboardName).toBe("Scheduled Report Test Dashboard");
    expect(report.chartCount).toBe(1);
    expect(Array.isArray(report.charts)).toBe(true);
    expect(report.charts[0].title).toBe("Revenue by Category");
    expect(report.charts[0].rowCount).toBe(3);
    expect(report.summary).toBeDefined();
    expect(report.summary.totalRecords).toBe(3);
    expect(report.summary.totalCharts).toBe(1);
    expect(typeof report.summary.executionTimeMs).toBe("number");
  });

  it("enforces tenant isolation and rejects cross-organization schedule access", async () => {
    if (!dbAvailable) return;

    // Cross-tenant GET schedule
    const getRes = await request
      .get(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`);
    expect(getRes.status).toBe(403);

    // Cross-tenant POST schedule
    const postRes = await request
      .post(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`)
      .send({ frequency: "DAILY", enabled: true });
    expect(postRes.status).toBe(403);

    // Cross-tenant report generation
    const genRes = await request
      .post(`/api/v1/dashboards/${testDashboardId}/reports/generate`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`);
    expect(genRes.status).toBe(403);

    // Cross-tenant DELETE schedule
    const delRes = await request
      .delete(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`);
    expect(delRes.status).toBe(403);
  });

  it("DELETE /api/v1/dashboards/:id/schedule removes the report schedule", async () => {
    if (!dbAvailable) return;

    const delRes = await request
      .delete(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verify GET now returns null
    const getRes = await request
      .get(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toBeNull();
  });
});
