// ========================================
// JSON Data Source Connector
// ========================================
// Validates file-based JSON data source configurations.
// ========================================

import fs from "node:fs";
import path from "node:path";
import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult,
} from "./connector.interface.js";

export class JsonConnector implements DataSourceConnector {
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    const fieldErrors: Record<string, string[]> = {};

    const rawFile = connectionMeta.fileName || connectionMeta.filePath;
    if (!rawFile || typeof rawFile !== "string") {
      fieldErrors.fileName = ["File name or path is required"];
    } else if (!rawFile.toLowerCase().endsWith(".json")) {
      fieldErrors.fileName = ["File must be a JSON (.json) file"];
    }

    if (
      connectionMeta.dataPath !== undefined &&
      typeof connectionMeta.dataPath !== "string"
    ) {
      fieldErrors.dataPath = ["Data path must be a string"];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        valid: false,
        error: "Invalid JSON data source configuration",
        fieldErrors,
      };
    }

    return { valid: true };
  }

  testConnection(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const rawFile = String(connectionMeta.fileName || connectionMeta.filePath || "data.json");
    const dataPath = connectionMeta.dataPath ? String(connectionMeta.dataPath) : "root";

    if (rawFile.includes("/") || rawFile.includes("\\")) {
      const resolved = path.resolve(rawFile);
      if (!fs.existsSync(resolved)) {
        return Promise.resolve({
          success: false,
          status: "FAILED",
          message: `JSON file does not exist at path: ${rawFile}`,
        });
      }
    }

    return Promise.resolve({
      success: true,
      status: "CONNECTED",
      message: `JSON data source configuration verified for ${rawFile}`,
      details: {
        fileName: rawFile,
        dataPath,
      },
    });
  }
}
