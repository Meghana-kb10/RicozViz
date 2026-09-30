// ========================================
// Dashboard Management Tests
// ========================================
// Tests Dashboard CRUD, Validation, Multi-Tenancy,
// RBAC Permission Enforcements, and Audit Logging.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  createDashboardSchema,
  updateDashboardSchema,
  listDashboardsQuerySchema,
  buildSafeDashboard,
} from "../services/dashboard/dashboard.service.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;

// Mock Tokens
const ADMIN_ORG_ID = "org-test-admin-1";
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
  ],
});

const ANALYST_TOKEN = signAccessToken({
  sub: "user-analyst-1",
  email: "analyst@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-analyst",
  roleName: "ANALYST",
  permissions: ["DASHBOARD_CREATE", "DASHBOARD_VIEW", "DASHBOARD_EDIT"],
});

const BUSINESS_USER_TOKEN = signAccessToken({
  sub: "user-business-1",
  email: "business@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-business",
  roleName: "BUSINESS_USER",
  permissions: ["DASHBOARD_VIEW"],
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
  organizationId: "org-other-tenant-99",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "DASHBOARD_CREATE",
    "DASHBOARD_VIEW",
    "DASHBOARD_EDIT",
    "DASHBOARD_DELETE",
  ],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("⚠️  Database not available — DB-dependent dashboard tests will be skipped.");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
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

describe("Dashboard Validation & Safe Serialization", () => {
  it("validates valid dashboard creation payload", () => {
    const valid = createDashboardSchema.parse({
      name: "Q3 Sales Performance",
      description: "Quarterly sales KPIs and pipeline metrics",
      status: "DRAFT",
      visibility: "ORGANIZATION",
      layoutConfig: { columns: 12, rowHeight: 80 },
    });

    expect(valid.name).toBe("Q3 Sales Performance");
    expect(valid.status).toBe("DRAFT");
    expect(valid.visibility).toBe("ORGANIZATION");
    expect(valid.layoutConfig).toEqual({ columns: 12, rowHeight: 80 });
  });

  it("rejects empty or whitespace-only dashboard name", () => {
    expect(() =>
      createDashboardSchema.parse({
        name: "   ",
      })
    ).toThrow();
  });

  it("rejects dashboard name exceeding 100 characters", () => {
    expect(() =>
      createDashboardSchema.parse({
        name: "a".repeat(101),
      })
    ).toThrow();
  });

  it("rejects dashboard description exceeding 500 characters", () => {
    expect(() =>
      createDashboardSchema.parse({
        name: "Valid Dashboard",
        description: "a".repeat(501),
      })
    ).toThrow();
  });

  it("validates update dashboard schema with optional fields", () => {
    const valid = updateDashboardSchema.parse({
      name: "Updated Name",
      status: "PUBLISHED",
    });
    expect(valid.name).toBe("Updated Name");
    expect(valid.status).toBe("PUBLISHED");

    expect(() =>
      updateDashboardSchema.parse({
        name: "",
      })
    ).toThrow();
  });

  it("validates list dashboards query parameters", () => {
    const query = listDashboardsQuerySchema.parse({
      search: "sales",
      status: "PUBLISHED",
      page: "2",
      limit: "15",
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(query.search).toBe("sales");
    expect(query.page).toBe(2);
    expect(query.limit).toBe(15);
    expect(query.sortOrder).toBe("asc");
  });

  it("builds safe dashboard response without leaking internal secrets", () => {
    const mockDashboard: any = {
      id: "dash-123",
      name: "Executive Dashboard",
      description: "Leadership KPIs",
      status: "PUBLISHED",
      visibility: "ORGANIZATION",
      organizationId: "org-1",
      ownerId: "user-1",
      owner: {
        id: "user-1",
        name: "Jane Doe",
        email: "jane@example.com",
      },
      layoutConfig: { cols: 12 },
      charts: [
        {
          id: "chart-1",
          title: "Revenue by Region",
          chartType: "bar",
          config: {},
          position: { x: 0, y: 0, w: 6, h: 4 },
          sortOrder: 1,
          datasetId: "ds-1",
        },
      ],
      createdAt: new Date("2026-03-30T10:00:00Z"),
      updatedAt: new Date("2026-03-30T12:00:00Z"),
    };

    const safe = buildSafeDashboard(mockDashboard);
    expect(safe.id).toBe("dash-123");
    expect(safe.name).toBe("Executive Dashboard");
    expect(safe.chartCount).toBe(1);
    expect(safe.ownerName).toBe("Jane Doe");
    expect((safe as any).password).toBeUndefined();
    expect((safe as any).secret).toBeUndefined();
  });
});

// ============================================================
// 2. RBAC & HTTP GUARDS (No DB required)
// ============================================================

describe("Dashboard RBAC & HTTP Guards", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request.get("/api/v1/dashboards");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects users without DASHBOARD_VIEW permission with 403", async () => {
    const res = await request
      .get("/api/v1/dashboards")
      .set("Authorization", `Bearer ${NO_PERMS_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects BUSINESS_USER from creating dashboards with 403", async () => {
    const res = await request
      .post("/api/v1/dashboards")
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`)
      .send({
        name: "Unauthorized Dashboard",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects BUSINESS_USER from updating dashboards with 403", async () => {
    const res = await request
      .patch("/api/v1/dashboards/dash-nonexistent")
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`)
      .send({
        name: "Unauthorized Update",
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects ANALYST from deleting dashboards with 403 (ADMIN only)", async () => {
    const res = await request
      .delete("/api/v1/dashboards/dash-nonexistent")
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects invalid dashboard creation payload with 400 VALIDATION_ERROR", async () => {
    const res = await request
      .post("/api/v1/dashboards")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "", // empty name
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows ANALYST to access creation route schema validation", async () => {
    const res = await request
      .post("/api/v1/dashboards")
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`)
      .send({
        name: "a".repeat(105), // triggers validation error, proving route access
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ============================================================
// 3. DB INTEGRATION & TENANT ISOLATION (Skipped if DB not available)
// ============================================================

describe("Dashboard DB Integration & Multi-Tenancy", () => {
  it("skips DB-backed dashboard integration when database is unreachable", { skip: !dbAvailable }, () => {});

  it("creates, retrieves, lists, updates, and deletes dashboard with tenant isolation", async () => {
    if (!dbAvailable) return;

    // 1. Create Dashboard (Admin)
    const createRes = await request
      .post("/api/v1/dashboards")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Test Dashboard - Executive",
        description: "Primary KPI overview for organization",
        status: "DRAFT",
        visibility: "ORGANIZATION",
        layoutConfig: { columns: 12, rowHeight: 100 },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const dashboardId = createRes.body.data.id;
    expect(dashboardId).toBeTruthy();
    expect(createRes.body.data.name).toBe("Test Dashboard - Executive");

    // 2. List Dashboards
    const listRes = await request
      .get("/api/v1/dashboards")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.dashboards.some((d: { id: string }) => d.id === dashboardId)).toBe(true);

    // 3. Get Dashboard
    const getRes = await request
      .get(`/api/v1/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(dashboardId);
    expect(getRes.body.data.name).toBe("Test Dashboard - Executive");

    // 4. Cross-Tenant Read Protection (Other Org receives 403 Forbidden)
    const crossTenantGet = await request
      .get(`/api/v1/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`);

    expect(crossTenantGet.status).toBe(403);

    // 5. Update Dashboard (Analyst can edit)
    const updateRes = await request
      .patch(`/api/v1/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`)
      .send({
        name: "Test Dashboard - Executive Updated",
        status: "PUBLISHED",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Test Dashboard - Executive Updated");
    expect(updateRes.body.data.status).toBe("PUBLISHED");

    // 6. Cross-Tenant Update Protection
    const crossTenantUpdate = await request
      .patch(`/api/v1/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`)
      .send({
        name: "Hacked Dashboard",
      });

    expect(crossTenantUpdate.status).toBe(403);

    // 7. Cross-Tenant Delete Protection
    const crossTenantDelete = await request
      .delete(`/api/v1/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`);

    expect(crossTenantDelete.status).toBe(403);

    // 8. Delete Dashboard (Admin)
    const deleteRes = await request
      .delete(`/api/v1/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 9. Verify Deletion
    const verifyGet = await request
      .get(`/api/v1/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(verifyGet.status).toBe(404);
  });
});
