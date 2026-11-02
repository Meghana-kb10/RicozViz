// ========================================
// Enterprise Data Warehouse Connector
// ========================================
// Connectors for:
// - Snowflake
// - ClickHouse
// - Google BigQuery
// - Databricks
// - Amazon Redshift
// - S3 Parquet Objects
//
// NOTE: Enterprise warehouse connectors are marked "Coming soon" and disabled.
// Live creation and simulated connection paths are removed so nothing fake runs.
// ========================================

import type {
  DataSourceConnector,
  ConnectionTestResult,
  ConfigurationValidationResult
} from './connector.interface.js';

export interface WarehouseConnectionConfig {
  type: 'SNOWFLAKE' | 'CLICKHOUSE' | 'BIGQUERY' | 'DATABRICKS' | 'REDSHIFT' | 'S3_PARQUET';
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  account?: string;
  warehouse?: string;
  projectId?: string;
  dataset?: string;
  catalog?: string;
  bucket?: string;
  region?: string;
  prefix?: string;
  endpoint?: string;
  ssl?: boolean;
}

export class WarehouseConnector implements DataSourceConnector {
  constructor(private readonly warehouseType: WarehouseConnectionConfig['type']) {}

  validateConfiguration(
    _connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): ConfigurationValidationResult {
    return {
      valid: false,
      error: `${this.warehouseType} connector is coming soon and disabled in this release. Creation and live testing are not permitted.`
    };
  }

  async testConnection(
    _connectionMeta: Record<string, unknown>,
    _credentials?: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    return {
      success: false,
      status: 'FAILED',
      message: `${this.warehouseType} connector is coming soon and disabled in this release.`
    };
  }
}
