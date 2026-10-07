// ========================================
// Dashboard Management Service
// ========================================
// Handles dashboard CRUD, multi-tenant isolation,
// layout configuration, and audit logging.
// Never exposes credentials or sensitive secrets.
// ========================================

import crypto from "crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import type { Dashboard, DashboardStatus, DashboardVisibility, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import { datasetQueryEngine, type DatasetQueryParams } from "../dataset/query-engine.js";
import { validateWebhookUrl, isValidEmail } from "../report/report-delivery.dispatcher.js";
import { createDashboardVersionSnapshot } from "./dashboard-version.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDashboardSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().trim().max(500, "Description must be 500 characters or less").optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT").optional(),
  visibility: z.enum(["PRIVATE", "ORGANIZATION", "PUBLIC"]).default("PRIVATE").optional(),
  layoutConfig: z.record(z.unknown()).default({}).optional(),
  layout: z.array(z.record(z.unknown())).optional(),
  workspaceId: z.string().optional().nullable(),
});

export const updateDashboardSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name must be 100 characters or less").optional(),
  description: z.string().trim().max(500, "Description must be 500 characters or less").optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  visibility: z.enum(["PRIVATE", "ORGANIZATION", "PUBLIC"]).optional(),
  layoutConfig: z.record(z.unknown()).optional(),
});

export const listDashboardsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "ALL"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================
// HELPER: BUILD SAFE DASHBOARD RESPONSE
// ============================================================

export function buildSafeDashboard(
  dash: Dashboard & {
    owner?: { id: string; name: string; email: string } | null;
    charts?: Array<{
      id: string;
      title: string;
      description: string | null;
      chartType: string;
      config: unknown;
      position: unknown;
      sortOrder: number;
      datasetId: string | null;
    }>;
    _count?: { charts: number };
  }
) {
  const meta = (dash.layoutConfig || {}) as Record<string, unknown>;
  const layout = Array.isArray(meta.layout)
    ? meta.layout
    : (dash.charts || []).map((c, idx) => ({
        id: c.id,
        visualizationId: c.id,
        ...((c.position as any) || { x: (idx * 6) % 12, y: Math.floor(idx / 2) * 4, w: 6, h: 4 }),
      }));

  return {
    id: dash.id,
    name: dash.name,
    description: dash.description,
    status: dash.status,
    visibility: dash.visibility,
    organizationId: dash.organizationId,
    ownerId: dash.ownerId,
    ownerName: dash.owner?.name || null,
    ownerEmail: dash.owner?.email || null,
    layoutConfig: dash.layoutConfig || {},
    layout,
    chartCount: dash._count?.charts ?? dash.charts?.length ?? 0,
    charts: dash.charts || [],
    shareToken: (dash as any).shareToken || null,
    shareTokenActive: Boolean((dash as any).shareTokenActive),
    sharedAt: (dash as any).sharedAt ? (dash as any).sharedAt.toISOString() : null,
    createdAt: dash.createdAt.toISOString(),
    updatedAt: dash.updatedAt.toISOString(),
  };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * POST /api/v1/dashboards
 * Create a new dashboard.
 */
export async function createDashboard(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const input = createDashboardSchema.parse(req.body);

  const initialLayoutConfig: Record<string, unknown> = {
    ...(input.layoutConfig || {}),
  };
  if (Array.isArray(input.layout)) {
    initialLayoutConfig["layout"] = input.layout;
  }
  if (input.workspaceId) {
    initialLayoutConfig["workspaceId"] = input.workspaceId;
    await verifyResourceWorkspaceAccess(
      { workspaceId: input.workspaceId, organizationId },
      userId,
      organizationId,
      req.user?.roleName,
      "WRITE"
    );
  }

  const dashboard = await prisma.dashboard.create({
    data: {
      organizationId,
      ownerId: userId,
      name: input.name,
      description: input.description || null,
      status: (input.status as DashboardStatus) || "DRAFT",
      visibility: (input.visibility as DashboardVisibility) || "PRIVATE",
      layoutConfig: initialLayoutConfig as Prisma.InputJsonValue,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { charts: true } },
    },
  });

  if (Array.isArray(input.layout)) {
    for (const item of input.layout) {
      const vizId = (item.visualizationId || item.chartId) as string;
      if (vizId) {
        await prisma.chart
          .updateMany({
            where: { id: vizId },
            data: { dashboardId: dashboard.id },
          })
          .catch(() => null);
      }
    }

    const defaultStudio = await prisma.dashboard.findFirst({
      where: { organizationId, name: "Visualizations Studio" },
      include: { _count: { select: { charts: true } } },
    });
    if (defaultStudio && defaultStudio._count.charts === 0) {
      await prisma.dashboard.delete({ where: { id: defaultStudio.id } }).catch(() => null);
    }
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_CREATED",
    resourceType: "Dashboard",
    resourceId: dashboard.id,
    metadata: {
      name: dashboard.name,
      status: dashboard.status,
      visibility: dashboard.visibility,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  void createDashboardVersionSnapshot(
    dashboard.id,
    "Initial dashboard creation",
    userId,
    req.user?.email,
    req.user?.roleName
  );

  sendSuccess(res, buildSafeDashboard(dashboard), 201);
}

/**
 * GET /api/v1/dashboards
 * List dashboards belonging to user's organization.
 */
export async function listDashboards(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const query = listDashboardsQuerySchema.parse(req.query);

  const where: Prisma.DashboardWhereInput = {
    organizationId,
  };

  if (query.status && query.status !== "ALL") {
    where.status = query.status as DashboardStatus;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const skip = (query.page - 1) * query.limit;
  const take = query.limit;

  const [total, dashboards] = await Promise.all([
    prisma.dashboard.count({ where }),
    prisma.dashboard.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { charts: true } },
      },
    }),
  ]);

  sendSuccess(res, {
    dashboards: dashboards.map(buildSafeDashboard),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  });
}

/**
 * GET /api/v1/dashboards/:id
 * Retrieve a single dashboard with layout and chart references.
 */
export async function getDashboard(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      charts: {
        select: {
          id: true,
          title: true,
          description: true,
          chartType: true,
          config: true,
          position: true,
          sortOrder: true,
          datasetId: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { charts: true } },
    },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_VIEWED",
    resourceType: "Dashboard",
    resourceId: dashboard.id,
    metadata: {
      name: dashboard.name,
      chartCount: dashboard.charts.length,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, buildSafeDashboard(dashboard));
}

/**
 * PATCH /api/v1/dashboards/:id
 * Update dashboard metadata, layout configuration, or status.
 */
export async function updateDashboard(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const input = updateDashboardSchema.parse(req.body);

  const existing = await prisma.dashboard.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Dashboard");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  const workspaceId = (existing.layoutConfig as any)?.workspaceId ?? undefined;
  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    req.user?.roleName,
    "WRITE"
  );

  const data: Prisma.DashboardUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status as DashboardStatus;
  if (input.visibility !== undefined) data.visibility = input.visibility as DashboardVisibility;
  if (input.layoutConfig !== undefined) {
    data.layoutConfig = input.layoutConfig as Prisma.InputJsonValue;
  }

  const updated = await prisma.dashboard.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { charts: true } },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_UPDATED",
    resourceType: "Dashboard",
    resourceId: updated.id,
    metadata: {
      name: updated.name,
      updatedFields: Object.keys(data),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  void createDashboardVersionSnapshot(
    updated.id,
    input.name ? `Updated name to "${input.name}"` : "Updated dashboard layout and configuration",
    userId,
    req.user?.email,
    req.user?.roleName
  );

  sendSuccess(res, buildSafeDashboard(updated));
}

/**
 * DELETE /api/v1/dashboards/:id
 * Delete a dashboard and cascade related items safely.
 */
export async function deleteDashboard(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const existing = await prisma.dashboard.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Dashboard");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  const deleteWsId = (existing.layoutConfig as any)?.workspaceId ?? undefined;
  await verifyResourceWorkspaceAccess(
    { workspaceId: deleteWsId, organizationId },
    userId,
    organizationId,
    req.user?.roleName,
    "WRITE"
  );

  if (existing.ownerId !== userId && req.user?.roleName !== "ADMIN") {
    if (deleteWsId) {
      const access = await resolveWorkspaceAccess(deleteWsId, userId, organizationId, req.user?.roleName);
      if (access.userRole !== "OWNER" && access.userRole !== "ADMIN" && !access.isOrgAdmin) {
        throw AppError.forbidden("Only workspace owners or admins can delete this dashboard");
      }
    }
  }

  // Delete associated reports first to satisfy foreign key constraint
  await prisma.report.deleteMany({ where: { dashboardId: id } });

  await prisma.dashboard.delete({
    where: { id },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_DELETED",
    resourceType: "Dashboard",
    resourceId: id,
    metadata: {
      name: existing.name,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: "Dashboard deleted successfully" });
}

// ============================================================
// DASHBOARD SHARING HANDLERS
// ============================================================

/**
 * POST /api/v1/dashboards/:id/share
 * Generates or activates a secure random token share link for the dashboard.
 */
export async function createShareLink(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  // Generate 48-char cryptographically secure token
  const shareToken = crypto.randomBytes(24).toString("hex");

  const updated = await prisma.dashboard.update({
    where: { id },
    data: {
      shareToken,
      shareTokenActive: true,
      sharedAt: new Date(),
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_UPDATED",
    resourceType: "Dashboard",
    resourceId: id,
    metadata: {
      action: "SHARE_LINK_CREATED",
      shareToken: updated.shareToken,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    shareToken: updated.shareToken,
    shareTokenActive: updated.shareTokenActive,
    sharedAt: updated.sharedAt?.toISOString() || null,
    active: updated.shareTokenActive,
    token: updated.shareToken,
    shareUrl: `/dashboards/shared/${updated.shareToken}`,
  });
}

/**
 * GET /api/v1/dashboards/:id/share
 * Retrieves current share status for a dashboard.
 */
export async function getShareLinkStatus(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      shareToken: true,
      shareTokenActive: true,
      sharedAt: true,
    },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  sendSuccess(res, {
    shareToken: dashboard.shareToken,
    shareTokenActive: dashboard.shareTokenActive,
    sharedAt: dashboard.sharedAt?.toISOString() || null,
    active: dashboard.shareTokenActive,
    token: dashboard.shareToken,
    shareUrl: dashboard.shareTokenActive && dashboard.shareToken ? `/dashboards/shared/${dashboard.shareToken}` : null,
  });
}

/**
 * DELETE /api/v1/dashboards/:id/share
 * Disables active share link for a dashboard.
 */
export async function disableShareLink(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  await prisma.dashboard.update({
    where: { id },
    data: {
      shareTokenActive: false,
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_UPDATED",
    resourceType: "Dashboard",
    resourceId: id,
    metadata: {
      action: "SHARE_LINK_DISABLED",
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    message: "Share link disabled successfully",
    shareTokenActive: false,
    active: false,
  });
}

/**
 * GET /api/v1/dashboards/shared/:shareToken
 * Public read-only dashboard retrieval using share token.
 * Does NOT expose internal workspace IDs or tenant credentials.
 */
export async function getSharedDashboard(req: Request, res: Response): Promise<void> {
  const { shareToken } = req.params;

  if (!shareToken) {
    throw AppError.badRequest("Share token is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { shareToken },
    include: {
      charts: {
        orderBy: { sortOrder: "asc" },
        include: {
          dataset: {
            select: {
              id: true,
              name: true,
              type: true,
              columns: {
                select: {
                  id: true,
                  name: true,
                  dataType: true,
                  nullable: true,
                },
                orderBy: { ordinalPosition: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!dashboard || !dashboard.shareTokenActive) {
    throw AppError.notFound("Shared dashboard not found or link has been disabled");
  }

  // Safe read-only DTO for public consumption
  const safeData = {
    id: dashboard.id,
    name: dashboard.name,
    description: dashboard.description,
    layoutConfig: dashboard.layoutConfig || {},
    createdAt: dashboard.createdAt.toISOString(),
    updatedAt: dashboard.updatedAt.toISOString(),
    charts: dashboard.charts.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      chartType: c.chartType,
      config: c.config,
      position: c.position,
      sortOrder: c.sortOrder,
      datasetId: c.datasetId,
      datasetName: c.dataset?.name || null,
      datasetColumns:
        c.dataset?.columns.map((col) => ({
          id: col.id,
          name: col.name,
          type: col.dataType,
          nullable: col.nullable,
        })) || [],
    })),
  };

  sendSuccess(res, safeData);
}

/**
 * POST /api/v1/dashboards/shared/:shareToken/charts/:chartId/data
 * Public chart data execution for shared dashboards.
 * Strictly verifies the chart belongs to the shared dashboard.
 */
export async function getSharedChartData(req: Request, res: Response): Promise<void> {
  const { shareToken, chartId } = req.params;

  if (!shareToken || !chartId) {
    throw AppError.badRequest("Share token and Chart ID are required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { shareToken },
    include: {
      charts: {
        where: { id: chartId },
        include: {
          dataset: {
            include: {
              columns: { orderBy: { ordinalPosition: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!dashboard || !dashboard.shareTokenActive) {
    throw AppError.notFound("Shared dashboard not found or link has been disabled");
  }

  const chart = dashboard.charts[0];
  if (!chart) {
    throw AppError.notFound("Chart not found on this shared dashboard");
  }

  if (!chart.datasetId || !chart.dataset) {
    sendSuccess(res, {
      columns: [],
      rows: [],
      rowCount: 0,
      total: 0,
      limit: 100,
      offset: 0,
      executionTimeMs: 0,
      metadata: { rowCount: 0, total: 0, limit: 100, offset: 0, executionTimeMs: 0, queryMode: "RAW" },
    });
    return;
  }

  // Parse effective chart query parameters
  const rawConfig = (chart.config || {}) as Record<string, any>;
  const passedFilters = (Array.isArray(req.body?.filters) ? req.body.filters : [])
    .map((f: any) => ({
      column: f.column || f.field,
      operator: f.operator || "=",
      value: f.value,
    }))
    .filter((f: any) => Boolean(f.column));

  const configFilters = (Array.isArray(rawConfig.filters) ? rawConfig.filters : [])
    .map((f: any) => ({
      column: f.column || f.field,
      operator: f.operator || "=",
      value: f.value,
    }))
    .filter((f: any) => Boolean(f.column));

  const queryParams: DatasetQueryParams = {
    limit: typeof rawConfig.limit === "number" ? Math.min(rawConfig.limit, 1000) : 1000,
    filters: [...configFilters, ...passedFilters],
  };

  if (rawConfig.sort) {
    queryParams.sort = rawConfig.sort;
  }
  if (rawConfig.orderBy) {
    queryParams.orderBy = rawConfig.orderBy;
  }
  if (Array.isArray(rawConfig.dimensions) && rawConfig.dimensions.length > 0) {
    queryParams.dimensions = rawConfig.dimensions;
  }
  if (Array.isArray(rawConfig.measures) && rawConfig.measures.length > 0) {
    queryParams.measures = rawConfig.measures;
  }
  if (Array.isArray(rawConfig.groupBy) && rawConfig.groupBy.length > 0) {
    queryParams.groupBy = rawConfig.groupBy;
  }
  if (Array.isArray(rawConfig.aggregations) && rawConfig.aggregations.length > 0) {
    queryParams.aggregations = rawConfig.aggregations;
  }
  if (Array.isArray(rawConfig.columns) && rawConfig.columns.length > 0) {
    queryParams.columns = rawConfig.columns;
  }

  // Normalize fallback for xAxis/category and yAxis/value
  if ((!queryParams.measures || queryParams.measures.length === 0) && (!queryParams.aggregations || queryParams.aggregations.length === 0)) {
    const yVal = rawConfig.yAxis || rawConfig.value;
    if (yVal) {
      queryParams.measures = [
        {
          column: String(yVal),
          aggregation: (rawConfig.aggregation as any) || "SUM",
          alias: String(yVal),
        },
      ];
    }
  }
  if ((!queryParams.dimensions || queryParams.dimensions.length === 0) && (!queryParams.groupBy || queryParams.groupBy.length === 0)) {
    const xVal = rawConfig.xAxis || rawConfig.category;
    if (xVal) {
      queryParams.dimensions = [String(xVal)];
    }
  }

  const result = await datasetQueryEngine.executeQuery(chart.dataset, queryParams, req.user);
  sendSuccess(res, result);
}

// ============================================================
// DASHBOARD REPORT SCHEDULE & SNAPSHOT HANDLERS
// ============================================================

/**
 * GET /api/v1/dashboards/:id/schedule
 * Retrieve scheduled report configuration for a dashboard.
 */
export async function getDashboardSchedule(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  const report = await prisma.report.findFirst({
    where: { dashboardId: id, organizationId },
    orderBy: { createdAt: "desc" },
  });

  if (!report) {
    sendSuccess(res, null);
    return;
  }

  const delivery = (report.deliveryConfig || {}) as Record<string, unknown>;
  const frequency = String(
    delivery.frequency || (report.cronExpression?.includes("1") ? "WEEKLY" : "DAILY")
  ).toUpperCase();

  sendSuccess(res, {
    id: report.id,
    dashboardId: report.dashboardId,
    frequency,
    enabled: report.status === "ACTIVE",
    nextRunAt: (delivery.nextRunAt as string) || null,
    lastRunAt: (delivery.lastRunAt as string) || null,
    recipients: Array.isArray(delivery.recipients) ? delivery.recipients : [],
    webhookUrl: typeof delivery.webhookUrl === "string" ? delivery.webhookUrl : null,
    deliveryType: (delivery.deliveryType as string) || "EMAIL",
    lastDeliveryStatus: (delivery.lastDeliveryStatus as string) || null,
    lastDeliveryAt: (delivery.lastDeliveryAt as string) || null,
    lastDeliveryError: (delivery.lastDeliveryError as string) || null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  });
}

/**
 * POST /api/v1/dashboards/:id/schedule
 * Create or update scheduled report configuration for a dashboard.
 */
export async function upsertDashboardSchedule(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;
  const { frequency, enabled, recipients, webhookUrl, deliveryType, format } = req.body;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const normalizedFreq = String(frequency || "DAILY").toUpperCase();
  if (normalizedFreq !== "DAILY" && normalizedFreq !== "WEEKLY" && normalizedFreq !== "MONTHLY") {
    throw AppError.badRequest("Frequency must be DAILY, WEEKLY, or MONTHLY");
  }

  // Validate recipients if provided
  if (recipients !== undefined) {
    if (!Array.isArray(recipients)) {
      throw AppError.badRequest("Recipients must be an array of email addresses");
    }
    for (const r of recipients) {
      if (!isValidEmail(String(r))) {
        throw AppError.badRequest(`Invalid recipient email address format: "${r}"`);
      }
    }
  }

  // Validate webhook URL if provided
  if (webhookUrl !== undefined && webhookUrl !== null && String(webhookUrl).trim() !== "") {
    const webhookCheck = validateWebhookUrl(String(webhookUrl));
    if (!webhookCheck.valid) {
      throw AppError.badRequest(webhookCheck.error || "Invalid webhook URL");
    }
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  const isEnabled = enabled !== undefined ? Boolean(enabled) : true;
  const cronExpression =
    normalizedFreq === "MONTHLY"
      ? "0 9 1 * *"
      : normalizedFreq === "WEEKLY"
      ? "0 9 * * 1"
      : "0 9 * * *";
  const intervalMs =
    normalizedFreq === "MONTHLY"
      ? 30 * 24 * 60 * 60 * 1000
      : normalizedFreq === "WEEKLY"
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
  const nextRunAt = new Date(Date.now() + intervalMs).toISOString();

  const existing = await prisma.report.findFirst({
    where: { dashboardId: id, organizationId },
  });

  const updatedRecipients =
    recipients !== undefined ? (recipients as string[]) : existing ? ((existing.deliveryConfig as any)?.recipients || []) : [];
  const updatedWebhookUrl =
    webhookUrl !== undefined ? (webhookUrl ? String(webhookUrl).trim() : null) : existing ? ((existing.deliveryConfig as any)?.webhookUrl || null) : null;
  const updatedDeliveryType =
    deliveryType !== undefined ? String(deliveryType).toUpperCase() : existing ? ((existing.deliveryConfig as any)?.deliveryType || "EMAIL") : "EMAIL";

  let report;
  if (existing) {
    const existingDelivery = (existing.deliveryConfig || {}) as Record<string, unknown>;
    report = await prisma.report.update({
      where: { id: existing.id },
      data: {
        status: isEnabled ? "ACTIVE" : "PAUSED",
        cronExpression,
        deliveryConfig: {
          ...existingDelivery,
          frequency: normalizedFreq,
          enabled: isEnabled,
          nextRunAt,
          recipients: updatedRecipients,
          webhookUrl: updatedWebhookUrl,
          deliveryType: updatedDeliveryType,
          format: format ? String(format).toUpperCase() : existingDelivery.format || "PDF",
        },
      },
    });
  } else {
    report = await prisma.report.create({
      data: {
        dashboardId: id,
        organizationId,
        createdById: userId,
        name: `${dashboard.name} Scheduled Report`,
        status: isEnabled ? "ACTIVE" : "PAUSED",
        cronExpression,
        deliveryConfig: {
          frequency: normalizedFreq,
          enabled: isEnabled,
          nextRunAt,
          recipients: updatedRecipients,
          webhookUrl: updatedWebhookUrl,
          deliveryType: updatedDeliveryType,
          format: format ? String(format).toUpperCase() : "PDF",
        },
      },
    });
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_UPDATED",
    resourceType: "Dashboard",
    resourceId: id,
    metadata: {
      action: "SCHEDULE_UPDATED",
      frequency: normalizedFreq,
      enabled: isEnabled,
      recipientsCount: updatedRecipients.length,
      hasWebhook: Boolean(updatedWebhookUrl),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  const delivery = (report.deliveryConfig || {}) as Record<string, unknown>;
  sendSuccess(res, {
    id: report.id,
    dashboardId: report.dashboardId,
    frequency: normalizedFreq,
    enabled: report.status === "ACTIVE",
    nextRunAt: (delivery.nextRunAt as string) || null,
    lastRunAt: (delivery.lastRunAt as string) || null,
    recipients: Array.isArray(delivery.recipients) ? delivery.recipients : [],
    webhookUrl: typeof delivery.webhookUrl === "string" ? delivery.webhookUrl : null,
    deliveryType: (delivery.deliveryType as string) || "EMAIL",
    lastDeliveryStatus: (delivery.lastDeliveryStatus as string) || null,
    lastDeliveryAt: (delivery.lastDeliveryAt as string) || null,
    lastDeliveryError: (delivery.lastDeliveryError as string) || null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  });
}

/**
 * DELETE /api/v1/dashboards/:id/schedule
 * Delete scheduled report configuration for a dashboard.
 */
export async function deleteDashboardSchedule(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  await prisma.report.deleteMany({
    where: { dashboardId: id, organizationId },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "DASHBOARD_UPDATED",
    resourceType: "Dashboard",
    resourceId: id,
    metadata: { action: "SCHEDULE_DELETED" },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { success: true, message: "Dashboard report schedule deleted successfully." });
}

/**
 * Standalone report snapshot generation engine.
 * Reusable by both HTTP request handler and background workers.
 */
export interface DashboardReportSnapshot {
  reportId: string;
  dashboardId: string;
  dashboardName: string;
  generatedAt: string;
  chartCount: number;
  format?: string;
  csvContent?: string;
  charts: Array<{
    chartId: string;
    title: string;
    chartType: string;
    rowCount: number;
    columns: Array<{ name: string; type: string }>;
    data: Record<string, unknown>[];
  }>;
  summary: {
    totalCharts: number;
    totalRecords: number;
    executionTimeMs: number;
    appliedFiltersCount?: number;
  };
}

export async function generateDashboardReportSnapshot(
  dashboardId: string,
  organizationId: string,
  options?: {
    dashboardFilters?: Array<{
      column?: string;
      field?: string;
      operator?: string;
      value?: unknown;
      datasetId?: string;
      sourceChartId?: string;
      isCrossFilter?: boolean;
    }>;
    format?: string;
    user?: any;
  }
): Promise<DashboardReportSnapshot> {
  const startTime = Date.now();

  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    include: {
      charts: {
        include: {
          dataset: {
            include: {
              columns: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  // Extract dashboard layout-level saved filters
  const layout = (dashboard.layoutConfig || {}) as Record<string, any>;
  const rawDashboardFilters: Array<any> = Array.isArray(options?.dashboardFilters)
    ? options.dashboardFilters
    : Array.isArray(layout.dashboardFilters)
    ? layout.dashboardFilters
    : Array.isArray(layout.filters)
    ? layout.filters
    : [];

  const reportCharts: Array<{
    chartId: string;
    title: string;
    chartType: string;
    rowCount: number;
    columns: Array<{ name: string; type: string }>;
    data: Record<string, unknown>[];
  }> = [];

  let totalRecords = 0;

  for (const chart of dashboard.charts) {
    if (!chart.dataset) {
      reportCharts.push({
        chartId: chart.id,
        title: chart.title,
        chartType: chart.chartType,
        rowCount: 0,
        columns: [],
        data: [],
      });
      continue;
    }

    const rawConfig = (chart.config || {}) as Record<string, any>;
    const baseChartFilters: Array<any> = Array.isArray(rawConfig.filters)
      ? [...rawConfig.filters]
      : [];

    // Merge dashboard filters that apply to this chart (respecting dataset, column and cross-filter exemptions)
    const datasetColNames = (chart.dataset.columns || []).map((c: any) => c.name.toLowerCase());
    for (const df of rawDashboardFilters) {
      const colName = df.column || df.field;
      if (!colName) continue;
      // If cross filter originating from this chart, exempt source chart
      if (df.isCrossFilter && df.sourceChartId === chart.id) continue;
      // If datasetId specified on filter and doesn't match chart dataset, skip
      if (df.datasetId && chart.datasetId && df.datasetId !== chart.datasetId) continue;
      // If dataset columns available, verify column belongs to this dataset
      if (datasetColNames.length > 0 && !datasetColNames.includes(String(colName).toLowerCase())) {
        continue;
      }
      baseChartFilters.push({
        column: String(colName),
        operator: df.operator || "=",
        value: df.value,
      });
    }

    const queryParams: Record<string, any> = {
      filters: baseChartFilters,
    };

    if (rawConfig.sort) queryParams.sort = rawConfig.sort;
    if (rawConfig.orderBy) queryParams.orderBy = rawConfig.orderBy;
    if (Array.isArray(rawConfig.dimensions) && rawConfig.dimensions.length > 0) {
      queryParams.dimensions = rawConfig.dimensions;
    }
    if (Array.isArray(rawConfig.measures) && rawConfig.measures.length > 0) {
      queryParams.measures = rawConfig.measures;
    }
    if (Array.isArray(rawConfig.groupBy) && rawConfig.groupBy.length > 0) {
      queryParams.groupBy = rawConfig.groupBy;
    }
    if (Array.isArray(rawConfig.aggregations) && rawConfig.aggregations.length > 0) {
      queryParams.aggregations = rawConfig.aggregations;
    }
    if (Array.isArray(rawConfig.columns) && rawConfig.columns.length > 0) {
      queryParams.columns = rawConfig.columns;
    }

    if (
      (!queryParams.measures || queryParams.measures.length === 0) &&
      (!queryParams.aggregations || queryParams.aggregations.length === 0)
    ) {
      const yVal = rawConfig.yAxis || rawConfig.value;
      if (yVal) {
        queryParams.measures = [
          {
            column: String(yVal),
            aggregation: rawConfig.aggregation || "SUM",
            alias: String(yVal),
          },
        ];
      }
    }
    if (
      (!queryParams.dimensions || queryParams.dimensions.length === 0) &&
      (!queryParams.groupBy || queryParams.groupBy.length === 0)
    ) {
      const xVal = rawConfig.xAxis || rawConfig.category;
      if (xVal) {
        queryParams.dimensions = [String(xVal)];
      }
    }

    try {
      const qRes = await datasetQueryEngine.executeQuery(chart.dataset, queryParams, options?.user);
      totalRecords += qRes.rowCount;
      reportCharts.push({
        chartId: chart.id,
        title: chart.title,
        chartType: chart.chartType,
        rowCount: qRes.rowCount,
        columns: qRes.columns,
        data: qRes.rows,
      });
    } catch {
      reportCharts.push({
        chartId: chart.id,
        title: chart.title,
        chartType: chart.chartType,
        rowCount: 0,
        columns: [],
        data: [],
      });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const requestedFormat = String(options?.format || "PDF").toUpperCase();

  // If CSV format requested, serialize chart data to CSV
  let csvContent: string | undefined;
  if (requestedFormat === "CSV") {
    const csvSections: string[] = [];
    for (const c of reportCharts) {
      if (c.data.length > 0) {
        const colNames = c.columns.map((col) => col.name);
        const header = colNames.join(",");
        const rows = c.data.map((r) =>
          colNames
            .map((col) => {
              const val = r[col];
              if (val === null || val === undefined) return "";
              const str = String(val);
              return str.includes(",") || str.includes('"') || str.includes("\n")
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            })
            .join(",")
        );
        csvSections.push(`--- Chart: ${c.title} (${c.rowCount} records) ---\r\n${header}\r\n${rows.join("\r\n")}`);
      }
    }
    csvContent = csvSections.join("\r\n\r\n");
  }

  return {
    reportId: crypto.randomUUID(),
    dashboardId: dashboard.id,
    dashboardName: dashboard.name,
    generatedAt: new Date().toISOString(),
    chartCount: reportCharts.length,
    format: requestedFormat,
    csvContent,
    charts: reportCharts,
    summary: {
      totalCharts: reportCharts.length,
      totalRecords,
      executionTimeMs,
      appliedFiltersCount: rawDashboardFilters.length,
    },
  };
}

/**
 * POST /api/v1/dashboards/:id/reports/generate
 * Generates an on-demand report snapshot reusing dashboard queries.
 */
export async function generateDashboardReport(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const { id } = req.params;
  const { filters, dashboardFilters, format } = req.body || {};

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const snapshot = await generateDashboardReportSnapshot(id, organizationId, {
    dashboardFilters: filters || dashboardFilters,
    format,
  });

  // Update lastRunAt on existing report schedule if any
  const existingReport = await prisma.report.findFirst({
    where: { dashboardId: id, organizationId },
  });
  if (existingReport) {
    const delivery = (existingReport.deliveryConfig || {}) as Record<string, unknown>;
    const freq = String(delivery.frequency || "DAILY").toUpperCase();
    const intervalMs = freq === "WEEKLY" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    await prisma.report
      .update({
        where: { id: existingReport.id },
        data: {
          deliveryConfig: {
            ...delivery,
            lastRunAt: new Date().toISOString(),
            nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
          },
        },
      })
      .catch(() => null);
  }

  sendSuccess(res, snapshot);
}

/**
 * POST /api/v1/dashboards/:id/reports
 * Create a scheduled report directly for a dashboard.
 */
export async function createDashboardReport(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id } = req.params;
  const { frequency, format, recipients, name } = req.body;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  const freq = String(frequency || "WEEKLY").toUpperCase();
  const cronExpression =
    freq === "DAILY" ? "0 9 * * *" : freq === "MONTHLY" ? "0 9 1 * *" : "0 9 * * 1";

  const report = await prisma.report.create({
    data: {
      dashboardId: id,
      organizationId,
      createdById: userId,
      name: name || `${dashboard.name} Scheduled Report`,
      status: "ACTIVE",
      format: (String(format || "PDF").toUpperCase() as any),
      cronExpression,
      deliveryConfig: {
        frequency: freq,
        recipients: Array.isArray(recipients) ? recipients : [],
        format: String(format || "PDF").toUpperCase(),
      },
    },
  });

  sendSuccess(
    res,
    {
      id: report.id,
      dashboardId: report.dashboardId,
      frequency: freq,
      format: report.format,
      recipients: Array.isArray(recipients) ? recipients : [],
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    },
    201
  );
}

/**
 * POST /api/v1/dashboards/:id/reports/:reportId/run
 * Run an existing report manually and return execution status.
 */
export async function runDashboardReport(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = req.user!;
  const { id, reportId } = req.params;

  if (!id || !reportId) {
    throw AppError.badRequest("Dashboard ID and Report ID are required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  const report = await prisma.report.findFirst({
    where: { id: reportId, dashboardId: id },
  });

  if (!report) {
    throw AppError.notFound("Report");
  }

  const startTime = Date.now();
  const snapshot = await generateDashboardReportSnapshot(id, organizationId);
  const durationMs = Date.now() - startTime;

  const execution = await prisma.reportExecution.create({
    data: {
      reportId: report.id,
      dashboardId: id,
      status: "SUCCESS",
      durationMs,
      chartCount: snapshot.chartCount,
      totalRecords: snapshot.summary.totalRecords,
      summary: snapshot.summary as any,
    },
  });

  const delivery = (report.deliveryConfig || {}) as Record<string, unknown>;
  await prisma.report
    .update({
      where: { id: report.id },
      data: {
        deliveryConfig: {
          ...delivery,
          lastRunAt: new Date().toISOString(),
          lastDeliveryStatus: "SUCCESS",
          lastDeliveryAt: new Date().toISOString(),
        },
      },
    })
    .catch(() => null);

  await logAuditEvent({
    organizationId,
    userId,
    action: "REPORT_RUN_MANUAL",
    resourceType: "Report",
    resourceId: report.id,
    metadata: {
      durationMs,
      chartCount: snapshot.chartCount,
      totalRecords: snapshot.summary.totalRecords,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    id: report.id,
    reportId: report.id,
    executionId: execution.id,
    status: "COMPLETED",
    executedAt: execution.executedAt.toISOString(),
    durationMs,
    chartCount: snapshot.chartCount,
    totalRecords: snapshot.summary.totalRecords,
    snapshot,
  });
}

/**
 * GET /api/v1/dashboards/:id/reports/history
 * List historical report executions for a dashboard.
 */
export async function getDashboardReportHistory(req: Request, res: Response): Promise<void> {
  const { organizationId } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  if (dashboard.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: dashboard belongs to a different organization");
  }

  const executions = await prisma.reportExecution.findMany({
    where: { dashboardId: id },
    orderBy: { executedAt: "desc" },
    take: 50,
  });

  sendSuccess(res, executions);
}



