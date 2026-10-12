// ========================================
// Collaboration & Sharing Service
// ========================================
// Manages workspace collaborator access, fine-grained resource permissions,
// and public/embedded sharing links for dashboards and standalone visualizations.
// ========================================

import crypto from 'crypto';
import { z } from 'zod';
import {
  ChartModel,
  DashboardModel,
  DashboardAccessModel,
  DatasetModel,
  OrganizationMemberModel,
  WorkspaceMemberModel,
  toObjectId
} from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  getDashboardWorkspaceId,
  idIdentifierSchema,
  verifyResourceWorkspaceAccess
} from '../dashboard/dashboard-access.service.js';
import { executeLocalDatasetQuery, loadDatasetForQuery } from '../dashboard/dashboard.service.js';
import { DASHBOARD_ACCESS_LEVEL } from '@repo/types';
import type {
  AuthenticatedUser,
  DashboardAccessLevel,
  DashboardCollaboratorsResponse,
  DatasetQueryResult
} from '@repo/types';

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
  targetUserId: idIdentifierSchema('Invalid user ID'),
  accessLevel: z.enum(['VIEW', 'EDIT', 'ADMIN']).default('VIEW')
});

export const UpdateAccessSchema = z.object({
  accessLevel: z.enum(['VIEW', 'EDIT', 'ADMIN'])
});

// ============================================================
// DASHBOARD COLLABORATORS
// ============================================================

/**
 * List all collaborators with access to a dashboard
 */
export async function listDashboardCollaborators(
  dashboardId: string,
  user: AuthenticatedUser
): Promise<DashboardCollaboratorsResponse> {
  const { userId, organizationId, roleName } = user;

  const dashboardObjectId = toObjectId(dashboardId);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findOne({
        _id: dashboardObjectId,
        organizationId: toObjectId(organizationId)
      })
        .populate<{ ownerId: { _id: unknown; name: string; email: string } }>('ownerId', 'name email')
        .lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    roleName,
    'READ'
  );

  const accessGrants = await DashboardAccessModel.find({ dashboardId: dashboard._id })
    .populate<{
      userId: { _id: unknown; name: string; email: string; avatarUrl: string | null } | null;
    }>('userId', 'name email avatarUrl')
    .lean();

  const serializedGrants: Array<{
    id: string;
    accessLevel: string;
    grantedAt: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  }> = accessGrants.map((grant) => {
    const profile = grant.userId as unknown as {
      _id: { toString(): string };
      name: string;
      email: string;
      avatarUrl: string | null;
    } | null;
    return {
      id: grant._id.toString(),
      accessLevel: grant.accessLevel,
      grantedAt: grant.grantedAt.toISOString(),
      user: profile
        ? {
            id: profile._id.toString(),
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.avatarUrl ?? null
          }
        : null
    };
  });

  const collaborators: CollaboratorInfo[] = serializedGrants
    .filter((grant) => grant.user !== null)
    .map((grant) => {
      const userProfile = grant.user as {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
      };
      return {
        id: grant.id,
        userId: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        avatarUrl: userProfile.avatarUrl,
        accessLevel: grant.accessLevel as DashboardAccessLevel,
        grantedAt: grant.grantedAt
      };
    });

  let workspaceMembers: DashboardCollaboratorsResponse['workspaceMembers'];

  if (workspaceId) {
    const members = await WorkspaceMemberModel.find({ workspaceId: toObjectId(workspaceId) })
      .populate<{
        userId: { _id: unknown; name: string; email: string; avatarUrl: string | null };
      }>('userId', 'name email avatarUrl')
      .lean();

    workspaceMembers = members
      .filter((member) => member.userId)
      .map((member) => {
        const profile = member.userId as unknown as {
          _id: { toString(): string };
          name: string;
          email: string;
          avatarUrl: string | null;
        };
        return {
          userId: profile._id.toString(),
          roleName: member.role,
          user: {
            id: profile._id.toString(),
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.avatarUrl ?? null
          }
        };
      });
  } else {
    const members = await OrganizationMemberModel.find({
      organizationId: toObjectId(organizationId)
    })
      .populate<{
        userId: { _id: unknown; name: string; email: string; avatarUrl: string | null };
        roleId: { name: string } | null;
      }>('userId', 'name email avatarUrl')
      .populate<{ roleId: { name: string } | null }>('roleId', 'name')
      .lean();

    workspaceMembers = members
      .filter((member) => member.userId)
      .map((member) => {
        const profile = member.userId as unknown as {
          _id: { toString(): string };
          name: string;
          email: string;
          avatarUrl: string | null;
        };
        return {
          userId: profile._id.toString(),
          roleName: member.roleId?.name || 'MEMBER',
          user: {
            id: profile._id.toString(),
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.avatarUrl ?? null
          }
        };
      });
  }

  const owner = dashboard.ownerId as unknown as {
    _id: { toString(): string };
    name: string;
    email: string;
  };

  return {
    owner: {
      id: owner._id.toString(),
      name: owner.name,
      email: owner.email
    },
    collaborators,
    workspaceMembers
  };
}

/**
 * Grant a workspace member access to a dashboard
 */
export async function grantDashboardCollaborator(
  dashboardId: string,
  input: z.infer<typeof GrantAccessSchema>,
  user: AuthenticatedUser
): Promise<CollaboratorInfo> {
  const { userId, organizationId, roleName } = user;
  const { targetUserId, accessLevel } = input;

  const dashboardObjectId = toObjectId(dashboardId);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findOne({
        _id: dashboardObjectId,
        organizationId: toObjectId(organizationId)
      }).lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  const targetUserObjectId = toObjectId(targetUserId);
  if (!targetUserObjectId) {
    throw AppError.badRequest('Target user is not a member of this dashboard workspace');
  }

  // Validate target user exists in the same workspace (or organization for legacy dashboards).
  const targetMember = workspaceId
    ? await WorkspaceMemberModel.findOne({
        workspaceId: toObjectId(workspaceId),
        userId: targetUserObjectId
      })
        .populate<{
          userId: { _id: unknown; name: string; email: string; avatarUrl: string | null };
        }>('userId', 'name email avatarUrl')
        .lean()
    : await OrganizationMemberModel.findOne({
        userId: targetUserObjectId,
        organizationId: toObjectId(organizationId)
      })
        .populate<{
          userId: { _id: unknown; name: string; email: string; avatarUrl: string | null };
        }>('userId', 'name email avatarUrl')
        .lean();

  if (!targetMember) {
    throw AppError.badRequest('Target user is not a member of this dashboard workspace');
  }

  // Prevent granting to dashboard owner
  if (dashboard.ownerId.toString() === targetUserId) {
    throw AppError.badRequest('User is already the dashboard owner');
  }

  // Upsert access grant
  const existing = await DashboardAccessModel.findOne({
    dashboardId: dashboard._id,
    userId: targetUserObjectId
  }).lean();

  let grantId: string;
  if (existing) {
    const updated = await DashboardAccessModel.findByIdAndUpdate(
      existing._id,
      { $set: { accessLevel } },
      { new: true }
    ).lean();
    grantId = (updated?._id ?? existing._id).toString();
  } else {
    const created = await DashboardAccessModel.create({
      dashboardId: dashboard._id,
      userId: targetUserObjectId,
      accessLevel
    });
    grantId = created._id.toString();
  }

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: 'DASHBOARD_COLLABORATOR_GRANTED',
    resourceType: 'DASHBOARD',
    resourceId: dashboardId,
    metadata: {
      targetUserId,
      accessLevel
    }
  });

  const grant = await DashboardAccessModel.findById(toObjectId(grantId))
    .populate<{
      userId: { _id: unknown; name: string; email: string; avatarUrl: string | null };
    }>('userId', 'name email avatarUrl')
    .lean();

  const profile = grant?.userId as unknown as {
    _id: { toString(): string };
    name: string;
    email: string;
    avatarUrl: string | null;
  };

  return {
    id: grantId,
    userId: profile._id.toString(),
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl ?? null,
    accessLevel: (grant?.accessLevel ?? accessLevel) as DashboardAccessLevel,
    grantedAt: (grant?.grantedAt ?? new Date()).toISOString()
  };
}

/**
 * Revoke collaborator access from a dashboard
 */
export async function revokeDashboardCollaborator(
  dashboardId: string,
  accessId: string,
  user: AuthenticatedUser
): Promise<{ message: string }> {
  const { userId, organizationId, roleName } = user;

  const dashboardObjectId = toObjectId(dashboardId);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findOne({
        _id: dashboardObjectId,
        organizationId: toObjectId(organizationId)
      }).lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  const grant = await DashboardAccessModel.findOne({
    _id: toObjectId(accessId),
    dashboardId: dashboard._id
  }).lean();

  if (!grant) {
    throw AppError.notFound('Collaborator access record not found');
  }

  await DashboardAccessModel.deleteOne({ _id: grant._id }).exec();

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: 'DASHBOARD_COLLABORATOR_REVOKED',
    resourceType: 'DASHBOARD',
    resourceId: dashboardId,
    metadata: {
      revokedAccessId: accessId,
      revokedUserId: grant.userId ? grant.userId.toString() : null
    }
  });

  return { message: 'Collaborator access revoked successfully' };
}

// ============================================================
// STANDALONE VISUALIZATION / CHART SHARING
// ============================================================

export interface ChartShareLinkResult {
  shareToken: string | null;
  isPublic: boolean;
  shareTokenActive: boolean;
  sharedAt: string | null;
}

/** Load a chart together with its owning dashboard's tenant scope. */
async function loadChartWithDashboard(chartId: string, organizationId: string) {
  const chartObjectId = toObjectId(chartId);
  const chart = chartObjectId ? await ChartModel.findById(chartObjectId).lean() : null;
  if (!chart) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  const dashboard = await DashboardModel.findById(chart.dashboardId)
    .select('organizationId layoutConfig')
    .lean();

  if (!dashboard || dashboard.organizationId.toString() !== organizationId) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  return { chart, dashboard };
}

export async function createChartShareLink(
  chartId: string,
  user: AuthenticatedUser
): Promise<ChartShareLinkResult> {
  const { userId, organizationId, roleName } = user;

  const { chart, dashboard } = await loadChartWithDashboard(chartId, organizationId);

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  const shareToken = chart.shareToken || crypto.randomBytes(24).toString('hex');

  const updated = await ChartModel.findByIdAndUpdate(
    chart._id,
    {
      $set: {
        shareToken,
        shareTokenActive: true,
        isPublic: true,
        sharedAt: new Date()
      }
    },
    { new: true }
  ).lean();

  if (!updated) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: 'CHART_SHARED',
    resourceType: 'CHART',
    resourceId: chart._id.toString(),
    metadata: { shareToken }
  });

  return {
    shareToken: updated.shareToken,
    isPublic: updated.isPublic,
    shareTokenActive: updated.shareTokenActive,
    sharedAt: updated.sharedAt ? updated.sharedAt.toISOString() : null
  };
}

export async function revokeChartShareLink(
  chartId: string,
  user: AuthenticatedUser
): Promise<{ message: string }> {
  const { userId, organizationId, roleName } = user;

  const { chart, dashboard } = await loadChartWithDashboard(chartId, organizationId);

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId },
    userId,
    organizationId,
    roleName,
    'WRITE'
  );

  await ChartModel.updateOne(
    { _id: chart._id },
    { $set: { shareTokenActive: false, isPublic: false } }
  ).exec();

  await logAuditEvent({
    userId,
    organizationId,
    workspaceId,
    action: 'CHART_SHARE_REVOKED',
    resourceType: 'CHART',
    resourceId: chart._id.toString()
  });

  return { message: 'Chart share link revoked' };
}

/** Load an active public chart by its share token. */
async function loadSharedChart(shareToken: string) {
  const chart = await ChartModel.findOne({
    shareToken,
    shareTokenActive: true,
    isPublic: true
  }).lean();

  if (!chart) {
    throw AppError.notFound('Shared chart not found or share link has been revoked');
  }

  return chart;
}

export async function getSharedChartByToken(shareToken: string): Promise<Record<string, unknown>> {
  const chart = await loadSharedChart(shareToken);

  const dataset = chart.datasetId
    ? await DatasetModel.findById(chart.datasetId).select('name').lean()
    : null;

  return {
    id: chart._id.toString(),
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType,
    config: chart.config,
    dataset: dataset ? { id: dataset._id.toString(), name: dataset.name } : null,
    sharedAt: chart.sharedAt ? chart.sharedAt.toISOString() : null
  };
}

export async function getSharedChartDataByToken(shareToken: string): Promise<DatasetQueryResult> {
  const chart = await loadSharedChart(shareToken);

  if (!chart.datasetId) {
    throw AppError.notFound('Shared chart data not available');
  }

  const dataset = await loadDatasetForQuery(chart.datasetId);
  if (!dataset) {
    throw AppError.notFound('Shared chart data not available');
  }

  return executeLocalDatasetQuery(dataset, { limit: 1000, offset: 0 });
}

/** Access levels usable when granting a dashboard collaborator. */
export const COLLABORATOR_ACCESS_LEVELS = Object.values(DASHBOARD_ACCESS_LEVEL);
