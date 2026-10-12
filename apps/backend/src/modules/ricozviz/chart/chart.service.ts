// ========================================
// Chart Management Service
// ========================================
// Handles Chart CRUD, configuration validation,
// dataset linkage, dashboard multi-tenancy, and audit logging.
// ========================================

import { z } from 'zod';
import { ChartModel, DashboardModel, DatasetModel, toObjectId, serializeDocs } from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  ALLOWED_AGGREGATIONS,
  ALLOWED_FILTER_OPERATORS
} from '../dashboard/dashboard.service.js';
import { idIdentifierSchema, requireObjectId } from '../dashboard/dashboard-access.service.js';
import type { AuthenticatedUser, ChartData, ChartPosition, ChartType } from '@repo/types';

// ============================================================
// CONSTANTS & ENUMS
// ============================================================

export const ALLOWED_CHART_TYPES = [
  'BAR',
  'LINE',
  'AREA',
  'PIE',
  'DONUT',
  'SCATTER',
  'TABLE',
  'KPI',
  'RADAR',
  'FUNNEL',
  'HEATMAP',
  'MAP'
] as const;

export type AllowedChartType = (typeof ALLOWED_CHART_TYPES)[number];

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const chartPositionSchema = z.object({
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  w: z.number().int().min(1).max(24).default(6),
  h: z.number().int().min(1).max(24).default(4)
});

export const chartConfigSchema = z.object({
  dimensions: z.array(z.string().min(1)).max(10).default([]).optional(),
  measures: z
    .array(
      z.object({
        column: z.string().min(1),
        aggregation: z.enum(ALLOWED_AGGREGATIONS),
        alias: z.string().max(63).optional()
      })
    )
    .max(20)
    .default([])
    .optional(),
  xAxis: z.string().optional(),
  yAxis: z.union([z.string(), z.array(z.string())]).optional(),
  filters: z
    .array(
      z.object({
        column: z.string().min(1),
        operator: z.enum(ALLOWED_FILTER_OPERATORS),
        value: z.unknown().optional()
      })
    )
    .max(20)
    .default([])
    .optional(),
  sort: z
    .object({
      column: z.string().min(1),
      direction: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc')
    })
    .optional(),
  options: z.record(z.unknown()).default({}).optional()
});

export const createChartSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  chartType: z
    .string()
    .toUpperCase()
    .refine(
      (val): val is AllowedChartType => ALLOWED_CHART_TYPES.includes(val as AllowedChartType),
      {
        message: `Invalid chart type. Supported: ${ALLOWED_CHART_TYPES.join(', ')}`
      }
    ),
  datasetId: idIdentifierSchema('Invalid Dataset ID').optional().nullable(),
  config: chartConfigSchema.default({}),
  position: chartPositionSchema.default({ x: 0, y: 0, w: 6, h: 4 }),
  sortOrder: z.number().int().default(0).optional()
});

export const updateChartSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(100, 'Title must be 100 characters or less')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  chartType: z
    .string()
    .toUpperCase()
    .refine(
      (val): val is AllowedChartType => ALLOWED_CHART_TYPES.includes(val as AllowedChartType),
      {
        message: `Invalid chart type. Supported: ${ALLOWED_CHART_TYPES.join(', ')}`
      }
    )
    .optional(),
  datasetId: idIdentifierSchema('Invalid Dataset ID').optional().nullable(),
  config: chartConfigSchema.optional(),
  position: chartPositionSchema.optional(),
  sortOrder: z.number().int().optional()
});

// ============================================================
// HELPER: BUILD SAFE CHART RESPONSE
// ============================================================

interface ChartSource {
  id: string;
  dashboardId: string;
  datasetId: string | null;
  title: string;
  description: string | null;
  chartType: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  dataset?: { id: string; name: string; type: string } | null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildSafeChart(chart: ChartSource): ChartData {
  return {
    id: chart.id,
    dashboardId: chart.dashboardId,
    datasetId: chart.datasetId,
    datasetName: chart.dataset?.name || null,
    datasetType: chart.dataset?.type || null,
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType as ChartType,
    config: (chart.config || {}) as ChartData['config'],
    position: (chart.position || { x: 0, y: 0, w: 6, h: 4 }) as unknown as ChartPosition,
    sortOrder: chart.sortOrder,
    createdAt: toIso(chart.createdAt),
    updatedAt: toIso(chart.updatedAt)
  };
}

function getPopulatedDataset(
  value: unknown
): { id: string; name: string; type: string } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const dataset = value as Record<string, unknown>;
  const id = dataset.id ?? dataset._id;
  if (id === null || id === undefined) {
    return null;
  }
  return {
    id: String(id),
    name: String(dataset.name ?? ''),
    type: String(dataset.type ?? '')
  };
}

/** Load the owning dashboard and assert tenant isolation. */
async function assertDashboardOwnership(
  dashboardId: string,
  organizationId: string
): Promise<{ id: string }> {
  if (!dashboardId) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(dashboardId);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId).select('organizationId').lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  if (dashboard.organizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: dashboard belongs to a different organization');
  }

  return { id: requireObjectId(dashboard._id, 'Dashboard').toString() };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/dashboards/:dashboardId/charts
 * Create a new chart in a dashboard.
 */
export async function createChart(
  user: AuthenticatedUser,
  dashboardId: string,
  input: z.infer<typeof createChartSchema>,
  audit: { ipAddress?: string; userAgent?: string } = {}
): Promise<ChartData> {
  const { organizationId, userId } = user;

  // 1. Verify dashboard existence and tenant ownership
  const dashboard = await assertDashboardOwnership(dashboardId, organizationId);

  // 2. Validate input (done by the caller through the zod schema)

  // 3. Verify dataset existence and tenant ownership (if provided)
  if (input.datasetId) {
    const datasetObjectId = toObjectId(input.datasetId);
    const dataset = datasetObjectId
      ? await DatasetModel.findById(datasetObjectId).lean()
      : null;

    if (!dataset) {
      throw AppError.notFound('Dataset');
    }

    if (dataset.organizationId.toString() !== organizationId) {
      throw AppError.forbidden('Access denied: dataset belongs to a different organization');
    }
  }

  // 4. Create chart record
  const chart = await ChartModel.create({
    dashboardId: requireObjectId(dashboard.id, 'Dashboard'),
    datasetId: input.datasetId ? requireObjectId(input.datasetId, 'Dataset') : null,
    title: input.title,
    description: input.description || null,
    chartType: input.chartType,
    config: input.config as Record<string, unknown>,
    position: input.position as unknown as Record<string, unknown>,
    sortOrder: input.sortOrder ?? 0
  });

  const dataset = chart.datasetId
    ? await DatasetModel.findById(chart.datasetId).select('name type').lean()
    : null;

  // 5. Audit Log
  await logAuditEvent({
    organizationId,
    userId,
    action: 'CHART_CREATED',
    resourceType: 'Chart',
    resourceId: chart._id.toString(),
    metadata: {
      dashboardId: dashboard.id,
      title: chart.title,
      chartType: chart.chartType,
      datasetId: chart.datasetId
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  return buildSafeChart({
    id: chart._id.toString(),
    dashboardId: chart.dashboardId.toString(),
    datasetId: chart.datasetId ? chart.datasetId.toString() : null,
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType,
    config: (chart.config || {}) as Record<string, unknown>,
    position: (chart.position || {}) as Record<string, unknown>,
    sortOrder: chart.sortOrder,
    createdAt: chart.createdAt,
    updatedAt: chart.updatedAt,
    dataset: dataset ? { id: dataset._id.toString(), name: dataset.name, type: dataset.type } : null
  });
}

/**
 * GET /api/v1/dashboards/:dashboardId/charts
 * List all charts configured in a dashboard.
 */
export async function listCharts(
  user: AuthenticatedUser,
  dashboardId: string
): Promise<ChartData[]> {
  const { organizationId } = user;

  const dashboard = await assertDashboardOwnership(dashboardId, organizationId);

  const charts = await ChartModel.find({ dashboardId: toObjectId(dashboard.id) })
    .sort({ sortOrder: 1 })
    .populate<{ datasetId: { _id: unknown; name: string; type: string } | null }>(
      'datasetId',
      'name type'
    )
    .lean();

  const serialized = serializeDocs<Record<string, unknown>>(charts);

  return serialized.map((chart) => {
    const dataset = getPopulatedDataset(chart.datasetId);
    return buildSafeChart({
      id: String(chart.id ?? ''),
      dashboardId: String(chart.dashboardId ?? ''),
      datasetId: dataset?.id ?? null,
      title: String(chart.title ?? ''),
      description: (chart.description ?? null) as string | null,
      chartType: String(chart.chartType ?? ''),
      config: (chart.config ?? {}) as Record<string, unknown>,
      position: (chart.position ?? {}) as Record<string, unknown>,
      sortOrder: Number(chart.sortOrder ?? 0),
      createdAt: chart.createdAt as string,
      updatedAt: chart.updatedAt as string,
      dataset
    });
  });
}

/**
 * GET /api/v1/dashboards/:dashboardId/charts/:chartId
 * Retrieve a specific chart.
 */
export async function getChart(
  user: AuthenticatedUser,
  dashboardId: string,
  chartId: string,
  audit: { ipAddress?: string; userAgent?: string } = {}
): Promise<ChartData> {
  const { organizationId, userId } = user;

  if (!dashboardId || !chartId) {
    throw AppError.badRequest('Dashboard ID and Chart ID are required');
  }

  // Verify dashboard existence and tenant ownership
  const dashboard = await assertDashboardOwnership(dashboardId, organizationId);

  const chartObjectId = toObjectId(chartId);
  const chart = chartObjectId
    ? await ChartModel.findById(chartObjectId)
        .populate<{ datasetId: { _id: unknown; name: string; type: string } | null }>(
          'datasetId',
          'name type'
        )
        .lean()
    : null;

  if (!chart) {
    throw AppError.notFound('Chart');
  }

  // Prevent cross-dashboard ID manipulation
  if (chart.dashboardId.toString() !== dashboard.id) {
    throw AppError.notFound('Chart not found in this dashboard');
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'CHART_VIEWED',
    resourceType: 'Chart',
    resourceId: chart._id.toString(),
    metadata: {
      dashboardId: dashboard.id,
      title: chart.title,
      chartType: chart.chartType
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  const serialized = serializeDocs<Record<string, unknown>>([chart])[0];
  const dataset = getPopulatedDataset(serialized.datasetId);

  return buildSafeChart({
    id: String(serialized.id ?? ''),
    dashboardId: String(serialized.dashboardId ?? ''),
    datasetId: dataset?.id ?? null,
    title: String(serialized.title ?? ''),
    description: (serialized.description ?? null) as string | null,
    chartType: String(serialized.chartType ?? ''),
    config: (serialized.config ?? {}) as Record<string, unknown>,
    position: (serialized.position ?? {}) as Record<string, unknown>,
    sortOrder: Number(serialized.sortOrder ?? 0),
    createdAt: serialized.createdAt as string,
    updatedAt: serialized.updatedAt as string,
    dataset
  });
}

/**
 * PATCH /api/v1/dashboards/:dashboardId/charts/:chartId
 * Update chart configuration, title, type, or position.
 */
export async function updateChart(
  user: AuthenticatedUser,
  dashboardId: string,
  chartId: string,
  input: z.infer<typeof updateChartSchema>,
  audit: { ipAddress?: string; userAgent?: string } = {}
): Promise<ChartData> {
  const { organizationId, userId } = user;

  if (!dashboardId || !chartId) {
    throw AppError.badRequest('Dashboard ID and Chart ID are required');
  }

  // 1. Verify dashboard existence and tenant ownership
  const dashboard = await assertDashboardOwnership(dashboardId, organizationId);

  // 2. Verify chart existence and dashboard ownership
  const chartObjectId = toObjectId(chartId);
  const existingChart = chartObjectId
    ? await ChartModel.findById(chartObjectId).lean()
    : null;

  if (!existingChart) {
    throw AppError.notFound('Chart');
  }

  if (existingChart.dashboardId.toString() !== dashboard.id) {
    throw AppError.notFound('Chart not found in this dashboard');
  }

  // 3. Validate input (done by the caller through the zod schema)

  // 4. Verify dataset existence and tenant ownership if updated
  if (input.datasetId !== undefined && input.datasetId !== null) {
    const datasetObjectId = toObjectId(input.datasetId);
    const dataset = datasetObjectId
      ? await DatasetModel.findById(datasetObjectId).lean()
      : null;

    if (!dataset) {
      throw AppError.notFound('Dataset');
    }

    if (dataset.organizationId.toString() !== organizationId) {
      throw AppError.forbidden('Access denied: dataset belongs to a different organization');
    }
  }

  // 5. Update chart
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.chartType !== undefined) data.chartType = input.chartType;
  if (input.datasetId !== undefined) {
    data.datasetId = input.datasetId ? toObjectId(input.datasetId) : null;
  }
  if (input.config !== undefined) {
    data.config = input.config as Record<string, unknown>;
  }
  if (input.position !== undefined) {
    data.position = input.position as unknown as Record<string, unknown>;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const updated = await ChartModel.findByIdAndUpdate(existingChart._id, { $set: data }, { new: true })
    .populate<{ datasetId: { _id: unknown; name: string; type: string } | null }>(
      'datasetId',
      'name type'
    )
    .lean();

  if (!updated) {
    throw AppError.notFound('Chart');
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'CHART_UPDATED',
    resourceType: 'Chart',
    resourceId: updated._id.toString(),
    metadata: {
      dashboardId: dashboard.id,
      title: updated.title,
      updatedFields: Object.keys(data)
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  const serialized = serializeDocs<Record<string, unknown>>([updated])[0];
  const dataset = getPopulatedDataset(serialized.datasetId);

  return buildSafeChart({
    id: String(serialized.id ?? ''),
    dashboardId: String(serialized.dashboardId ?? ''),
    datasetId: dataset?.id ?? null,
    title: String(serialized.title ?? ''),
    description: (serialized.description ?? null) as string | null,
    chartType: String(serialized.chartType ?? ''),
    config: (serialized.config ?? {}) as Record<string, unknown>,
    position: (serialized.position ?? {}) as Record<string, unknown>,
    sortOrder: Number(serialized.sortOrder ?? 0),
    createdAt: serialized.createdAt as string,
    updatedAt: serialized.updatedAt as string,
    dataset
  });
}

/**
 * DELETE /api/v1/dashboards/:dashboardId/charts/:chartId
 * Delete a chart from a dashboard.
 */
export async function deleteChart(
  user: AuthenticatedUser,
  dashboardId: string,
  chartId: string,
  audit: { ipAddress?: string; userAgent?: string } = {}
): Promise<{ message: string }> {
  const { organizationId, userId } = user;

  if (!dashboardId || !chartId) {
    throw AppError.badRequest('Dashboard ID and Chart ID are required');
  }

  // Verify dashboard existence and tenant ownership
  const dashboard = await assertDashboardOwnership(dashboardId, organizationId);

  // Verify chart existence and dashboard ownership
  const chartObjectId = toObjectId(chartId);
  const existingChart = chartObjectId
    ? await ChartModel.findById(chartObjectId).lean()
    : null;

  if (!existingChart) {
    throw AppError.notFound('Chart');
  }

  if (existingChart.dashboardId.toString() !== dashboard.id) {
    throw AppError.notFound('Chart not found in this dashboard');
  }

  await ChartModel.deleteOne({ _id: existingChart._id }).exec();

  await logAuditEvent({
    organizationId,
    userId,
    action: 'CHART_DELETED',
    resourceType: 'Chart',
    resourceId: chartId,
    metadata: {
      dashboardId: dashboard.id,
      title: existingChart.title
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  return { message: 'Chart deleted successfully' };
}
