// ========================================
// SQLite Data Source Connector
// ========================================
// Validates configuration and verifies SQLite database file accessibility.
// Never exposes sensitive paths or credentials in error messages.
// ========================================

import fs from "node:fs";
import path from "node:path";
import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult,
} from "./connector.interface.js";

export class SqliteConnector implements DataSourceConnector {
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    const fieldErrors: Record<string, string[]> = {};

    const dbPath = connectionMeta.databasePath || connectionMeta.fileName || connectionMeta.filePath;
    if (!dbPath || typeof dbPath !== "string" || dbPath.trim().length === 0) {
      fieldErrors.filePath = ["Database file path or name is required"];
    } else {
      const lower = dbPath.toLowerCase().trim();
      const validExt =
        lower.endsWith(".sqlite") ||
        lower.endsWith(".sqlite3") ||
        lower.endsWith(".db") ||
        lower === ":memory:";
      if (!validExt) {
        fieldErrors.filePath = [
          "Database must have a valid SQLite extension (.sqlite, .sqlite3, .db) or be :memory:",
        ];
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        valid: false,
        error: "Invalid SQLite configuration",
        fieldErrors,
      };
    }

    return { valid: true };
  }

  async testConnection(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const rawPath = String(
      connectionMeta.databasePath || connectionMeta.fileName || connectionMeta.filePath || ""
    ).trim();
    if (!rawPath) {
      return {
        success: false,
        status: "FAILED",
        message: "SQLite database path is missing",
      };
    }

    // In-memory SQLite
    if (rawPath === ":memory:") {
      return {
        success: true,
        status: "CONNECTED",
        message: "Successfully connected to in-memory SQLite database (:memory:)",
        details: { databasePath: ":memory:" },
      };
    }

    // File-based SQLite
    try {
      const resolved = path.resolve(rawPath);
      const exists = fs.existsSync(resolved);

      if (!exists) {
        return {
          success: false,
          status: "FAILED",
          message: `SQLite database file does not exist: ${path.basename(rawPath)}`,
        };
      }

      const stats = fs.statSync(resolved);
      if (!stats.isFile()) {
        return {
          success: false,
          status: "FAILED",
          message: "Target SQLite path is not a file",
        };
      }

      // Validate SQLite header signature (first 16 bytes: "SQLite format 3\0")
      const fd = fs.openSync(resolved, "r");
      const buffer = Buffer.alloc(16);
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      const headerStr = buffer.toString("utf8");
      if (headerStr.startsWith("SQLite format 3")) {
        return {
          success: true,
          status: "CONNECTED",
          message: `Successfully connected to SQLite database: ${path.basename(resolved)}`,
          details: {
            fileName: path.basename(resolved),
            sizeBytes: stats.size,
          },
        };
      }

      return {
        success: false,
        status: "FAILED",
        message: "Target file is not a valid SQLite database",
      };
    } catch {
      return {
        success: false,
        status: "FAILED",
        message: `Unable to access SQLite database path: ${path.basename(rawPath)}`,
      };
    }
  }
}
