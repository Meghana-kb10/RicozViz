// ========================================
// Dashboard Access & Sharing Service
// ========================================
// Governs dashboard sharing across users, roles, and organizations.
// Enforces multi-tenant isolation, owner protection, RBAC checks,
// deterministic effective access evaluation, and audit logging.
// Never exposes password hashes or sensitive account credentials.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Dashboard, DashboardAccessLevel } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import type { AuthenticatedUser } from "../../middleware/auth.middleware.js";

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDashboardAccessSchema = z
  .object({
    type: z.enum(["USER", "ROLE", "ORGANIZATION"]),
    userId: z.string().uuid("Invalid user ID").optional().nullable(),
    roleId: z.string().optional().nullable(),
    organizationId: z.string().uuid("Invalid organization ID").optional().nullable(),
    accessLevel: z.enum(["VIEW", "EDIT"]).default("VIEW"),
  })
  .refine(
    (data) => {
      if (data.type === "USER") return !!data.userId;
      if (data.type === "ROLE") return !!data.roleId;
      if (data.type === "ORGANIZATION") return !!data.organizationId;
      return false;
    },
    {
      message: "Target ID (userId, roleId, or organizationId) matching target type is required",
    }
  );

export const updateDashboardAccessSchema = z.object({
  accessLevel: z.enum(["VIEW", "EDIT"]),
});

export const searchRecipientsQuerySchema = z.object({
  search: z.string().trim().optional(),
});

// ============================================================
// EFFECTIVE ACCESS EVALUATION
// ============================================================

export type EffectiveAccess = "OWNER" | "EDIT" | "VIEW" | "NONE";

export interface DashboardAuthContext {
  dashboard: Dashboard;
  effectiveAccess: EffectiveAccess;
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * Deterministically evaluates effective access for a user on a dashboard.
 * Precedence:
 * 1. Cross-tenant check: Different org -> NONE (Strictly Forbidden).
 * 2. Owner check: Dashboard owner -> OWNER (Full control, cannot be removed).
 * 3. Administrator check: Org Admin with DASHBOARD_VIEW/EDIT -> EDIT.
 * 4. Explicit grants: User grant > Role grant > Org grant (EDIT > VIEW > NONE).
 * 5. Visibility check: ORGANIZATION visibility grants VIEW to org members.
 * 6. Default: PRIVATE dashboards without explicit grants -> NONE.
 */
export async function evaluateEffectiveAccess(
  dashboardId: string,
  user: AuthenticatedUser
): Promise<DashboardAuthContext> {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    include: {
      access: true,
    },
  });

  if (!dashboard) {
    throw AppError.notFound("Dashboard");
  }

  // 1. Strict Tenant Isolation
  if (dashboard.organizationId !== user.organizationId) {
    return {
      dashboard,
      effectiveAccess: "NONE",
      isOwner: false,
      isAdmin: false,
    };
  }

  // 2. Owner check
  const isOwner = dashboard.ownerId === user.userId;
  if (isOwner) {
    return {
      dashboard,
      effectiveAccess: "OWNER",
      isOwner: true,
      isAdmin: user.roleName === "ADMIN",
    };
  }

  // 3. Admin check
  const isAdmin = user.roleName === "ADMIN";
  if (isAdmin) {
    return {
      dashboard,
      effectiveAccess: "EDIT",
      isOwner: false,
      isAdmin: true,
    };
  }

  // 4. Evaluate explicit DashboardAccess grants
  let highestGrant: EffectiveAccess = "NONE";

  for (const grant of dashboard.access) {
    let matches = false;

    // Direct User Grant
    if (grant.userId && grant.userId === user.userId) {
      matches = true;
    }
    // Role Grant (by role UUID or role Name)
    else if (
      grant.roleId &&
      (grant.roleId === user.roleId || grant.roleId.toUpperCase() === user.roleName.toUpperCase())
    ) {
      matches = true;
    }
    // Organization Grant
    else if (grant.organizationId && grant.organizationId === user.organizationId) {
      matches = true;
    }

    if (matches) {
      if (grant.accessLevel === "EDIT" || grant.accessLevel === "ADMIN") {
        highestGrant = "EDIT";
      } else if (grant.accessLevel === "VIEW" && highestGrant === "NONE") {
        highestGrant = "VIEW";
      }
    }
  }

  if (highestGrant !== "NONE") {
    return {
      dashboard,
      effectiveAccess: highestGrant,
      isOwner: false,
      isAdmin: false,
    };
  }

  // 5. Visibility check
  if (dashboard.visibility === "ORGANIZATION" && user.permissions.includes("DASHBOARD_VIEW")) {
    return {
      dashboard,
      effectiveAccess: "VIEW",
      isOwner: false,
      isAdmin: false,
    };
  }

  // 6. Private with no applicable grant
  return {
    dashboard,
    effectiveAccess: "NONE",
    isOwner: false,
    isAdmin: false,
  };
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * GET /api/v1/dashboards/:dashboardId/access
 * List all active access grants for a dashboard along with owner details.
 */
export async function listDashboardAccess(req: Request, res: Response): Promise<void> {
  const { dashboardId } = req.params;
  const user = req.user!;

  if (!dashboardId) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess === "NONE") {
    throw AppError.forbidden("Access denied: you do not have permission to view this dashboard");
  }

  // Fetch owner info
  const owner = await prisma.user.findUnique({
    where: { id: dashboard.ownerId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  });

  // Fetch all grants
  const grants = await prisma.dashboardAccess.findMany({
    where: { dashboardId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { grantedAt: "asc" },
  });

  // Fetch role metadata for role grants
  const roleIds = grants.map((g) => g.roleId).filter(Boolean) as string[];
  const roles = roleIds.length > 0
    ? await prisma.role.findMany({
        where: {
          OR: [{ id: { in: roleIds } }, { name: { in: roleIds } }],
        },
        select: { id: true, name: true, description: true },
      })
    : [];

  const roleMap = new Map<string, { id: string; name: string; description: string | null }>();
  for (const r of roles) {
    roleMap.set(r.id, r);
    roleMap.set(r.name.toUpperCase(), r);
  }

  // Fetch organization name
  const org = await prisma.organization.findUnique({
    where: { id: dashboard.organizationId },
    select: { id: true, name: true },
  });

  const formattedGrants = grants.map((g) => {
    let type: "USER" | "ROLE" | "ORGANIZATION" = "USER";
    if (g.roleId) type = "ROLE";
    else if (g.organizationId) type = "ORGANIZATION";

    const roleInfo = g.roleId ? roleMap.get(g.roleId) || roleMap.get(g.roleId.toUpperCase()) : null;

    return {
      id: g.id,
      dashboardId: g.dashboardId,
      type,
      userId: g.userId,
      user: g.user || null,
      roleId: g.roleId,
      roleName: roleInfo?.name || g.roleId || null,
      roleDescription: roleInfo?.description || null,
      organizationId: g.organizationId,
      organizationName: g.organizationId ? org?.name || "Organization" : null,
      accessLevel: g.accessLevel as "VIEW" | "EDIT",
      grantedAt: g.grantedAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  });

  sendSuccess(res, {
    dashboard: {
      id: dashboard.id,
      name: dashboard.name,
      visibility: dashboard.visibility,
      ownerId: dashboard.ownerId,
    },
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          avatarUrl: owner.avatarUrl,
          accessLevel: "OWNER",
        }
      : null,
    grants: formattedGrants,
    currentUserAccess: effectiveAccess,
  });
}

/**
 * POST /api/v1/dashboards/:dashboardId/access
 * Grant dashboard access to a user, role, or organization.
 */
export async function createDashboardAccess(req: Request, res: Response): Promise<void> {
  const { dashboardId } = req.params;
  const user = req.user!;
  const input = createDashboardAccessSchema.parse(req.body);

  if (!dashboardId) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== "OWNER" && effectiveAccess !== "EDIT") {
    throw AppError.forbidden("Access denied: you must have EDIT or OWNER permissions to manage sharing");
  }

  // 1. Target Validation
  if (input.type === "USER") {
    // Owner protection
    if (input.userId === dashboard.ownerId) {
      throw AppError.badRequest("Cannot modify access grant for the dashboard owner");
    }

    // Verify user belongs to the same organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: user.organizationId,
        userId: input.userId!,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!member) {
      throw AppError.notFound("User not found in organization");
    }
  } else if (input.type === "ROLE") {
    // Verify role exists
    const role = await prisma.role.findFirst({
      where: {
        OR: [{ id: input.roleId! }, { name: input.roleId!.toUpperCase() }],
      },
    });

    if (!role) {
      throw AppError.notFound("Role");
    }
  } else if (input.type === "ORGANIZATION") {
    // Cannot share with arbitrary external organizations
    if (input.organizationId !== user.organizationId) {
      throw AppError.forbidden("Cannot grant access to external organizations");
    }
  }

  // 2. Check for duplicate grant
  const existingGrant = await prisma.dashboardAccess.findFirst({
    where: {
      dashboardId,
      ...(input.type === "USER" ? { userId: input.userId } : {}),
      ...(input.type === "ROLE" ? { roleId: input.roleId } : {}),
      ...(input.type === "ORGANIZATION" ? { organizationId: input.organizationId } : {}),
    },
  });

  if (existingGrant) {
    // Update existing grant instead of throwing duplicate error
    const updated = await prisma.dashboardAccess.update({
      where: { id: existingGrant.id },
      data: {
        accessLevel: input.accessLevel as DashboardAccessLevel,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    await logAuditEvent({
      organizationId: user.organizationId,
      userId: user.userId,
      action: "DASHBOARD_ACCESS_UPDATED",
      resourceType: "DashboardAccess",
      resourceId: updated.id,
      metadata: {
        dashboardId,
        targetType: input.type,
        targetId: input.userId || input.roleId || input.organizationId,
        accessLevel: input.accessLevel,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200);
    sendSuccess(res, updated);
    return;
  }

  // 3. Create access grant
  const newGrant = await prisma.dashboardAccess.create({
    data: {
      dashboardId,
      userId: input.type === "USER" ? input.userId : null,
      roleId: input.type === "ROLE" ? input.roleId : null,
      organizationId: input.type === "ORGANIZATION" ? input.organizationId : null,
      accessLevel: input.accessLevel as DashboardAccessLevel,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  await logAuditEvent({
    organizationId: user.organizationId,
    userId: user.userId,
    action: "DASHBOARD_ACCESS_GRANTED",
    resourceType: "DashboardAccess",
    resourceId: newGrant.id,
    metadata: {
      dashboardId,
      targetType: input.type,
      targetId: input.userId || input.roleId || input.organizationId,
      accessLevel: input.accessLevel,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, newGrant, 201);
}

/**
 * PATCH /api/v1/dashboards/:dashboardId/access/:accessId
 * Update an existing access grant (e.g. VIEW <-> EDIT).
 */
export async function updateDashboardAccess(req: Request, res: Response): Promise<void> {
  const { dashboardId, accessId } = req.params;
  const user = req.user!;
  const input = updateDashboardAccessSchema.parse(req.body);

  if (!dashboardId || !accessId) {
    throw AppError.badRequest("Dashboard ID and Access ID are required");
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== "OWNER" && effectiveAccess !== "EDIT") {
    throw AppError.forbidden("Access denied: you must have EDIT or OWNER permissions to update sharing");
  }

  const grant = await prisma.dashboardAccess.findUnique({
    where: { id: accessId },
  });

  if (!grant || grant.dashboardId !== dashboardId) {
    throw AppError.notFound("Access grant");
  }

  // Owner protection
  if (grant.userId && grant.userId === dashboard.ownerId) {
    throw AppError.badRequest("Cannot modify access grant for the dashboard owner");
  }

  const updated = await prisma.dashboardAccess.update({
    where: { id: accessId },
    data: {
      accessLevel: input.accessLevel as DashboardAccessLevel,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  await logAuditEvent({
    organizationId: user.organizationId,
    userId: user.userId,
    action: "DASHBOARD_ACCESS_UPDATED",
    resourceType: "DashboardAccess",
    resourceId: updated.id,
    metadata: {
      dashboardId,
      accessId,
      accessLevel: input.accessLevel,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, updated);
}

/**
 * DELETE /api/v1/dashboards/:dashboardId/access/:accessId
 * Revoke an existing dashboard access grant.
 */
export async function revokeDashboardAccess(req: Request, res: Response): Promise<void> {
  const { dashboardId, accessId } = req.params;
  const user = req.user!;

  if (!dashboardId || !accessId) {
    throw AppError.badRequest("Dashboard ID and Access ID are required");
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== "OWNER" && effectiveAccess !== "EDIT") {
    throw AppError.forbidden("Access denied: you must have EDIT or OWNER permissions to revoke sharing");
  }

  const grant = await prisma.dashboardAccess.findUnique({
    where: { id: accessId },
  });

  if (!grant || grant.dashboardId !== dashboardId) {
    throw AppError.notFound("Access grant");
  }

  // Owner protection
  if (grant.userId && grant.userId === dashboard.ownerId) {
    throw AppError.badRequest("Cannot revoke access for the dashboard owner");
  }

  await prisma.dashboardAccess.delete({
    where: { id: accessId },
  });

  await logAuditEvent({
    organizationId: user.organizationId,
    userId: user.userId,
    action: "DASHBOARD_ACCESS_REVOKED",
    resourceType: "DashboardAccess",
    resourceId: accessId,
    metadata: {
      dashboardId,
      revokedGrant: {
        userId: grant.userId,
        roleId: grant.roleId,
        organizationId: grant.organizationId,
        accessLevel: grant.accessLevel,
      },
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: "Access grant revoked successfully" });
}

/**
 * GET /api/v1/dashboards/:dashboardId/access/recipients
 * Search and list eligible organization members, roles, and organization details for sharing.
 * Strictly scoped to the authenticated organization with no credential exposure.
 */
export async function getAvailableRecipients(req: Request, res: Response): Promise<void> {
  const { dashboardId } = req.params;
  const user = req.user!;
  const query = searchRecipientsQuerySchema.parse(req.query);

  if (!dashboardId) {
    throw AppError.badRequest("Dashboard ID is required");
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== "OWNER" && effectiveAccess !== "EDIT") {
    throw AppError.forbidden("Access denied: you do not have permission to manage dashboard access");
  }

  // 1. Fetch organization members matching optional search
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: user.organizationId,
      status: "ACTIVE",
      ...(query.search
        ? {
            user: {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 50,
  });

  // Filter out the dashboard owner from shareable users
  const shareableUsers = members
    .filter((m) => m.user.id !== dashboard.ownerId)
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      roleName: m.role.name,
    }));

  // 2. Fetch available system roles
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  // 3. Fetch current organization
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  sendSuccess(res, {
    users: shareableUsers,
    roles,
    organization,
  });
}
