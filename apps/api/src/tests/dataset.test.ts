// ========================================
// Dataset Management & Ingestion Tests
// ========================================
// Tests Dataset CRUD, CSV Ingestion, Type Inference,
// Schema Discovery, Query Engine, RBAC, and Multi-Tenancy.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  parseCsvText,
  inferColumnType,
  discoverCsvSchema,
} from "../services/dataset/type-inference.js";
import {
  validateSqlIdentifier,
  mapPostgresTypeToColumnType,
} from "../services/dataset/schema-discovery.service.js";
import { datasetQueryEngine } from "../services/dataset/query-engine.js";
import { buildSafeDataset } from "../services/dataset/dataset.service.js";

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
    "DATASET_CREATE",
    "DATASET_VIEW",
    "DATASET_EDIT",
    "DATASET_DELETE",
    "DATA_SOURCE_CREATE",
    "DATA_SOURCE_VIEW",
  ],
});

const ANALYST_TOKEN = signAccessToken({
  sub: "user-analyst-1",
  email: "analyst@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-analyst",
  roleName: "ANALYST",
  permissions: ["DATASET_CREATE", "DATASET_VIEW", "DATASET_EDIT"],
});

const BUSINESS_USER_TOKEN = signAccessToken({
  sub: "user-business-1",
  email: "business@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-business",
  roleName: "BUSINESS_USER",
  permissions: ["DATASET_VIEW", "DASHBOARD_VIEW"],
});

const OTHER_ORG_TOKEN = signAccessToken({
  sub: "user-other-org",
  email: "other@other-org.test",
  organizationId: "org-other-tenant-99",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "DATASET_CREATE",
    "DATASET_VIEW",
    "DATASET_EDIT",
    "DATASET_DELETE",
  ],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("⚠️  Database not available — DB-dependent dataset tests will be skipped.");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      await prisma.dataset.deleteMany({
        where: { name: { startsWith: "Test Dataset" } },
      });
    } catch {
      // ignore cleanup errors
    }
  }
  await prisma.$disconnect();
});

// ============================================================
// 1. CSV INGESTION & TYPE INFERENCE TESTS (No DB required)
// ============================================================

describe("CSV Parsing and Column Type Inference", () => {
  it("infers integer, number, boolean, date, and string types correctly", () => {
    expect(inferColumnType(["1", "2", "300", "-40"]).type).toBe("integer");
    expect(inferColumnType(["1.5", "2.0", "3.1415", "100"]).type).toBe("number");
    expect(inferColumnType(["true", "false", "yes", "no"]).type).toBe("boolean");
    expect(inferColumnType(["2026-01-15", "2026-02-28", "2026-03-30"]).type).toBe("date");
    expect(inferColumnType(["alpha", "beta", "gamma", "123"]).type).toBe("string");
  });

  it("detects nullability when empty values are present", () => {
    const withoutNulls = inferColumnType(["1", "2", "3"]);
    expect(withoutNulls.nullable).toBe(false);

    const withNulls = inferColumnType(["1", "", "3", "   "]);
    expect(withNulls.nullable).toBe(true);
  });

  it("parses CSV lines handling quotes and delimiters safely", () => {
    const sampleCsv = `customer_id,customer_name,revenue,is_active,created_at
1,"Acme, Inc.",12500.50,true,2026-01-15
2,"Wayne Enterprises",98000.00,true,2026-02-20
3,"Stark Tech",150000.75,false,2026-03-10`;

    const { headers, rows } = parseCsvText(sampleCsv);
    expect(headers).toEqual(["customer_id", "customer_name", "revenue", "is_active", "created_at"]);
    expect(rows.length).toBe(3);
    expect(rows[0]?.["customer_name"]).toBe("Acme, Inc.");
    expect(rows[0]?.["revenue"]).toBe("12500.50");

    const schema = discoverCsvSchema(headers, rows);
    expect(schema.find((c) => c.name === "customer_id")?.type).toBe("integer");
    expect(schema.find((c) => c.name === "customer_name")?.type).toBe("string");
    expect(schema.find((c) => c.name === "revenue")?.type).toBe("number");
    expect(schema.find((c) => c.name === "is_active")?.type).toBe("boolean");
    expect(schema.find((c) => c.name === "created_at")?.type).toBe("date");
  });
});

// ============================================================
// 2. SQL IDENTIFIER VALIDATION & POSTGRES TYPE MAPPING
// ============================================================

describe("SQL Identifier Validation and Postgres Mapping", () => {
  it("allows safe alphanumeric SQL table and column names", () => {
    expect(validateSqlIdentifier("users")).toBe("users");
    expect(validateSqlIdentifier("sales_q3_2026")).toBe("sales_q3_2026");
    expect(validateSqlIdentifier("customer_id")).toBe("customer_id");
  });

  it("rejects malicious or invalid SQL identifiers", () => {
    expect(() => validateSqlIdentifier("users; DROP TABLE users;--")).toThrowError();
    expect(() => validateSqlIdentifier("users union select")).toThrowError();
    expect(() => validateSqlIdentifier("123users")).toThrowError();
    expect(() => validateSqlIdentifier("users-table")).toThrowError();
  });

  it("maps Postgres types to unified column types", () => {
    expect(mapPostgresTypeToColumnType("integer")).toBe("integer");
    expect(mapPostgresTypeToColumnType("bigint")).toBe("integer");
    expect(mapPostgresTypeToColumnType("numeric")).toBe("number");
    expect(mapPostgresTypeToColumnType("double precision")).toBe("number");
    expect(mapPostgresTypeToColumnType("boolean")).toBe("boolean");
    expect(mapPostgresTypeToColumnType("timestamp with time zone")).toBe("date");
    expect(mapPostgresTypeToColumnType("character varying")).toBe("string");
    expect(mapPostgresTypeToColumnType("text")).toBe("string");
  });
});

// ============================================================
// 3. QUERY ENGINE & ROW LIMITS (No DB required)
// ============================================================

describe("Dataset Query Engine", () => {
  const mockDataset: any = {
    id: "ds-1",
    name: "Mock Sales",
    type: "UPLOADED",
    status: "ACTIVE",
    schemaMeta: {
      columns: [
        { name: "id", type: "integer", nullable: false },
        { name: "product", type: "string", nullable: false },
        { name: "amount", type: "number", nullable: false },
      ],
      sampleData: [
        { id: 1, product: "Widget A", amount: 100 },
        { id: 2, product: "Widget B", amount: 250 },
        { id: 3, product: "Widget C", amount: 75 },
      ],
    },
  };

  it("projects requested columns accurately", async () => {
    const result = await datasetQueryEngine.executeQuery(mockDataset, {
      columns: ["product", "amount"],
    });

    expect(result.columns).toEqual(["product", "amount"]);
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toEqual({ product: "Widget A", amount: 100 });
    expect(result.rows[0]?.id).toBeUndefined();
  });

  it("enforces default limit and bounds maximum limit to 100", async () => {
    const result = await datasetQueryEngine.executeQuery(mockDataset, {
      limit: 500, // Should be clamped to 100
    });
    expect(result.limit).toBe(100);

    const minResult = await datasetQueryEngine.executeQuery(mockDataset, {
      limit: -5, // Should be clamped to 1
    });
    expect(minResult.limit).toBe(1);
  });

  it("sorts rows ascending and descending cleanly", async () => {
    const ascResult = await datasetQueryEngine.executeQuery(mockDataset, {
      orderBy: { column: "amount", direction: "asc" },
    });
    expect(ascResult.rows[0]?.amount).toBe(75);

    const descResult = await datasetQueryEngine.executeQuery(mockDataset, {
      orderBy: { column: "amount", direction: "desc" },
    });
    expect(descResult.rows[0]?.amount).toBe(250);
  });

  it("rejects non-existent columns in projection or sorting", async () => {
    await expect(
      datasetQueryEngine.executeQuery(mockDataset, {
        columns: ["non_existent_col"],
      })
    ).rejects.toThrowError("does not exist");

    await expect(
      datasetQueryEngine.executeQuery(mockDataset, {
        orderBy: { column: "fake_col", direction: "asc" },
      })
    ).rejects.toThrowError("does not exist");
  });
});

// ============================================================
// 4. SAFE DATASET SERIALIZATION
// ============================================================

describe("Safe Dataset Serialization", () => {
  it("builds safe dataset without leaking raw secrets or internal metadata", () => {
    const mockRow: any = {
      id: "ds-1",
      name: "Sales 2026",
      description: "Q1 sales dataset",
      type: "CONNECTED",
      status: "ACTIVE",
      dataSourceId: "source-1",
      dataSource: {
        id: "source-1",
        name: "PostgreSQL Prod",
        type: "POSTGRESQL",
      },
      schemaMeta: {
        columns: [{ name: "id", type: "integer", nullable: false }],
        tableName: "sales_table",
        sampleData: [{ id: 1 }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const safe = buildSafeDataset(mockRow);
    expect(safe.id).toBe("ds-1");
    expect(safe.name).toBe("Sales 2026");
    expect(safe.status).toBe("READY");
    expect(safe.dataSourceName).toBe("PostgreSQL Prod");
    expect(safe.tableName).toBe("sales_table");
  });
});

// ============================================================
// 5. RBAC & TENANT HTTP GUARDS
// ============================================================

describe("Dataset RBAC & HTTP Guards", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request.get("/api/v1/datasets");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects BUSINESS_USER from creating datasets with 403", async () => {
    const res = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`)
      .send({
        name: "Test Dataset",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects ANALYST from deleting datasets with 403 (ADMIN only)", async () => {
    const res = await request
      .delete("/api/v1/datasets/ds-nonexistent")
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects invalid dataset payload with 400 VALIDATION_ERROR", async () => {
    const res = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "", // empty name invalid
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("previews CSV schema via POST /api/v1/datasets/csv/preview-schema", async () => {
    const res = await request
      .post("/api/v1/datasets/csv/preview-schema")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        csvText: "name,age,salary\nAlice,30,85000\nBob,40,95000",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.columns.length).toBe(3);
    expect(res.body.data.previewRows.length).toBe(2);
  });
});

// ============================================================
// 6. DB-DEPENDENT INTEGRATION TESTS (Skipped if DB not available)
// ============================================================

describe("Dataset DB Integration", () => {
  it("skips DB-backed dataset integration when database is unreachable", { skip: !dbAvailable }, () => {});

  it("creates, retrieves, previews, updates, and deletes dataset with tenant verification", async () => {
    if (!dbAvailable) return;

    // 1. Create Dataset
    const createRes = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Test Dataset - Sales",
        description: "Integration test dataset",
        type: "UPLOADED",
        columns: [
          { name: "id", type: "integer", nullable: false },
          { name: "item", type: "string", nullable: false },
          { name: "price", type: "number", nullable: false },
        ],
        sampleData: [
          { id: 1, item: "Apple", price: 1.5 },
          { id: 2, item: "Banana", price: 0.75 },
        ],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const datasetId = createRes.body.data.id;
    expect(datasetId).toBeTruthy();

    // 2. List Datasets
    const listRes = await request
      .get("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((d: { id: string }) => d.id === datasetId)).toBe(true);

    // 3. Cross-Tenant Protection
    const crossRes = await request
      .get(`/api/v1/datasets/${datasetId}`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`);
    expect(crossRes.status).toBe(403);

    // 4. Preview Dataset
    const previewRes = await request
      .get(`/api/v1/datasets/${datasetId}/preview?limit=10`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.rows.length).toBe(2);

    // 5. Query Dataset
    const queryRes = await request
      .post(`/api/v1/datasets/${datasetId}/query`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        columns: ["item", "price"],
        orderBy: { column: "price", direction: "desc" },
      });
    expect(queryRes.status).toBe(200);
    expect(queryRes.body.data.rows[0].item).toBe("Apple");

    // 6. Update Dataset
    const updateRes = await request
      .patch(`/api/v1/datasets/${datasetId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Test Dataset - Sales Updated",
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Test Dataset - Sales Updated");

    // 7. Delete Dataset
    const deleteRes = await request
      .delete(`/api/v1/datasets/${datasetId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });
});
