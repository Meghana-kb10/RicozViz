// ========================================
// Schema Discovery Service (PostgreSQL, MySQL & Tabular)
// ========================================
// Discovers tables and column definitions from connected sources safely.
// Validates identifiers to prevent SQL injection.
// Never exposes credentials in responses or error logs.
// ========================================

import type { ColumnSchema, InferredColumnType } from "./type-inference.js";
import { credentialService } from "../data-source/credential.service.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";

export interface DiscoveredTable {
  name: string;
  type: "table" | "view";
}

/**
 * Validates that an SQL identifier contains only alphanumeric characters and underscores.
 * Strictly prevents SQL injection in table and column names.
 */
export function validateSqlIdentifier(name: string): string {
  const clean = name.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(clean)) {
    throw AppError.badRequest(
      `Invalid SQL identifier: "${name}". Identifiers must start with a letter/underscore and contain only alphanumeric characters.`
    );
  }
  return clean;
}

/**
 * Maps SQL / Database data types to standardized InferredColumnType.
 */
export function mapPostgresTypeToColumnType(pgType: string): InferredColumnType {
  const lower = pgType.toLowerCase();

  if (
    lower.includes("int") ||
    lower.includes("serial") ||
    lower === "smallint" ||
    lower === "bigint"
  ) {
    return "integer";
  }

  if (
    lower.includes("numeric") ||
    lower.includes("decimal") ||
    lower.includes("float") ||
    lower.includes("double") ||
    lower === "real"
  ) {
    return "number";
  }

  if (lower.includes("bool")) {
    return "boolean";
  }

  if (lower.includes("date") || lower.includes("time")) {
    return "date";
  }

  return "string";
}

export class SchemaDiscoveryService {
  /**
   * Lists tables and views for a given DataSource (PostgreSQL, MySQL, CSV, XLSX, JSON).
   */
  async listTables(dataSourceId: string, organizationId: string): Promise<DiscoveredTable[]> {
    let dataSource: any;
    try {
      dataSource = await prisma.dataSource.findUnique({
        where: { id: dataSourceId },
      });
    } catch {
      throw AppError.notFound("Data source");
    }

    if (!dataSource) {
      throw AppError.notFound("Data source");
    }

    if (dataSource.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: resource belongs to a different organization");
    }

    let credentials: Record<string, unknown> = {};
    if (dataSource.credentialRef) {
       const c = await credentialService.getCredentials(dataSource.credentialRef);
       if (c) credentials = c;
    }

    const type = dataSource.type;
    const meta = (dataSource.connectionMeta || {}) as Record<string, unknown>;

    if (type === "POSTGRESQL") {
      try {
        const { Client: PgClient } = await import("pg");
        const client = new PgClient({
           host: String(meta.host || "localhost"),
           port: Number(meta.port || 5432),
           database: String(meta.database || ""),
           user: String(meta.username || ""),
           password: String(credentials.password || "")
        });
        await client.connect();
        const res = await client.query(`SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC`);
        await client.end();
        return res.rows.map((t: any) => ({
           name: t.table_name,
           type: t.table_type === "VIEW" ? "view" : "table",
        }));
      } catch (err: any) {
        throw AppError.badRequest("Failed to retrieve tables from PostgreSQL: " + err.message);
      }
    }

    if (type === "MYSQL") {
      try {
        const mysql = await import("mysql2/promise");
        const database = String(meta.database || "");
        const connection = await mysql.createConnection({
          host: String(meta.host || "localhost"),
          port: Number(meta.port || 3306),
          database,
          user: String(meta.username || ""),
          password: String(credentials.password || "")
        });
        const [rows] = await connection.execute("SHOW FULL TABLES");
        await connection.end();
        
        return (rows as any[]).map((r: any) => {
           const key = Object.keys(r).find(k => k.startsWith("Tables_in_"));
           const typeKey = Object.keys(r).find(k => k === "Table_type");
           return {
              name: key ? r[key] : "unknown",
              type: (typeKey && r[typeKey] === "VIEW") ? "view" : "table"
           };
        });
      } catch (err: any) {
         throw AppError.badRequest("Failed to retrieve tables from MySQL: " + err.message);
      }
    }

    if (type === "SQLITE") {
      try {
        const Database = (await import("better-sqlite3")).default;
        const filePath = String(meta.filePath || meta.databasePath || ":memory:");
        const db = new Database(filePath, { fileMustExist: filePath !== ":memory:" });
        const rows = db.pragma("table_list");
        db.close();
        return (rows as any[]).filter(r => !r.name.startsWith("sqlite_")).map(r => ({
           name: r.name,
           type: r.type === "view" ? "view" : "table"
        }));
      } catch (err: any) {
        throw AppError.badRequest("Failed to retrieve tables from SQLite: " + err.message);
      }
    }

    if (type === "CSV_UPLOAD" || (type as string) === "CSV") {
      const tableName = String(meta.fileName || "data.csv").replace(/\.[^/.]+$/, "");
      return [{ name: tableName, type: "table" }];
    }

    const format = String(meta.sourceFormat || type).toUpperCase();

    if (format === "XLSX") {
      try {
         const xlsx = await import("xlsx");
         const filePath = String(meta.filePath || "");
         const workbook = xlsx.readFile(filePath);
         return workbook.SheetNames.map(name => ({ name, type: "table" }));
      } catch (err: any) {
         throw AppError.badRequest("Failed to read XLSX: " + err.message);
      }
    }

    if (format === "JSON") {
      const pathKey = String(meta.dataPath || "records");
      return [
        { name: pathKey || "root", type: "table" }
      ];
    }

    return [{ name: "dataset_table", type: "table" }];
  }

  /**
   * Backwards-compatible wrapper for PostgreSQL table discovery.
   */
  async listPostgresTables(dataSourceId: string, organizationId: string): Promise<DiscoveredTable[]> {
    return this.listTables(dataSourceId, organizationId);
  }

  /**
   * Discovers the column schema of a specific table in a DataSource.
   */
  async discoverTableSchema(
    dataSourceId: string,
    organizationId: string,
    tableName: string
  ): Promise<ColumnSchema[]> {
    const safeTable = validateSqlIdentifier(tableName);

    let dataSource: any;
    try {
      dataSource = await prisma.dataSource.findUnique({
        where: { id: dataSourceId },
      });
    } catch {
      throw AppError.notFound("Data source");
    }

    if (!dataSource) {
      throw AppError.notFound("Data source");
    }

    if (dataSource.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: resource belongs to a different organization");
    }

    let credentials: Record<string, unknown> = {};
    if (dataSource.credentialRef) {
       const c = await credentialService.getCredentials(dataSource.credentialRef);
       if (c) credentials = c;
    }
    const type = dataSource.type;
    const meta = (dataSource.connectionMeta || {}) as Record<string, unknown>;

    if (type === "POSTGRESQL") {
      try {
        const { Client: PgClient } = await import("pg");
        const client = new PgClient({
           host: String(meta.host || "localhost"),
           port: Number(meta.port || 5432),
           database: String(meta.database || ""),
           user: String(meta.username || ""),
           password: String(credentials.password || "")
        });
        await client.connect();
        const res = await client.query({
           text: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position ASC",
           values: [safeTable]
        });
        await client.end();
        
        if (res.rows.length === 0) {
          throw AppError.notFound(`Table "${safeTable}"`);
        }
        return res.rows.map((col: any) => ({
          name: col.column_name,
          type: mapPostgresTypeToColumnType(col.data_type),
          nullable: col.is_nullable.toUpperCase() === "YES",
        }));
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw AppError.badRequest("Failed to retrieve schema from PostgreSQL: " + err.message);
      }
    }

    if (type === "MYSQL") {
      try {
        const mysql = await import("mysql2/promise");
        const database = String(meta.database || "");
        const connection = await mysql.createConnection({
          host: String(meta.host || "localhost"),
          port: Number(meta.port || 3306),
          database,
          user: String(meta.username || ""),
          password: String(credentials.password || "")
        });
        const [rows] = await connection.execute("DESCRIBE `" + safeTable + "`");
        await connection.end();
        
        return (rows as any[]).map((r: any) => ({
           name: r.Field,
           type: mapPostgresTypeToColumnType(r.Type),
           nullable: r.Null === "YES"
        }));
      } catch (err: any) {
         throw AppError.badRequest("Failed to retrieve schema from MySQL: " + err.message);
      }
    }

    if (type === "SQLITE") {
      try {
        const Database = (await import("better-sqlite3")).default;
        const filePath = String(meta.filePath || meta.databasePath || ":memory:");
        const db = new Database(filePath, { fileMustExist: filePath !== ":memory:" });
        const rows = db.pragma(`table_info("${safeTable}")`);
        db.close();
        return (rows as any[]).map(r => ({
           name: r.name,
           type: mapPostgresTypeToColumnType(r.type),
           nullable: r.notnull === 0
        }));
      } catch (err: any) {
        throw AppError.badRequest("Failed to retrieve schema from SQLite: " + err.message);
      }
    }

    const format = String(meta.sourceFormat || type).toUpperCase();

    if (format === "XLSX") {
      try {
         const xlsx = await import("xlsx");
         const filePath = String(meta.filePath || "");
         const workbook = xlsx.readFile(filePath);
         const firstSheetName = workbook.SheetNames[0] || "";
         const sheet = workbook.Sheets[safeTable] || workbook.Sheets[firstSheetName];
         if (!sheet) throw new Error("Sheet not found");
         const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
         if (!rows || rows.length === 0) return [];
         const headers = rows[0] || [];
         return headers.map((h: any, i: number) => {
           let t = "string";
           if (rows.length > 1 && rows[1]) {
             const v = rows[1][i];
             if (typeof v === "number") t = "number";
             else if (typeof v === "boolean") t = "boolean";
           }
           return { name: String(h), type: t as any, nullable: true };
         });
      } catch (err: any) {
         throw AppError.badRequest("Failed to read XLSX schema: " + err.message);
      }
    }

    if (format === "JSON") {
      try {
         const fs = await import("fs");
         const filePath = String(meta.filePath || "");
         const content = fs.readFileSync(filePath, "utf-8");
         let data = JSON.parse(content);
         const pathKey = String(meta.dataPath || "");
         if (pathKey && data[pathKey]) data = data[pathKey];
         if (!Array.isArray(data)) data = [data];
         if (data.length === 0) return [];
         const firstRow = data[0];
         if (typeof firstRow !== "object" || !firstRow) return [];
         return Object.keys(firstRow).map(k => {
           const v = firstRow[k];
           let t = "string";
           if (typeof v === "number") t = "number";
           else if (typeof v === "boolean") t = "boolean";
           return { name: k, type: t as any, nullable: true };
         });
      } catch (err: any) {
         throw AppError.badRequest("Failed to read JSON schema: " + err.message);
      }
    }

    if (type === "CSV_UPLOAD" || format === "CSV") {
      try {
         const fs = await import("fs");
         const csv = (await import("csv-parser")).default || require("csv-parser");
         const filePath = String(meta.filePath || "");
         return await new Promise((resolve, reject) => {
           const results: any[] = [];
           const stream = fs.createReadStream(filePath)
             .pipe(csv())
             .on('data', (data: any) => {
               results.push(data);
               if (results.length > 1) {
                 stream.destroy();
               }
             })
             .on('close', () => {
               if (results.length === 0) return resolve([]);
               const firstRow = results[0];
               const cols = Object.keys(firstRow).map(k => {
                 const v = firstRow[k];
                 let t = "string";
                 if (!isNaN(Number(v)) && v !== "") t = "number";
                 return { name: k, type: t as any, nullable: true };
               });
               resolve(cols);
             })
             .on('end', () => {
               if (results.length === 0) return resolve([]);
               const firstRow = results[0];
               const cols = Object.keys(firstRow).map(k => {
                 const v = firstRow[k];
                 let t = "string";
                 if (!isNaN(Number(v)) && v !== "") t = "number";
                 return { name: k, type: t as any, nullable: true };
               });
               resolve(cols);
             })
             .on('error', reject);
         });
      } catch (err: any) {
         throw AppError.badRequest("Failed to read CSV schema: " + err.message);
      }
    }

    return [
      { name: "id", type: "string", nullable: false },
      { name: "name", type: "string", nullable: false },
      { name: "created_at", type: "date", nullable: false },
      { name: "value", type: "number", nullable: true },
    ];

  }

  /**
   * Backwards-compatible wrapper for PostgreSQL column discovery.
   */
  async discoverPostgresTableSchema(
    dataSourceId: string,
    organizationId: string,
    tableName: string
  ): Promise<ColumnSchema[]> {
    return this.discoverTableSchema(dataSourceId, organizationId, tableName);
  }
}

export const schemaDiscoveryService = new SchemaDiscoveryService();
