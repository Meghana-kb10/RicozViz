// ========================================
// Dataset Blending & Multi-Source Tests
// ========================================
// Tests dataset blending with INNER and LEFT joins, previewing,
// schema derivation, validation, tenant/workspace isolation,
// querying, and visualization compatibility.
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
let testOtherWorkspaceId = "";
let testUserId = "";

let datasetSalesId = "";
let datasetCustomersId = "";
let datasetTypesIncompatibleId = "";
let datasetOtherWsId = "";
let createdBlendId = "";

const ORG_ID = "org-test-admin-1";
const USER_ID = "user-admin-1";

const OWNER_TOKEN = signAccessToken({
  sub: USER_ID,
  email: "admin@ricozviz.test",
  organizationId: ORG_ID,
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "DATASET_CREATE",
    "DATASET_VIEW",
    "DATASET_EDIT",
    "DATASET_DELETE",
    "DASHBOARD_CREATE",
    "DASHBOARD_VIEW",
    "DASHBOARD_EDIT",
    "VISUALIZATION_CREATE",
    "VISUALIZATION_VIEW",
  ],
});

const OTHER_TENANT_TOKEN = signAccessToken({
  sub: "user-other-org",
  email: "other@other-org.test",
  organizationId: "org-other-tenant-99",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: ["DATASET_VIEW", "DATASET_CREATE"],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
    testOrgId = ORG_ID;
    testUserId = USER_ID;

    // Create main test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Blending Test Workspace",
        slug: `blend-ws-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testWorkspaceId = workspace.id;

    // Create secondary workspace in same org for isolation tests
    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: "Other Workspace For Isolation",
        slug: `blend-other-ws-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testOtherWorkspaceId = otherWorkspace.id;

    // 1. Create Dataset A: Sales
    const sales = await prisma.dataset.create({
      data: {
        name: "Sales Dataset",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 4,
        columnCount: 4,
        columns: {
          create: [
            { name: "customer_id", dataType: "STRING", ordinalPosition: 1 },
            { name: "customer_name", dataType: "STRING", ordinalPosition: 2 },
            { name: "region", dataType: "STRING", ordinalPosition: 3 },
            { name: "revenue", dataType: "NUMBER", ordinalPosition: 4 },
          ],
        },
        schemaMeta: {
          columns: [
            { name: "customer_id", type: "string" },
            { name: "customer_name", type: "string" },
            { name: "region", type: "string" },
            { name: "revenue", type: "number" },
          ],
          sampleData: [
            { customer_id: "C101", customer_name: "Acme Corp", region: "North", revenue: 5000 },
            { customer_id: "C102", customer_name: "Globex", region: "South", revenue: 8000 },
            { customer_id: "C103", customer_name: "Soylent", region: "East", revenue: 3200 },
            { customer_id: "C999", customer_name: "Ghost Corp", region: "West", revenue: 1500 }, // Has no match in customers
          ],
        },
      },
    });
    datasetSalesId = sales.id;

    // 2. Create Dataset B: Customers
    const customers = await prisma.dataset.create({
      data: {
        name: "Customers Dataset",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 3,
        columnCount: 3,
        columns: {
          create: [
            { name: "customer_id", dataType: "STRING", ordinalPosition: 1 },
            { name: "age", dataType: "NUMBER", ordinalPosition: 2 },
            { name: "category", dataType: "STRING", ordinalPosition: 3 },
          ],
        },
        schemaMeta: {
          columns: [
            { name: "customer_id", type: "string" },
            { name: "age", type: "number" },
            { name: "category", type: "string" },
          ],
          sampleData: [
            { customer_id: "C101", age: 34, category: "Enterprise" },
            { customer_id: "C102", age: 45, category: "SMB" },
            { customer_id: "C103", age: 29, category: "Enterprise" },
          ],
        },
      },
    });
    datasetCustomersId = customers.id;

    // 3. Create Dataset with incompatible type on customer_id (NUMBER instead of STRING)
    const incompatible = await prisma.dataset.create({
      data: {
        name: "Incompatible Numeric Customer Dataset",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 1,
        columnCount: 2,
        columns: {
          create: [
            { name: "customer_id", dataType: "NUMBER", ordinalPosition: 1 },
            { name: "tier", dataType: "STRING", ordinalPosition: 2 },
          ],
        },
        schemaMeta: {
          columns: [
            { name: "customer_id", type: "number" },
            { name: "tier", type: "string" },
          ],
          sampleData: [{ customer_id: 101, tier: "Gold" }],
        },
      },
    });
    datasetTypesIncompatibleId = incompatible.id;

    // 4. Create Dataset in a different workspace
    const otherWsDataset = await prisma.dataset.create({
      data: {
        name: "Other Workspace Dataset",
        organizationId: testOrgId,
        workspaceId: testOtherWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 1,
        columnCount: 2,
        columns: {
          create: [
            { name: "customer_id", dataType: "STRING", ordinalPosition: 1 },
            { name: "notes", dataType: "STRING", ordinalPosition: 2 },
          ],
        },
        schemaMeta: {
          columns: [
            { name: "customer_id", type: "string" },
            { name: "notes", type: "string" },
          ],
          sampleData: [{ customer_id: "C101", notes: "Test note" }],
        },
      },
    });
    datasetOtherWsId = otherWsDataset.id;
  } catch (err) {
    console.warn("⚠️ Database setup failed or unavailable — blend tests will be skipped:", err);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      if (createdBlendId) {
        await prisma.datasetColumn.deleteMany({ where: { datasetId: createdBlendId } });
        await prisma.dataset.delete({ where: { id: createdBlendId } }).catch(() => null);
      }
      if (datasetSalesId) {
        await prisma.datasetColumn.deleteMany({ where: { datasetId: datasetSalesId } });
        await prisma.dataset.delete({ where: { id: datasetSalesId } }).catch(() => null);
      }
      if (datasetCustomersId) {
        await prisma.datasetColumn.deleteMany({ where: { datasetId: datasetCustomersId } });
        await prisma.dataset.delete({ where: { id: datasetCustomersId } }).catch(() => null);
      }
      if (datasetTypesIncompatibleId) {
        await prisma.datasetColumn.deleteMany({ where: { datasetId: datasetTypesIncompatibleId } });
        await prisma.dataset.delete({ where: { id: datasetTypesIncompatibleId } }).catch(() => null);
      }
      if (datasetOtherWsId) {
        await prisma.datasetColumn.deleteMany({ where: { datasetId: datasetOtherWsId } });
        await prisma.dataset.delete({ where: { id: datasetOtherWsId } }).catch(() => null);
      }
      if (testWorkspaceId) await prisma.workspace.delete({ where: { id: testWorkspaceId } }).catch(() => null);
      if (testOtherWorkspaceId) await prisma.workspace.delete({ where: { id: testOtherWorkspaceId } }).catch(() => null);
    } catch {
      // Ignore cleanup error
    }
  }
});

describe("Data Blending API", () => {
  it("POST /api/v1/datasets/blends/preview previews an INNER JOIN correctly", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/blends/preview")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        datasetAId: datasetSalesId,
        datasetBId: datasetCustomersId,
        joinColumnA: "customer_id",
        joinColumnB: "customer_id",
        joinType: "INNER",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.joinType).toBe("INNER");
    // Only 3 matching customers between Sales (4 rows) and Customers (3 rows)
    expect(data.rowCount).toBe(3);
    expect(data.rows.length).toBe(3);

    // Verify merged columns
    const colNames = data.resultingColumns.map((c: any) => c.name);
    expect(colNames).toContain("customer_id");
    expect(colNames).toContain("customer_name");
    expect(colNames).toContain("region");
    expect(colNames).toContain("revenue");
    expect(colNames).toContain("age");
    expect(colNames).toContain("category");

    // Verify row contents
    const firstRow = data.rows.find((r: any) => r.customer_id === "C101");
    expect(firstRow).toBeDefined();
    expect(firstRow.customer_name).toBe("Acme Corp");
    expect(firstRow.age).toBe(34);
    expect(firstRow.category).toBe("Enterprise");
    expect(firstRow.revenue).toBe(5000);
  });

  it("POST /api/v1/datasets/blends/preview previews a LEFT JOIN correctly", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/blends/preview")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        datasetAId: datasetSalesId,
        datasetBId: datasetCustomersId,
        joinColumnA: "customer_id",
        joinColumnB: "customer_id",
        joinType: "LEFT",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.joinType).toBe("LEFT");
    // All 4 rows from Sales are retained
    expect(data.rowCount).toBe(4);
    expect(data.rows.length).toBe(4);

    // Ghost Corp (C999) has null age and category
    const ghostRow = data.rows.find((r: any) => r.customer_id === "C999");
    expect(ghostRow).toBeDefined();
    expect(ghostRow.customer_name).toBe("Ghost Corp");
    expect(ghostRow.revenue).toBe(1500);
    expect(ghostRow.age).toBeNull();
    expect(ghostRow.category).toBeNull();
  });

  it("POST /api/v1/datasets/blends creates and persists a DERIVED dataset", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/blends")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "Sales and Customer Profile Blend",
        description: "Blended dataset combining customer demographic profile with sales",
        datasetAId: datasetSalesId,
        datasetBId: datasetCustomersId,
        joinColumnA: "customer_id",
        joinColumnB: "customer_id",
        joinType: "LEFT",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const ds = res.body.data;
    createdBlendId = ds.id;

    expect(ds.name).toBe("Sales and Customer Profile Blend");
    expect(ds.type).toBe("DERIVED");
    expect(ds.status).toBe("READY");
    expect(ds.rowCount).toBe(4);
    expect(ds.columnCount).toBe(6);
    expect(ds.columns.length).toBe(6);
  });

  it("GET /api/v1/datasets/blends lists the created blend", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get("/api/v1/datasets/blends")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((b: any) => b.id === createdBlendId);
    expect(found).toBeDefined();
    expect(found.type).toBe("DERIVED");
    expect(found.blendConfig).toBeDefined();
    expect(found.blendConfig.joinType).toBe("LEFT");
  });

  it("GET /api/v1/datasets/blends/:id returns the blend details", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/datasets/blends/${createdBlendId}`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdBlendId);
    expect(res.body.data.blendConfig.joinColumnA).toBe("customer_id");
  });

  it("validates and rejects non-existent join columns", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/blends/preview")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        datasetAId: datasetSalesId,
        datasetBId: datasetCustomersId,
        joinColumnA: "non_existent_column",
        joinColumnB: "customer_id",
        joinType: "INNER",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("does not exist in dataset A");
  });

  it("validates and rejects incompatible data types on join columns", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/blends/preview")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        datasetAId: datasetSalesId,
        datasetBId: datasetTypesIncompatibleId,
        joinColumnA: "customer_id", // STRING
        joinColumnB: "customer_id", // NUMBER
        joinType: "INNER",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("incompatible data types");
  });

  it("validates and rejects cross-workspace blend attempts", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/blends/preview")
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        datasetAId: datasetSalesId,
        datasetBId: datasetOtherWsId,
        joinColumnA: "customer_id",
        joinColumnB: "customer_id",
        joinType: "INNER",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Datasets belong to different workspaces");
  });

  it("enforces tenant isolation and rejects other tenant blend access", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/blends/preview")
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`)
      .send({
        datasetAId: datasetSalesId,
        datasetBId: datasetCustomersId,
        joinColumnA: "customer_id",
        joinColumnB: "customer_id",
        joinType: "INNER",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("allows querying the blended dataset through datasetQueryEngine (Visualization Compatibility)", async () => {
    if (!dbAvailable) return;

    // Query aggregated revenue by category on the blended dataset
    const res = await request
      .post(`/api/v1/datasets/${createdBlendId}/query`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        dimensions: ["category"],
        measures: [{ column: "revenue", aggregation: "SUM", alias: "total_revenue" }],
        sort: { column: "total_revenue", direction: "desc" },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const qData = res.body.data;
    expect(qData.queryMode || qData.metadata?.queryMode).toBe("AGGREGATE");
    expect(Array.isArray(qData.rows)).toBe(true);
    expect(qData.rows.length).toBeGreaterThan(0);

    // Enterprise category sum should be 5000 (Acme) + 3200 (Soylent) = 8200
    const enterpriseRow = qData.rows.find((r: any) => r.category === "Enterprise");
    expect(enterpriseRow).toBeDefined();
    expect(Number(enterpriseRow.total_revenue)).toBe(8200);
  });

  it("DELETE /api/v1/datasets/blends/:id deletes the blended dataset", async () => {
    if (!dbAvailable) return;

    const delRes = await request
      .delete(`/api/v1/datasets/blends/${createdBlendId}`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await request
      .get(`/api/v1/datasets/blends/${createdBlendId}`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(getRes.status).toBe(404);
    createdBlendId = ""; // Marked as deleted
  });
});
