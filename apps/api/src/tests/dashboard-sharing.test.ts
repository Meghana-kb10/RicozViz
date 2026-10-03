// ========================================
// Dashboard Sharing & Public View Tests
// ========================================
// Tests Dashboard Share Link Creation, Token Security,
// Public Read-Only Access, Disabled Link Handling, and Chart Querying.
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
let testShareToken = "";

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
        name: "Sharing Test Workspace",
        slug: `sharing-ws-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testWorkspaceId = workspace.id;

    // Create test dataset
    const dataset = await prisma.dataset.create({
      data: {
        name: "Sharing Test Dataset",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 3,
        columns: {
          create: [
            { name: "region", dataType: "STRING", ordinalPosition: 1 },
            { name: "sales", dataType: "NUMBER", ordinalPosition: 2 },
          ],
        },
        schemaMeta: {
          sampleData: [
            { region: "North", sales: 100 },
            { region: "South", sales: 200 },
            { region: "East", sales: 150 },
          ],
        },
      },
    });
    testDatasetId = dataset.id;

    // Create test dashboard
    const dashboard = await prisma.dashboard.create({
      data: {
        name: "Public Sharing Demo Dashboard",
        description: "Testing public read-only dashboard sharing",
        organizationId: testOrgId,
        ownerId: testUserId,
        status: "PUBLISHED",
        visibility: "ORGANIZATION",
      },
    });
    testDashboardId = dashboard.id;

    // Create test chart on dashboard
    const chart = await prisma.chart.create({
      data: {
        title: "Sales by Region",
        dashboardId: testDashboardId,
        datasetId: testDatasetId,
        chartType: "BAR",
        config: {
          dimensions: ["region"],
          measures: [{ column: "sales", aggregation: "SUM", alias: "sales" }],
        },
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
    });
    testChartId = chart.id;
  } catch (err) {
    console.warn("⚠️  Database setup failed or unavailable — DB sharing tests will be skipped:", err);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      if (testChartId) await prisma.chart.deleteMany({ where: { dashboardId: testDashboardId } });
      if (testDashboardId) await prisma.dashboard.delete({ where: { id: testDashboardId } });
      if (testDatasetId) await prisma.dataset.delete({ where: { id: testDatasetId } });
      if (testWorkspaceId) await prisma.workspace.delete({ where: { id: testWorkspaceId } });
    } catch {
      // Ignore cleanup error
    }
  }
});

describe("Dashboard Sharing & Public View API", () => {
  it("should initially report share link as inactive", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/dashboards/${testDashboardId}/share`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.active).toBe(false);
    expect(res.body.data.shareUrl).toBeNull();
  });

  it("should create a secure share link for the dashboard owner", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardId}/share`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.token.length).toBeGreaterThanOrEqual(32);
    expect(res.body.data.shareUrl).toContain(`/dashboards/shared/${res.body.data.token}`);

    testShareToken = res.body.data.token;
  });

  it("should deny share link creation to a user from a different organization", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardId}/share`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it("should retrieve shared dashboard data publicly without credentials", async () => {
    if (!dbAvailable || !testShareToken) return;

    const res = await request.get(`/api/v1/dashboards/shared/${testShareToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Public Sharing Demo Dashboard");
    expect(res.body.data.charts).toHaveLength(1);
    expect(res.body.data.charts[0].id).toBe(testChartId);
    expect(res.body.data.charts[0].title).toBe("Sales by Region");
    // Ensure internal IDs or sensitive tenant fields are NOT exposed
    expect(res.body.data.organizationId).toBeUndefined();
    expect(res.body.data.createdById).toBeUndefined();
  });

  it("should execute chart query for public viewer through shared endpoint", async () => {
    if (!dbAvailable || !testShareToken) return;

    const res = await request
      .post(`/api/v1/dashboards/shared/${testShareToken}/charts/${testChartId}/data`)
      .send({
        filters: [{ field: "region", operator: "=", value: "North" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rows).toBeDefined();
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    // Should filter to North only
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].region).toBe("North");
  });

  it("should reject chart query for a chart not belonging to the shared dashboard", async () => {
    if (!dbAvailable || !testShareToken) return;

    const res = await request
      .post(`/api/v1/dashboards/shared/${testShareToken}/charts/unrelated-chart-id/data`)
      .send({});

    expect(res.status).toBe(404);
  });

  it("should disable share link when requested by owner", async () => {
    if (!dbAvailable) return;

    const res = await request
      .delete(`/api/v1/dashboards/${testDashboardId}/share`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.active).toBe(false);
  });

  it("should reject public access to a disabled share link", async () => {
    if (!dbAvailable || !testShareToken) return;

    const res = await request.get(`/api/v1/dashboards/shared/${testShareToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("should reject public access with an invalid or non-existent token", async () => {
    const res = await request.get(`/api/v1/dashboards/shared/completely-bogus-token-12345`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
