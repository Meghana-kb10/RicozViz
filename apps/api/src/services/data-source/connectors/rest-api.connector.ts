// ========================================
// REST API Data Source Connector
// ========================================
// Validates REST API endpoints and tests connectivity.
// Never exposes API keys, bearer tokens or internal endpoints in errors.
// ========================================

import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult,
} from "./connector.interface.js";

export class RestApiConnector implements DataSourceConnector {
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    const fieldErrors: Record<string, string[]> = {};

    if (!connectionMeta.url || typeof connectionMeta.url !== "string") {
      fieldErrors.url = ["URL is required"];
    } else {
      try {
        const parsed = new URL(connectionMeta.url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          fieldErrors.url = ["URL protocol must be http or https"];
        }
      } catch {
        fieldErrors.url = ["Invalid URL format"];
      }
    }

    if (
      connectionMeta.method !== undefined &&
      !["GET", "POST"].includes(String(connectionMeta.method).toUpperCase())
    ) {
      fieldErrors.method = ["HTTP method must be GET or POST"];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        valid: false,
        error: "Invalid REST API configuration",
        fieldErrors,
      };
    }

    return { valid: true };
  }

  async testConnection(
    connectionMeta: Record<string, unknown>,
    credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const rawUrl = String(connectionMeta.url || "");
    const method = String(connectionMeta.method || "GET").toUpperCase();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return {
        success: false,
        status: "FAILED",
        message: "Invalid target URL format",
      };
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "RicozViz-Connector/1.0",
    };

    // Attach credentials safely without leaking them in response
    if (credentials?.apiKey) {
      headers["X-API-Key"] = String(credentials.apiKey);
    }
    if (credentials?.bearerToken) {
      headers["Authorization"] = `Bearer ${String(credentials.bearerToken)}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(parsedUrl.toString(), {
        method,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isSuccess = response.status >= 200 && response.status < 400;

      return {
        success: isSuccess,
        status: isSuccess ? "CONNECTED" : "FAILED",
        message: isSuccess
          ? `Successfully reached API endpoint (${response.status} ${response.statusText || "OK"})`
          : `API returned status code ${response.status}`,
        details: {
          statusCode: response.status,
          protocol: parsedUrl.protocol,
          host: parsedUrl.host,
        },
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";

      return {
        success: false,
        status: "FAILED",
        message: isAbort
          ? "Connection timed out after 4 seconds"
          : "Unable to connect to REST API endpoint",
      };
    }
  }
}
