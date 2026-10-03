// ============================================================
// Dashboard Scheduled Report Worker & Delivery Flow Tests
// ============================================================
// Verifies:
// 1. Dashboard creation
// 2. Schedule creation with delivery config (email & webhook)
// 3. Due schedule pickup by background worker
// 4. Report generation via query engine
// 5. Delivery dispatcher invocation
// 6. lastRunAt updated
// 7. nextRunAt recalculated
// 8. Duplicate concurrent execution prevention
// 9. Graceful failure handling
// 10. Multi-tenant and workspace boundary isolation
// 11. Delivery input validation (SSRF / invalid email)
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { scheduledReportWorker } from "../services/report/report-worker.service.js";
import { validateWebhookUrl, isValidEmail } from "../services/report/report-delivery.dispatcher.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;
let testOrgA = "";
let testOrgB = "";
let testUserA = "";
let testUserB = "";
let testDashboardA = "";
let testDashboardB = "";
let testDatasetA = "";

const TOKEN_A = signAccessToken({
  sub: "user-worker-test-a",
  email: "admin-a@worker-test.ricozviz.test",
  organizationId: "org-worker-test-a",
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

const TOKEN_B = signAccessToken({
  sub: "user-worker-test-b",
  email: "admin-b@worker-test.ricozviz.test",
  organizationId: "org-worker-test-b",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: ["DASHBOARD_VIEW", "DASHBOARD_EDIT"],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;

    testOrgA = "org-worker-test-a";
    testOrgB = "org-worker-test-b";
    testUserA = "user-worker-test-a";
    testUserB = "user-worker-test-b";

    await prisma.organization.upsert({
      where: { id: testOrgA },
      update: {},
      create: { id: testOrgA, name: "Org Worker Test A", slug: `org-worker-a-${Date.now()}` },
    });
    await prisma.user.upsert({
      where: { id: testUserA },
      update: {},
      create: { id: testUserA, email: "admin-a@worker-test.ricozviz.test", name: "Admin A", passwordHash: "dummy" },
    });
    await prisma.organization.upsert({
      where: { id: testOrgB },
      update: {},
      create: { id: testOrgB, name: "Org Worker Test B", slug: `org-worker-b-${Date.now()}` },
    });
    await prisma.user.upsert({
      where: { id: testUserB },
      update: {},
      create: { id: testUserB, email: "admin-b@worker-test.ricozviz.test", name: "Admin B", passwordHash: "dummy" },
    });

    // Setup Workspace & Dataset for Org A
    const wsA = await prisma.workspace.create({
      data: {
        name: "Worker Test WS A",
        slug: `worker-ws-a-${Date.now()}`,
        organizationId: testOrgA,
      },
    });

    const datasetA = await prisma.dataset.create({
      data: {
        name: "Quarterly Revenue Data",
        organizationId: testOrgA,
        workspaceId: wsA.id,
        createdById: testUserA,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 3,
        columns: {
          create: [
            { name: "quarter", dataType: "STRING", ordinalPosition: 1 },
            { name: "revenue", dataType: "NUMBER", ordinalPosition: 2 },
          ],
        },
        schemaMeta: {
          sampleData: [
            { quarter: "Q1", revenue: 12000 },
            { quarter: "Q2", revenue: 15000 },
            { quarter: "Q3", revenue: 18000 },
          ],
        },
      },
    });
    testDatasetA = datasetA.id;

    // Setup Dashboard A
    const dashA = await prisma.dashboard.create({
      data: {
        name: "Worker Test Dashboard A",
        organizationId: testOrgA,
        ownerId: testUserA,
        status: "PUBLISHED",
        visibility: "ORGANIZATION",
      },
    });
    testDashboardA = dashA.id;

    // Setup Chart on Dashboard A
    await prisma.chart.create({
      data: {
        dashboardId: testDashboardA,
        datasetId: testDatasetA,
        title: "Quarterly Revenue Chart",
        chartType: "BAR",
        config: {
          xAxis: "quarter",
          yAxis: "revenue",
          aggregation: "SUM",
        },
      },
    });

    // Setup Dashboard B in Org B
    const dashB = await prisma.dashboard.create({
      data: {
        name: "Worker Test Dashboard B",
        organizationId: testOrgB,
        ownerId: testUserB,
        status: "PUBLISHED",
        visibility: "ORGANIZATION",
      },
    });
    testDashboardB = dashB.id;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    await prisma.report.deleteMany({
      where: { organizationId: { in: [testOrgA, testOrgB] } },
    });
    await prisma.chart.deleteMany({
      where: { dashboardId: { in: [testDashboardA, testDashboardB] } },
    });
    await prisma.dashboard.deleteMany({
      where: { id: { in: [testDashboardA, testDashboardB] } },
    });
    await prisma.datasetColumn.deleteMany({
      where: { datasetId: testDatasetA },
    });
    await prisma.dataset.deleteMany({
      where: { id: testDatasetA },
    });
    await prisma.workspace.deleteMany({
      where: { organizationId: { in: [testOrgA, testOrgB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserA, testUserB] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [testOrgA, testOrgB] } },
    });
  } catch {
    // Ignore cleanup errors
  }
});

describe("Phase 1 & 2: Report Worker & Delivery Dispatcher", () => {
  it("validates email addresses properly", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("admin.corp@sub.domain.co.uk")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@missing-username.com")).toBe(false);
    expect(isValidEmail("missing-domain@")).toBe(false);
  });

  it("validates webhook URLs and rejects malformed protocols", () => {
    expect(validateWebhookUrl("https://webhook.site/abc-123").valid).toBe(true);
    expect(validateWebhookUrl("http://example.com/api/reports").valid).toBe(true);
    expect(validateWebhookUrl("ftp://evil.com/webhook").valid).toBe(false);
    expect(validateWebhookUrl("not-a-valid-url").valid).toBe(false);
    expect(validateWebhookUrl("").valid).toBe(false);
  });

  it("rejects invalid schedule inputs via HTTP endpoint", async () => {
    if (!dbAvailable) return;

    // Invalid frequency
    const res1 = await request
      .post(`/api/v1/dashboards/${testDashboardA}/schedule`)
      .set("Authorization", `Bearer ${TOKEN_A}`)
      .send({ frequency: "HOURLY" });
    expect(res1.status).toBe(400);

    // Invalid recipient email
    const res2 = await request
      .post(`/api/v1/dashboards/${testDashboardA}/schedule`)
      .set("Authorization", `Bearer ${TOKEN_A}`)
      .send({
        frequency: "DAILY",
        recipients: ["valid@acme.com", "not-an-email"],
      });
    expect(res2.status).toBe(400);
    expect(res2.body.error?.message).toContain("Invalid recipient email");

    // Invalid webhook URL
    const res3 = await request
      .post(`/api/v1/dashboards/${testDashboardA}/schedule`)
      .set("Authorization", `Bearer ${TOKEN_A}`)
      .send({
        frequency: "DAILY",
        webhookUrl: "javascript:alert(1)",
      });
    expect(res3.status).toBe(400);
  });

  it("enforces tenant isolation: Tenant B cannot schedule report on Tenant A dashboard", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardA}/schedule`)
      .set("Authorization", `Bearer ${TOKEN_B}`)
      .send({ frequency: "DAILY" });

    expect(res.status).toBe(403);
    expect(res.body.error?.message).toContain("Access denied");
  });

  it("creates a schedule with email recipients and webhook URL", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/dashboards/${testDashboardA}/schedule`)
      .set("Authorization", `Bearer ${TOKEN_A}`)
      .send({
        frequency: "DAILY",
        enabled: true,
        recipients: ["stakeholder@acme.com", "cfo@acme.com"],
        webhookUrl: "https://httpbin.org/post",
        deliveryType: "BOTH",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.frequency).toBe("DAILY");
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.recipients).toEqual(["stakeholder@acme.com", "cfo@acme.com"]);
    expect(res.body.data.webhookUrl).toBe("https://httpbin.org/post");
    expect(res.body.data.deliveryType).toBe("BOTH");
    expect(res.body.data.nextRunAt).toBeTruthy();
  });

  it("retrieves schedule with full delivery metadata", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/dashboards/${testDashboardA}/schedule`)
      .set("Authorization", `Bearer ${TOKEN_A}`);

    expect(res.status).toBe(200);
    expect(res.body.data.frequency).toBe("DAILY");
    expect(res.body.data.recipients).toContain("stakeholder@acme.com");
    expect(res.body.data.webhookUrl).toBe("https://httpbin.org/post");
  });

  it("background worker executes due report, generates snapshot, dispatches delivery, and updates timestamps", async () => {
    if (!dbAvailable) return;

    // Simulate schedule becoming due by setting nextRunAt to 5 minutes in the past
    const pastDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const existing = await prisma.report.findFirst({
      where: { dashboardId: testDashboardA, organizationId: testOrgA },
    });
    expect(existing).toBeTruthy();

    await prisma.report.update({
      where: { id: existing!.id },
      data: {
        deliveryConfig: {
          ...(existing!.deliveryConfig as any),
          nextRunAt: pastDate,
        },
      },
    });

    // Run the worker cycle
    const pollResult = await scheduledReportWorker.executeDueReports();

    expect(pollResult.processed).toBeGreaterThanOrEqual(1);
    expect(pollResult.succeeded).toBeGreaterThanOrEqual(1);

    const reportRun = pollResult.runs.find((r) => r.reportId === existing!.id);
    expect(reportRun).toBeTruthy();
    expect(reportRun?.status).toBe("SUCCESS");
    expect(reportRun?.deliveryStatus).toBe("SUCCESS");

    // Verify DB was updated with new lastRunAt, nextRunAt, and delivery status
    const updated = await prisma.report.findUnique({
      where: { id: existing!.id },
    });
    const updatedDelivery = updated?.deliveryConfig as any;

    expect(updatedDelivery.lastRunAt).toBeTruthy();
    expect(new Date(updatedDelivery.lastRunAt).getTime()).toBeGreaterThan(new Date(pastDate).getTime());
    expect(updatedDelivery.nextRunAt).toBeTruthy();
    expect(new Date(updatedDelivery.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    expect(updatedDelivery.lastDeliveryStatus).toBe("SUCCESS");
    expect(updatedDelivery.lastDeliveryAt).toBeTruthy();
  });

  it("prevents duplicate execution of an already running report", async () => {
    if (!dbAvailable) return;

    const existing = await prisma.report.findFirst({
      where: { dashboardId: testDashboardA, organizationId: testOrgA },
    });
    expect(existing).toBeTruthy();

    // Manually mark job as active
    (scheduledReportWorker as any).activeJobIds.add(existing!.id);

    try {
      expect(scheduledReportWorker.isJobRunning(existing!.id)).toBe(true);

      // Trigger run while job is marked active
      const runSummary = await scheduledReportWorker.executeDueReports(
        new Date(Date.now() + 100 * 24 * 60 * 60 * 1000) // far future so it qualifies
      );

      const skippedRun = runSummary.runs.find((r) => r.reportId === existing!.id);
      expect(skippedRun?.status).toBe("SKIPPED");
      expect(skippedRun?.error).toContain("already executing");
    } finally {
      (scheduledReportWorker as any).activeJobIds.delete(existing!.id);
      expect(scheduledReportWorker.isJobRunning(existing!.id)).toBe(false);
    }
  });

  it("handles delivery and report failures gracefully without crashing worker", async () => {
    if (!dbAvailable) return;

    // Create a dashboard in Org B
    const badDash = await prisma.dashboard.create({
      data: {
        name: "Org B Target Dashboard",
        organizationId: testOrgB,
        ownerId: testUserB,
      },
    });

    // Create a report in Org A referencing Org B's dashboard (cross-tenant violation)
    const badReport = await prisma.report.create({
      data: {
        dashboardId: badDash.id,
        organizationId: testOrgA,
        createdById: testUserA,
        name: "Cross-Tenant Broken Scheduled Report",
        status: "ACTIVE",
        deliveryConfig: {
          frequency: "DAILY",
          enabled: true,
          nextRunAt: new Date(Date.now() - 1000).toISOString(),
        },
      },
    });

    try {
      const summary = await scheduledReportWorker.executeDueReports();
      const failedRun = summary.runs.find((r) => r.reportId === badReport.id);

      expect(failedRun).toBeTruthy();
      expect(failedRun?.status).toBe("FAILED");
      expect(failedRun?.error).toContain("Access denied");

      // Verify DB recorded the failure status
      const updatedBad = await prisma.report.findUnique({
        where: { id: badReport.id },
      });
      const delivery = updatedBad?.deliveryConfig as any;
      expect(delivery.lastDeliveryStatus).toBe("FAILED");
      expect(delivery.lastDeliveryError).toContain("Access denied");
      // nextRunAt was still calculated forward so it doesn't spin in a loop
      expect(new Date(delivery.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    } finally {
      await prisma.report.delete({ where: { id: badReport.id } }).catch(() => null);
      await prisma.dashboard.delete({ where: { id: badDash.id } }).catch(() => null);
    }
  });
});
