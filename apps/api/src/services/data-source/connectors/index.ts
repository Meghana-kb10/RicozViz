// ========================================
// Connector Registry
// ========================================

import type { DataSourceConnector } from "./connector.interface.js";
import { PostgresConnector } from "./postgres.connector.js";
import { CsvConnector } from "./csv.connector.js";
import { XlsxConnector } from "./xlsx.connector.js";
import { JsonConnector } from "./json.connector.js";
import { RestApiConnector } from "./rest-api.connector.js";
import { MysqlConnector } from "./mysql.connector.js";
import { SqliteConnector } from "./sqlite.connector.js";

export * from "./connector.interface.js";
export * from "./postgres.connector.js";
export * from "./mysql.connector.js";
export * from "./sqlite.connector.js";
export * from "./csv.connector.js";
export * from "./xlsx.connector.js";
export * from "./json.connector.js";
export * from "./rest-api.connector.js";

const connectors: Record<string, DataSourceConnector> = {
  POSTGRESQL: new PostgresConnector(),
  MYSQL: new MysqlConnector(),
  SQLITE: new SqliteConnector(),
  CSV: new CsvConnector(),
  CSV_UPLOAD: new CsvConnector(),
  XLSX: new XlsxConnector(),
  JSON: new JsonConnector(),
  REST_API: new RestApiConnector(),
};

export function getConnector(type: string): DataSourceConnector | null {
  return connectors[type.toUpperCase()] || null;
}

