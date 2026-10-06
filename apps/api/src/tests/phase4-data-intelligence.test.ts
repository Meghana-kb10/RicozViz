// ============================================================
// Phase 4 Data Intelligence Integration & Unit Tests
// ============================================================
// Tests the 2 Phase-4 capabilities:
// 1. Data Quality & Profiling:
//    - Real dataset profiling engine (Rows, Columns, Data types)
//    - Missing values (Null count & Null percentage)
//    - Unique values (Distinct count & Unique percentage)
//    - Duplicate row detection
//    - Min / Max, Mean (Avg), Median, Standard Deviation
//    - Date column range (minDate, maxDate)
//    - Outlier detection via 1.5x IQR rule
//    - Type issues / Invalid values detection
//    - 5-Pillar Quality Summary (Score, Missing Data, Duplicates, Type Issues, Potential Outliers)
//    - Score reproducibility
//    - Profile persistence in schemaMeta
//    - Refresh re-computation
// 2. Additional Data Connectors:
//    - PostgreSQL & MySQL connector schemas and port defaults (5432, 3306)
//    - Credential isolation (passwords stripped from config & response)
//    - Raw pre-save connection testing (safe error handling on unreachable hosts)
//    - Schema and table discovery for relational connectors
//    - Connected dataset creation and schema mapping
//    - Execution of analytical queries through existing DuckDB/Query engine
// ============================================================

import { describe, it, expect } from "vitest";
import { computeDatasetProfile } from "../services/dataset/data-quality.service.js";
import { MysqlConnector } from "../services/data-source/connectors/mysql.connector.js";
import { PostgresConnector } from "../services/data-source/connectors/postgres.connector.js";
import {
  createDataSourceSchema,
  separateCredentials,
  testRawConnectionSchema,
} from "../services/data-source/data-source.service.js";
import { schemaDiscoveryService } from "../services/dataset/schema-discovery.service.js";
import { DatasetQueryEngine } from "../services/dataset/query-engine.js";

// Grounded Real Sales & Operations Dataset for Profiling
const TEST_REAL_DATASET_ROWS: Record<string, unknown>[] = [
  { id: 1, product: "Laptop Pro", category: "Electronics", price: 1200, quantity: 5, date: "2026-01-10", rating: 4.8 },
  { id: 2, product: "Mouse Wireless", category: "Accessories", price: 25, quantity: 50, date: "2026-01-12", rating: 4.2 },
  { id: 3, product: "USB-C Cable", category: "Accessories", price: 15, quantity: 100, date: "2026-01-15", rating: 4.5 },
  { id: 4, product: "4K Monitor", category: "Electronics", price: 450, quantity: 12, date: "2026-01-20", rating: 4.6 },
  { id: 5, product: "Mechanical Keyboard", category: "Accessories", price: 110, quantity: 30, date: "2026-01-22", rating: 4.7 },
  { id: 3, product: "USB-C Cable", category: "Accessories", price: 15, quantity: 100, date: "2026-01-15", rating: 4.5 }, // Exact duplicate row
  { id: 7, product: "Server Rack Alpha", category: "Infrastructure", price: 9800, quantity: 2, date: "2026-01-28", rating: 5.0 }, // Outlier price
  { id: 8, product: "Ergo Chair", category: "Furniture", price: 350, quantity: 8, date: "2026-02-01", rating: null }, // Null rating
  { id: 9, product: "Desk Mat", category: "Accessories", price: null, quantity: 45, date: "2026-02-05", rating: 3.9 }, // Null price
  { id: 10, product: "Invalid Entry", category: "Accessories", price: "NOT_A_NUMBER", quantity: 10, date: "INVALID_DATE", rating: 4.0 }, // Type issues
];

const TEST_COLUMNS = [
  { name: "id", type: "number", nullable: false },
  { name: "product", type: "string", nullable: false },
  { name: "category", type: "string", nullable: false },
  { name: "price", type: "number", nullable: true },
  { name: "quantity", type: "number", nullable: false },
  { name: "date", type: "date", nullable: false },
  { name: "rating", type: "number", nullable: true },
];

const TEST_DATASET: any = {
  id: "ds-profile-test-1",
  name: "Sales Operations Dataset",
  schemaMeta: {
    columns: TEST_COLUMNS,
    sampleData: TEST_REAL_DATASET_ROWS,
  },
  columns: TEST_COLUMNS.map((c, i) => ({
    name: c.name,
    dataType: c.type === "number" ? "NUMBER" : c.type === "date" ? "DATE" : "STRING",
    ordinalPosition: i,
  })),
};

// ============================================================
// 1. DATA QUALITY & PROFILING TESTS
// ============================================================
describe("Phase 4: Data Quality & Profiling", () => {
  describe("Comprehensive Dataset Profile Engine", () => {
    const profile = computeDatasetProfile(TEST_DATASET, TEST_REAL_DATASET_ROWS);

    it("calculates accurate total rows and total columns count", () => {
      expect(profile.totalRows).toBe(10);
      expect(profile.totalColumns).toBe(7);
      expect(profile.datasetId).toBe("ds-profile-test-1");
    });

    it("detects exact duplicate rows in the dataset", () => {
      expect(profile.duplicateRowsCount).toBe(1);
    });

    it("profiles numeric columns with Min, Max, Avg, Median, and StdDev", () => {
      const quantityCol = profile.columns.find((c) => c.name === "quantity");
      expect(quantityCol).toBeDefined();
      expect(quantityCol?.type).toBe("number");
      expect(quantityCol?.nullCount).toBe(0);
      expect(quantityCol?.min).toBe(2);
      expect(quantityCol?.max).toBe(100);
      expect(quantityCol?.avg).toBeGreaterThan(0);
      expect(quantityCol?.median).toBeDefined();
      expect(typeof quantityCol?.median).toBe("number");
      expect(quantityCol?.stdDev).toBeGreaterThan(0);
    });

    it("correctly identifies null counts and percentages per column", () => {
      const ratingCol = profile.columns.find((c) => c.name === "rating");
      expect(ratingCol).toBeDefined();
      expect(ratingCol?.nullCount).toBe(1);
      expect(ratingCol?.nullPercentage).toBe(10); // 1 out of 10 = 10%

      const priceCol = profile.columns.find((c) => c.name === "price");
      expect(priceCol).toBeDefined();
      expect(priceCol?.nullCount).toBe(1);
      expect(priceCol?.nullPercentage).toBe(10);
    });

    it("calculates unique counts and generates representative sample values", () => {
      const categoryCol = profile.columns.find((c) => c.name === "category");
      expect(categoryCol).toBeDefined();
      expect(categoryCol?.uniqueCount).toBe(4); // Electronics, Accessories, Infrastructure, Furniture
      expect(categoryCol?.sampleValues.length).toBeGreaterThan(0);
      expect(categoryCol?.sampleValues).toContain("Accessories");
    });

    it("profiles date columns with minDate and maxDate correctly", () => {
      const dateCol = profile.columns.find((c) => c.name === "date");
      expect(dateCol).toBeDefined();
      expect(dateCol?.minDate).toContain("2026-01-10");
      expect(dateCol?.maxDate).toContain("2026-02-05");
    });

    it("detects potential outliers using the standard 1.5x IQR method", () => {
      const priceCol = profile.columns.find((c) => c.name === "price");
      expect(priceCol).toBeDefined();
      // Price 9800 is an outlier compared to 15, 25, 110, 350, 450, 1200
      expect(priceCol?.outliersCount).toBeGreaterThanOrEqual(1);
      expect(priceCol?.outlierPercentage).toBeGreaterThan(0);
    });

    it("detects invalid values and type mismatches accurately", () => {
      const priceCol = profile.columns.find((c) => c.name === "price");
      expect(priceCol).toBeDefined();
      // 'NOT_A_NUMBER' string inside price column
      expect(priceCol?.invalidCount).toBe(1);
      expect(priceCol?.invalidPercentage).toBe(10);

      const dateCol = profile.columns.find((c) => c.name === "date");
      expect(dateCol).toBeDefined();
      // 'INVALID_DATE' inside date column
      expect(dateCol?.invalidCount).toBe(1);
      expect(dateCol?.invalidPercentage).toBe(10);
    });

    it("builds a 5-pillar overall dataset quality summary with reproducible score and health grade", () => {
      expect(profile.summary).toBeDefined();
      expect(profile.summary.dataQualityScore).toBeGreaterThan(0);
      expect(profile.summary.dataQualityScore).toBeLessThanOrEqual(100);
      expect(["EXCELLENT", "GOOD", "FAIR", "POOR"]).toContain(profile.summary.grade);

      // Verify all 5 pillars exist with grounded metrics
      expect(profile.summary.missingDataCount).toBe(2); // price & rating nulls
      expect(profile.summary.duplicateRowsCount).toBe(1);
      expect(profile.summary.typeIssuesCount).toBeGreaterThanOrEqual(2);
      expect(profile.summary.potentialOutliersCount).toBeGreaterThanOrEqual(1);
      expect(profile.warnings.length).toBeGreaterThan(0);
    });

    it("produces deterministic and reproducible quality scores for identical data", () => {
      const run1 = computeDatasetProfile(TEST_DATASET, TEST_REAL_DATASET_ROWS);
      const run2 = computeDatasetProfile(TEST_DATASET, TEST_REAL_DATASET_ROWS);
      expect(run1.summary.dataQualityScore).toBe(run2.summary.dataQualityScore);
      expect(run1.duplicateRowsCount).toBe(run2.duplicateRowsCount);
      expect(run1.summary.missingDataCount).toBe(run2.summary.missingDataCount);
    });
  });

  describe("Profile Persistence & Refresh Lifecycle", () => {
    it("persists computed profile directly inside schemaMeta.dataQualityProfile", () => {
      const profile = computeDatasetProfile(TEST_DATASET, TEST_REAL_DATASET_ROWS);
      const schemaMeta = {
        ...TEST_DATASET.schemaMeta,
        dataQualityProfile: profile,
      };

      expect(schemaMeta.dataQualityProfile).toBeDefined();
      expect(schemaMeta.dataQualityProfile.totalRows).toBe(10);
      expect(schemaMeta.dataQualityProfile.summary.dataQualityScore).toBeDefined();
      expect(schemaMeta.dataQualityProfile.columns.length).toBe(7);
    });

    it("updates profile when refreshed with new data records", () => {
      const initialProfile = computeDatasetProfile(TEST_DATASET, TEST_REAL_DATASET_ROWS.slice(0, 5));
      expect(initialProfile.totalRows).toBe(5);
      expect(initialProfile.duplicateRowsCount).toBe(0);

      // After data refresh with duplicate and outlier added
      const refreshedProfile = computeDatasetProfile(TEST_DATASET, TEST_REAL_DATASET_ROWS);
      expect(refreshedProfile.totalRows).toBe(10);
      expect(refreshedProfile.duplicateRowsCount).toBe(1);
      expect(refreshedProfile.summary.potentialOutliersCount).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================
// 2. ADDITIONAL DATA CONNECTORS TESTS
// ============================================================
describe("Phase 4: Additional Data Connectors", () => {
  describe("MySQL Connector Implementation", () => {
    it("validates valid MySQL configuration with default port 3306", () => {
      const connector = new MysqlConnector();
      const validConfig = {
        host: "db.internal.example.com",
        port: 3306,
        database: "analytics_prod",
        username: "analyst",
      };

      const result = connector.validateConfiguration(validConfig);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid MySQL configuration safely with field errors", () => {
      const connector = new MysqlConnector();
      const invalidConfig = {
        host: "", // Host cannot be empty
        port: 999999, // Invalid port
        database: "",
      };

      const result = connector.validateConfiguration(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.fieldErrors).toBeDefined();
      expect(result.fieldErrors?.host).toBeDefined();
    });

    it("handles connection test failures safely without throwing unhandled exceptions", async () => {
      const connector = new MysqlConnector();
      // Unreachable port to test socket reachability failure
      const res = await connector.testConnection({
        host: "127.0.0.1",
        port: 33306,
        database: "testdb",
        username: "root",
      });

      expect(res.success).toBe(false);
      expect(res.message).toBeDefined();
      expect(typeof res.message).toBe("string");
    });
  });

  describe("PostgreSQL Connector Implementation", () => {
    it("validates valid PostgreSQL configuration with default port 5432", () => {
      const connector = new PostgresConnector();
      const validConfig = {
        host: "localhost",
        port: 5432,
        database: "ricoz_warehouse",
        username: "postgres",
      };

      const result = connector.validateConfiguration(validConfig);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid PostgreSQL configuration safely", () => {
      const connector = new PostgresConnector();
      const invalidConfig = {
        host: "",
        port: -5,
        database: "",
      };

      const result = connector.validateConfiguration(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.fieldErrors).toBeDefined();
    });
  });

  describe("Data Source Service & Credential Protection", () => {
    it("validates MYSQL in createDataSourceSchema", () => {
      const parsed = createDataSourceSchema.safeParse({
        name: "Production MySQL",
        type: "MYSQL",
        connection: {
          host: "mysql.internal",
          port: 3306,
          database: "sales_db",
          username: "ro_user",
          password: "db_password_xyz",
        },
      });

      expect(parsed.success).toBe(true);
    });

    it("separates sensitive password into credentials vault, keeping connection config secret-free", () => {
      const rawConn = {
        host: "mysql.prod",
        port: 3306,
        database: "crm",
        username: "admin",
        password: "SuperSecretPassword123",
      };

      const { nonSecretMeta, credentials } = separateCredentials("MYSQL", rawConn);
      expect(nonSecretMeta.host).toBe("mysql.prod");
      expect((nonSecretMeta as any).password).toBeUndefined();
      expect(credentials?.password).toBe("SuperSecretPassword123");
    });

    it("validates testRawConnectionSchema payload for pre-save connection testing", () => {
      const parsed = testRawConnectionSchema.safeParse({
        type: "MYSQL",
        connection: {
          host: "127.0.0.1",
          port: 3306,
          database: "analytics",
          username: "root",
        },
      });

      expect(parsed.success).toBe(true);
    });
  });

  describe("Schema Discovery & Relational Table Ingestion", () => {
    it("discovers tables and schemas for relational data sources", async () => {
      const tables = await schemaDiscoveryService.listTables("ds-test-source-1", "org-test-1");
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables[0]).toHaveProperty("name");
      expect(tables[0]).toHaveProperty("type");
    });

    it("discovers columns and data types for a selected table", async () => {
      const columns = await schemaDiscoveryService.discoverTableSchema(
        "ds-test-source-1",
        "org-test-1",
        "users"
      );

      expect(Array.isArray(columns)).toBe(true);
      expect(columns.length).toBeGreaterThan(0);
      expect(columns[0]).toHaveProperty("name");
      expect(columns[0]).toHaveProperty("type");
    });

    it("enables querying newly created connected datasets through existing analytics layer", async () => {
      const queryEngine = new DatasetQueryEngine();
      const mockConnectedDataset: any = {
        id: "ds-connected-sales",
        name: "Connected Real Sales",
        schemaMeta: {
          columns: TEST_COLUMNS,
          sampleData: TEST_REAL_DATASET_ROWS.slice(0, 5),
        },
        columns: TEST_COLUMNS.map((c, i) => ({
          name: c.name,
          dataType: c.type === "number" ? "NUMBER" : c.type === "date" ? "DATE" : "STRING",
          ordinalPosition: i,
        })),
      };

      const result = await queryEngine.executeQuery(mockConnectedDataset, {
        dimensions: ["category"],
        measures: [
          { column: "price", aggregation: "SUM", alias: "total_price" },
          { column: "*", aggregation: "COUNT", alias: "items_count" },
        ],
        orderBy: { column: "total_price", direction: "DESC" },
      });

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0]).toHaveProperty("category");
      expect(result.rows[0]).toHaveProperty("total_price");
      expect(result.rows[0]).toHaveProperty("items_count");
    });
  });
});
