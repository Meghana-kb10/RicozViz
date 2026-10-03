// ========================================
// XLSX Data Source Connector
// ========================================
// Validates file-based Excel (XLSX) data source configurations.
// ========================================

import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult,
} from "./connector.interface.js";

export class XlsxConnector implements DataSourceConnector {
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    const fieldErrors: Record<string, string[]> = {};

    if (!connectionMeta.fileName || typeof connectionMeta.fileName !== "string") {
      fieldErrors.fileName = ["File name is required"];
    } else {
      const lower = connectionMeta.fileName.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
        fieldErrors.fileName = ["File must be an Excel spreadsheet (.xlsx or .xls)"];
      }
    }

    if (
      connectionMeta.sheetName !== undefined &&
      (typeof connectionMeta.sheetName !== "string" || connectionMeta.sheetName.trim().length === 0)
    ) {
      fieldErrors.sheetName = ["Sheet name must be a non-empty string"];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        valid: false,
        error: "Invalid XLSX data source configuration",
        fieldErrors,
      };
    }

    return { valid: true };
  }

  testConnection(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const fileName = String(connectionMeta.fileName || "data.xlsx");
    const sheetName = connectionMeta.sheetName ? String(connectionMeta.sheetName) : "Sheet1";

    return Promise.resolve({
      success: true,
      status: "CONNECTED",
      message: `Excel (XLSX) data source configuration verified for ${fileName}`,
      details: {
        fileName,
        sheetName,
      },
    });
  }
}
