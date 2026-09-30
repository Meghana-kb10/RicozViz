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
        { name: "category", type: "string", nullable: false },
        { name: "amount", type: "number", nullable: false },
        { name: "quantity", type: "integer", nullable: false },
        { name: "is_active", type: "boolean", nullable: false },
        { name: "notes", type: "string", nullable: true },
      ],
      sampleData: [
        { id: 1, product: "Widget A", category: "Hardware", amount: 100, quantity: 5, is_active: true, notes: "Popular" },
        { id: 2, product: "Widget B", category: "Hardware", amount: 250, quantity: 2, is_active: true, notes: null },
        { id: 3, product: "SaaS Pro", category: "Software", amount: 75, quantity: 10, is_active: false, notes: "Discounted" },
        { id: 4, product: "SaaS Enterprise", category: "Software", amount: 500, quantity: 1, is_active: true, notes: "Annual" },
      ],
    },
  };

  // ---- Basic Querying ----
  it("projects requested columns accurately with column metadata", async () => {
    const result = await datasetQueryEngine.executeQuery(mockDataset, {
      columns: ["product", "amount"],
    });

    expect(result.columns).toEqual([
      { name: "product", type: "string" },
      { name: "amount", type: "number" },
    ]);
    expect(result.rows.length).toBe(4);
    expect(result.rows[0]).toEqual({ product: "Widget A", amount: 100 });
    expect(result.rows[0]?.id).toBeUndefined();
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("enforces default limit and bounds maximum limit to 1000", async () => {
    const defaultRes = await datasetQueryEngine.executeQuery(mockDataset);
    expect(defaultRes.limit).toBe(100);

    const boundedRes = await datasetQueryEngine.executeQuery(mockDataset, {
      limit: 500,
    });
    expect(boundedRes.limit).toBe(500);

    await expect(
      datasetQueryEngine.executeQuery(mockDataset, { limit: 1500 })
    ).rejects.toThrowError("exceeds maximum allowable limit");
  });

  it("sorts rows ascending and descending cleanly", async () => {
    const ascResult = await datasetQueryEngine.executeQuery(mockDataset, {
      orderBy: { column: "amount", direction: "asc" },
    });
    expect(ascResult.rows[0]?.amount).toBe(75);

    const descResult = await datasetQueryEngine.executeQuery(mockDataset, {
      orderBy: { column: "amount", direction: "desc" },
    });
    expect(descResult.rows[0]?.amount).toBe(500);
  });

  it("paginates rows using offset and limit", async () => {
    const paged = await datasetQueryEngine.executeQuery(mockDataset, {
      offset: 1,
      limit: 2,
    });
    expect(paged.rows.length).toBe(2);
    expect(paged.offset).toBe(1);
    expect(paged.limit).toBe(2);
    expect(paged.total).toBe(4);
  });

  // ---- Filtering Tests ----
  it("filters with equality (=) and inequality (!=)", async () => {
    const eqResult = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "category", operator: "=", value: "Hardware" }],
    });
    expect(eqResult.rows.length).toBe(2);
    expect(eqResult.rows.every((r) => r.category === "Hardware")).toBe(true);

    const neqResult = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "category", operator: "!=", value: "Hardware" }],
    });
    expect(neqResult.rows.length).toBe(2);
    expect(neqResult.rows.every((r) => r.category === "Software")).toBe(true);
  });

  it("filters with greater than (>) and less than (<)", async () => {
    const gtResult = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "amount", operator: ">", value: 100 }],
    });
    expect(gtResult.rows.length).toBe(2); // 250, 500

    const ltResult = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "amount", operator: "<", value: 100 }],
    });
    expect(ltResult.rows.length).toBe(1); // 75
  });

  it("filters with text matching (contains, startsWith, endsWith)", async () => {
    const containsRes = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "product", operator: "contains", value: "SaaS" }],
    });
    expect(containsRes.rows.length).toBe(2);

    const startsRes = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "product", operator: "startsWith", value: "Widget" }],
    });
    expect(startsRes.rows.length).toBe(2);

    const endsRes = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "product", operator: "endsWith", value: "Pro" }],
    });
    expect(endsRes.rows.length).toBe(1);
    expect(endsRes.rows[0]?.product).toBe("SaaS Pro");
  });

  it("filters with isNull and isNotNull", async () => {
    const isNullRes = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "notes", operator: "isNull" }],
    });
    expect(isNullRes.rows.length).toBe(1);
    expect(isNullRes.rows[0]?.product).toBe("Widget B");

    const isNotNullRes = await datasetQueryEngine.executeQuery(mockDataset, {
      filters: [{ column: "notes", operator: "isNotNull" }],
    });
    expect(isNotNullRes.rows.length).toBe(3);
  });

  it("combines filters with AND logic and OR logic", async () => {
    const andRes = await datasetQueryEngine.executeQuery(mockDataset, {
      filterLogic: "AND",
      filters: [
        { column: "category", operator: "=", value: "Hardware" },
        { column: "amount", operator: ">", value: 150 },
      ],
    });
    expect(andRes.rows.length).toBe(1);
    expect(andRes.rows[0]?.product).toBe("Widget B");

    const orRes = await datasetQueryEngine.executeQuery(mockDataset, {
      filterLogic: "OR",
      filters: [
        { column: "product", operator: "=", value: "Widget A" },
        { column: "category", operator: "=", value: "Software" },
      ],
    });
    expect(orRes.rows.length).toBe(3);
  });

  // ---- Aggregation & Group By Tests ----
  it("aggregates data using COUNT, SUM, AVG, MIN, MAX grouped by dimension", async () => {
    const aggResult = await datasetQueryEngine.executeQuery(mockDataset, {
      dimensions: ["category"],
      measures: [
        { column: "amount", aggregation: "SUM", alias: "total_amount" },
        { column: "amount", aggregation: "AVG", alias: "avg_amount" },
        { column: "quantity", aggregation: "COUNT", alias: "count_orders" },
        { column: "amount", aggregation: "MIN", alias: "min_amount" },
        { column: "amount", aggregation: "MAX", alias: "max_amount" },
      ],
    });

    expect(aggResult.columns.map((c) => c.name)).toEqual([
      "category",
      "total_amount",
      "avg_amount",
      "count_orders",
      "min_amount",
      "max_amount",
    ]);
    expect(aggResult.rows.length).toBe(2);

    const hardware = aggResult.rows.find((r) => r.category === "Hardware")!;
    expect(hardware.total_amount).toBe(350); // 100 + 250
    expect(hardware.avg_amount).toBe(175);
    expect(hardware.count_orders).toBe(2);
    expect(hardware.min_amount).toBe(100);
    expect(hardware.max_amount).toBe(250);

    const software = aggResult.rows.find((r) => r.category === "Software")!;
    expect(software.total_amount).toBe(575); // 75 + 500
  });

  it("supports overall grand total aggregation without dimensions", async () => {
    const totalResult = await datasetQueryEngine.executeQuery(mockDataset, {
      measures: [
        { column: "amount", aggregation: "SUM", alias: "grand_total" },
        { column: "*", aggregation: "COUNT", alias: "total_items" },
      ],
    });

    expect(totalResult.rows.length).toBe(1);
    expect(totalResult.rows[0]?.grand_total).toBe(925);
    expect(totalResult.rows[0]?.total_items).toBe(4);
  });

  // ---- Security & Validation Tests ----
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

  it("rejects invalid SQL injection identifiers in column names", async () => {
    await expect(
      datasetQueryEngine.executeQuery(mockDataset, {
        columns: ["id; DROP TABLE users;--"],
      })
    ).rejects.toThrowError();
  });

  it("rejects invalid filter values for typed columns", async () => {
    await expect(
      datasetQueryEngine.executeQuery(mockDataset, {
        filters: [{ column: "quantity", operator: "=", value: "not-an-integer" }],
      })
    ).rejects.toThrowError("must be a valid integer");

    await expect(
      datasetQueryEngine.executeQuery(mockDataset, {
        filters: [{ column: "amount", operator: "=", value: "abc" }],
      })
    ).rejects.toThrowError("must be a valid number");
  });

  it("rejects SUM or AVG aggregations on non-numeric columns", async () => {
    await expect(
      datasetQueryEngine.executeQuery(mockDataset, {
        measures: [{ column: "product", aggregation: "SUM" }],
      })
    ).rejects.toThrowError("cannot be applied to non-numeric column");
  });

  it("rejects excessive filters exceeding limit", async () => {
    const manyFilters: any[] = [];
    for (let i = 0; i < 25; i++) {
      manyFilters.push({ column: "product", operator: "=", value: "Widget" });
    }
    await expect(
      datasetQueryEngine.executeQuery(mockDataset, {
        filters: manyFilters,
      })
    ).rejects.toThrowError("exceeds maximum allowable");
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
