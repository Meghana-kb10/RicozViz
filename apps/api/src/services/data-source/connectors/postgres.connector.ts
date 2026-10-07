// ========================================
// PostgreSQL Data Source Connector
// ========================================
// Validates configuration and tests connectivity to PostgreSQL instances.
// Never exposes credentials in error messages or logs.
// ========================================

import net from "node:net";
import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult,
} from "./connector.interface.js";

export class PostgresConnector implements DataSourceConnector {
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    const fieldErrors: Record<string, string[]> = {};

    if (!connectionMeta.host || typeof connectionMeta.host !== "string") {
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

    if (!connectionMeta.database || typeof connectionMeta.database !== "string") {
      fieldErrors.database = ["Database name is required"];
    }

    if (!connectionMeta.username || typeof connectionMeta.username !== "string") {
      fieldErrors.username = ["Username is required"];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        valid: false,
        error: "Invalid PostgreSQL configuration",
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
    const port = Number(connectionMeta.port || 5432);
    const database = String(connectionMeta.database || "").trim();
    const user = String(connectionMeta.username || "").trim();
    const password = String(credentials?.password || "");

    try {
      const { Client } = await import("pg");
      const client = new Client({
        host,
        port,
        database,
        user,
        password,
        connectionTimeoutMillis: 3000
      });
      
      await client.connect();
      await client.end();
      
      return {
        success: true,
        status: "CONNECTED",
        message: `Successfully connected to PostgreSQL at ${host}:${port}/${database}`,
        details: { host, port, database }
      };
    } catch (err: any) {
      let safeMessage = "Unable to establish connection to PostgreSQL instance";
      if (err.message.includes("ECONNREFUSED")) {
        safeMessage = `Connection refused by host ${host}:${port}`;
      } else if (err.message.includes("ENOTFOUND")) {
        safeMessage = `Host not found: ${host}`;
      } else if (err.message.includes("password") || err.message.includes("authentication")) {
        safeMessage = `Authentication failed for user ${user}`;
      } else if (err.message.includes("database")) {
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
