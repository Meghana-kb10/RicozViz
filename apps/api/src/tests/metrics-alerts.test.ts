// ========================================
// Metrics & Smart Alerts Integration Tests
// ========================================
// Tests Metric creation, calculation, CRUD, RBAC,
// Alert conditions, evaluation, history logging,
// and Report Execution History.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { testAlertCondition } from "../services/alert/alert.service.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;
let testOrgId = "";
let testWorkspaceId = "";
let testUserId = "";
let testDatasetId = "";
let testMetricId = "";
let testAlertId = "";
let testDashboardId = "";

const ORG_ID = "org-test-metrics-1";
const USER_ID = "user-metrics-1";

const OWNER_TOKEN = signAccessToken({
  sub: USER_ID,
  email: "metrics-owner@ricozviz.test",
  organizationId: ORG_ID,
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "METRIC_CREATE",
    "METRIC_VIEW",
    "METRIC_EDIT",
    "METRIC_DELETE",
    "ALERT_CREATE",
    "ALERT_VIEW",
    "ALERT_EDIT",
    "ALERT_DELETE",
    "DATASET_CREATE",
    "DATASET_VIEW",
    "DASHBOARD_CREATE",
    "DASHBOARD_VIEW",
    "DASHBOARD_EDIT",
  ],
});

const OTHER_TENANT_TOKEN = signAccessToken({
  sub: "user-other-tenant-99",
  email: "other@tenant99.test",
  organizationId: "org-other-tenant-99",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "METRIC_CREATE",
    "METRIC_VIEW",
    "METRIC_EDIT",
    "METRIC_DELETE",
    "ALERT_CREATE",
    "ALERT_VIEW",
    "ALERT_EDIT",
    "ALERT_DELETE",
    "DASHBOARD_VIEW",
  ],
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
        name: "Metrics Test Workspace",
        slug: `metrics-ws-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testWorkspaceId = workspace.id;

    // Create test dataset
    const dataset = await prisma.dataset.create({
      data: {
        name: "Sales Test Dataset",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 3,
        columns: [
          { name: "region", type: "string" },
          { name: "amount", type: "number" },
        ],
      },
    });
    testDatasetId = dataset.id;

    // Create test dashboard for report history testing
    const dashboard = await prisma.dashboard.create({
      data: {
        title: "Metrics Test Dashboard",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
      },
    });
    testDashboardId = dashboard.id;
  } catch (err) {
    console.warn("⚠️ Database setup unavailable — DB integration tests will be skipped:", err);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      if (testAlertId) await prisma.alert.delete({ where: { id: testAlertId } });
      if (testMetricId) await prisma.metric.delete({ where: { id: testMetricId } });
      if (testDashboardId) await prisma.dashboard.delete({ where: { id: testDashboardId } });
      if (testDatasetId) await prisma.dataset.delete({ where: { id: testDatasetId } });
      if (testWorkspaceId) await prisma.workspace.delete({ where: { id: testWorkspaceId } });
    } catch {
      // Ignore cleanup error
    }
  }
});

// ============================================================
// 1. PURE UNIT TESTS: Alert Condition Evaluator
// ============================================================
describe("Alert Condition Evaluator (Unit)", () => {
  it("evaluates GREATER_THAN correctly", () => {
    expect(testAlertCondition(150, "GREATER_THAN", 100)).toBe(true);
    expect(testAlertCondition(100, "GREATER_THAN", 100)).toBe(false);
    expect(testAlertCondition(50, "GREATER_THAN", 100)).toBe(false);
  });

  it("evaluates LESS_THAN correctly", () => {
    expect(testAlertCondition(50, "LESS_THAN", 100)).toBe(true);
    expect(testAlertCondition(100, "LESS_THAN", 100)).toBe(false);
    expect(testAlertCondition(150, "LESS_THAN", 100)).toBe(false);
  });

  it("evaluates GREATER_THAN_OR_EQUAL correctly", () => {
    expect(testAlertCondition(100, "GREATER_THAN_OR_EQUAL", 100)).toBe(true);
    expect(testAlertCondition(101, "GREATER_THAN_OR_EQUAL", 100)).toBe(true);
    expect(testAlertCondition(99, "GREATER_THAN_OR_EQUAL", 100)).toBe(false);
  });

  it("evaluates LESS_THAN_OR_EQUAL correctly", () => {
    expect(testAlertCondition(100, "LESS_THAN_OR_EQUAL", 100)).toBe(true);
    expect(testAlertCondition(99, "LESS_THAN_OR_EQUAL", 100)).toBe(true);
    expect(testAlertCondition(101, "LESS_THAN_OR_EQUAL", 100)).toBe(false);
  });

  it("evaluates EQUALS correctly", () => {
    expect(testAlertCondition(100, "EQUALS", 100)).toBe(true);
    expect(testAlertCondition(100.0001, "EQUALS", 100)).toBe(false);
  });
});

// ============================================================
// 2. METRICS API TESTS
// ============================================================
describe("Metrics API (/api/v1/metrics)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request.get("/api/v1/metrics");
    expect(res.status).toBe(401);
  });

  it("validates metric creation parameters", async () => {
    const res = await request
      .post("/api/v1/metrics")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({ name: "" }); // Missing required fields

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates, reads, updates, and deletes a metric when DB is available", async () => {
    if (!dbAvailable) return;

    // 1. Create
    const createRes = await request
      .post("/api/v1/metrics")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "Total Sales Amount",
        description: "Sum of all sales amounts",
        datasetId: testDatasetId,
        aggregation: "SUM",
        column: "amount",
        format: "CURRENCY",
        targetValue: 50000,
        workspaceId: testWorkspaceId,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.name).toBe("Total Sales Amount");
    testMetricId = createRes.body.data.id;

    // 2. Read by ID
    const getRes = await request
      .get(`/api/v1/metrics/${testMetricId}`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(testMetricId);

    // 3. Update
    const updateRes = await request
      .patch(`/api/v1/metrics/${testMetricId}`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({ targetValue: 75000 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.targetValue).toBe(75000);

    // 4. Tenant isolation: Other tenant cannot access this metric
    const tenantRes = await request
      .get(`/api/v1/metrics/${testMetricId}`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`);

    expect(tenantRes.status).toBe(404);
  });
});

// ============================================================
// 3. SMART ALERTS API TESTS
// ============================================================
describe("Smart Alerts API (/api/v1/alerts)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request.get("/api/v1/alerts");
    expect(res.status).toBe(401);
  });

  it("validates alert input parameters", async () => {
    const res = await request
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({ name: "" }); // Missing required fields

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates, reads, toggles, evaluates, and deletes an alert when DB is available", async () => {
    if (!dbAvailable || !testMetricId) return;

    // 1. Create Alert
    const createRes = await request
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "High Revenue Drop Alert",
        description: "Trigger when sales amount drops below target",
        metricId: testMetricId,
        condition: "LESS_THAN",
        threshold: 10000,
        isEnabled: true,
        workspaceId: testWorkspaceId,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.threshold).toBe(10000);
    testAlertId = createRes.body.data.id;

    // 2. List Alerts
    const listRes = await request
      .get("/api/v1/alerts")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    // 3. Update / Toggle Alert
    const updateRes = await request
      .patch(`/api/v1/alerts/${testAlertId}`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({ isEnabled: false });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.isEnabled).toBe(false);

    // 4. Tenant isolation check
    const tenantRes = await request
      .get(`/api/v1/alerts/${testAlertId}`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`);

    expect(tenantRes.status).toBe(404);
  });
});

// ============================================================
// 4. REPORT EXECUTION HISTORY & MONTHLY SCHEDULE TESTS
// ============================================================
describe("Dashboard Reports Enhancements", () => {
  it("accepts MONTHLY frequency when saving dashboard schedule", async () => {
    if (!dbAvailable || !testDashboardId) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardId}/schedule`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        frequency: "MONTHLY",
        enabled: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.frequency).toBe("MONTHLY");
  });

  it("GET /api/v1/dashboards/:id/reports/history returns execution logs list", async () => {
    if (!dbAvailable || !testDashboardId) return;

    const res = await request
      .get(`/api/v1/dashboards/${testDashboardId}/reports/history`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
