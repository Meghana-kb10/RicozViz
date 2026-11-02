import { z } from 'zod';

// ==============================================================================
// Common Route Param & Query Schemas
// ==============================================================================

export const resourceIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Resource ID is required')
});

export const resourceTokenParamSchema = z.object({
  token: z.string().trim().min(1, 'Token is required')
});

export const resourceSlugParamSchema = z.object({
  slug: z.string().trim().min(1, 'Slug is required')
});

// ==============================================================================
// AI NL-to-Chart Validation Schemas
// ==============================================================================

export const aiFilterSchema = z.object({
  column: z.string().min(1),
  operator: z.string().default('='),
  value: z.unknown()
});

export const askAnalystSchema = z.object({
  datasetId: z.string().min(1, 'datasetId is required'),
  question: z.string().min(1, 'question is required'),
  filters: z.array(aiFilterSchema).optional(),
  dashboardId: z.string().optional()
});

export const nlToChartSchema = z.object({
  datasetId: z.string().min(1, 'datasetId is required'),
  prompt: z.string().min(1, 'prompt is required'),
  filters: z.array(aiFilterSchema).optional()
});

export const insightsSchema = z.object({
  datasetId: z.string().min(1, 'datasetId is required'),
  dimension: z.string().optional(),
  measure: z.string().optional(),
  filters: z.array(aiFilterSchema).optional(),
  data: z.array(z.record(z.unknown())).optional()
});

export const dashboardSummarySchema = z.object({
  dashboardId: z.string().min(1, 'dashboardId is required'),
  activeFilters: z.array(aiFilterSchema).optional(),
  filters: z.array(aiFilterSchema).optional()
});

// ==============================================================================
// Data Source Validation Schemas
// ==============================================================================

export const testRawConnectionSchema = z.object({
  type: z.enum(['POSTGRESQL', 'MYSQL', 'SQLITE', 'CSV', 'XLSX', 'JSON', 'REST_API', 'SNOWFLAKE', 'BIGQUERY', 'CLICKHOUSE', 'DATABRICKS', 'REDSHIFT', 'S3_PARQUET']),
  connection: z.record(z.unknown()).default({})
});

export const createDataSourceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(['POSTGRESQL', 'MYSQL', 'SQLITE', 'CSV', 'XLSX', 'JSON', 'REST_API', 'SNOWFLAKE', 'BIGQUERY', 'CLICKHOUSE', 'DATABRICKS', 'REDSHIFT', 'S3_PARQUET']),
  workspaceId: z.string().trim().min(1).optional().nullable(),
  connection: z.record(z.unknown()).default({})
});

export const updateDataSourceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  workspaceId: z.string().trim().min(1).optional().nullable(),
  connection: z.record(z.unknown()).optional()
});

// ==============================================================================
// Dataset Validation Schemas
// ==============================================================================

export const createDatasetSchema = z.object({
  name: z.string().trim().min(1, 'Dataset name is required').max(150),
  description: z.string().max(1000).optional().nullable(),
  dataSourceId: z.string().trim().min(1).optional().nullable(),
  workspaceId: z.string().trim().min(1).optional().nullable(),
  query: z.string().optional().nullable(),
  sourceTable: z.string().optional().nullable(),
  columns: z.array(z.record(z.unknown())).optional()
});

export const updateDatasetSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  workspaceId: z.string().trim().min(1).optional().nullable(),
  query: z.string().optional().nullable()
});

export const listDatasetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  workspaceId: z.string().optional(),
  search: z.string().optional()
});

export const datasetQueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  filter: z.array(z.record(z.unknown())).optional(),
  groupBy: z.array(z.string()).optional(),
  orderBy: z.array(z.record(z.unknown())).optional()
});

// ==============================================================================
// Dashboard Validation Schemas
// ==============================================================================

export const createDashboardSchema = z.object({
  name: z.string().trim().min(1, 'Dashboard name is required').max(150),
  description: z.string().max(1000).optional().nullable(),
  workspaceId: z.string().trim().min(1).optional().nullable(),
  layout: z.array(z.record(z.unknown())).default([])
});

export const updateDashboardSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  workspaceId: z.string().trim().min(1).optional().nullable(),
  layout: z.array(z.record(z.unknown())).optional()
});

export const listDashboardsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  workspaceId: z.string().optional(),
  search: z.string().optional()
});

export const createEmbedConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allowedOrigins: z.array(z.string()).default(['*']),
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  showTitle: z.boolean().default(true),
  expiresInDays: z.number().min(1).max(365).optional()
});

// ==============================================================================
// Chart & Visualization Validation Schemas
// ==============================================================================

export const createChartSchema = z.object({
  dashboardId: z.string().trim().min(1, 'Dashboard ID is required'),
  datasetId: z.string().trim().min(1, 'Dataset ID is required'),
  title: z.string().trim().min(1, 'Chart title is required').max(150),
  chartType: z.string().trim().min(1, 'Chart type is required'),
  config: z.record(z.unknown()).default({})
});

export const updateChartSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  chartType: z.string().trim().min(1).optional(),
  config: z.record(z.unknown()).optional()
});

// ==============================================================================
// Metric & Alert Validation Schemas
// ==============================================================================

export const createAlertSchema = z.object({
  name: z.string().trim().min(1, 'Alert name is required').max(150),
  description: z.string().max(500).optional().nullable(),
  metricId: z.string().trim().min(1, 'Metric ID is required'),
  workspaceId: z.string().trim().min(1).optional().nullable(),
  condition: z.string().trim().min(1, 'Condition is required'),
  threshold: z.number(),
  enabled: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  recipients: z.array(z.string().email()).optional(),
  slackWebhookUrl: z.string().url().optional().nullable()
});

export const updateAlertSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(500).optional().nullable(),
  condition: z.string().trim().min(1).optional(),
  threshold: z.number().optional(),
  enabled: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  recipients: z.array(z.string().email()).optional(),
  slackWebhookUrl: z.string().url().optional().nullable()
});

// ==============================================================================
// Export Validation Schemas
// ==============================================================================

export const exportRequestSchema = z.object({
  resourceType: z.enum(['DASHBOARD', 'DATASET', 'VISUALIZATION']),
  resourceId: z.string().trim().min(1),
  format: z.enum(['CSV', 'JSON', 'PDF', 'EXCEL']),
  recipients: z.array(z.string().email()).optional()
});

// ==============================================================================
// Workspace Validation Schemas
// ==============================================================================

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(100),
  description: z.string().max(500).optional().nullable()
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable()
});
