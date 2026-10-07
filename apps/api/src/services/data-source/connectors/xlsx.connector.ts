// ========================================
// XLSX Data Source Connector
// ========================================
// Validates file-based Excel (XLSX) data source configurations.
// ========================================

import fs from "node:fs";
import path from "node:path";
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

    const rawFile = connectionMeta.fileName || connectionMeta.filePath;
    if (!rawFile || typeof rawFile !== "string") {
      fieldErrors.fileName = ["File name or path is required"];
    } else {
      const lower = rawFile.toLowerCase();
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
    const rawFile = String(connectionMeta.fileName || connectionMeta.filePath || "data.xlsx");
    const sheetName = connectionMeta.sheetName ? String(connectionMeta.sheetName) : "Sheet1";

    if (rawFile.includes("/") || rawFile.includes("\\")) {
      const resolved = path.resolve(rawFile);
      if (!fs.existsSync(resolved)) {
        return Promise.resolve({
          success: false,
          status: "FAILED",
          message: `XLSX file does not exist at path: ${rawFile}`,
        });
      }
    }

    return Promise.resolve({
      success: true,
      status: "CONNECTED",
      message: `Excel (XLSX) data source configuration verified for ${rawFile}`,
      details: {
        fileName: rawFile,
        sheetName,
      },
    });
  }
}
