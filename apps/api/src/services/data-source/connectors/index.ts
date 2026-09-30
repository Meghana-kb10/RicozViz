// ========================================
// Connector Registry
// ========================================

import type { DataSourceConnector } from "./connector.interface.js";
import { PostgresConnector } from "./postgres.connector.js";
import { CsvConnector } from "./csv.connector.js";
import { RestApiConnector } from "./rest-api.connector.js";

export * from "./connector.interface.js";
export * from "./postgres.connector.js";
export * from "./csv.connector.js";
export * from "./rest-api.connector.js";

const connectors: Record<string, DataSourceConnector> = {
  POSTGRESQL: new PostgresConnector(),
  CSV: new CsvConnector(),
  CSV_UPLOAD: new CsvConnector(),
  REST_API: new RestApiConnector(),
};

export function getConnector(type: string): DataSourceConnector | null {
  return connectors[type.toUpperCase()] || null;
}
