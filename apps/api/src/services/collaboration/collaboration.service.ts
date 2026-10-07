// ========================================
// Collaboration & Sharing Service
// ========================================
// Manages workspace collaborator access, fine-grained resource permissions,
// and public/embedded sharing links for dashboards and standalone visualizations.
// ========================================

import crypto from "crypto";
import { z } from "zod";
import type { DashboardAccessLevel } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { getDashboardWorkspaceId, verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";
import { datasetQueryEngine } from "../dataset/query-engine.js";

export interface CollaboratorInfo {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  accessLevel: DashboardAccessLevel;
  grantedAt: string;
}

export const GrantAccessSchema = z.object({
  targetUserId: z.string().uuid("Invalid user ID"),
  accessLevel: z.enum(["VIEW", "EDIT", "ADMIN"]).default("VIEW"),
});

export const UpdateAccessSchema = z.object({
  accessLevel: z.enum(["VIEW", "EDIT", "ADMIN"]),
});

/**
 * List all collaborators with access to a dashboard
 */
export async function listDashboardCollaborators(
  dashboardId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<{
  owner: { id: string; name: string; email: string };
  collaborators: CollaboratorInfo[];
  workspaceMembers: Array<{
    userId: string;
    roleName: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }>;
}> {
  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, organizationId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      access: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "READ"
  );

  const collaborators: CollaboratorInfo[] = dashboard.access
    .filter((g) => g.user !== null)
    .map((g) => ({
      id: g.id,
      userId: g.user!.id,
      name: g.user!.name,
      email: g.user!.email,
      avatarUrl: g.user!.avatarUrl,
      accessLevel: g.accessLevel,
      grantedAt: g.grantedAt.toISOString(),
    }));

  const workspaceMembers = workspaceId
    ? (await prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      })).map((member) => ({ userId: member.user.id, roleName: member.role, user: member.user }))
    : (await prisma.organizationMember.findMany({
        where: { organizationId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          role: { select: { name: true } },
        },
      })).map((member) => ({ userId: member.user.id, roleName: member.role?.name || "MEMBER", user: member.user }));

  return {
    owner: dashboard.owner,
    collaborators,
    workspaceMembers,
  };
}

/**
 * Grant a workspace member access to a dashboard
 */
export async function grantDashboardCollaborator(
  dashboardId: string,
  targetUserId: string,
  accessLevel: DashboardAccessLevel,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<CollaboratorInfo> {
  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, organizationId },
  });

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "WRITE"
  );

  // Validate target user exists in the same workspace (or organization for legacy dashboards).
  const targetMember = workspaceId
    ? await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
        include: { user: true },
      })
    : await prisma.organizationMember.findFirst({
        where: { userId: targetUserId, organizationId },
        include: { user: true },
      });

  if (!targetMember) {
    throw AppError.badRequest("Target user is not a member of this dashboard workspace");
  }

  // Prevent granting to dashboard owner
  if (dashboard.ownerId === targetUserId) {
    throw AppError.badRequest("User is already the dashboard owner");
  }

  // Upsert access grant
  const existing = await prisma.dashboardAccess.findFirst({
    where: { dashboardId, userId: targetUserId },
  });

  let grant;
  if (existing) {
    grant = await prisma.dashboardAccess.update({
      where: { id: existing.id },
      data: { accessLevel },
      include: { user: true },
    });
  } else {
    grant = await prisma.dashboardAccess.create({
      data: {
        dashboardId,
        userId: targetUserId,
        accessLevel,
      },
      include: { user: true },
    });
  }

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: "DASHBOARD_COLLABORATOR_GRANTED",
    resourceType: "DASHBOARD",
    resourceId: dashboardId,
    metadata: {
      targetUserId,
      accessLevel,
    },
  });

  return {
    id: grant.id,
    userId: grant.user!.id,
    name: grant.user!.name,
    email: grant.user!.email,
    avatarUrl: grant.user!.avatarUrl,
    accessLevel: grant.accessLevel,
    grantedAt: grant.grantedAt.toISOString(),
  };
}

/**
 * Revoke collaborator access from a dashboard
 */
export async function revokeDashboardCollaborator(
  dashboardId: string,
  accessId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
) {
  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, organizationId },
  });

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "WRITE"
  );

  const grant = await prisma.dashboardAccess.findFirst({
    where: { id: accessId, dashboardId },
  });

  if (!grant) {
    throw AppError.notFound("Collaborator access record not found");
  }

  await prisma.dashboardAccess.delete({
    where: { id: accessId },
  });

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: "DASHBOARD_COLLABORATOR_REVOKED",
    resourceType: "DASHBOARD",
    resourceId: dashboardId,
    metadata: {
      revokedAccessId: accessId,
      revokedUserId: grant.userId,
    },
  });

  return { message: "Collaborator access revoked successfully" };
}

// ============================================================
// STANDALONE VISUALIZATION / CHART SHARING
// ============================================================

export async function createChartShareLink(
  chartId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
) {
  const chart = await prisma.chart.findFirst({
    where: { id: chartId },
    include: {
      dashboard: { select: { organizationId: true, layoutConfig: true } },
    },
  });

  if (!chart || chart.dashboard.organizationId !== organizationId) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(chart.dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "WRITE"
  );

  const shareToken = chart.shareToken || crypto.randomBytes(24).toString("hex");

  const updated = await prisma.chart.update({
    where: { id: chart.id },
    data: {
      shareToken,
      shareTokenActive: true,
      isPublic: true,
      sharedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: "CHART_SHARED",
    resourceType: "CHART",
    resourceId: chart.id,
    metadata: { shareToken },
  });

  return {
    shareToken: updated.shareToken,
    isPublic: updated.isPublic,
    shareTokenActive: updated.shareTokenActive,
    sharedAt: updated.sharedAt?.toISOString(),
  };
}

export async function revokeChartShareLink(
  chartId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
) {
  const chart = await prisma.chart.findFirst({
    where: { id: chartId },
    include: {
      dashboard: { select: { organizationId: true, layoutConfig: true } },
    },
  });

  if (!chart || chart.dashboard.organizationId !== organizationId) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(chart.dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    userRoleName,
    "WRITE"
  );

  await prisma.chart.update({
    where: { id: chart.id },
    data: {
      shareTokenActive: false,
      isPublic: false,
    },
  });

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: "CHART_SHARE_REVOKED",
    resourceType: "CHART",
    resourceId: chart.id,
  });

  return { message: "Chart share link revoked" };
}

export async function getSharedChartByToken(shareToken: string) {
  const chart = await prisma.chart.findFirst({
    where: {
      shareToken,
      shareTokenActive: true,
      isPublic: true,
    },
    include: {
      dataset: { select: { id: true, name: true } },
    },
  });

  if (!chart) {
    throw AppError.notFound("Shared chart not found or share link has been revoked");
  }

  return {
    id: chart.id,
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType,
    config: chart.config,
    dataset: chart.dataset,
    sharedAt: chart.sharedAt,
  };
}

export async function getSharedChartDataByToken(shareToken: string) {
  const chart = await prisma.chart.findFirst({
    where: {
      shareToken,
      shareTokenActive: true,
      isPublic: true,
    },
    include: {
      dataset: { include: { columns: true } },
    },
  });

  if (!chart || !chart.dataset) {
    throw AppError.notFound("Shared chart data not available");
  }

  const queryRes = await datasetQueryEngine.executeQuery(chart.dataset, {
    limit: 1000,
    offset: 0,
  });

  return queryRes;
}
