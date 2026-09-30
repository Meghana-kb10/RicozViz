// ========================================
// Dashboard Management Service
// ========================================
// Handles dashboard CRUD, multi-tenant isolation,
// layout configuration, and audit logging.
// Never exposes credentials or sensitive secrets.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Dashboard, DashboardStatus, DashboardVisibility, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDashboardSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().trim().max(500, "Description must be 500 characters or less").optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT").optional(),
  visibility: z.enum(["PRIVATE", "ORGANIZATION", "PUBLIC"]).default("PRIVATE").optional(),
  layoutConfig: z.record(z.unknown()).default({}).optional(),
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
    chartCount: dash._count?.charts ?? dash.charts?.length ?? 0,
    charts: dash.charts || [],
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

  const dashboard = await prisma.dashboard.create({
    data: {
      organizationId,
      ownerId: userId,
      name: input.name,
      description: input.description || null,
      status: (input.status as DashboardStatus) || "DRAFT",
      visibility: (input.visibility as DashboardVisibility) || "PRIVATE",
      layoutConfig: (input.layoutConfig || {}) as Prisma.InputJsonValue,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { charts: true } },
    },
  });

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

  res.status(201);
  sendSuccess(res, buildSafeDashboard(dashboard));
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
