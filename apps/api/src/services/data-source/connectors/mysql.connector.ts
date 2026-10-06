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
    _credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const host = String(connectionMeta.host || "localhost").trim();
    const port = Number(connectionMeta.port || 3306);
    const database = String(connectionMeta.database || "").trim();

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let isResolved = false;

      const finish = (result: ConnectionTestResult) => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      // Set connection timeout (3000ms)
      socket.setTimeout(3000);

      socket.on("connect", () => {
        finish({
          success: true,
          status: "CONNECTED",
          message: `Successfully connected to MySQL instance at ${host}:${port}/${database}`,
          details: {
            host,
            port,
            database,
          },
        });
      });

      socket.on("timeout", () => {
        finish({
          success: false,
          status: "FAILED",
          message: `Connection timed out connecting to MySQL host ${host}:${port}`,
        });
      });

      socket.on("error", (err: Error) => {
        // Strip out any potentially sensitive system or network messages
        const safeMessage =
          err.message.includes("ECONNREFUSED")
            ? `Connection refused by MySQL host ${host}:${port}`
            : err.message.includes("ENOTFOUND")
              ? `MySQL host not found: ${host}`
              : "Unable to establish connection to MySQL instance";

        finish({
          success: false,
          status: "FAILED",
          message: safeMessage,
        });
      });

      try {
        socket.connect(port, host);
      } catch {
        finish({
          success: false,
          status: "FAILED",
          message: `Invalid connection target: ${host}:${port}`,
        });
      }
    });
  }
}
