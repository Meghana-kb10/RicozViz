// ========================================
// Chart Management Service
// ========================================
// Handles Chart CRUD, configuration validation,
// dataset linkage, dashboard multi-tenancy, and audit logging.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Chart, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import {
  ALLOWED_AGGREGATIONS,
  ALLOWED_FILTER_OPERATORS,
} from "../dataset/query-engine.js";

// ============================================================
// CONSTANTS & ENUMS
// ============================================================

export const ALLOWED_CHART_TYPES = [
  "BAR",
  "LINE",
  "AREA",
  "PIE",
  "DONUT",
  "SCATTER",
  "TABLE",
  "KPI",
] as const;

export type ChartType = (typeof ALLOWED_CHART_TYPES)[number];

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const chartPositionSchema = z.object({
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  w: z.number().int().min(1).max(24).default(6),
  h: z.number().int().min(1).max(24).default(4),
});

export const chartConfigSchema = z.object({
  dimensions: z.array(z.string().min(1)).max(10).default([]).optional(),
  measures: z
    .array(
      z.object({
        column: z.string().min(1),
        aggregation: z.enum(ALLOWED_AGGREGATIONS),
        alias: z.string().max(63).optional(),
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
        value: z.unknown().optional(),
      })
    )
    .max(20)
    .default([])
    .optional(),
  sort: z
    .object({
      column: z.string().min(1),
      direction: z.enum(["asc", "desc", "ASC", "DESC"]).default("asc"),
    })
    .optional(),
  options: z.record(z.unknown()).default({}).optional(),
});

export const createChartSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title must be 100 characters or less"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  chartType: z
    .string()
    .toUpperCase()
    .refine(
      (val): val is ChartType =>
        ALLOWED_CHART_TYPES.includes(val as ChartType),
      {
        message: `Invalid chart type. Supported: ${ALLOWED_CHART_TYPES.join(", ")}`,
      }
    ),
  datasetId: z.string().uuid("Invalid Dataset ID").optional().nullable(),
  config: chartConfigSchema.default({}),
  position: chartPositionSchema.default({ x: 0, y: 0, w: 6, h: 4 }),
  sortOrder: z.number().int().default(0).optional(),
});

export const updateChartSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(100, "Title must be 100 characters or less")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  chartType: z
    .string()
    .toUpperCase()
    .refine(
      (val): val is ChartType =>
        ALLOWED_CHART_TYPES.includes(val as ChartType),
      {
        message: `Invalid chart type. Supported: ${ALLOWED_CHART_TYPES.join(", ")}`,
      }
    )
    .optional(),
  datasetId: z.string().uuid("Invalid Dataset ID").optional().nullable(),
  config: chartConfigSchema.optional(),
  position: chartPositionSchema.optional(),
  sortOrder: z.number().int().optional(),
});

// ============================================================
// HELPER: BUILD SAFE CHART RESPONSE
// ============================================================

export function buildSafeChart(
  chart: Chart & {
    dataset?: { id: string; name: string; type: string } | null;
  }
) {
  return {
    id: chart.id,
    dashboardId: chart.dashboardId,
    datasetId: chart.datasetId,
    datasetName: chart.dataset?.name || null,
    datasetType: chart.dataset?.type || null,
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType,
    config: chart.config || {},
    position: chart.position || { x: 0, y: 0, w: 6, h: 4 },
    sortOrder: chart.sortOrder,
    createdAt: chart.createdAt.toISOString(),
    updatedAt: chart.updatedAt.toISOString(),
  };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/dashboards/:dashboardId/charts
 * Create a new chart in a dashboard.
 */
export async function createChart(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { dashboardId } = req.params;

  if (!dashboardId) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  // 1. Verify dashboard existence and tenant ownership
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  // 2. Validate input
  const input = createChartSchema.parse(req.body);

  // 3. Verify dataset existence and tenant ownership (if provided)
  if (input.datasetId) {
    const dataset = await prisma.dataset.findUnique({
      where: { id: input.datasetId },
    });

    if (!dataset) {
      throw AppError.notFound("Dataset");
    }

    if (dataset.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: dataset belongs to a different organization");
    }
  }

  // 4. Create chart record
  const chart = await prisma.chart.create({
    data: {
      dashboardId,
      datasetId: input.datasetId || null,
      title: input.title,
      description: input.description || null,
      chartType: input.chartType,
      config: input.config as Prisma.InputJsonValue,
      position: input.position as Prisma.InputJsonValue,
      sortOrder: input.sortOrder ?? 0,
    },
    include: {
      dataset: { select: { id: true, name: true, type: true } },
    },
  });

  // 5. Audit Log
  await logAuditEvent({
    organizationId,
    userId,
    action: "CHART_CREATED",
    resourceType: "Chart",
    resourceId: chart.id,
    metadata: {
      dashboardId,
      title: chart.title,
      chartType: chart.chartType,
      datasetId: chart.datasetId,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(201);
  sendSuccess(res, buildSafeChart(chart));
}

/**
 * GET /api/v1/dashboards/:dashboardId/charts
 * List all charts configured in a dashboard.
 */
export async function listCharts(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const { dashboardId } = req.params;

  if (!dashboardId) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  // Verify dashboard existence and tenant ownership
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  const charts = await prisma.chart.findMany({
    where: { dashboardId },
    orderBy: { sortOrder: "asc" },
    include: {
      dataset: { select: { id: true, name: true, type: true } },
    },
  });

  sendSuccess(res, charts.map(buildSafeChart));
}

/**
 * GET /api/v1/dashboards/:dashboardId/charts/:chartId
 * Retrieve a specific chart.
 */
export async function getChart(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { dashboardId, chartId } = req.params;

  if (!dashboardId || !chartId) {
    throw AppError.badRequest("Dashboard ID and Chart ID are required");
  }

  // Verify dashboard existence and tenant ownership
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    include: {
      dataset: { select: { id: true, name: true, type: true } },
    },
  });

  if (!chart) {
    throw AppError.notFound("Chart");
  }

  // Prevent cross-dashboard ID manipulation
  if (chart.dashboardId !== dashboardId) {
    throw AppError.notFound("Chart not found in this dashboard");
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: "CHART_VIEWED",
    resourceType: "Chart",
    resourceId: chart.id,
    metadata: {
      dashboardId,
      title: chart.title,
      chartType: chart.chartType,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeChart(chart));
}

/**
 * PATCH /api/v1/dashboards/:dashboardId/charts/:chartId
 * Update chart configuration, title, type, or position.
 */
export async function updateChart(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { dashboardId, chartId } = req.params;

  if (!dashboardId || !chartId) {
    throw AppError.badRequest("Dashboard ID and Chart ID are required");
  }

  // 1. Verify dashboard existence and tenant ownership
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  // 2. Verify chart existence and dashboard ownership
  const existingChart = await prisma.chart.findUnique({
    where: { id: chartId },
  });

  if (!existingChart) {
    throw AppError.notFound("Chart");
  }

  if (existingChart.dashboardId !== dashboardId) {
    throw AppError.notFound("Chart not found in this dashboard");
  }

  // 3. Validate input
  const input = updateChartSchema.parse(req.body);

  // 4. Verify dataset existence and tenant ownership if updated
  if (input.datasetId !== undefined && input.datasetId !== null) {
    const dataset = await prisma.dataset.findUnique({
      where: { id: input.datasetId },
    });

    if (!dataset) {
      throw AppError.notFound("Dataset");
    }

    if (dataset.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: dataset belongs to a different organization");
    }
  }

  // 5. Update chart
  const data: Prisma.ChartUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.chartType !== undefined) data.chartType = input.chartType;
  if (input.datasetId !== undefined) {
    data.dataset = input.datasetId
      ? { connect: { id: input.datasetId } }
      : { disconnect: true };
  }
  if (input.config !== undefined) {
    data.config = input.config as Prisma.InputJsonValue;
  }
  if (input.position !== undefined) {
    data.position = input.position as Prisma.InputJsonValue;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const updated = await prisma.chart.update({
    where: { id: chartId },
    data,
    include: {
      dataset: { select: { id: true, name: true, type: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CHART_UPDATED",
    resourceType: "Chart",
    resourceId: updated.id,
    metadata: {
      dashboardId,
      title: updated.title,
      updatedFields: Object.keys(data),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeChart(updated));
}

/**
 * DELETE /api/v1/dashboards/:dashboardId/charts/:chartId
 * Delete a chart from a dashboard.
 */
export async function deleteChart(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { dashboardId, chartId } = req.params;

  if (!dashboardId || !chartId) {
    throw AppError.badRequest("Dashboard ID and Chart ID are required");
  }

  // Verify dashboard existence and tenant ownership
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  // Verify chart existence and dashboard ownership
  const existingChart = await prisma.chart.findUnique({
    where: { id: chartId },
  });

  if (!existingChart) {
    throw AppError.notFound("Chart");
  }

  if (existingChart.dashboardId !== dashboardId) {
    throw AppError.notFound("Chart not found in this dashboard");
  }

  await prisma.chart.delete({
    where: { id: chartId },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CHART_DELETED",
    resourceType: "Chart",
    resourceId: chartId,
    metadata: {
      dashboardId,
      title: existingChart.title,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: "Chart deleted successfully" });
}
