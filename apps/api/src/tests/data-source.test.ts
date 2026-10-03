// ========================================
// Data Source Integration & Unit Tests
// ========================================
// Tests Data Source CRUD, Connectors, Credential Security,
// RBAC, and Tenant Isolation.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { credentialService } from "../services/data-source/credential.service.js";
import {
  PostgresConnector,
  CsvConnector,
  XlsxConnector,
  JsonConnector,
  RestApiConnector,
  getConnector,
} from "../services/data-source/connectors/index.js";
import {
  buildSafeDataSource,
  createDataSourceSchema,
  updateDataSourceSchema,
} from "../services/data-source/data-source.service.js";

const app = createApp();
const request = supertest(app);

let dbAvailable = false;

// Mock user tokens
const ADMIN_ORG_ID = "org-test-admin-1";
const ADMIN_TOKEN = signAccessToken({
  sub: "user-admin-1",
  email: "admin@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "DATA_SOURCE_CREATE",
    "DATA_SOURCE_VIEW",
    "DATA_SOURCE_EDIT",
    "DATA_SOURCE_DELETE",
    "DATA_SOURCE_TEST",
  ],
});

const ANALYST_TOKEN = signAccessToken({
  sub: "user-analyst-1",
  email: "analyst@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-analyst",
  roleName: "ANALYST",
  permissions: [
    "DATA_SOURCE_CREATE",
    "DATA_SOURCE_VIEW",
    "DATA_SOURCE_EDIT",
    "DATA_SOURCE_TEST",
  ],
});

const BUSINESS_USER_TOKEN = signAccessToken({
  sub: "user-business-1",
  email: "business@ricozviz.test",
  organizationId: ADMIN_ORG_ID,
  roleId: "role-business",
  roleName: "BUSINESS_USER",
  permissions: ["DASHBOARD_VIEW", "DATASET_VIEW", "REPORT_VIEW"],
});

const OTHER_ORG_TOKEN = signAccessToken({
  sub: "user-other-org",
  email: "other@other-org.test",
  organizationId: "org-other-tenant-99",
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: [
    "DATA_SOURCE_CREATE",
    "DATA_SOURCE_VIEW",
    "DATA_SOURCE_EDIT",
    "DATA_SOURCE_DELETE",
    "DATA_SOURCE_TEST",
  ],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("⚠️  Database not available — DB-dependent data-source tests will be skipped.");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      await prisma.dataSource.deleteMany({
        where: { name: { startsWith: "Test DS" } },
      });
    } catch {
      // ignore cleanup errors
    }
  }
  await prisma.$disconnect();
});

// ============================================================
// 1. CONNECTOR ARCHITECTURE TESTS (No DB required)
// ============================================================

describe("Data Source Connectors", () => {
  it("getConnector returns the appropriate connector instance", () => {
    expect(getConnector("POSTGRESQL")).toBeInstanceOf(PostgresConnector);
    expect(getConnector("CSV")).toBeInstanceOf(CsvConnector);
    expect(getConnector("CSV_UPLOAD")).toBeInstanceOf(CsvConnector);
    expect(getConnector("XLSX")).toBeInstanceOf(XlsxConnector);
    expect(getConnector("JSON")).toBeInstanceOf(JsonConnector);
    expect(getConnector("REST_API")).toBeInstanceOf(RestApiConnector);
    expect(getConnector("UNKNOWN")).toBeNull();
  });

  describe("PostgresConnector", () => {
    const connector = new PostgresConnector();

    it("validates required connection fields", () => {
      const valid = connector.validateConfiguration({
        host: "localhost",
        port: 5432,
        database: "mydb",
        username: "pguser",
      });
      expect(valid.valid).toBe(true);

      const invalid = connector.validateConfiguration({
        host: "",
        port: 999999,
        database: "",
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.fieldErrors).toBeDefined();
      expect(invalid.fieldErrors?.host).toBeDefined();
      expect(invalid.fieldErrors?.port).toBeDefined();
      expect(invalid.fieldErrors?.database).toBeDefined();
      expect(invalid.fieldErrors?.username).toBeDefined();
    });

    it("handles connection failure safely without exposing sensitive info", async () => {
      // Point to an invalid unreachable port
      const result = await connector.testConnection(
        { host: "127.0.0.1", port: 59999, database: "testdb" },
        { password: "super-secret-password-never-leak" }
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe("FAILED");
      expect(result.message).not.toContain("super-secret-password-never-leak");
      expect(result.message).toBeTruthy();
    });
  });

  describe("CsvConnector", () => {
    const connector = new CsvConnector();

    it("validates CSV file name and delimiter", () => {
      expect(
        connector.validateConfiguration({ fileName: "sales.csv", delimiter: "," }).valid
      ).toBe(true);

      expect(
        connector.validateConfiguration({ fileName: "sales.txt" }).valid
      ).toBe(false);

      expect(
        connector.validateConfiguration({ fileName: "" }).valid
      ).toBe(false);
    });

    it("tests CSV source successfully", async () => {
      const result = await connector.testConnection({ fileName: "data.csv" });
      expect(result.success).toBe(true);
      expect(result.status).toBe("CONNECTED");
    });
  });

  describe("XlsxConnector", () => {
    const connector = new XlsxConnector();

    it("validates XLSX file name and sheet name", () => {
      expect(
        connector.validateConfiguration({ fileName: "financials.xlsx", sheetName: "Q3" }).valid
      ).toBe(true);

      expect(
        connector.validateConfiguration({ fileName: "report.xls" }).valid
      ).toBe(true);

      expect(
        connector.validateConfiguration({ fileName: "financials.pdf" }).valid
      ).toBe(false);

      expect(
        connector.validateConfiguration({ fileName: "" }).valid
      ).toBe(false);
    });

    it("tests XLSX source successfully", async () => {
      const result = await connector.testConnection({ fileName: "budget.xlsx", sheetName: "Summary" });
      expect(result.success).toBe(true);
      expect(result.status).toBe("CONNECTED");
    });
  });

  describe("JsonConnector", () => {
    const connector = new JsonConnector();

    it("validates JSON file name and data path", () => {
      expect(
        connector.validateConfiguration({ fileName: "events.json", dataPath: "items" }).valid
      ).toBe(true);

      expect(
        connector.validateConfiguration({ fileName: "events.xml" }).valid
      ).toBe(false);

      expect(
        connector.validateConfiguration({ fileName: "" }).valid
      ).toBe(false);
    });

    it("tests JSON source successfully", async () => {
      const result = await connector.testConnection({ fileName: "users.json" });
      expect(result.success).toBe(true);
      expect(result.status).toBe("CONNECTED");
    });
  });

  describe("RestApiConnector", () => {
    const connector = new RestApiConnector();

    it("validates valid and invalid URL formats", () => {
      expect(
        connector.validateConfiguration({ url: "https://api.example.com/v1" }).valid
      ).toBe(true);

      expect(
        connector.validateConfiguration({ url: "not-a-url" }).valid
      ).toBe(false);

      expect(
        connector.validateConfiguration({ url: "ftp://example.com" }).valid
      ).toBe(false);
    });

    it("handles unreachable API endpoints gracefully without leaking API keys", async () => {
      const result = await connector.testConnection(
        { url: "https://127.0.0.1:59999/test" },
        { apiKey: "secret_api_key_12345" }
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe("FAILED");
      expect(result.message).not.toContain("secret_api_key_12345");
    });
  });
});

// ============================================================
// 2. CREDENTIAL SERVICE TESTS (No DB required)
// ============================================================

describe("CredentialService (AES-256-GCM)", () => {
  it("encrypts and decrypts credentials accurately", async () => {
    const secrets = {
      password: "MySuperSecretPassword!",
      apiKey: "ak_live_xyz12345",
    };

    const ref = await credentialService.storeCredentials("org-1", secrets);
    expect(ref).toMatch(/^cred_[a-f0-9-]+$/);
    expect(ref).not.toContain("MySuperSecretPassword!");

    const retrieved = await credentialService.getCredentials(ref);
    expect(retrieved).toEqual(secrets);

    expect(await credentialService.hasCredentials(ref)).toBe(true);

    await credentialService.deleteCredentials(ref);
    expect(await credentialService.hasCredentials(ref)).toBe(false);
    expect(await credentialService.getCredentials(ref)).toBeNull();
  });
});

// ============================================================
// 3. SCHEMA VALIDATION TESTS (No DB required)
// ============================================================

describe("Data Source Schemas", () => {
  it("accepts valid PostgreSQL data source input", () => {
    const parsed = createDataSourceSchema.safeParse({
      name: "Analytics DB",
      type: "POSTGRESQL",
      connection: {
        host: "localhost",
        port: 5432,
        database: "analytics",
        username: "postgres",
        password: "secretpassword",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid CSV data source input", () => {
    const parsed = createDataSourceSchema.safeParse({
      name: "Q3 Sales CSV",
      type: "CSV",
      connection: {
        fileName: "q3_sales.csv",
        delimiter: ",",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid REST API data source input", () => {
    const parsed = createDataSourceSchema.safeParse({
      name: "Stripe API",
      type: "REST_API",
      connection: {
        url: "https://api.stripe.com/v1",
        method: "GET",
        apiKey: "sk_test_123",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing required connection fields", () => {
    const parsed = createDataSourceSchema.safeParse({
      name: "Incomplete Postgres",
      type: "POSTGRESQL",
      connection: {
        host: "localhost",
        // missing database & username
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("validates update schemas cleanly", () => {
    expect(
      updateDataSourceSchema.safeParse({ name: "Updated Name" }).success
    ).toBe(true);
    expect(
      updateDataSourceSchema.safeParse({ name: "" }).success
    ).toBe(false);
  });
});

// ============================================================
// 4. SAFE SERIALIZATION TESTS (No DB required)
// ============================================================

describe("Data Source Safe Serialization", () => {
  it("never includes passwords or secret keys in safe data source outputs", () => {
    const mockDbRow = {
      id: "ds-123",
      organizationId: "org-1",
      name: "Production DB",
      description: "Main DB",
      type: "POSTGRESQL" as const,
      status: "ACTIVE" as const,
      connectionMeta: {
        host: "db.internal.com",
        port: 5432,
        database: "proddb",
        username: "admin",
        password: "super-secret-password", // accidental leakage into connectionMeta
        apiKey: "leak-key",
      },
      credentialRef: "cred_abc-123",
      createdById: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const safe = buildSafeDataSource(mockDbRow);

    expect(safe.id).toBe("ds-123");
    expect(safe.name).toBe("Production DB");
    expect(safe.type).toBe("POSTGRESQL");
    expect(safe.status).toBe("CONNECTED");
    expect(safe.hasCredentials).toBe(true);

    const safeConn = safe.connection as Record<string, unknown>;
    expect(safeConn.host).toBe("db.internal.com");
    expect(safeConn.database).toBe("proddb");
    expect(safeConn.password).toBeUndefined();
    expect(safeConn.apiKey).toBeUndefined();
    expect(safeConn.token).toBeUndefined();
    expect(safeConn.secret).toBeUndefined();
  });
});

// ============================================================
// 5. RBAC & TENANCY VIA HTTP (Mocked tokens)
// ============================================================

describe("Data Source RBAC & Authentication HTTP Guards", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request.get("/api/v1/data-sources");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects BUSINESS_USER from creating data sources with 403", async () => {
    const res = await request
      .post("/api/v1/data-sources")
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`)
      .send({
        name: "Test DS",
        type: "POSTGRESQL",
        connection: {
          host: "localhost",
          port: 5432,
          database: "db",
          username: "user",
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects BUSINESS_USER from viewing data sources with 403", async () => {
    const res = await request
      .get("/api/v1/data-sources")
      .set("Authorization", `Bearer ${BUSINESS_USER_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects ANALYST from deleting data sources with 403 (ADMIN only)", async () => {
    const res = await request
      .delete("/api/v1/data-sources/ds-nonexistent")
      .set("Authorization", `Bearer ${ANALYST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects malformed payload with 400 VALIDATION_ERROR for ADMIN", async () => {
    const res = await request
      .post("/api/v1/data-sources")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "", // Invalid empty name
        type: "INVALID_TYPE",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ============================================================
// 6. DB-DEPENDENT INTEGRATION TESTS (Skipped if DB not available)
// ============================================================

describe("Data Source DB Integration", () => {
  it("skips DB-backed tests when database is unreachable", { skip: !dbAvailable }, () => {});

  it("creates, retrieves, updates, and deletes a data source with full isolation", async () => {
    if (!dbAvailable) return;

    // 1. Create Data Source
    const createRes = await request
      .post("/api/v1/data-sources")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Test DS - Postgres",
        type: "POSTGRESQL",
        connection: {
          host: "localhost",
          port: 5432,
          database: "test_db",
          username: "test_user",
          password: "my-test-password-123",
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const dsId = createRes.body.data.id;
    expect(dsId).toBeTruthy();
    expect(createRes.body.data.hasCredentials).toBe(true);
    expect(createRes.body.data.connection.password).toBeUndefined();

    // 2. List Data Sources
    const listRes = await request
      .get("/api/v1/data-sources")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((d: { id: string }) => d.id === dsId)).toBe(true);

    // 3. Cross-Tenant Protection: Other Org cannot view it
    const crossRes = await request
      .get(`/api/v1/data-sources/${dsId}`)
      .set("Authorization", `Bearer ${OTHER_ORG_TOKEN}`);
    expect(crossRes.status).toBe(403);

    // 4. Update Data Source
    const updateRes = await request
      .patch(`/api/v1/data-sources/${dsId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Test DS - Updated Name",
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Test DS - Updated Name");

    // 5. Test Connection
    const testConnRes = await request
      .post(`/api/v1/data-sources/${dsId}/test-connection`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(testConnRes.status).toBe(200);
    expect(testConnRes.body.success).toBeDefined();
    expect(testConnRes.body.data.status).toBeDefined();

    // 6. Delete Data Source
    const deleteRes = await request
      .delete(`/api/v1/data-sources/${dsId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 7. Verify Deleted
    const getDeletedRes = await request
      .get(`/api/v1/data-sources/${dsId}`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(getDeletedRes.status).toBe(404);
  });
});
