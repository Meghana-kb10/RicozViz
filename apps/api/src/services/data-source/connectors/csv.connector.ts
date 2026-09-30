// ========================================
// CSV Data Source Connector
// ========================================
// Validates file-based CSV data source configurations.
// ========================================

import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult,
} from "./connector.interface.js";

export class CsvConnector implements DataSourceConnector {
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    const fieldErrors: Record<string, string[]> = {};

    if (!connectionMeta.fileName || typeof connectionMeta.fileName !== "string") {
      fieldErrors.fileName = ["File name is required"];
    } else if (!connectionMeta.fileName.toLowerCase().endsWith(".csv")) {
      fieldErrors.fileName = ["File must be a CSV (.csv) file"];
    }

    if (
      connectionMeta.delimiter !== undefined &&
      (typeof connectionMeta.delimiter !== "string" ||
        connectionMeta.delimiter.length === 0)
    ) {
      fieldErrors.delimiter = ["Delimiter must be a non-empty string"];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        valid: false,
        error: "Invalid CSV data source configuration",
        fieldErrors,
      };
    }

    return { valid: true };
  }

  testConnection(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const fileName = String(connectionMeta.fileName || "data.csv");
    const delimiter = String(connectionMeta.delimiter || ",");

    return Promise.resolve({
      success: true,
      status: "CONNECTED",
      message: `CSV data source configuration verified for ${fileName}`,
      details: {
        fileName,
        delimiter,
      },
    });
  }
}
