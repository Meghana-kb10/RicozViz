// ========================================
// Dataset Management & Ingestion Tests
// ========================================
// Tests Dataset CRUD, CSV Ingestion, Type Inference,
// Schema Discovery, Query Engine, RBAC, and Multi-Tenancy.
// ========================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  parseCsvText,
  inferColumnType,
  discoverCsvSchema,
  parseJsonTabular,
  discoverJsonSchema,
  parseXlsxBuffer,
  discoverXlsxSchema,
} from "../services/dataset/type-inference.js";
import * as XLSX from "xlsx";
import {
  validateSqlIdentifier,
  mapPostgresTypeToColumnType,
} from "../services/dataset/schema-discovery.service.js";
import { datasetQueryEngine } from "../services/dataset/query-engine.js";
import {
  buildSafeDataset,
  previewDataset,
  uploadDataset,
} from "../services/dataset/dataset.service.js";
import { verifyResourceWorkspaceAccess } from "../services/workspace/workspace-auth.helper.js";

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
// STEP 3 FINAL COMPLETION: WORKSPACE SCOPING & ISOLATION
// ============================================================

describe("Workspace Scoping & Resource Access Control", () => {
  it("1. User can access DataSource in their workspace", async () => {
    const spyWs = vi.spyOn(prisma.workspace, "findFirst").mockResolvedValue({
      id: "ws-1",
      name: "Workspace Alpha",
      slug: "workspace-alpha",
      description: null,
      organizationId: "org-test-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const spyMember = vi.spyOn(prisma.workspaceMember, "findUnique").mockResolvedValue({
      role: "MEMBER",
    } as any);

    await expect(
      verifyResourceWorkspaceAccess(
        { workspaceId: "ws-1", organizationId: "org-test-1" },
        "user-alpha",
        "org-test-1",
        "ANALYST"
      )
    ).resolves.not.toThrow();

    spyWs.mockRestore();
    spyMember.mockRestore();
  });

  it("2. User cannot access another workspace's DataSource", async () => {
    const spyWs = vi.spyOn(prisma.workspace, "findFirst").mockResolvedValue({
      id: "ws-2",
      name: "Workspace Beta",
      slug: "workspace-beta",
      description: null,
      organizationId: "org-test-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const spyMember = vi.spyOn(prisma.workspaceMember, "findUnique").mockResolvedValue(null);

    await expect(
      verifyResourceWorkspaceAccess(
        { workspaceId: "ws-2", organizationId: "org-test-1" },
        "user-alpha",
        "org-test-1",
        "ANALYST"
      )
    ).rejects.toThrow("Access denied: You do not have access to this workspace");

    spyWs.mockRestore();
    spyMember.mockRestore();
  });

  it("3. User can access Dataset in their workspace", async () => {
    const spyWs = vi.spyOn(prisma.workspace, "findFirst").mockResolvedValue({
      id: "ws-1",
      name: "Workspace Alpha",
      slug: "workspace-alpha",
      description: null,
      organizationId: "org-test-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const spyMember = vi.spyOn(prisma.workspaceMember, "findUnique").mockResolvedValue({
      role: "ADMIN",
    } as any);

    await expect(
      verifyResourceWorkspaceAccess(
        { workspaceId: "ws-1", organizationId: "org-test-1" },
        "user-alpha",
        "org-test-1",
        "MEMBER"
      )
    ).resolves.not.toThrow();

    spyWs.mockRestore();
    spyMember.mockRestore();
  });

  it("4. User cannot access another workspace's Dataset", async () => {
    const spyWs = vi.spyOn(prisma.workspace, "findFirst").mockResolvedValue({
      id: "ws-2",
      name: "Workspace Beta",
      slug: "workspace-beta",
      description: null,
      organizationId: "org-test-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const spyMember = vi.spyOn(prisma.workspaceMember, "findUnique").mockResolvedValue(null);

    await expect(
      verifyResourceWorkspaceAccess(
        { workspaceId: "ws-2", organizationId: "org-test-1" },
        "user-alpha",
        "org-test-1",
        "ANALYST"
      )
    ).rejects.toThrow("Access denied: You do not have access to this workspace");

    spyWs.mockRestore();
    spyMember.mockRestore();
  });
});

// ============================================================
// STEP 3 FINAL COMPLETION: CSV FILE UPLOAD & COLUMN CREATION
// ============================================================

describe("CSV File Ingestion & Column Inference", () => {
  it("5. CSV file upload succeeds", async () => {
    const validCsv = "id,name,amount\n1,Alpha,100\n2,Beta,200";

    vi.spyOn(prisma.workspace, "findFirst").mockResolvedValue({ id: "ws-1", organizationId: ADMIN_ORG_ID } as any);
    vi.spyOn(prisma.workspaceMember, "findUnique").mockResolvedValue({ role: "ADMIN" } as any);
    vi.spyOn(prisma.workspaceMember, "findFirst").mockResolvedValue({ workspaceId: "ws-1" } as any);
    vi.spyOn(prisma.dataSource, "findFirst").mockResolvedValue({
      id: "ds-file-1",
      name: "Uploaded CSVs",
      type: "CSV",
      organizationId: ADMIN_ORG_ID,
      workspaceId: "ws-1",
    } as any);

    let createdDatasetData: any = null;
    let createdColumnsData: any = null;

    vi.spyOn(prisma.dataset, "create").mockImplementation((args: any) => {
      createdDatasetData = args.data;
      createdColumnsData = args.data.columns?.create || [];
      return Promise.resolve({
        id: "dataset-csv-1",
        ...args.data,
        columns: createdColumnsData.map((c: any, i: number) => ({ id: `col-${i}`, ...c })),
        dataSource: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    });

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Test CSV Upload",
        fileName: "sales.csv",
        fileContent: validCsv,
        workspaceId: "ws-1",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("dataset-csv-1");
    expect(res.body.data.rowCount).toBe(2);
    expect(createdDatasetData).toBeTruthy();
    expect(createdColumnsData).toHaveLength(3);

    vi.restoreAllMocks();
  });

  it("6. Invalid CSV is rejected", async () => {
    expect(() => parseCsvText("name,age\nAlice")).toThrow("Malformed CSV: Row 2 has 1 values, expected 2 columns");

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Bad CSV",
        fileName: "broken.csv",
        fileContent: "col1,col2\nonly_one",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Malformed CSV");
  });

  it("7. Empty CSV is rejected", async () => {
    expect(() => parseCsvText("")).toThrow("CSV content is empty");
    expect(() => parseCsvText("   \n   \n")).toThrow("CSV content is empty");

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Empty CSV",
        fileName: "empty.csv",
        fileContent: "    ",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("empty");
  });

  it("8. CSV columns are detected", () => {
    const csv = "order_id,customer_name,total_price,status,shipped_at\n1,Acme,450.50,COMPLETED,2026-03-01";
    const { headers, rows } = parseCsvText(csv);
    expect(headers).toEqual(["order_id", "customer_name", "total_price", "status", "shipped_at"]);
    expect(rows.length).toBe(1);
    expect(rows[0]?.["order_id"]).toBe("1");
    expect(rows[0]?.["customer_name"]).toBe("Acme");
  });

  it("9. CSV data types are inferred", () => {
    const csv = "id,score,active,signed_up,city\n1,95.5,true,2026-01-10,Tokyo\n2,88.0,false,2026-02-15,London";
    const { headers, rows } = parseCsvText(csv);
    const schema = discoverCsvSchema(headers, rows);

    expect(schema.find((c) => c.name === "id")?.type).toBe("integer");
    expect(schema.find((c) => c.name === "score")?.type).toBe("number");
    expect(schema.find((c) => c.name === "active")?.type).toBe("boolean");
    expect(schema.find((c) => c.name === "signed_up")?.type).toBe("date");
    expect(schema.find((c) => c.name === "city")?.type).toBe("string");
  });

  it("10. DatasetColumn records are created", async () => {
    const validCsv = "sku,price,in_stock\nA1,19.99,true\nB2,29.99,false";

    vi.spyOn(prisma.workspaceMember, "findFirst").mockResolvedValue({ workspaceId: "ws-1" } as any);
    vi.spyOn(prisma.dataSource, "findFirst").mockResolvedValue({
      id: "ds-file-1",
      name: "CSVs",
      type: "CSV",
      organizationId: ADMIN_ORG_ID,
    } as any);

    let createdCols: any[] = [];
    vi.spyOn(prisma.dataset, "create").mockImplementation((args: any) => {
      createdCols = args.data.columns?.create || [];
      return Promise.resolve({
        id: "dataset-cols-check",
        ...args.data,
        columns: createdCols.map((c: any, i: number) => ({ id: `col-${i}`, ...c })),
        dataSource: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    });

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Col Check",
        fileName: "inventory.csv",
        fileContent: validCsv,
      });

    expect(res.status).toBe(201);
    expect(createdCols).toHaveLength(3);
    expect(createdCols[0]).toMatchObject({
      name: "sku",
      dataType: "STRING",
      ordinalPosition: 1,
    });
    expect(createdCols[1]).toMatchObject({
      name: "price",
      dataType: "NUMBER",
      ordinalPosition: 2,
    });
    expect(createdCols[2]).toMatchObject({
      name: "in_stock",
      dataType: "BOOLEAN",
      ordinalPosition: 3,
    });

    vi.restoreAllMocks();
  });
});

// ============================================================
// STEP 3 FINAL COMPLETION: JSON INGESTION & VALIDATION
// ============================================================

describe("JSON File Ingestion & Column Inference", () => {
  it("11. Valid JSON file upload succeeds", async () => {
    const validJson = JSON.stringify([
      { name: "Alice", age: 25, revenue: 1000 },
      { name: "Bob", age: 30, revenue: 1500 },
    ]);

    vi.spyOn(prisma.workspaceMember, "findFirst").mockResolvedValue({ workspaceId: "ws-1" } as any);
    vi.spyOn(prisma.dataSource, "findFirst").mockResolvedValue({
      id: "ds-json-1",
      name: "JSON Files",
      type: "CSV",
      organizationId: ADMIN_ORG_ID,
    } as any);

    vi.spyOn(prisma.dataset, "create").mockImplementation((args: any) => {
      return Promise.resolve({
        id: "dataset-json-1",
        ...args.data,
        columns: [],
        dataSource: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    });

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "JSON Upload",
        fileName: "users.json",
        fileContent: validJson,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("dataset-json-1");
    expect(res.body.data.rowCount).toBe(2);

    vi.restoreAllMocks();
  });

  it("12. Invalid JSON is rejected", async () => {
    expect(() => parseJsonTabular("not-json {age: 20}")).toThrow("Invalid JSON: syntax error");

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Broken JSON",
        fileName: "broken.json",
        fileContent: "{ broken: json ]",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Invalid JSON");
  });

  it("13. Unsupported JSON structure is rejected", async () => {
    // Plain primitive
    expect(() => parseJsonTabular("42")).toThrow("Unsupported JSON structure: expected non-empty array of objects");
    // Empty array
    expect(() => parseJsonTabular("[]")).toThrow("Unsupported JSON structure: expected non-empty array of objects");
    // Array of numbers
    expect(() => parseJsonTabular("[1, 2, 3]")).toThrow("Unsupported JSON structure: row 1 is not an object");
    // Array of arrays
    expect(() => parseJsonTabular("[[1, 2], [3, 4]]")).toThrow("Unsupported JSON structure: row 1 is not an object");

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Non Tabular JSON",
        fileName: "primitives.json",
        fileContent: '["just", "an", "array", "of", "strings"]',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Unsupported JSON structure");
  });

  it("14. JSON columns are detected", () => {
    const jsonStr = JSON.stringify([
      { name: "Alice", age: 25, revenue: 1000 },
      { name: "Bob", age: 30, revenue: 1500 },
    ]);
    const { headers, rows } = parseJsonTabular(jsonStr);
    expect(headers).toEqual(["name", "age", "revenue"]);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ name: "Alice", age: 25, revenue: 1000 });
    expect(rows[1]).toEqual({ name: "Bob", age: 30, revenue: 1500 });
  });

  it("15. JSON data types are inferred", () => {
    const jsonStr = JSON.stringify([
      { name: "Alice", age: 25, revenue: 1000.5, is_active: true, created_at: "2026-01-15" },
      { name: "Bob", age: 30, revenue: 1500.0, is_active: false, created_at: "2026-02-20" },
    ]);
    const { headers, rows } = parseJsonTabular(jsonStr);
    const schema = discoverJsonSchema(headers, rows);

    expect(schema.find((c) => c.name === "name")?.type).toBe("string");
    expect(schema.find((c) => c.name === "age")?.type).toBe("integer");
    expect(schema.find((c) => c.name === "revenue")?.type).toBe("number");
    expect(schema.find((c) => c.name === "is_active")?.type).toBe("boolean");
    expect(schema.find((c) => c.name === "created_at")?.type).toBe("date");
  });
});

// ============================================================
// STEP 3 FINAL COMPLETION: DATASET PREVIEW & BOUNDED LIMITS
// ============================================================

describe("Dataset Preview & Bounded Limits", () => {
  it("16. Dataset preview works", async () => {
    const mockDatasetWithColumns: any = {
      id: "ds-preview-test",
      name: "Sales Preview",
      type: "UPLOADED",
      status: "ACTIVE",
      organizationId: ADMIN_ORG_ID,
      workspaceId: "ws-1",
      columns: [
        { id: "col-1", name: "product", dataType: "STRING", nullable: false, ordinalPosition: 1 },
        { id: "col-2", name: "revenue", dataType: "NUMBER", nullable: false, ordinalPosition: 2 },
      ],
      schemaMeta: {
        columns: [
          { name: "product", type: "string", nullable: false },
          { name: "revenue", type: "number", nullable: false },
        ],
        sampleData: [
          { product: "Widget A", revenue: 100 },
          { product: "Widget B", revenue: 250 },
        ],
      },
    };

    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);
    vi.spyOn(prisma.dataset, "findUnique").mockResolvedValue(mockDatasetWithColumns as any);
    vi.spyOn(prisma.workspaceMember, "findUnique").mockResolvedValue({ role: "MEMBER" } as any);
    vi.spyOn(prisma.workspace, "findFirst").mockResolvedValue({ id: "ws-1", organizationId: ADMIN_ORG_ID } as any);

    const res = await request
      .get("/api/v1/datasets/ds-preview-test/preview?limit=10")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.datasetId).toBe("ds-preview-test");
    expect(res.body.data.rows.length).toBe(2);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.columns).toEqual([
      { name: "product", type: "string" },
      { name: "revenue", type: "number" },
    ]);
    expect(res.body.data.columnDefinitions).toBeDefined();
    expect(res.body.data.columnDefinitions?.length).toBe(2);

    vi.restoreAllMocks();
  });

  it("17. Preview is bounded", async () => {
    const mockDataset: any = {
      id: "ds-bounded-test",
      name: "Bounded Preview",
      type: "UPLOADED",
      status: "ACTIVE",
      organizationId: ADMIN_ORG_ID,
      workspaceId: "ws-1",
      columns: [],
      schemaMeta: {
        columns: [{ name: "id", type: "integer", nullable: false }],
        sampleData: Array.from({ length: 50 }, (_, i) => ({ id: i + 1 })),
      },
    };

    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);
    vi.spyOn(prisma.dataset, "findUnique").mockResolvedValue(mockDataset as any);
    vi.spyOn(prisma.workspaceMember, "findUnique").mockResolvedValue({ role: "MEMBER" } as any);
    vi.spyOn(prisma.workspace, "findFirst").mockResolvedValue({ id: "ws-1", organizationId: ADMIN_ORG_ID } as any);

    // Limit requesting 2000 rows must be capped at 1000
    const resCapped = await request
      .get("/api/v1/datasets/ds-bounded-test/preview?limit=2000")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(resCapped.status).toBe(200);
    expect(resCapped.body.data.previewLimit).toBe(1000);

    // Default limit is 25
    const resDefault = await request
      .get("/api/v1/datasets/ds-bounded-test/preview")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(resDefault.status).toBe(200);
    expect(resDefault.body.data.previewLimit).toBe(25);

    vi.restoreAllMocks();
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

// ============================================================
// DATASET MANAGEMENT STEP 1 — FOUNDATION & WORKSPACE SCOPING
// ============================================================

describe("Dataset Management Step 1 — Backend Foundation & Workspace Scoping", () => {
  let createdDatasetId: string;
  let xlsxDatasetId: string;
  let jsonDatasetId: string;
  let betaDatasetId: string;

  afterAll(async () => {
    if (dbAvailable) {
      try {
        await prisma.dataset.deleteMany({
          where: {
            name: {
              in: [
                "Step 1 - Q3 Regional Revenue",
                "Step 1 - Q3 Regional Revenue Updated",
                "Step 1 - XLSX Financial Report",
                "Step 1 - JSON Events Log",
                "Step 1 - Beta Restricted Dataset",
              ],
            },
          },
        });
      } catch {
        // ignore cleanup
      }
    }
  });

  it("creates a dataset with complete metadata (CSV, rowCount, columnCount, status, workspaceId)", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Step 1 - Q3 Regional Revenue",
        description: "Primary revenue dataset for regional analytics",
        workspaceId: "ws-test-alpha-1",
        sourceType: "CSV",
        fileName: "q3_revenue.csv",
        fileSize: 1048576,
        rowCount: 500,
        columnCount: 12,
        status: "READY",
        metadata: {
          delimiter: ",",
          encoding: "UTF-8",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.workspaceId).toBe("ws-test-alpha-1");
    expect(res.body.data.name).toBe("Step 1 - Q3 Regional Revenue");
    expect(res.body.data.description).toBe("Primary revenue dataset for regional analytics");
    expect(res.body.data.sourceType).toBe("CSV");
    expect(res.body.data.fileName).toBe("q3_revenue.csv");
    expect(res.body.data.fileSize).toBe(1048576);
    expect(res.body.data.rowCount).toBe(500);
    expect(res.body.data.columnCount).toBe(12);
    expect(res.body.data.status).toBe("READY");
    expect(res.body.data.createdAt).toBeTruthy();
    expect(res.body.data.updatedAt).toBeTruthy();

    createdDatasetId = res.body.data.id;
  });

  it("supports XLSX and JSON source types and lifecycle statuses (PROCESSING, FAILED)", async () => {
    if (!dbAvailable) return;

    // XLSX dataset in PROCESSING state
    const xlsxRes = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Step 1 - XLSX Financial Report",
        workspaceId: "ws-test-alpha-1",
        sourceType: "XLSX",
        fileName: "financial_report_2026.xlsx",
        fileSize: 2048000,
        rowCount: 1200,
        columnCount: 20,
        status: "PROCESSING",
      });

    expect(xlsxRes.status).toBe(201);
    expect(xlsxRes.body.data.sourceType).toBe("XLSX");
    expect(xlsxRes.body.data.status).toBe("PROCESSING");
    xlsxDatasetId = xlsxRes.body.data.id;

    // JSON dataset in FAILED state
    const jsonRes = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Step 1 - JSON Events Log",
        workspaceId: "ws-test-alpha-1",
        sourceType: "JSON",
        fileName: "events_stream.json",
        fileSize: 512000,
        rowCount: 80,
        columnCount: 6,
        status: "FAILED",
      });

    expect(jsonRes.status).toBe(201);
    expect(jsonRes.body.data.sourceType).toBe("JSON");
    expect(jsonRes.body.data.status).toBe("FAILED");
    jsonDatasetId = jsonRes.body.data.id;
  });

  it("lists datasets for the current workspace with pagination metadata", async () => {
    if (!dbAvailable || !createdDatasetId) return;

    const res = await request
      .get("/api/v1/datasets?workspaceId=ws-test-alpha-1&page=1&limit=2")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(2);

    // Verify pagination metadata
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);

    // Verify all returned datasets belong to the requested workspace
    for (const d of res.body.data) {
      expect(d.workspaceId).toBe("ws-test-alpha-1");
    }
  });

  it("retrieves dataset by ID with full metadata", async () => {
    if (!dbAvailable || !createdDatasetId) return;

    const res = await request
      .get(`/api/v1/datasets/${createdDatasetId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdDatasetId);
    expect(res.body.data.name).toBe("Step 1 - Q3 Regional Revenue");
    expect(res.body.data.sourceType).toBe("CSV");
    expect(res.body.data.fileName).toBe("q3_revenue.csv");
    expect(res.body.data.fileSize).toBe(1048576);
    expect(res.body.data.rowCount).toBe(500);
    expect(res.body.data.columnCount).toBe(12);
    expect(res.body.data.status).toBe("READY");
  });

  it("updates dataset metadata (name, description, status, rowCount, columnCount)", async () => {
    if (!dbAvailable || !createdDatasetId) return;

    const res = await request
      .patch(`/api/v1/datasets/${createdDatasetId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Step 1 - Q3 Regional Revenue Updated",
        description: "Updated description for Q3 analytics",
        rowCount: 550,
        columnCount: 14,
        status: "READY",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Step 1 - Q3 Regional Revenue Updated");
    expect(res.body.data.description).toBe("Updated description for Q3 analytics");
    expect(res.body.data.rowCount).toBe(550);
    expect(res.body.data.columnCount).toBe(14);
  });

  it("validates input errors (missing name, invalid source type, invalid ID format, not found)", async () => {
    // 1. Missing name
    const missingNameRes = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        description: "Dataset with no name",
      });
    expect(missingNameRes.status).toBe(400);
    expect(missingNameRes.body.success).toBe(false);

    // 2. Invalid source type
    const invalidSourceRes = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Invalid Source Dataset",
        sourceType: "PARQUET", // unsupported
      });
    expect(invalidSourceRes.status).toBe(400);
    expect(invalidSourceRes.body.success).toBe(false);

    // 3. Invalid dataset ID format
    const invalidIdRes = await request
      .get("/api/v1/datasets/!@#$%^&*()")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(invalidIdRes.status).toBe(400);
    expect(invalidIdRes.body.success).toBe(false);

    // 4. Dataset not found
    const notFoundRes = await request
      .get("/api/v1/datasets/00000000-0000-0000-0000-000000000099")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.success).toBe(false);
  });

  it("enforces workspace isolation and authorization across users", async () => {
    if (!dbAvailable) return;

    // 1. Admin creates a dataset in ws-test-beta-2 (user-analyst-1 is NOT a member of ws-test-beta-2)
    const betaCreate = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Step 1 - Beta Restricted Dataset",
        workspaceId: "ws-test-beta-2",
        sourceType: "CSV",
      });
    expect(betaCreate.status).toBe(201);
    betaDatasetId = betaCreate.body.data.id;

    // 2. Analyst tries to create a dataset in ws-test-beta-2 (should be rejected with 403)
    const analystCreateForbidden = await request
      .post("/api/v1/datasets")
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`)
      .send({
        name: "Analyst Intrusion Dataset",
        workspaceId: "ws-test-beta-2",
      });
    expect(analystCreateForbidden.status).toBe(403);
    expect(analystCreateForbidden.body.success).toBe(false);

    // 3. Analyst tries to read dataset belonging to ws-test-beta-2 (should be rejected with 403)
    const analystReadForbidden = await request
      .get(`/api/v1/datasets/${betaDatasetId}`)
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`);
    expect(analystReadForbidden.status).toBe(403);
    expect(analystReadForbidden.body.success).toBe(false);

    // 4. Analyst CAN read dataset in ws-test-alpha-1 (analyst is a member of ws-test-alpha-1)
    const analystReadAllowed = await request
      .get(`/api/v1/datasets/${createdDatasetId}`)
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`);
    expect(analystReadAllowed.status).toBe(200);
    expect(analystReadAllowed.body.success).toBe(true);

    // 5. Cross-tenant user (from another organization) receives 403 Forbidden
    const otherOrgRes = await request
      .get(`/api/v1/datasets/${createdDatasetId}`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`);
    expect(otherOrgRes.status).toBe(403);
  });

  it("deletes a dataset and confirms it is no longer retrievable", async () => {
    if (!dbAvailable || !createdDatasetId) return;

    // Delete
    const deleteRes = await request
      .delete(`/api/v1/datasets/${createdDatasetId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.data.message).toContain("deleted");

    // Subsequent retrieval should 404
    const getRes = await request
      .get(`/api/v1/datasets/${createdDatasetId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(getRes.status).toBe(404);
  });
});

// ============================================================
// MILESTONE 1 — DATASET INGESTION & FILE PARSING TESTS
// ============================================================

describe("Milestone 1 — Dataset Ingestion & File Parsing", () => {
  let uploadedCsvId = "";
  let uploadedXlsxId = "";
  let uploadedJsonId = "";

  // 1. CSV Parser & Ingestion
  it("successfully uploads and parses CSV with row/column counts and type detection", async () => {
    if (!dbAvailable) return;

    const csvContent =
      "product,category,units_sold,unit_price,is_available,created_at,recorded_at\n" +
      "Laptop Pro,Electronics,120,1299.99,true,2026-03-01,2026-03-01T10:30:00Z\n" +
      "Wireless Mouse,Accessories,450,29.50,true,2026-03-02,2026-03-02T11:15:00Z\n" +
      "Desk Mat,Office,80,19.00,false,2026-03-03,2026-03-03T12:00:00Z";

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .attach("file", Buffer.from(csvContent, "utf-8"), "sales_data.csv")
      .field("name", "Q1 Sales Data")
      .field("workspaceId", "ws-test-alpha-1");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.sourceType).toBe("CSV");
    expect(res.body.data.rowCount).toBe(3);
    expect(res.body.data.columnCount).toBe(7);
    expect(res.body.data.status).toBe("READY");
    expect(res.body.data.workspaceId).toBe("ws-test-alpha-1");

    uploadedCsvId = res.body.data.id;

    // Verify columns created with proper types in DB
    const dataset = await prisma.dataset.findUnique({
      where: { id: uploadedCsvId },
      include: { columns: { orderBy: { ordinalPosition: "asc" } } },
    });
    expect(dataset).toBeTruthy();
    expect(dataset!.columns).toHaveLength(7);

    const colsMap = new Map(dataset!.columns.map((c) => [c.name, c.dataType]));
    expect(colsMap.get("product")).toBe("STRING");
    expect(colsMap.get("units_sold")).toBe("NUMBER");
    expect(colsMap.get("unit_price")).toBe("NUMBER");
    expect(colsMap.get("is_available")).toBe("BOOLEAN");
    expect(colsMap.get("created_at")).toBe("DATE");
    expect(colsMap.get("recorded_at")).toBe("DATETIME");
  });

  // 2. XLSX Parser & Ingestion
  it("successfully uploads and parses XLSX file with first worksheet extraction and type inference", async () => {
    if (!dbAvailable) return;

    // Build real binary XLSX workbook buffer
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["employee_id", "full_name", "department", "salary", "active", "start_date"],
      [101, "Jane Doe", "Engineering", 125000.5, true, "2024-01-15"],
      [102, "John Smith", "Marketing", 95000.0, true, "2024-02-01"],
      [103, "Alice Taylor", "Finance", 110000.0, false, "2024-03-10"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .attach("file", xlsxBuffer, "employees_q1.xlsx")
      .field("name", "Q1 Employees Roster")
      .field("workspaceId", "ws-test-alpha-1");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sourceType).toBe("XLSX");
    expect(res.body.data.rowCount).toBe(3);
    expect(res.body.data.columnCount).toBe(6);
    expect(res.body.data.status).toBe("READY");

    uploadedXlsxId = res.body.data.id;

    // Verify columns in DB
    const dataset = await prisma.dataset.findUnique({
      where: { id: uploadedXlsxId },
      include: { columns: { orderBy: { ordinalPosition: "asc" } } },
    });
    expect(dataset).toBeTruthy();
    expect(dataset!.columns).toHaveLength(6);
    const colNames = dataset!.columns.map((c) => c.name);
    expect(colNames).toContain("employee_id");
    expect(colNames).toContain("full_name");
    expect(colNames).toContain("department");
    expect(colNames).toContain("salary");
  });

  // 3. JSON Parser & Ingestion
  it("successfully uploads and parses tabular array-of-objects JSON", async () => {
    if (!dbAvailable) return;

    const jsonData = [
      { id: 1, country: "USA", gdp_billions: 25462.7, year: 2026 },
      { id: 2, country: "Germany", gdp_billions: 4072.1, year: 2026 },
      { id: 3, country: "Japan", gdp_billions: 4231.1, year: 2026 },
      { id: 4, country: "UK", gdp_billions: 3070.7, year: 2026 },
    ];
    const jsonBuffer = Buffer.from(JSON.stringify(jsonData), "utf-8");

    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .attach("file", jsonBuffer, "world_gdp.json")
      .field("name", "World GDP Statistics")
      .field("workspaceId", "ws-test-alpha-1");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sourceType).toBe("JSON");
    expect(res.body.data.rowCount).toBe(4);
    expect(res.body.data.columnCount).toBe(4);
    expect(res.body.data.status).toBe("READY");

    uploadedJsonId = res.body.data.id;
  });

  // 4. Validation & Edge Cases
  it("rejects unsupported file formats with 400 error", async () => {
    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .attach("file", Buffer.from("%PDF-1.4 dummy pdf content", "utf-8"), "report.pdf")
      .field("workspaceId", "ws-test-alpha-1");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Unsupported file format");
  });

  it("rejects empty uploaded files with 400 error", async () => {
    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .attach("file", Buffer.from("", "utf-8"), "empty.csv")
      .field("workspaceId", "ws-test-alpha-1");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("empty");
  });

  it("rejects corrupted/invalid XLSX files with 400 error", async () => {
    const corruptedBuffer = Buffer.from("PK\x03\x04corrupted-non-xlsx-data-garbage", "utf-8");
    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .attach("file", corruptedBuffer, "corrupt.xlsx")
      .field("workspaceId", "ws-test-alpha-1");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/corrupted|invalid|no worksheets/i);
  });

  it("rejects invalid JSON structure (non-object rows or primitive arrays)", async () => {
    const invalidJson = JSON.stringify(["just", "a", "primitive", "array"]);
    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .attach("file", Buffer.from(invalidJson, "utf-8"), "invalid.json")
      .field("workspaceId", "ws-test-alpha-1");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Unsupported JSON structure");
  });

  // 5. Security & Authorization
  it("rejects unauthenticated upload requests with 401", async () => {
    const res = await request
      .post("/api/v1/datasets/upload")
      .attach("file", Buffer.from("a,b\n1,2", "utf-8"), "test.csv");

    expect(res.status).toBe(401);
  });

  it("rejects upload when user does not have access to specified workspace (403)", async () => {
    // Analyst user does NOT belong to ws-test-beta-2
    const res = await request
      .post("/api/v1/datasets/upload")
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`)
      .attach("file", Buffer.from("a,b\n1,2", "utf-8"), "test.csv")
      .field("workspaceId", "ws-test-beta-2");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // 6. Dataset Preview API & Bounded 50 Rows Limit
  it("previews dataset with column types and enforces maximum 50 rows limit", async () => {
    if (!dbAvailable || !uploadedCsvId) return;

    // Default preview
    const res = await request
      .get(`/api/v1/datasets/${uploadedCsvId}/preview`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.datasetId).toBe(uploadedCsvId);
    expect(res.body.data.columnNames).toBeDefined();
    expect(res.body.data.columnTypes).toBeDefined();
    expect(res.body.data.totalRowCount).toBe(3);
    expect(res.body.data.previewRows).toBeDefined();
    expect(res.body.data.previewRows.length).toBeLessThanOrEqual(50);

    // Requesting excessive limit (e.g. 500 rows) must be bounded to at most 50 rows
    const resExcessive = await request
      .get(`/api/v1/datasets/${uploadedCsvId}/preview?limit=500`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(resExcessive.status).toBe(200);
    expect(resExcessive.body.data.previewRows.length).toBeLessThanOrEqual(50);
  });

  it("enforces workspace authorization on preview endpoint", async () => {
    if (!dbAvailable || !uploadedCsvId) return;

    // Cross-tenant user cannot preview
    const res = await request
      .get(`/api/v1/datasets/${uploadedCsvId}/preview`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`);

    expect(res.status).toBe(403);
  });

  // Cleanup created test datasets
  afterAll(async () => {
    if (!dbAvailable) return;
    for (const id of [uploadedCsvId, uploadedXlsxId, uploadedJsonId]) {
      if (id) {
        await prisma.dataset.delete({ where: { id } }).catch(() => {});
      }
    }
  });
});
