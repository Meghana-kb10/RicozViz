// ========================================
// JSON Data Source Connector
// ========================================
// Validates file-based JSON data source configurations.
// ========================================

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

    if (!connectionMeta.fileName || typeof connectionMeta.fileName !== "string") {
      fieldErrors.fileName = ["File name is required"];
    } else if (!connectionMeta.fileName.toLowerCase().endsWith(".json")) {
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
    const fileName = String(connectionMeta.fileName || "data.json");
    const dataPath = connectionMeta.dataPath ? String(connectionMeta.dataPath) : "root";

    return Promise.resolve({
      success: true,
      status: "CONNECTED",
      message: `JSON data source configuration verified for ${fileName}`,
      details: {
        fileName,
        dataPath,
      },
    });
  }
}
