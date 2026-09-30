// ========================================
// Data Source Connector Interface
// ========================================
// Extensible interface for enterprise data source connectors.
// Future connectors (Snowflake, BigQuery, MySQL, etc.) implement this.
// ========================================

export interface ConnectionTestResult {
  success: boolean;
  status: "CONNECTED" | "FAILED";
  message: string;
  details?: Record<string, unknown>;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface DataSourceConnector {
  /**
   * Validates non-secret connection metadata and credentials structure.
   */
  validateConfiguration(
    connectionMeta: Record<string, unknown>,
    credentials?: Record<string, unknown>
  ): ConfigurationValidationResult;

  /**
   * Tests whether the data source can be reached and authenticated.
   * MUST never leak passwords, tokens or raw secrets in the result.
   */
  testConnection(
    connectionMeta: Record<string, unknown>,
    credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult>;
}
