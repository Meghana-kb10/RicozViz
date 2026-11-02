/**
 * RicozViz domain enumerations.
 *
 * These mirror the legacy Prisma enums one-to-one so that every persisted value,
 * query filter and API payload keeps its original string representation.
 */

// ---- User & organization -----------------------------------------------------

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION'
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const ORGANIZATION_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED'
} as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUS)[keyof typeof ORGANIZATION_STATUS];

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  INVITED: 'INVITED'
} as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

export const WORKSPACE_ROLE = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER'
} as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLE)[keyof typeof WORKSPACE_ROLE];

// ---- Data sources ------------------------------------------------------------

export const DATA_SOURCE_TYPE = {
  POSTGRESQL: 'POSTGRESQL',
  MYSQL: 'MYSQL',
  SQLITE: 'SQLITE',
  MONGODB: 'MONGODB',
  REST_API: 'REST_API',
  CSV_UPLOAD: 'CSV_UPLOAD',
  GOOGLE_SHEETS: 'GOOGLE_SHEETS',
  BIGQUERY: 'BIGQUERY',
  SNOWFLAKE: 'SNOWFLAKE',
  REDSHIFT: 'REDSHIFT',
  CLICKHOUSE: 'CLICKHOUSE',
  DATABRICKS: 'DATABRICKS',
  S3_PARQUET: 'S3_PARQUET',
  OTHER: 'OTHER'
} as const;
export type DataSourceType = (typeof DATA_SOURCE_TYPE)[keyof typeof DATA_SOURCE_TYPE];

export const DATA_SOURCE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ERROR: 'ERROR',
  PENDING: 'PENDING'
} as const;
export type DataSourceStatus = (typeof DATA_SOURCE_STATUS)[keyof typeof DATA_SOURCE_STATUS];

/**
 * Connectors the web UI can actually configure.
 *
 * Distinct from the persisted `DataSourceType` enum: the database also records
 * warehouse types (BIGQUERY, SNOWFLAKE, REDSHIFT, CLICKHOUSE, DATABRICKS, S3_PARQUET)
 * and the `CSV_UPLOAD` marker.
 */
export const DATA_SOURCE_CONNECTOR_TYPE = {
  POSTGRESQL: 'POSTGRESQL',
  MYSQL: 'MYSQL',
  SQLITE: 'SQLITE',
  CSV: 'CSV',
  REST_API: 'REST_API',
  XLSX: 'XLSX',
  JSON: 'JSON',
  SNOWFLAKE: 'SNOWFLAKE',
  CLICKHOUSE: 'CLICKHOUSE',
  BIGQUERY: 'BIGQUERY',
  DATABRICKS: 'DATABRICKS',
  REDSHIFT: 'REDSHIFT',
  S3_PARQUET: 'S3_PARQUET'
} as const;
export type DataSourceConnectorType =
  (typeof DATA_SOURCE_CONNECTOR_TYPE)[keyof typeof DATA_SOURCE_CONNECTOR_TYPE];

/** Status vocabulary surfaced by the web client for data source cards. */
export const DATA_SOURCE_DISPLAY_STATUS = {
  CONNECTED: 'CONNECTED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
  INACTIVE: 'INACTIVE'
} as const;
export type DataSourceDisplayStatus = (typeof DATA_SOURCE_DISPLAY_STATUS)[keyof typeof DATA_SOURCE_DISPLAY_STATUS];

export const DATASET_COLUMN_TYPE = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  DATETIME: 'DATETIME'
} as const;
export type DatasetColumnType = (typeof DATASET_COLUMN_TYPE)[keyof typeof DATASET_COLUMN_TYPE];

// ---- Datasets ----------------------------------------------------------------

export const DATASET_TYPE = {
  CONNECTED: 'CONNECTED',
  UPLOADED: 'UPLOADED',
  DERIVED: 'DERIVED'
} as const;
export type DatasetType = (typeof DATASET_TYPE)[keyof typeof DATASET_TYPE];

export const DATASET_SOURCE_TYPE = {
  CSV: 'CSV',
  XLSX: 'XLSX',
  JSON: 'JSON'
} as const;
export type DatasetSourceType = (typeof DATASET_SOURCE_TYPE)[keyof typeof DATASET_SOURCE_TYPE];

export const DATASET_STATUS = {
  ACTIVE: 'ACTIVE',
  DRAFT: 'DRAFT',
  ARCHIVED: 'ARCHIVED',
  ERROR: 'ERROR',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED'
} as const;
export type DatasetStatus = (typeof DATASET_STATUS)[keyof typeof DATASET_STATUS];

export const BLEND_JOIN_TYPE = {
  INNER: 'INNER',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  FULL_OUTER: 'FULL_OUTER'
} as const;
export type BlendJoinType = (typeof BLEND_JOIN_TYPE)[keyof typeof BLEND_JOIN_TYPE];

export const FILTER_LOGIC = {
  AND: 'AND',
  OR: 'OR'
} as const;
export type FilterLogic = (typeof FILTER_LOGIC)[keyof typeof FILTER_LOGIC];

// ---- Dashboards --------------------------------------------------------------

export const DASHBOARD_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED'
} as const;
export type DashboardStatus = (typeof DASHBOARD_STATUS)[keyof typeof DASHBOARD_STATUS];

export const DASHBOARD_VISIBILITY = {
  PRIVATE: 'PRIVATE',
  ORGANIZATION: 'ORGANIZATION',
  PUBLIC: 'PUBLIC'
} as const;
export type DashboardVisibility = (typeof DASHBOARD_VISIBILITY)[keyof typeof DASHBOARD_VISIBILITY];

export const DASHBOARD_ACCESS_LEVEL = {
  VIEW: 'VIEW',
  EDIT: 'EDIT',
  ADMIN: 'ADMIN'
} as const;
export type DashboardAccessLevel = (typeof DASHBOARD_ACCESS_LEVEL)[keyof typeof DASHBOARD_ACCESS_LEVEL];

// ---- Reports -----------------------------------------------------------------

export const REPORT_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED'
} as const;
export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

export const REPORT_FORMAT = {
  PDF: 'PDF',
  CSV: 'CSV',
  PNG: 'PNG',
  EXCEL: 'EXCEL'
} as const;
export type ReportFormat = (typeof REPORT_FORMAT)[keyof typeof REPORT_FORMAT];

export const REPORT_FREQUENCY = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY'
} as const;
export type ReportFrequency = (typeof REPORT_FREQUENCY)[keyof typeof REPORT_FREQUENCY];

export const REPORT_DELIVERY_TYPE = {
  EMAIL: 'EMAIL',
  WEBHOOK: 'WEBHOOK',
  BOTH: 'BOTH'
} as const;
export type ReportDeliveryType = (typeof REPORT_DELIVERY_TYPE)[keyof typeof REPORT_DELIVERY_TYPE];

export const REPORT_EXECUTION_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED'
} as const;
export type ReportExecutionStatus = (typeof REPORT_EXECUTION_STATUS)[keyof typeof REPORT_EXECUTION_STATUS];

// ---- Metrics & alerts --------------------------------------------------------

export const METRIC_FORMAT = {
  NUMBER: 'NUMBER',
  CURRENCY: 'CURRENCY',
  PERCENT: 'PERCENT'
} as const;
export type MetricFormat = (typeof METRIC_FORMAT)[keyof typeof METRIC_FORMAT];

export const METRIC_AGGREGATION = {
  SUM: 'SUM',
  AVG: 'AVG',
  COUNT: 'COUNT',
  MIN: 'MIN',
  MAX: 'MAX'
} as const;
export type MetricAggregation = (typeof METRIC_AGGREGATION)[keyof typeof METRIC_AGGREGATION];

/** Aggregations accepted by the in-memory dataset query engine. */
export const AGGREGATION_FUNCTION = {
  COUNT: 'COUNT',
  SUM: 'SUM',
  AVG: 'AVG',
  MIN: 'MIN',
  MAX: 'MAX'
} as const;
export type AggregationFunction = (typeof AGGREGATION_FUNCTION)[keyof typeof AGGREGATION_FUNCTION];

export const ALERT_CONDITION = {
  GREATER_THAN: 'GREATER_THAN',
  LESS_THAN: 'LESS_THAN',
  EQUALS: 'EQUALS',
  GREATER_THAN_OR_EQUAL: 'GREATER_THAN_OR_EQUAL',
  LESS_THAN_OR_EQUAL: 'LESS_THAN_OR_EQUAL'
} as const;
export type AlertCondition = (typeof ALERT_CONDITION)[keyof typeof ALERT_CONDITION];

/** Extra conditions supported by the evaluation engine beyond the persisted enum. */
export const ALERT_CONDITION_EXTENDED = {
  INCREASE_PERCENT: 'INCREASE_PERCENT',
  DECREASE_PERCENT: 'DECREASE_PERCENT',
  INCREASE_PCT: 'INCREASE_PCT',
  DECREASE_PCT: 'DECREASE_PCT'
} as const;
export type AlertConditionExtended =
  | AlertCondition
  | (typeof ALERT_CONDITION_EXTENDED)[keyof typeof ALERT_CONDITION_EXTENDED];

export const ALERT_STATUS = {
  OK: 'OK',
  TRIGGERED: 'TRIGGERED',
  PENDING: 'PENDING'
} as const;
export type AlertStatus = (typeof ALERT_STATUS)[keyof typeof ALERT_STATUS];

// ---- Exports -----------------------------------------------------------------

export const EXPORT_FORMAT = {
  CSV: 'CSV',
  EXCEL: 'EXCEL',
  PDF: 'PDF',
  PNG: 'PNG'
} as const;
export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

export const EXPORT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
} as const;
export type ExportStatus = (typeof EXPORT_STATUS)[keyof typeof EXPORT_STATUS];

export const EXPORT_RESOURCE_TYPE = {
  DATASET: 'DATASET',
  VISUALIZATION: 'VISUALIZATION',
  DASHBOARD: 'DASHBOARD'
} as const;
export type ExportResourceType = (typeof EXPORT_RESOURCE_TYPE)[keyof typeof EXPORT_RESOURCE_TYPE];

// ---- Audit -------------------------------------------------------------------

export const AUDIT_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  WARNING: 'WARNING'
} as const;
export type AuditStatus = (typeof AUDIT_STATUS)[keyof typeof AUDIT_STATUS];