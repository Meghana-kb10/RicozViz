// ============================================================
// Demo Datasets Catalog & Ingestion Tests
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { DEMO_DATASETS } from "../services/dataset/demo-catalog.data.js";
import { datasetQueryEngine } from "../services/dataset/query-engine.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;
let testOrgId: string;
let testWorkspaceId: string;
let otherWorkspaceId: string;
let testUserId: string;

let adminToken: string;
let analystToken: string;
let readOnlyToken: string;
let unauthorizedToken: string;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;

    // Create unique test organization
    const org = await prisma.organization.create({
      data: {
        name: `Demo Dataset Test Org ${Date.now()}`,
        slug: `demo-org-${Date.now()}`,
      },
    });
    testOrgId = org.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `demo-admin-${Date.now()}@example.com`,
        passwordHash: "mock-hash",
        name: "Demo Admin",
      },
    });
    testUserId = user.id;

    // Create workspace 1
    const ws1 = await prisma.workspace.create({
      data: {
        name: "Test Primary Workspace",
        slug: `test-ws-primary-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testWorkspaceId = ws1.id;

    // Create workspace 2 (for isolation check)
    const ws2 = await prisma.workspace.create({
      data: {
        name: "Test Secondary Workspace",
        slug: `test-ws-secondary-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    otherWorkspaceId = ws2.id;

    // Add user as member of ws1
    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspaceId,
        userId: testUserId,
        role: "ADMIN",
      },
    });

    // Tokens
    adminToken = signAccessToken({
      sub: testUserId,
      email: user.email,
      organizationId: testOrgId,
      roleId: "role-admin",
      roleName: "ADMIN",
      permissions: ["DATASET_VIEW", "DATASET_CREATE", "DATASET_EDIT", "DATASET_DELETE"],
    });

    analystToken = signAccessToken({
      sub: testUserId,
      email: user.email,
      organizationId: testOrgId,
      roleId: "role-analyst",
      roleName: "ANALYST",
      permissions: ["DATASET_VIEW", "DATASET_CREATE"],
    });

    readOnlyToken = signAccessToken({
      sub: testUserId,
      email: user.email,
      organizationId: testOrgId,
      roleId: "role-viewer",
      roleName: "VIEWER",
      permissions: ["DATASET_VIEW"],
    });

    unauthorizedToken = signAccessToken({
      sub: testUserId,
      email: user.email,
      organizationId: testOrgId,
      roleId: "role-none",
      roleName: "NO_PERM",
      permissions: [],
    });
  } catch (err) {
    console.warn("⚠️ Database not available for demo dataset tests:", err);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable && testOrgId) {
    try {
      await prisma.datasetColumn.deleteMany({
        where: { dataset: { organizationId: testOrgId } },
      });
      await prisma.dataset.deleteMany({
        where: { organizationId: testOrgId },
      });
      await prisma.workspaceMember.deleteMany({
        where: { workspace: { organizationId: testOrgId } },
      });
      await prisma.workspace.deleteMany({
        where: { organizationId: testOrgId },
      });
      await prisma.user.deleteMany({
        where: { email: { contains: "demo-admin" } },
      });
      await prisma.organization.deleteMany({
        where: { id: testOrgId },
      });
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  }
  await prisma.$disconnect();
});

describe("Demo Dataset Catalog & Ingestion", () => {
  // ------------------------------------------------------------
  // 1. Catalog Listing & Filtering
  // ------------------------------------------------------------
  it("GET /api/v1/datasets/demo/catalog lists all 10 curated demo datasets with complete metadata", async () => {
    const res = await request
      .get("/api/v1/datasets/demo/catalog")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBe(10);
    expect(res.body.data.length).toBe(10);

    // Validate that every dataset has full attribution, license, and schema
    for (const item of res.body.data) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.sourceUrl).toMatch(/^https?:\/\//);
      expect(item.license).toBeTruthy();
      expect(item.sourceAttribution).toBeTruthy();
      expect(item.fileName).toMatch(/\.csv$/);
      expect(item.sourceType).toBe("CSV");
      expect(item.rowCount).toBeGreaterThan(0);
      expect(item.columnCount).toBeGreaterThan(0);
      expect(item.columns.length).toBe(item.columnCount);
      expect(item.sampleData.length).toBeGreaterThan(0);
      // Records should be omitted from list for payload optimization
      expect(item.records).toBeUndefined();
    }
  });

  it("filters catalog items by category", async () => {
    const res = await request
      .get("/api/v1/datasets/demo/catalog?category=Food %26 Nutrition")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2); // 80 Cereals + Starbucks Menu
    for (const item of res.body.data) {
      expect(item.category).toBe("Food & Nutrition");
    }
  });

  it("filters catalog items by search query", async () => {
    const res = await request
      .get("/api/v1/datasets/demo/catalog?search=lego")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe("lego-database");
  });

  // ------------------------------------------------------------
  // 2. Details & Preview
  // ------------------------------------------------------------
  it("GET /api/v1/datasets/demo/:demoId returns full dataset details including records preview", async () => {
    const res = await request
      .get("/api/v1/datasets/demo/cereals-80")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("cereals-80");
    expect(res.body.data.name).toBe("80 Breakfast Cereals");
    expect(res.body.data.records).toBeInstanceOf(Array);
    expect(res.body.data.records.length).toBe(20);
    expect(res.body.data.license).toBe("CC0: Public Domain");
  });

  it("returns 404 for unknown demo dataset ID", async () => {
    const res = await request
      .get("/api/v1/datasets/demo/unknown-dataset-xyz")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ------------------------------------------------------------
  // 3. RBAC & Security Checks
  // ------------------------------------------------------------
  it("rejects unauthenticated requests to demo endpoints", async () => {
    const res = await request.get("/api/v1/datasets/demo/catalog");
    expect(res.status).toBe(401);
  });

  it("rejects users without DATASET_VIEW permission from viewing catalog", async () => {
    const res = await request
      .get("/api/v1/datasets/demo/catalog")
      .set("Authorization", `Bearer ${unauthorizedToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects users without DATASET_CREATE permission from importing demo dataset", async () => {
    const res = await request
      .post("/api/v1/datasets/demo/cereals-80/import")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ workspaceId: testWorkspaceId });
    expect(res.status).toBe(403);
  });

  // ------------------------------------------------------------
  // 4. Ingestion, Schema Persistence & Query Engine Integration
  // ------------------------------------------------------------
  it("successfully imports a demo dataset into the target workspace", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/demo/cereals-80/import")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ workspaceId: testWorkspaceId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyImported).toBe(false);
    expect(res.body.data.name).toBe("80 Breakfast Cereals");
    expect(res.body.data.rowCount).toBe(20);
    expect(res.body.data.columnCount).toBe(12);
    expect(res.body.data.sourceType).toBe("CSV");
    expect(res.body.data.status).toBe("READY");

    const datasetId = res.body.data.id;

    // Verify in database: schemaMeta must store attribution, license, and records
    const dbRecord = await prisma.dataset.findUnique({
      where: { id: datasetId },
      include: { columns: { orderBy: { ordinalPosition: "asc" } } },
    });

    expect(dbRecord).toBeTruthy();
    expect(dbRecord?.type).toBe("UPLOADED");
    expect(dbRecord?.columns.length).toBe(12);

    const meta = dbRecord?.schemaMeta as Record<string, unknown>;
    expect(meta["isDemo"]).toBe(true);
    expect(meta["demoCatalogId"]).toBe("cereals-80");
    expect(meta["license"]).toBe("CC0: Public Domain");
    expect(meta["sourceAttribution"]).toContain("USDA Nutrition Data");
    expect(meta["sampleData"]).toBeInstanceOf(Array);
    expect((meta["sampleData"] as unknown[]).length).toBe(20);

    // Verify Query Engine can run aggregations on the imported demo dataset immediately
    const queryResult = await datasetQueryEngine.executeQuery(dbRecord!, {
      dimensions: ["mfr"],
      measures: [
        { column: "calories", aggregation: "AVG", alias: "avg_calories" },
        { column: "rating", aggregation: "AVG", alias: "avg_rating" },
      ],
      limit: 10,
    });

    expect(queryResult.rows.length).toBeGreaterThan(0);
    expect(queryResult.rows[0]).toHaveProperty("mfr");
    expect(queryResult.rows[0]).toHaveProperty("avg_calories");
    expect(queryResult.rows[0]).toHaveProperty("avg_rating");
  });

  // ------------------------------------------------------------
  // 5. Duplicate Prevention
  // ------------------------------------------------------------
  it("prevents duplicate demo imports in the same workspace and returns alreadyImported: true", async () => {
    if (!dbAvailable) return;

    // Second import attempt of cereals-80 in testWorkspaceId
    const res = await request
      .post("/api/v1/datasets/demo/cereals-80/import")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ workspaceId: testWorkspaceId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyImported).toBe(true);
    expect(res.body.message).toContain("already available in this workspace");

    // Count in DB for this workspace should still be exactly 1
    const count = await prisma.dataset.count({
      where: {
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        name: "80 Breakfast Cereals",
      },
    });
    expect(count).toBe(1);
  });

  // ------------------------------------------------------------
  // 6. Custom Name Support
  // ------------------------------------------------------------
  it("supports importing demo dataset with a custom name", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets/demo/lego-database/import")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({
        workspaceId: testWorkspaceId,
        customName: "Lego Themes & Sets 2024",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Lego Themes & Sets 2024");
    expect(res.body.data.rowCount).toBe(20);
    expect(res.body.data.columnCount).toBe(6);
  });

  // ------------------------------------------------------------
  // 7. Workspace Isolation
  // ------------------------------------------------------------
  it("allows importing the same demo dataset into a different workspace in the same org without conflict", async () => {
    if (!dbAvailable) return;

    // Add user as member of otherWorkspaceId so they have access
    await prisma.workspaceMember.create({
      data: {
        workspaceId: otherWorkspaceId,
        userId: testUserId,
        role: "ADMIN",
      },
    });

    const res = await request
      .post("/api/v1/datasets/demo/cereals-80/import")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ workspaceId: otherWorkspaceId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyImported).toBe(false);

    // Both workspaces now have 1 copy of cereals-80 independently
    const countWs1 = await prisma.dataset.count({
      where: { workspaceId: testWorkspaceId, name: "80 Breakfast Cereals" },
    });
    const countWs2 = await prisma.dataset.count({
      where: { workspaceId: otherWorkspaceId, name: "80 Breakfast Cereals" },
    });

    expect(countWs1).toBe(1);
    expect(countWs2).toBe(1);
  });
});
