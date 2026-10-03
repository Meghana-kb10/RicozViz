// ========================================
// Visualization Service
// ========================================
// Powers the RicozViz Visualization Engine.
// Provides standalone visualization CRUD, query execution against datasets,
// multi-tenant and workspace authorization, and live chart-ready data mapping.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Chart, Dataset, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import {
  datasetQueryEngine,
  ALLOWED_AGGREGATIONS,
  type AggregationFunction,
  type DatasetQueryParams,
} from "../dataset/query-engine.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";

// ============================================================
// CONSTANTS & SCHEMAS
// ============================================================

export const ALLOWED_VISUALIZATION_TYPES = [
  "BAR",
  "LINE",
  "AREA",
  "PIE",
  "DONUT",
  "TABLE",
  "KPI",
  "SCATTER",
  "RADAR",
  "FUNNEL",
  "HEATMAP",
] as const;

export type VisualizationType = (typeof ALLOWED_VISUALIZATION_TYPES)[number];

export const visualizationConfigSchema = z.object({
  xAxis: z.string().optional(),
  category: z.string().optional(),
  yAxis: z.union([z.string(), z.array(z.string())]).optional(),
  value: z.union([z.string(), z.array(z.string())]).optional(),
  aggregation: z.string().optional(),
  series: z.string().optional(),
  group: z.string().optional(),
  dimensions: z.array(z.string().min(1)).max(10).optional(),
  groupBy: z.array(z.string().min(1)).max(10).optional(),
  measures: z
    .array(
      z.object({
        column: z.string().min(1),
        aggregation: z.union([z.enum(ALLOWED_AGGREGATIONS), z.string()]),
        alias: z.string().max(63).optional(),
      })
    )
    .max(20)
    .optional(),
  aggregations: z
    .array(
      z.object({
        column: z.string().min(1),
        function: z.string().optional(),
        aggregation: z.string().optional(),
        alias: z.string().max(63).optional(),
      })
    )
    .max(20)
    .optional(),
  columns: z.array(z.string().min(1)).max(50).optional(),
  filters: z
    .array(
      z.object({
        column: z.string().min(1),
        operator: z.string().min(1),
        value: z.unknown().optional(),
      })
    )
    .max(20)
    .optional(),
  sort: z
    .object({
      column: z.string().min(1),
      direction: z.union([z.enum(["asc", "desc", "ASC", "DESC"]), z.string()]).default("asc"),
    })
    .optional(),
  sorting: z
    .union([
      z.object({
        column: z.string().min(1),
        direction: z.union([z.enum(["asc", "desc", "ASC", "DESC"]), z.string()]).default("asc"),
      }),
      z.array(
        z.object({
          column: z.string().min(1),
          direction: z.union([z.enum(["asc", "desc", "ASC", "DESC"]), z.string()]).default("asc"),
        })
      ),
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  options: z.record(z.unknown()).default({}).optional(),
});

export const createVisualizationSchema = z.preprocess(
  (raw: any) => {
    if (raw && typeof raw === "object") {
      const copy = { ...raw };
      if (!copy.chartType && copy.type) {
        copy.chartType = copy.type;
      }
      return copy;
    }
    return raw;
  },
  z.object({
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
        (val): val is VisualizationType =>
          ALLOWED_VISUALIZATION_TYPES.includes(val as VisualizationType),
        {
          message: `Invalid chart type. Supported: ${ALLOWED_VISUALIZATION_TYPES.join(", ")}`,
        }
      ),
    type: z.string().optional(),
    datasetId: z.string().uuid("Invalid Dataset ID").optional().nullable(),
    dashboardId: z.string().uuid("Invalid Dashboard ID").optional().nullable(),
    workspaceId: z.string().optional().nullable(),
    config: visualizationConfigSchema.default({}),
    position: z
      .object({
        x: z.number().int().min(0).default(0),
        y: z.number().int().min(0).default(0),
        w: z.number().int().min(1).max(24).default(6),
        h: z.number().int().min(1).max(24).default(4),
      })
      .default({ x: 0, y: 0, w: 6, h: 4 }),
    sortOrder: z.number().int().default(0).optional(),
  })
);

export const updateVisualizationSchema = z.preprocess(
  (raw: any) => {
    if (raw && typeof raw === "object") {
      const copy = { ...raw };
      if (!copy.chartType && copy.type) {
        copy.chartType = copy.type;
      }
      return copy;
    }
    return raw;
  },
  z.object({
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
        (val): val is VisualizationType =>
          ALLOWED_VISUALIZATION_TYPES.includes(val as VisualizationType),
        {
          message: `Invalid chart type. Supported: ${ALLOWED_VISUALIZATION_TYPES.join(", ")}`,
        }
      )
      .optional(),
    type: z.string().optional(),
    datasetId: z.string().uuid("Invalid Dataset ID").optional().nullable(),
    workspaceId: z.string().optional().nullable(),
    config: visualizationConfigSchema.optional(),
    position: z
      .object({
        x: z.number().int().min(0).default(0),
        y: z.number().int().min(0).default(0),
        w: z.number().int().min(1).max(24).default(6),
        h: z.number().int().min(1).max(24).default(4),
      })
      .optional(),
    sortOrder: z.number().int().optional(),
  })
);

// ============================================================
// HELPER: BUILD SAFE VISUALIZATION
// ============================================================

export function buildSafeVisualization(
  chart: Chart & {
    dataset?: { id: string; name: string; type: string; workspaceId?: string | null } | null;
  }
) {
  return {
    id: chart.id,
    dashboardId: chart.dashboardId,
    datasetId: chart.datasetId,
    datasetName: chart.dataset?.name ?? null,
    datasetType: chart.dataset?.type ?? null,
    workspaceId: chart.dataset?.workspaceId ?? null,
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType as VisualizationType,
    config: chart.config as Record<string, unknown>,
    position: chart.position as Record<string, unknown>,
    sortOrder: chart.sortOrder,
    createdAt: chart.createdAt.toISOString(),
    updatedAt: chart.updatedAt.toISOString(),
  };
}

// ============================================================
// HELPER: EXECUTE VISUALIZATION QUERY
// ============================================================

export async function executeVisualizationQuery(
  chart: Chart & { dataset?: any },
  userId: string,
  organizationId: string,
  roleName?: string
) {
  if (!chart.datasetId) {
    return {
      columns: [],
      rows: [],
      processedColumns: [],
      processedRows: [],
      rowCount: 0,
      total: 0,
      limit: 100,
      offset: 0,
      executionTimeMs: 0,
      metadata: {
        rowCount: 0,
        total: 0,
        limit: 100,
        offset: 0,
        executionTimeMs: 0,
        queryMode: "RAW" as const,
      },
    };
  }

  const dataset =
    chart.dataset ||
    (await prisma.dataset.findUnique({
      where: { id: chart.datasetId },
      include: { columns: { orderBy: { ordinalPosition: "asc" } } },
    }));

  if (!dataset) {
    throw AppError.notFound("Dataset linked to visualization not found");
  }

  await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);

  const rawConfig = (chart.config || {}) as Record<string, any>;
  const chartType = chart.chartType.toUpperCase();

  const xAxis = rawConfig.xAxis || rawConfig.category;
  const yAxis = rawConfig.yAxis || rawConfig.value;
  const series = rawConfig.series || rawConfig.group;
  const aggregation = rawConfig.aggregation;

  const queryParams: DatasetQueryParams = {
    limit: typeof rawConfig.limit === "number" ? rawConfig.limit : 1000,
    filters: rawConfig.filters || [],
  };

  // Sorting
  if (rawConfig.sort) {
    queryParams.sort = rawConfig.sort;
  } else if (rawConfig.sorting) {
    queryParams.sorting = rawConfig.sorting;
  } else if (rawConfig.orderBy) {
    queryParams.orderBy = rawConfig.orderBy;
  } else if (xAxis) {
    queryParams.orderBy = { column: String(xAxis), direction: "asc" };
  }

  // Dimensions & Measures
  if (Array.isArray(rawConfig.measures) && rawConfig.measures.length > 0) {
    queryParams.measures = rawConfig.measures;
    queryParams.dimensions = rawConfig.dimensions || (xAxis ? [String(xAxis)] : []);
  } else if (Array.isArray(rawConfig.aggregations) && rawConfig.aggregations.length > 0) {
    queryParams.aggregations = rawConfig.aggregations;
    queryParams.dimensions = rawConfig.dimensions || rawConfig.groupBy || (xAxis ? [String(xAxis)] : []);
  } else if (chartType === "SCATTER" && !aggregation && xAxis && yAxis) {
    queryParams.columns = [String(xAxis), String(yAxis)];
  } else if (yAxis && (aggregation || chartType === "KPI")) {
    const agg = String(aggregation || "SUM").toUpperCase() as AggregationFunction;
    const yCol = String(yAxis);
    queryParams.measures = [
      {
        column: yCol,
        aggregation: agg,
        alias: yCol === "*" ? `${agg.toLowerCase()}_count` : yCol,
      },
    ];

    const secondaryY = rawConfig.secondaryValueCol || rawConfig.secondary || rawConfig.yAxis2;
    if (secondaryY && String(secondaryY) !== yCol) {
      queryParams.measures.push({
        column: String(secondaryY),
        aggregation: agg,
        alias: String(secondaryY),
      });
    }

    if (chartType !== "KPI" && xAxis) {
      const dims = [String(xAxis)];
      const groupCol = rawConfig.groupCol || rawConfig.group || series;
      if (groupCol && groupCol !== xAxis) {
        dims.push(String(groupCol));
      }
      queryParams.dimensions = dims;
    }
  } else if (chartType === "TABLE") {
    if (Array.isArray(rawConfig.columns) && rawConfig.columns.length > 0) {
      queryParams.columns = rawConfig.columns;
    }
  } else if (xAxis && !yAxis) {
    queryParams.dimensions = [String(xAxis)];
    queryParams.measures = [
      {
        column: "*",
        aggregation: "COUNT",
        alias: "count",
      },
    ];
  }

  return datasetQueryEngine.executeQuery(dataset, queryParams);
}

// ============================================================
// CONTROLLER HANDLERS
// ============================================================

/**
 * POST /api/v1/visualizations
 * Create a new visualization and associate it with a dataset.
 */
export async function createVisualization(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const input = createVisualizationSchema.parse(req.body);

  // 1. Verify dataset access if provided
  let dataset: (Dataset & { columns?: any[] }) | null = null;
  if (input.datasetId) {
    dataset = await prisma.dataset.findUnique({
      where: { id: input.datasetId },
      include: { columns: { orderBy: { ordinalPosition: "asc" } } },
    });

    if (!dataset) {
      throw AppError.notFound("Dataset");
    }

    await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);
  }

  // 2. Ensure dashboard container
  let dashboardId = input.dashboardId;
  if (dashboardId) {
    const existingDash = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
    });
    if (!existingDash) {
      throw AppError.notFound("Dashboard");
    }
    if (existingDash.organizationId !== organizationId) {
      throw AppError.forbidden("Access denied: dashboard belongs to another organization");
    }
  } else {
    // Auto-link to default Visualizations Studio dashboard
    let defaultDash = await prisma.dashboard.findFirst({
      where: {
        organizationId,
        name: "Visualizations Studio",
      },
    });

    if (!defaultDash) {
      defaultDash = await prisma.dashboard.create({
        data: {
          organizationId,
          ownerId: userId,
          name: "Visualizations Studio",
          description: "Default canvas for standalone visualizations",
          status: "DRAFT",
          visibility: "ORGANIZATION",
        },
      });
    }
    dashboardId = defaultDash.id;
  }

  // 3. Create chart
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
      dataset: { select: { id: true, name: true, type: true, workspaceId: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CHART_CREATED",
    resourceType: "Chart",
    resourceId: chart.id,
    metadata: {
      title: chart.title,
      chartType: chart.chartType,
      datasetId: chart.datasetId,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeVisualization(chart), 201);
}

/**
 * GET /api/v1/visualizations
 * List all visualizations for organization / workspace.
 */
export async function listVisualizations(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const includeData = req.query.includeData === "true";

  const charts = await prisma.chart.findMany({
    where: {
      dashboard: { organizationId },
      ...(workspaceId
        ? {
            OR: [
              { dataset: { workspaceId } },
              { datasetId: null },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      dataset: { select: { id: true, name: true, type: true, workspaceId: true } },
    },
  });

  const safeCharts = charts.map(buildSafeVisualization);

  if (includeData) {
    const withData = await Promise.all(
      charts.map(async (c) => {
        try {
          const queryResult = await executeVisualizationQuery(c, userId, organizationId, roleName);
          return {
            ...buildSafeVisualization(c),
            data: queryResult.rows,
            columns: queryResult.columns,
            rowCount: queryResult.rowCount,
            total: queryResult.total,
          };
        } catch {
          return {
            ...buildSafeVisualization(c),
            data: [],
            columns: [],
            rowCount: 0,
            total: 0,
          };
        }
      })
    );
    sendSuccess(res, withData);
    return;
  }

  sendSuccess(res, safeCharts);
}

/**
 * GET /api/v1/visualizations/:id
 * Retrieve a specific visualization.
 */
export async function getVisualization(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;
  const includeData = req.query.includeData === "true";

  const chart = await prisma.chart.findUnique({
    where: { id },
    include: {
      dashboard: true,
      dataset: {
        include: { columns: { orderBy: { ordinalPosition: "asc" } } },
      },
    },
  });

  if (!chart) {
    throw AppError.notFound("Visualization");
  }

  if (chart.dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: visualization belongs to another organization");
  }

  if (chart.dataset) {
    await verifyResourceWorkspaceAccess(chart.dataset, userId, organizationId, roleName);
  }

  const safe = buildSafeVisualization(chart);

  if (includeData) {
    const queryResult = await executeVisualizationQuery(chart, userId, organizationId, roleName);
    sendSuccess(res, {
      ...safe,
      data: queryResult.rows,
      processedRows: queryResult.rows,
      columns: queryResult.columns,
      processedColumns: queryResult.columns,
      rowCount: queryResult.rowCount,
      total: queryResult.total,
      metadata: queryResult.metadata,
    });
    return;
  }

  sendSuccess(res, safe);
}

/**
 * GET /api/v1/visualizations/:id/data
 * Execute configuration against dataset and return chart-ready data.
 */
export async function getVisualizationData(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const chart = await prisma.chart.findUnique({
    where: { id },
    include: {
      dashboard: true,
      dataset: {
        include: { columns: { orderBy: { ordinalPosition: "asc" } } },
      },
    },
  });

  if (!chart) {
    throw AppError.notFound("Visualization");
  }

  if (chart.dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: visualization belongs to another organization");
  }

  if (chart.dataset) {
    await verifyResourceWorkspaceAccess(chart.dataset, userId, organizationId, roleName);
  }

  const queryResult = await executeVisualizationQuery(chart, userId, organizationId, roleName);

  sendSuccess(res, {
    visualization: buildSafeVisualization(chart),
    ...queryResult,
  });
}

/**
 * PATCH /api/v1/visualizations/:id
 * Update visualization title, chartType, config, or datasetId.
 */
export async function updateVisualization(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  const chart = await prisma.chart.findUnique({
    where: { id },
    include: { dashboard: true },
  });

  if (!chart) {
    throw AppError.notFound("Visualization");
  }

  if (chart.dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: visualization belongs to another organization");
  }

  const input = updateVisualizationSchema.parse(req.body);

  if (input.datasetId !== undefined && input.datasetId !== null) {
    const dataset = await prisma.dataset.findUnique({
      where: { id: input.datasetId },
    });

    if (!dataset) {
      throw AppError.notFound("Dataset");
    }

    await verifyResourceWorkspaceAccess(dataset, userId, organizationId, roleName);
  }

  const data: Prisma.ChartUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.chartType !== undefined) data.chartType = input.chartType;
  if (input.datasetId !== undefined) {
    data.dataset = input.datasetId ? { connect: { id: input.datasetId } } : { disconnect: true };
  }
  if (input.config !== undefined) {
    data.config = input.config as Prisma.InputJsonValue;
  }
  if (input.position !== undefined) {
    data.position = input.position as Prisma.InputJsonValue;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const updated = await prisma.chart.update({
    where: { id },
    data,
    include: {
      dataset: { select: { id: true, name: true, type: true, workspaceId: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CHART_UPDATED",
    resourceType: "Chart",
    resourceId: id,
    metadata: {
      title: updated.title,
      updatedFields: Object.keys(data),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeVisualization(updated));
}

/**
 * DELETE /api/v1/visualizations/:id
 * Delete a visualization.
 */
export async function deleteVisualization(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  const chart = await prisma.chart.findUnique({
    where: { id },
    include: { dashboard: true },
  });

  if (!chart) {
    throw AppError.notFound("Visualization");
  }

  if (chart.dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: visualization belongs to another organization");
  }

  await prisma.chart.delete({
    where: { id },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "CHART_DELETED",
    resourceType: "Chart",
    resourceId: id,
    metadata: {
      title: chart.title,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: "Visualization deleted successfully" });
}
