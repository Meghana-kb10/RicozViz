// ============================================================================
// Phase 7: Data Connectors & Data Quality Integration & Unit Tests
// ============================================================================
// Verifies:
// 1. All 5 Data Connectors: PostgreSQL, MySQL, SQLite, XLSX, JSON
//    - Connection testing, credential protection, parameter validation
//    - Schema discovery (tables, sheets, columns, types)
// 2. Data Quality & Profiling Engine:
//    - Dataset-level metrics: rows, columns, duplicate rows, completeness %
//    - Data-type distribution calculation
//    - Column-level metrics: null %, unique count, cardinality, samples
//    - Numeric stats: min, max, mean, median, stdDev, IQR outliers
//    - Categorical stats: top values, frequency, distribution
//    - Date/time stats: min date, max date, invalid dates, missing dates
//    - Issue detection: missing values, duplicates, empty columns, invalid dates,
//      categorical case inconsistencies ("India / india / INDIA"), outliers,
//      suspicious negative values, high cardinality
//    - Deterministic 4-pillar Quality Score breakdown
// 3. Direct Import Schema & Service Validation
// ============================================================================

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  PostgresConnector,
  MysqlConnector,
  XlsxConnector,
  JsonConnector,
  getConnector,
} from "../services/data-source/connectors/index.js";
import { SqliteConnector } from "../services/data-source/connectors/sqlite.connector.js";
import {
  createDataSourceSchema,
  testRawConnectionSchema,
  separateCredentials,
} from "../services/data-source/data-source.service.js";
import { importSourceTableSchema } from "../services/dataset/dataset.service.js";
import { computeDatasetProfile } from "../services/dataset/data-quality.service.js";

describe("Phase 7 — 1. Data Connectors", () => {
  describe("PostgreSQL Connector", () => {
    const connector = new PostgresConnector();

    it("retrieves connector instance via getConnector('POSTGRESQL')", () => {
      const inst = getConnector("POSTGRESQL");
      expect(inst).toBeInstanceOf(PostgresConnector);
    });

    it("validates required connection fields", () => {
      const validation = connector.validateConfiguration({});
      expect(validation.valid).toBe(false);
      expect(validation.fieldErrors?.host).toBeDefined();
      expect(validation.fieldErrors?.database).toBeDefined();
      expect(validation.fieldErrors?.username).toBeDefined();
    });

    it("rejects invalid connection credentials gracefully without crashing or leaking secrets", async () => {
      const res = await connector.testConnection({
        host: "127.0.0.1",
        port: 54329, // unreachable port
        database: "non_existent_db",
        username: "fake_user",
        password: "secret_password_123",
        connectionTimeoutMs: 1000,
      });

      expect(res.success).toBe(false);
      expect(res.message).toBeDefined();
      expect(res.message).not.toContain("secret_password_123");
    });
  });

  describe("MySQL Connector", () => {
    const connector = new MysqlConnector();

    it("retrieves connector instance via getConnector('MYSQL')", () => {
      const inst = getConnector("MYSQL");
      expect(inst).toBeInstanceOf(MysqlConnector);
    });

    it("validates required MySQL connection fields", () => {
      const validation = connector.validateConfiguration({});
      expect(validation.valid).toBe(false);
      expect(validation.fieldErrors?.host).toBeDefined();
      expect(validation.fieldErrors?.database).toBeDefined();
      expect(validation.fieldErrors?.username).toBeDefined();
    });

    it("rejects unreachable MySQL hosts safely without exposing passwords", async () => {
      const res = await connector.testConnection({
        host: "127.0.0.1",
        port: 33069, // unreachable port
        database: "test_db",
        username: "root",
        password: "super_secret_mysql_pw",
        connectionTimeoutMs: 1000,
      });

      expect(res.success).toBe(false);
      expect(res.message).toBeDefined();
      expect(res.message).not.toContain("super_secret_mysql_pw");
    });
  });

  describe("SQLite Connector", () => {
    const connector = new SqliteConnector();

    it("retrieves connector instance via getConnector('SQLITE')", () => {
      const inst = getConnector("SQLITE");
      expect(inst).toBeInstanceOf(SqliteConnector);
    });

    it("validates required SQLite connection fields", () => {
      const invalid = connector.validateConfiguration({});
      expect(invalid.valid).toBe(false);
      expect(invalid.fieldErrors?.filePath).toBeDefined();

      const valid = connector.validateConfiguration({ filePath: ":memory:" });
      expect(valid.valid).toBe(true);
    });

    it("successfully connects to in-memory database :memory:", async () => {
      const res = await connector.testConnection({
        filePath: ":memory:",
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("in-memory SQLite database");
    });

    it("fails cleanly when file does not exist", async () => {
      const res = await connector.testConnection({
        filePath: "C:/non/existent/path/database.sqlite",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("does not exist");
    });

    it("fails cleanly when file is not a valid SQLite database", async () => {
      const tmpFile = path.join(os.tmpdir(), `corrupt-${Date.now()}.sqlite`);
      fs.writeFileSync(tmpFile, "This is not a SQLite database file at all");

      try {
        const res = await connector.testConnection({
          filePath: tmpFile,
        });

        expect(res.success).toBe(false);
        expect(res.message).toContain("not a valid SQLite database");
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });

    it("successfully validates a real SQLite 3 header file", async () => {
      const tmpFile = path.join(os.tmpdir(), `valid-${Date.now()}.sqlite`);
      // Standard SQLite 3 16-byte magic header
      const header = Buffer.concat([
        Buffer.from("SQLite format 3\0", "utf-8"),
        Buffer.alloc(84),
      ]);
      fs.writeFileSync(tmpFile, header);

      try {
        const res = await connector.testConnection({
          filePath: tmpFile,
        });

        expect(res.success).toBe(true);
        expect(res.message).toContain("Successfully connected to SQLite database");
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });
  });

  describe("Excel / XLSX Connector", () => {
    const connector = new XlsxConnector();

    it("retrieves connector instance via getConnector('XLSX')", () => {
      const inst = getConnector("XLSX");
      expect(inst).toBeInstanceOf(XlsxConnector);
    });

    it("validates required filePath or url", () => {
      const invalid = connector.validateConfiguration({});
      expect(invalid.valid).toBe(false);

      const valid = connector.validateConfiguration({ filePath: "data.xlsx" });
      expect(valid.valid).toBe(true);
    });

    it("fails cleanly when XLSX file path does not exist", async () => {
      const res = await connector.testConnection({
        filePath: "C:/non/existent/test-sheet.xlsx",
      });
      expect(res.success).toBe(false);
      expect(res.message).toBeDefined();
    });
  });

  describe("JSON Connector", () => {
    const connector = new JsonConnector();

    it("retrieves connector instance via getConnector('JSON')", () => {
      const inst = getConnector("JSON");
      expect(inst).toBeInstanceOf(JsonConnector);
    });

    it("validates required filePath or url for JSON connector", () => {
      const invalid = connector.validateConfiguration({});
      expect(invalid.valid).toBe(false);

      const valid = connector.validateConfiguration({ filePath: "data.json" });
      expect(valid.valid).toBe(true);
    });

    it("fails cleanly when JSON file path does not exist", async () => {
      const res = await connector.testConnection({
        filePath: "C:/non/existent/test-data.json",
      });
      expect(res.success).toBe(false);
      expect(res.message).toBeDefined();
    });
  });

  describe("Connection Validation & Credential Isolation", () => {
    it("validates SQLITE connection input schema", () => {
      const valid = createDataSourceSchema.safeParse({
        name: "Local SQLite DB",
        type: "SQLITE",
        connection: {
          filePath: "D:/data/app.db",
        },
      });
      expect(valid.success).toBe(true);
    });

    it("validates testRawConnectionSchema for SQLITE", () => {
      const valid = testRawConnectionSchema.safeParse({
        type: "SQLITE",
        connection: {
          filePath: ":memory:",
        },
      });
      expect(valid.success).toBe(true);
    });

    it("properly separates credentials from connectionConfig", () => {
      const { nonSecretMeta, credentials } = separateCredentials(
        "POSTGRESQL",
        {
          host: "db.production.internal",
          port: 5432,
          database: "analytics",
          username: "admin",
          password: "MySuperSecretPassword!",
        }
      );

      // Public metadata must NOT contain password
      expect(nonSecretMeta.password).toBeUndefined();
      expect(nonSecretMeta.host).toBe("db.production.internal");
      expect(nonSecretMeta.username).toBe("admin");

      // Credentials object contains the sensitive password
      expect(credentials.password).toBe("MySuperSecretPassword!");
    });

    it("validates importSourceTableSchema for table selection", () => {
      const valid = importSourceTableSchema.safeParse({
        tableName: "orders",
        name: "Production Orders",
      });
      expect(valid.success).toBe(true);

      const invalid = importSourceTableSchema.safeParse({
        tableName: "",
      });
      expect(invalid.success).toBe(false);
    });
  });
});

describe("Phase 7 — 2. Data Quality & Profiling Engine", () => {
  const dummyDataset = {
    id: "ds-quality-test-01",
    name: "Customer Transactions",
  };

  it("calculates exact row count, column count, duplicates, completeness, and type distribution", () => {
    const records = [
      { id: 1, customer: "Alice", amount: 100, status: "PAID" },
      { id: 2, customer: "Bob", amount: 200, status: "PAID" },
      { id: 3, customer: null, amount: 300, status: null }, // 2 nulls out of 4 fields
      { id: 1, customer: "Alice", amount: 100, status: "PAID" }, // Exact duplicate of row 1
    ];

    const profile = computeDatasetProfile(dummyDataset, records);

    expect(profile.totalRows).toBe(4);
    expect(profile.totalColumns).toBe(4);
    expect(profile.duplicateRowsCount).toBe(1); // 1 duplicate row detected

    // Total cells = 4 rows * 4 columns = 16 cells. 2 nulls = 87.5% completeness
    expect(profile.completenessPercentage).toBe(87.5);

    // Data-type distribution must track correctly
    expect(profile.dataTypeDistribution.number).toBe(2); // id, amount
    expect(profile.dataTypeDistribution.string).toBe(2); // customer, status
  });

  it("computes comprehensive numeric statistics: min, max, mean, median, stdDev, and IQR outliers", () => {
    const records = [
      { val: 10 },
      { val: 12 },
      { val: 14 },
      { val: 15 },
      { val: 16 },
      { val: 18 },
      { val: 20 },
      { val: 500 }, // Clear statistical outlier (IQR)
    ];

    const profile = computeDatasetProfile(dummyDataset, records);
    const col = profile.columns.find((c) => c.name === "val");

    expect(col).toBeDefined();
    expect(col?.type).toBe("number");
    expect(col?.min).toBe(10);
    expect(col?.max).toBe(500);
    expect(col?.mean).toBeDefined();
    expect(col?.median).toBe(15.5); // Median of 10,12,14,15,16,18,20,500
    expect(col?.stdDev).toBeGreaterThan(0);
    expect(col?.outliersCount).toBe(1);
    expect(col?.outliers).toContain(500);

    // Check warning generated for outliers
    const outlierWarning = profile.warnings.find((w) => w.rule === "STATISTICAL_OUTLIERS");
    expect(outlierWarning).toBeDefined();
    expect(outlierWarning?.column).toBe("val");
  });

  it("computes categorical distributions, top values, and frequencies", () => {
    const records = [
      { country: "India" },
      { country: "India" },
      { country: "United States" },
      { country: "Germany" },
      { country: "India" },
    ];

    const profile = computeDatasetProfile(dummyDataset, records);
    const col = profile.columns.find((c) => c.name === "country");

    expect(col).toBeDefined();
    expect(col?.type).toBe("string");
    expect(col?.uniqueCount).toBe(3);
    expect(col?.topValues).toBeDefined();

    const topIndia = col?.topValues?.find((v) => v.value === "India");
    expect(topIndia?.count).toBe(3);
    expect(topIndia?.percentage).toBe(60);

    expect(col?.frequency?.India).toBe(3);
    expect(col?.frequency?.["United States"]).toBe(1);
  });

  it("accurately detects categorical casing inconsistencies (India / india / INDIA)", () => {
    // Prompt specification:
    // Country: India (82%), india (4%), INDIA (2%)
    // Potential inconsistency: India / india / INDIA
    const records = [
      { country: "India" },
      { country: "India" },
      { country: "india" },
      { country: "INDIA" },
      { country: "Japan" },
    ];

    const profile = computeDatasetProfile(dummyDataset, records);

    const inconsistencyWarning = profile.warnings.find(
      (w) => w.rule === "INCONSISTENT_CATEGORICAL_VALUES"
    );

    expect(inconsistencyWarning).toBeDefined();
    expect(inconsistencyWarning?.column).toBe("country");
    expect(inconsistencyWarning?.message).toContain("India");
    expect(inconsistencyWarning?.message).toContain("india");
    expect(inconsistencyWarning?.message).toContain("INDIA");
  });

  it("detects suspicious negative values in monetary/quantity columns", () => {
    const records = [
      { order_id: "O-1", revenue: 120.5 },
      { order_id: "O-2", revenue: -45.0 }, // Suspicious negative revenue
      { order_id: "O-3", revenue: 89.0 },
    ];

    const profile = computeDatasetProfile(dummyDataset, records);

    const suspiciousWarning = profile.warnings.find((w) => w.rule === "SUSPICIOUS_VALUES");
    expect(suspiciousWarning).toBeDefined();
    expect(suspiciousWarning?.column).toBe("revenue");
    expect(suspiciousWarning?.message).toContain("negative value");
  });

  it("detects high-cardinality non-ID columns", () => {
    const records: Array<{ tag: string }> = [];
    for (let i = 0; i < 40; i++) {
      records.push({ tag: `UniqueTag_${i}` });
    }

    const profile = computeDatasetProfile(dummyDataset, records);

    const highCardWarning = profile.warnings.find((w) => w.rule === "HIGH_CARDINALITY");
    expect(highCardWarning).toBeDefined();
    expect(highCardWarning?.column).toBe("tag");
  });

  it("profiles date/time columns: minDate, maxDate, invalidDates, missingDates", () => {
    const records = [
      { timestamp: "2026-01-10T10:00:00.000Z" },
      { timestamp: "2026-03-25T14:30:00.000Z" },
      { timestamp: null },
      { timestamp: "invalid-not-a-date" },
    ];

    const profile = computeDatasetProfile(dummyDataset, records);
    const col = profile.columns.find((c) => c.name === "timestamp");

    expect(col).toBeDefined();
    expect(col?.type).toBe("date");
    expect(col?.minDate).toBe("2026-01-10T10:00:00.000Z");
    expect(col?.maxDate).toBe("2026-03-25T14:30:00.000Z");
    expect(col?.missingDates).toBe(1);
    expect(col?.invalidDates).toBe(1);

    const invalidDateWarning = profile.warnings.find((w) => w.rule === "INVALID_DATES");
    expect(invalidDateWarning).toBeDefined();
    expect(invalidDateWarning?.column).toBe("timestamp");
  });

  it("computes deterministic 4-pillar quality score with explicit formula and transparent breakdown", () => {
    // 100% clean dataset
    const cleanRecords = [
      { id: 1, name: "Alpha", amount: 100 },
      { id: 2, name: "Beta", amount: 200 },
      { id: 3, name: "Gamma", amount: 300 },
    ];

    const cleanProfile = computeDatasetProfile(dummyDataset, cleanRecords);

    expect(cleanProfile.qualityScore).toBe(100);
    expect(cleanProfile.scoreBreakdown.completeness).toBe(100);
    expect(cleanProfile.scoreBreakdown.validity).toBe(100);
    expect(cleanProfile.scoreBreakdown.uniqueness).toBe(100);
    expect(cleanProfile.scoreBreakdown.consistency).toBe(100);
    expect(cleanProfile.scoreBreakdown.formula).toBe(
      "Quality Score = (Completeness × 35%) + (Validity × 25%) + (Consistency × 20%) + (Uniqueness × 20%)"
    );

    // Dataset with specific defects:
    // Row 1: id: 1, name: "A", amount: 10
    // Row 2: id: 1, name: "A", amount: 10 (duplicate -> uniqueness penalty)
    // Row 3: id: 2, name: null, amount: 20 (null -> completeness penalty)
    const defectiveRecords = [
      { id: 1, name: "A", amount: 10 },
      { id: 1, name: "A", amount: 10 },
      { id: 2, name: null, amount: 20 },
    ];

    const defProfile = computeDatasetProfile(dummyDataset, defectiveRecords);

    // Must be strictly between 0 and 100
    expect(defProfile.qualityScore).toBeLessThan(100);
    expect(defProfile.qualityScore).toBeGreaterThanOrEqual(0);

    // Uniqueness must reflect duplicate penalty
    expect(defProfile.scoreBreakdown.uniqueness).toBeLessThan(100);
    // Completeness must reflect missing cell
    expect(defProfile.scoreBreakdown.completeness).toBeLessThan(100);

    // Check calculation matches deterministic formula:
    const expectedScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          defProfile.scoreBreakdown.completeness * 0.35 +
          defProfile.scoreBreakdown.validity * 0.25 +
          defProfile.scoreBreakdown.uniqueness * 0.20 +
          defProfile.scoreBreakdown.consistency * 0.20
        )
      )
    );
    expect(defProfile.qualityScore).toBe(expectedScore);
  });
});
