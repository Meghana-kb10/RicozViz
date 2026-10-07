// ========================================
// MySQL Data Source Connector (Phase 4)
// ========================================
// Validates configuration, tests connectivity, and discovers schemas for MySQL instances.
// Never exposes credentials in error messages or logs.
// ========================================

import net from "node:net";
import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult,
} from "./connector.interface.js";

export class MysqlConnector implements DataSourceConnector {
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    const fieldErrors: Record<string, string[]> = {};

    if (!connectionMeta.host || typeof connectionMeta.host !== "string" || connectionMeta.host.trim().length === 0) {
      fieldErrors.host = ["Host is required"];
    }

    if (
      connectionMeta.port !== undefined &&
      (typeof connectionMeta.port !== "number" ||
        connectionMeta.port < 1 ||
        connectionMeta.port > 65535)
    ) {
      fieldErrors.port = ["Port must be between 1 and 65535"];
    }

    if (!connectionMeta.database || typeof connectionMeta.database !== "string" || connectionMeta.database.trim().length === 0) {
      fieldErrors.database = ["Database name is required"];
    }

    if (!connectionMeta.username || typeof connectionMeta.username !== "string" || connectionMeta.username.trim().length === 0) {
      fieldErrors.username = ["Username is required"];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        valid: false,
        error: "Invalid MySQL configuration",
        fieldErrors,
      };
    }

    return { valid: true };
  }

  async testConnection(
    connectionMeta: Record<string, unknown>,
    credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const host = String(connectionMeta.host || "localhost").trim();
    const port = Number(connectionMeta.port || 3306);
    const database = String(connectionMeta.database || "").trim();
    const user = String(connectionMeta.username || "").trim();
    const password = String(credentials?.password || "");

    try {
      const mysql = await import("mysql2/promise");
      const connection = await mysql.createConnection({
        host,
        port,
        database,
        user,
        password,
        connectTimeout: 3000
      });
      
      await connection.ping();
      await connection.end();
      
      return {
        success: true,
        status: "CONNECTED",
        message: `Successfully connected to MySQL instance at ${host}:${port}/${database}`,
        details: { host, port, database }
      };
    } catch (err: any) {
      let safeMessage = "Unable to establish connection to MySQL instance";
      if (err.message.includes("ECONNREFUSED")) {
        safeMessage = `Connection refused by MySQL host ${host}:${port}`;
      } else if (err.message.includes("ENOTFOUND")) {
        safeMessage = `MySQL host not found: ${host}`;
      } else if (err.message.includes("Access denied")) {
        safeMessage = `Authentication failed for user ${user}`;
      } else if (err.message.includes("Unknown database")) {
        safeMessage = `Database "${database}" not found`;
      }
      
      return {
        success: false,
        status: "FAILED",
        message: safeMessage
      };
    }
  }
}
