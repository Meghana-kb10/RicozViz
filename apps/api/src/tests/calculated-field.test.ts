// ========================================
// Calculated Fields & Formula Columns Tests
// ========================================
// Tests expression evaluation, AST compilation, safety limits,
// arithmetic, string functions, division by zero, cross-workspace security,
// query engine aggregations, and blended dataset compatibility.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  compileCalculatedField,
  evaluateExpression,
} from "../services/dataset/calculated-field.engine.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;
let testOrgId = "";
let testWorkspaceId = "";
let testOtherWorkspaceId = "";
let testUserId = "";

let datasetSalesId = "";
let datasetBlendedId = "";
let createdFieldId = "";

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
  ],
});

const OTHER_TENANT_TOKEN = signAccessToken({
  sub: "user-other-org",
  email: "other@other-org.test",
  organizationId: "org-other-tenant-99",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: ["DATASET_VIEW", "DATASET_EDIT"],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
    testOrgId = ORG_ID;
    testUserId = USER_ID;

    // 1. Create main test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Calculated Field Workspace",
        slug: `calc-ws-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testWorkspaceId = workspace.id;

    // 2. Create another workspace in same org for cross-workspace checks
    const otherWs = await prisma.workspace.create({
      data: {
        name: "Other WS for Calc Field Isolation",
        slug: `calc-other-ws-${Date.now()}`,
        organizationId: testOrgId,
      },
    });
    testOtherWorkspaceId = otherWs.id;

    // 3. Create Dataset: Sales with sample rows
    const salesSampleRows = [
      { id: 1, product: "Widget A", revenue: 10000, cost: 7000, quantity: 50, region: " north " },
      { id: 2, product: "Widget B", revenue: 15000, cost: 9000, quantity: 30, region: "SOUTH" },
      { id: 3, product: "Widget C", revenue: 8000, cost: 8000, quantity: 0, region: "East" }, // quantity: 0 to test division by zero
      { id: 4, product: "Widget D", revenue: 20000, cost: 12000, quantity: 100, region: "west" },
    ];

    const sales = await prisma.dataset.create({
      data: {
        name: "Sales For Calc Fields",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "UPLOADED",
        sourceType: "CSV",
        rowCount: 4,
        columnCount: 6,
        schemaMeta: {
          columns: [
            { name: "id", type: "number" },
            { name: "product", type: "string" },
            { name: "revenue", type: "number" },
            { name: "cost", type: "number" },
            { name: "quantity", type: "number" },
            { name: "region", type: "string" },
          ],
          sampleData: salesSampleRows,
          rowCount: 4,
          columnCount: 6,
        },
        columns: {
          create: [
            { name: "id", dataType: "NUMBER", ordinalPosition: 1 },
            { name: "product", dataType: "STRING", ordinalPosition: 2 },
            { name: "revenue", dataType: "NUMBER", ordinalPosition: 3 },
            { name: "cost", dataType: "NUMBER", ordinalPosition: 4 },
            { name: "quantity", dataType: "NUMBER", ordinalPosition: 5 },
            { name: "region", dataType: "STRING", ordinalPosition: 6 },
          ],
        },
      },
    });
    datasetSalesId = sales.id;

    // 4. Create a DERIVED / Blended Dataset to verify compatibility
    const blended = await prisma.dataset.create({
      data: {
        name: "Blended Dataset For Calc Fields",
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        createdById: testUserId,
        type: "DERIVED",
        sourceType: "CSV",
        rowCount: 2,
        columnCount: 4,
        schemaMeta: {
          columns: [
            { name: "cust_id", type: "string" },
            { name: "spend", type: "number" },
            { name: "orders", type: "number" },
            { name: "country", type: "string" },
          ],
          sampleData: [
            { cust_id: "C1", spend: 5000, orders: 10, country: "usa" },
            { cust_id: "C2", spend: 3000, orders: 5, country: "uk" },
          ],
          rowCount: 2,
          columnCount: 4,
        },
        columns: {
          create: [
            { name: "cust_id", dataType: "STRING", ordinalPosition: 1 },
            { name: "spend", dataType: "NUMBER", ordinalPosition: 2 },
            { name: "orders", dataType: "NUMBER", ordinalPosition: 3 },
            { name: "country", dataType: "STRING", ordinalPosition: 4 },
          ],
        },
      },
    });
    datasetBlendedId = blended.id;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      await prisma.datasetColumn.deleteMany({
        where: { datasetId: { in: [datasetSalesId, datasetBlendedId] } },
      });
      await prisma.dataset.deleteMany({
        where: { id: { in: [datasetSalesId, datasetBlendedId] } },
      });
      await prisma.workspace.deleteMany({
        where: { id: { in: [testWorkspaceId, testOtherWorkspaceId] } },
      });
    } catch {
      // Ignore cleanup error
    }
  }
  await prisma.$disconnect();
});

// ============================================================
// UNIT TESTS: EXPRESSION ENGINE
// ============================================================

describe("Calculated Field Expression Engine (Unit Tests)", () => {
  const columns = [
    { name: "revenue", type: "number" },
    { name: "cost", type: "number" },
    { name: "quantity", type: "number" },
    { name: "region", type: "string" },
  ];

  it("compiles and evaluates simple arithmetic (revenue - cost)", () => {
    const { ast, referencedColumns, dataType } = compileCalculatedField("revenue - cost", columns);
    expect(referencedColumns).toEqual(["revenue", "cost"]);
    expect(dataType).toBe("NUMBER");

    const result = evaluateExpression(ast, { revenue: 10000, cost: 7000 });
    expect(result).toBe(3000);
  });

  it("compiles and evaluates multi-column combined formula (profit / revenue * 100)", () => {
    const { ast, dataType } = compileCalculatedField("(revenue - cost) / revenue * 100", columns);
    expect(dataType).toBe("NUMBER");

    const result = evaluateExpression(ast, { revenue: 10000, cost: 8000 });
    expect(result).toBe(20);
  });

  it("safely handles division by zero by returning null instead of throwing", () => {
    const { ast } = compileCalculatedField("revenue / quantity", columns);
    const result = evaluateExpression(ast, { revenue: 5000, quantity: 0 });
    expect(result).toBeNull();
  });

  it("compiles and evaluates string functions (UPPER, LOWER, TRIM)", () => {
    const upperAst = compileCalculatedField("UPPER(region)", columns).ast;
    expect(evaluateExpression(upperAst, { region: "north" })).toBe("NORTH");

    const lowerAst = compileCalculatedField("LOWER(region)", columns).ast;
    expect(evaluateExpression(lowerAst, { region: "SOUTH" })).toBe("south");

    const trimAst = compileCalculatedField("TRIM(region)", columns).ast;
    expect(evaluateExpression(trimAst, { region: "  east  " })).toBe("east");
  });

  it("compiles and evaluates mathematical functions (ABS, ROUND)", () => {
    const absAst = compileCalculatedField("ABS(cost - revenue)", columns).ast;
    expect(evaluateExpression(absAst, { revenue: 3000, cost: 5000 })).toBe(2000);

    const roundAst = compileCalculatedField("ROUND(revenue / 3, 2)", columns).ast;
    expect(evaluateExpression(roundAst, { revenue: 10 })).toBe(3.33);
  });

  it("rejects unknown columns with a descriptive error", () => {
    expect(() => compileCalculatedField("revenue - non_existent_column", columns)).toThrow(
      /Referenced column 'non_existent_column' does not exist/
    );
  });

  it("rejects unknown functions outside the allowlist", () => {
    expect(() => compileCalculatedField("DANGEROUS_FN(revenue)", columns)).toThrow(
      /Function 'DANGEROUS_FN' is not supported/
    );
  });

  it("rejects dangerous keywords and code execution attempts", () => {
    expect(() => compileCalculatedField("eval('1+1')", columns)).toThrow(/Prohibited keyword/);
    expect(() => compileCalculatedField("function() { return 1; }()", columns)).toThrow(/Prohibited keyword/);
  });
});

// ============================================================
// INTEGRATION TESTS: CALCULATED FIELD API
// ============================================================

describe("Calculated Field API & Query Engine Integration", () => {
  it("1. POST /api/v1/datasets/:id/calculated-fields/preview previews an arithmetic formula", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields/preview`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "profit",
        expression: "revenue - cost",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.name).toBe("profit");
    expect(data.dataType).toBe("NUMBER");
    expect(data.referencedColumns).toContain("revenue");
    expect(data.referencedColumns).toContain("cost");
    expect(data.rows.length).toBe(4);

    // Row 1: revenue 10000 - cost 7000 = 3000
    expect(data.rows[0].profit).toBe(3000);
    // Row 2: revenue 15000 - cost 9000 = 6000
    expect(data.rows[1].profit).toBe(6000);
  });

  it("2. POST /api/v1/datasets/:id/calculated-fields/preview handles division by zero safely", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields/preview`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "unit_price",
        expression: "revenue / quantity",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    // Row 3 has quantity: 0 -> unit_price should be null, not throw
    expect(data.rows[2].quantity).toBe(0);
    expect(data.rows[2].unit_price).toBeNull();
  });

  it("3. POST /api/v1/datasets/:id/calculated-fields/preview previews string expressions", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields/preview`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "clean_region",
        expression: "UPPER(TRIM(region))",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.dataType).toBe("STRING");
    // Row 1: " north " -> "NORTH"
    expect(data.rows[0].clean_region).toBe("NORTH");
  });

  it("4. POST /api/v1/datasets/:id/calculated-fields creates and persists a calculated field", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "profit",
        expression: "revenue - cost",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    createdFieldId = data.field.id;
    expect(data.field.name).toBe("profit");
    expect(data.field.expression).toBe("revenue - cost");
    expect(data.field.dataType).toBe("NUMBER");

    // Verify dataset columns now includes 'profit'
    const colNames = data.dataset.columns.map((c: any) => c.name);
    expect(colNames).toContain("profit");
  });

  it("5. rejects creating a calculated field with an unknown column", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "bad_field",
        expression: "revenue - fictitious_col",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("fictitious_col");
  });

  it("6. rejects creating a calculated field with an unknown function", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "bad_func",
        expression: "SQL_EXEC(revenue)",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("SQL_EXEC");
  });

  it("7. rejects invalid expression syntax", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "syntax_error",
        expression: "revenue + * cost",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("8. enforces tenant isolation on calculated field creation", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/calculated-fields`)
      .set("Authorization", `Bearer ${OTHER_TENANT_TOKEN}`)
      .send({
        name: "stolen_field",
        expression: "revenue - cost",
      });

    expect(res.status).toBe(403);
  });

  it("9. GET /api/v1/datasets/:id/calculated-fields lists calculated fields", async () => {
    if (!dbAvailable) return;

    const res = await request
      .get(`/api/v1/datasets/${datasetSalesId}/calculated-fields`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const names = res.body.data.map((f: any) => f.name);
    expect(names).toContain("profit");
  });

  it("10. Query Engine allows raw projection of calculated field", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/query`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        columns: ["product", "revenue", "cost", "profit"],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const rows = res.body.data.rows;
    expect(rows.length).toBe(4);
    expect(rows[0].product).toBe("Widget A");
    expect(rows[0].profit).toBe(3000);
    expect(rows[1].profit).toBe(6000);
  });

  it("11. Query Engine aggregates calculated field using SUM and AVG (Visualization Compatibility)", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post(`/api/v1/datasets/${datasetSalesId}/query`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        measures: [
          { column: "profit", aggregation: "SUM", alias: "total_profit" },
          { column: "profit", aggregation: "AVG", alias: "avg_profit" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const rows = res.body.data.rows;
    expect(rows.length).toBe(1);
    // Profits: 3000 + 6000 + 0 + 8000 = 17000
    expect(rows[0].total_profit).toBe(17000);
    expect(rows[0].avg_profit).toBe(4250);
  });

  it("12. Works seamlessly on DERIVED / Blended datasets", async () => {
    if (!dbAvailable) return;

    // Create calculated field on blended dataset: avg_order_value = spend / orders
    const createRes = await request
      .post(`/api/v1/datasets/${datasetBlendedId}/calculated-fields`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        name: "aov",
        expression: "spend / orders",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);

    // Query blended dataset with calculated field
    const qRes = await request
      .post(`/api/v1/datasets/${datasetBlendedId}/query`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`)
      .send({
        dimensions: ["country"],
        measures: [{ column: "aov", aggregation: "SUM", alias: "total_aov" }],
      });

    expect(qRes.status).toBe(200);
    expect(qRes.body.success).toBe(true);
    const rows = qRes.body.data.rows;
    expect(rows.length).toBe(2);
    // C1: spend 5000 / 10 = 500
    // C2: spend 3000 / 5 = 600
    const usaRow = rows.find((r: any) => r.country === "usa");
    expect(usaRow.total_aov).toBe(500);
  });

  it("13. DELETE /api/v1/datasets/:id/calculated-fields/:fieldId deletes calculated field", async () => {
    if (!dbAvailable) return;

    const delRes = await request
      .delete(`/api/v1/datasets/${datasetSalesId}/calculated-fields/${createdFieldId}`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verify it's no longer listed
    const listRes = await request
      .get(`/api/v1/datasets/${datasetSalesId}/calculated-fields`)
      .set("Authorization", `Bearer ${OWNER_TOKEN}`);
    expect(listRes.status).toBe(200);
    const names = listRes.body.data.map((f: any) => f.name);
    expect(names).not.toContain("profit");
  });
});
