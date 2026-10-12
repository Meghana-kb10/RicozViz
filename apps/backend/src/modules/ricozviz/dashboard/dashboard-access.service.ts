// ========================================
// Dashboard Access & Sharing Service
// ========================================
// Governs dashboard sharing across users, roles, and organizations.
// Enforces multi-tenant isolation, owner protection, RBAC checks,
// deterministic effective access evaluation, and audit logging.
// Never exposes password hashes or sensitive account credentials.
//
// This module also owns the workspace authorization helpers used by every
// dashboard-adjacent feature. They live here (instead of a separate workspace
// module) so the dashboard/chart/collaboration/report domains share one tenant
// boundary implementation.
// ========================================

import mongoose from 'mongoose';
import { z } from 'zod';
import {
  DashboardModel,
  DashboardAccessModel,
  OrganizationModel,
  OrganizationMemberModel,
  RoleModel,
  UserModel,
  WorkspaceModel,
  WorkspaceMemberModel,
  toObjectId,
  serializeDoc,
  type IDashboardDocument,
  type IOrganizationMemberDocument,
  type IWorkspaceDocument
} from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  DASHBOARD_ACCESS_LEVEL,
  DASHBOARD_VISIBILITY,
  MEMBERSHIP_STATUS,
  WORKSPACE_ROLE
} from '@repo/types';
import type { AuthenticatedUser, DashboardAccessLevel } from '@repo/types';

// ============================================================
// IDENTIFIER SCHEMA
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Legacy identifiers were UUID strings; MongoDB uses 24-character hex ids.
 * The validation error message is preserved verbatim, only the accepted shape
 * is widened so migrated ObjectId identifiers keep working.
 */
export function idIdentifierSchema(message: string) {
  return z.string().refine(
    (value) => UUID_PATTERN.test(value) || mongoose.Types.ObjectId.isValid(value),
    { message }
  );
}

/**
 * `toObjectId` returns `null` for malformed input, which Mongoose filters reject.
 * Use this at every call site where the id has already been resolved (or where
 * a missing record and a malformed id are equivalent) so the cast is total.
 */
export function requireObjectId(value: unknown, resource = 'Resource'): mongoose.Types.ObjectId {
  const objectId = toObjectId(value);
  if (!objectId) {
    throw AppError.notFound(resource);
  }
  return objectId;
}

// ============================================================
// WORKSPACE AUTHORIZATION HELPERS
// ============================================================

/**
 * Dashboards predate the first-class workspace relation and keep their
 * workspace binding in layoutConfig. Keep the extraction in one place so all
 * dashboard-adjacent features apply the same tenant boundary.
 */
export function getDashboardWorkspaceId(layoutConfig: unknown): string | undefined {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return undefined;
  }

  const workspaceId = (layoutConfig as Record<string, unknown>).workspaceId;
  return typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId : undefined;
}

export interface WorkspaceAccessContext {
  workspaceId: string;
  userRole: string;
  isOrgAdmin: boolean;
}

/**
 * Load the caller's workspace membership.
 * Organization admins bypass the membership requirement.
 */
export async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<WorkspaceAccessContext> {
  const workspaceObjectId = toObjectId(workspaceId);
  const organizationObjectId = toObjectId(organizationId);

  const workspace: IWorkspaceDocument | null = workspaceObjectId
    ? await WorkspaceModel.findOne({
        _id: workspaceObjectId,
        organizationId: organizationObjectId
      }).lean()
    : null;

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  const isOrgAdmin = userRoleName === 'ADMIN';
  const userObjectId = toObjectId(userId);

  const membership =
    workspaceObjectId && userObjectId
      ? await WorkspaceMemberModel.findOne({ workspaceId: workspaceObjectId, userId: userObjectId })
          .select('role')
          .lean()
      : null;

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden('Access denied: You do not have access to this workspace');
  }

  return {
    workspaceId: workspace._id.toString(),
    userRole: membership?.role ?? WORKSPACE_ROLE.ADMIN,
    isOrgAdmin
  };
}

/**
 * Resolves target workspaceId for resource creation or query filtering.
 * - If targetWorkspaceId is supplied by the client, verifies membership.
 * - If not supplied, falls back to the user's first accessible workspace in the organization.
 */
export async function resolveTargetWorkspaceId(
  targetWorkspaceId: string | undefined | null,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<string | null> {
  if (targetWorkspaceId) {
    await resolveWorkspaceAccess(targetWorkspaceId, userId, organizationId, userRoleName);
    return targetWorkspaceId;
  }

  // Fallback to first accessible workspace for this user in the organization
  try {
    const userObjectId = toObjectId(userId);
    const organizationObjectId = toObjectId(organizationId);
    if (!userObjectId || !organizationObjectId) {
      return null;
    }

    const membership = await WorkspaceMemberModel.findOne({
      userId: userObjectId,
      workspaceId: { $in: await workspaceIdsForOrganization(organizationObjectId) }
    })
      .select('workspaceId')
      .lean();

    return membership?.workspaceId ? membership.workspaceId.toString() : null;
  } catch {
    return null;
  }
}

async function workspaceIdsForOrganization(
  organizationId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> {
  const workspaces = await WorkspaceModel.find({ organizationId }).select('_id').lean();
  return workspaces.map((workspace) => workspace._id);
}

export type WorkspaceAction = 'READ' | 'WRITE' | 'DELETE' | 'ADMIN' | 'SHARE';

const inMemoryWorkspaceRoleStore = new Map<string, string>();

export function registerInMemoryWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: string
): void {
  inMemoryWorkspaceRoleStore.set(`${workspaceId}:${userId}`, role);
}

export function clearInMemoryWorkspaceMembers(): void {
  inMemoryWorkspaceRoleStore.clear();
}

/**
 * Verifies that the authenticated user has access to the workspace of the given resource.
 * If resource belongs to a workspace, checks user's membership (or org admin).
 * Enforces role hierarchy: OWNER -> ADMIN -> EDITOR/MEMBER -> VIEWER.
 * Prevents Workspace A users from accessing Workspace B resources.
 */
export async function verifyResourceWorkspaceAccess(
  resource: { workspaceId?: string | null; organizationId: string },
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: WorkspaceAction = 'READ'
): Promise<void> {
  // 1. Organization tenant isolation
  if (resource.organizationId !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  // 2. Organization admins bypass workspace restrictions
  if (userRoleName === 'ADMIN') {
    return;
  }

  // 3. Workspace scoping
  if (resource.workspaceId) {
    let userRole = inMemoryWorkspaceRoleStore.get(`${resource.workspaceId}:${userId}`);

    if (!userRole) {
      try {
        const access = await resolveWorkspaceAccess(
          resource.workspaceId,
          userId,
          organizationId,
          userRoleName
        );
        if (access.isOrgAdmin) {
          return; // Organization admins bypass workspace restrictions
        }
        userRole = access.userRole;
      } catch (err) {
        if (err instanceof AppError) throw err;
        return;
      }
    }

    if (requiredAction === 'READ') {
      // All workspace members (OWNER, ADMIN, MEMBER, EDITOR, VIEWER) can read
      return;
    }

    if (requiredAction === 'WRITE') {
      if (userRole === WORKSPACE_ROLE.VIEWER) {
        throw AppError.forbidden('Access denied: Viewers have read-only access to this workspace');
      }
      return;
    }

    if (requiredAction === 'DELETE') {
      if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN) {
        throw AppError.forbidden(
          'Access denied: Only workspace owners and admins can delete this resource'
        );
      }
      return;
    }

    if (requiredAction === 'SHARE') {
      if (userRole === WORKSPACE_ROLE.VIEWER) {
        throw AppError.forbidden('Access denied: Viewers cannot share workspace resources');
      }
      return;
    }

    if (requiredAction === 'ADMIN') {
      if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN) {
        throw AppError.forbidden(
          'Access denied: Only workspace owners and admins have administrative permissions'
        );
      }
      return;
    }
  }
}

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

export const createDashboardAccessSchema = z
  .object({
    type: z.enum(['USER', 'ROLE', 'ORGANIZATION']),
    userId: idIdentifierSchema('Invalid user ID').optional().nullable(),
    roleId: z.string().optional().nullable(),
    organizationId: idIdentifierSchema('Invalid organization ID').optional().nullable(),
    accessLevel: z.enum(['VIEW', 'EDIT']).default('VIEW')
  })
  .refine(
    (data) => {
      if (data.type === 'USER') return !!data.userId;
      if (data.type === 'ROLE') return !!data.roleId;
      if (data.type === 'ORGANIZATION') return !!data.organizationId;
      return false;
    },
    {
      message:
        'Target ID (userId, roleId, or organizationId) matching target type is required'
    }
  );

export const updateDashboardAccessSchema = z.object({
  accessLevel: z.enum(['VIEW', 'EDIT'])
});

export const searchRecipientsQuerySchema = z.object({
  search: z.string().trim().optional()
});

// ============================================================
// EFFECTIVE ACCESS EVALUATION
// ============================================================

export type EffectiveAccess = 'OWNER' | 'EDIT' | 'VIEW' | 'NONE';

export interface DashboardAuthContext {
  dashboard: IDashboardDocument;
  accessGrants: IDashboardAccessGrant[];
  effectiveAccess: EffectiveAccess;
  isOwner: boolean;
  isAdmin: boolean;
}

/** Flattened grant shape used for deterministic access evaluation. */
export interface IDashboardAccessGrant {
  _id: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  roleId: mongoose.Types.ObjectId | null;
  organizationId: mongoose.Types.ObjectId | null;
  accessLevel: string;
  grantedAt: Date;
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
  const dashboardObjectId = toObjectId(dashboardId);
  if (!dashboardObjectId) {
    throw AppError.notFound('Dashboard');
  }

  const dashboard = await DashboardModel.findById(dashboardObjectId).exec();
  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  const grants = (await DashboardAccessModel.find({ dashboardId: dashboardObjectId })
    .lean()) as unknown as IDashboardAccessGrant[];

  // 1. Strict Tenant Isolation
  if (dashboard.organizationId.toString() !== user.organizationId) {
    return { dashboard, accessGrants: grants, effectiveAccess: 'NONE', isOwner: false, isAdmin: false };
  }

  // 2. Owner check
  const isOwner = dashboard.ownerId.toString() === user.userId;
  if (isOwner) {
    return {
      dashboard,
      accessGrants: grants,
      effectiveAccess: 'OWNER',
      isOwner: true,
      isAdmin: user.roleName === 'ADMIN'
    };
  }

  // 3. Admin check
  const isAdmin = user.roleName === 'ADMIN';
  if (isAdmin) {
    return { dashboard, accessGrants: grants, effectiveAccess: 'EDIT', isOwner: false, isAdmin: true };
  }

  // 4. Evaluate explicit DashboardAccess grants
  let highestGrant: EffectiveAccess = 'NONE';

  for (const grant of grants) {
    let matches = false;

    // Direct User Grant
    if (grant.userId && grant.userId.toString() === user.userId) {
      matches = true;
    }
    // Role Grant (by role id or role Name)
    else if (
      grant.roleId &&
      (grant.roleId.toString() === user.roleId ||
        grant.roleId.toString().toUpperCase() === user.roleName.toUpperCase())
    ) {
      matches = true;
    }
    // Organization Grant
    else if (grant.organizationId && grant.organizationId.toString() === user.organizationId) {
      matches = true;
    }

    if (matches) {
      if (
        grant.accessLevel === DASHBOARD_ACCESS_LEVEL.EDIT ||
        grant.accessLevel === DASHBOARD_ACCESS_LEVEL.ADMIN
      ) {
        highestGrant = 'EDIT';
      } else if (grant.accessLevel === DASHBOARD_ACCESS_LEVEL.VIEW && highestGrant === 'NONE') {
        highestGrant = 'VIEW';
      }
    }
  }

  if (highestGrant !== 'NONE') {
    return {
      dashboard,
      accessGrants: grants,
      effectiveAccess: highestGrant,
      isOwner: false,
      isAdmin: false
    };
  }

  // 5. Visibility check
  if (
    dashboard.visibility === DASHBOARD_VISIBILITY.ORGANIZATION &&
    user.permissions.includes('DASHBOARD_VIEW')
  ) {
    return { dashboard, accessGrants: grants, effectiveAccess: 'VIEW', isOwner: false, isAdmin: false };
  }

  // 6. Private with no applicable grant
  return { dashboard, accessGrants: grants, effectiveAccess: 'NONE', isOwner: false, isAdmin: false };
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

export interface AuditTrail {
  ipAddress?: string;
  userAgent?: string;
}

export interface DashboardAccessListResult {
  dashboard: { id: string; name: string; visibility: string; ownerId: string };
  owner: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    accessLevel: 'OWNER';
  } | null;
  grants: Array<{
    id: string;
    dashboardId: string;
    type: 'USER' | 'ROLE' | 'ORGANIZATION';
    userId: string | null;
    user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
    roleId: string | null;
    roleName: string | null;
    roleDescription: string | null;
    organizationId: string | null;
    organizationName: string | null;
    accessLevel: DashboardAccessLevel;
    grantedAt: string;
    updatedAt: string;
  }>;
  currentUserAccess: EffectiveAccess;
}

/**
 * List all active access grants for a dashboard along with owner details.
 */
export async function listDashboardAccess(
  user: AuthenticatedUser,
  dashboardId: string
): Promise<DashboardAccessListResult> {
  if (!dashboardId) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess === 'NONE') {
    throw AppError.forbidden(
      'Access denied: you do not have permission to view this dashboard'
    );
  }

  const dashboardObjectId = dashboard._id;

  // Fetch owner info
  const owner = await UserModel.findById(dashboard.ownerId)
    .select('name email avatarUrl')
    .lean();

  // Fetch all grants with their resolved user profile
  const grantDocs = await DashboardAccessModel.find({ dashboardId: dashboardObjectId })
    .populate<{
      userId: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null } | null;
    }>('userId', 'name email avatarUrl')
    .sort({ grantedAt: 1 })
    .lean();

  // Fetch role metadata for role grants
  const roleIds = grantDocs
    .map((grant) => grant.roleId)
    .filter((value): value is mongoose.Types.ObjectId => Boolean(value))
    .map((value) => value.toString());

  const roles =
    roleIds.length > 0
      ? await RoleModel.find({
          $or: [
            { _id: { $in: roleIds.map((id) => toObjectId(id)).filter(Boolean) } },
            { name: { $in: roleIds } },
            { name: { $in: roleIds.map((id) => id.toUpperCase()) } }
          ]
        })
          .select('name description')
          .lean()
      : [];

  const roleMap = new Map<string, { id: string; name: string; description: string | null }>();
  for (const role of roles) {
    roleMap.set(role._id.toString(), {
      id: role._id.toString(),
      name: role.name,
      description: role.description
    });
    roleMap.set(role.name.toUpperCase(), {
      id: role._id.toString(),
      name: role.name,
      description: role.description
    });
  }

  // Fetch organization name
  const org = await OrganizationModel.findById(dashboard.organizationId).select('name').lean();

  const formattedGrants = grantDocs.map((grant) => {
    let type: 'USER' | 'ROLE' | 'ORGANIZATION' = 'USER';
    if (grant.roleId) type = 'ROLE';
    else if (grant.organizationId) type = 'ORGANIZATION';

    const roleKey = grant.roleId ? grant.roleId.toString() : null;
    const roleInfo = roleKey ? roleMap.get(roleKey) || roleMap.get(roleKey.toUpperCase()) : null;

    const populatedUser = (grant as unknown as { userId?: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null } | null }).userId;

    return {
      id: grant._id.toString(),
      dashboardId: grant.dashboardId.toString(),
      type,
      userId: grant.userId ? grant.userId.toString() : null,
      user: populatedUser
        ? {
            id: populatedUser._id.toString(),
            name: populatedUser.name,
            email: populatedUser.email,
            avatarUrl: populatedUser.avatarUrl ?? null
          }
        : null,
      roleId: roleKey,
      roleName: roleInfo?.name || roleKey || null,
      roleDescription: roleInfo?.description || null,
      organizationId: grant.organizationId ? grant.organizationId.toString() : null,
      organizationName: grant.organizationId ? org?.name || 'Organization' : null,
      accessLevel: grant.accessLevel as DashboardAccessLevel,
      grantedAt: grant.grantedAt.toISOString(),
      updatedAt: grant.updatedAt.toISOString()
    };
  });

  return {
    dashboard: {
      id: dashboard._id.toString(),
      name: dashboard.name,
      visibility: dashboard.visibility,
      ownerId: dashboard.ownerId.toString()
    },
    owner: owner
      ? {
          id: owner._id.toString(),
          name: owner.name,
          email: owner.email,
          avatarUrl: owner.avatarUrl ?? null,
          accessLevel: 'OWNER'
        }
      : null,
    grants: formattedGrants,
    currentUserAccess: effectiveAccess
  };
}

/**
 * Grant dashboard access to a user, role, or organization.
 * Returns the grant record plus a `created` flag so the controller can pick
 * between 200 (updated) and 201 (created) exactly like the legacy handler.
 */
export async function createDashboardAccess(
  user: AuthenticatedUser,
  dashboardId: string,
  input: z.infer<typeof createDashboardAccessSchema>,
  audit: AuditTrail = {}
): Promise<{ grant: Record<string, unknown>; created: boolean }> {
  if (!dashboardId) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== 'OWNER' && effectiveAccess !== 'EDIT') {
    throw AppError.forbidden(
      'Access denied: you must have EDIT or OWNER permissions to manage sharing'
    );
  }

  // 1. Target Validation
  if (input.type === 'USER') {
    // Owner protection
    if (input.userId === dashboard.ownerId.toString()) {
      throw AppError.badRequest('Cannot modify access grant for the dashboard owner');
    }

    // Verify user belongs to the same organization
    const member = await OrganizationMemberModel.findOne({
      organizationId: toObjectId(user.organizationId),
      userId: toObjectId(input.userId as string)
    }).lean();

    if (!member) {
      throw AppError.notFound('User not found in organization');
    }
  } else if (input.type === 'ROLE') {
    // Verify role exists (by id or by upper-cased name)
    const roleId = toObjectId(input.roleId as string);
    const role = await RoleModel.findOne({
      $or: [{ _id: roleId }, { name: (input.roleId as string).toUpperCase() }]
    }).lean();

    if (!role) {
      throw AppError.notFound('Role');
    }
  } else if (input.type === 'ORGANIZATION') {
    // Cannot share with arbitrary external organizations
    if (input.organizationId !== user.organizationId) {
      throw AppError.forbidden('Cannot grant access to external organizations');
    }
  }

  // 2. Check for duplicate grant
  const targetFilter: mongoose.QueryFilter<IDashboardAccessGrant> = {
    dashboardId: dashboard._id
  };
  if (input.type === 'USER') {
    targetFilter.userId = toObjectId(input.userId as string);
  } else if (input.type === 'ROLE') {
    targetFilter.roleId = toObjectId(input.roleId as string);
  } else {
    targetFilter.organizationId = toObjectId(input.organizationId as string);
  }

  const existingGrant = await DashboardAccessModel.findOne(targetFilter).lean();

  if (existingGrant) {
    // Update existing grant instead of throwing duplicate error
    const updated = await DashboardAccessModel.findByIdAndUpdate(
      existingGrant._id,
      { $set: { accessLevel: input.accessLevel } },
      { new: true }
    )
      .populate<{
        userId: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null } | null;
      }>('userId', 'name email avatarUrl')
      .exec();

    await logAuditEvent({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'DASHBOARD_ACCESS_UPDATED',
      resourceType: 'DashboardAccess',
      resourceId: existingGrant._id.toString(),
      metadata: {
        dashboardId,
        targetType: input.type,
        targetId: input.userId || input.roleId || input.organizationId,
        accessLevel: input.accessLevel
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent
    });

    return { grant: serializeDoc<Record<string, unknown>>(updated), created: false };
  }

  // 3. Create access grant
  const newGrant = await DashboardAccessModel.create({
    dashboardId: dashboard._id,
    userId: input.type === 'USER' ? toObjectId(input.userId as string) : null,
    roleId: input.type === 'ROLE' ? toObjectId(input.roleId as string) : null,
    organizationId:
      input.type === 'ORGANIZATION' ? toObjectId(input.organizationId as string) : null,
    accessLevel: input.accessLevel
  });

  const hydratedGrant = await DashboardAccessModel.findById(newGrant._id)
    .populate<{
      userId: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null } | null;
    }>('userId', 'name email avatarUrl')
    .exec();

  await logAuditEvent({
    organizationId: user.organizationId,
    userId: user.userId,
    action: 'DASHBOARD_ACCESS_GRANTED',
    resourceType: 'DashboardAccess',
    resourceId: newGrant._id.toString(),
    metadata: {
      dashboardId,
      targetType: input.type,
      targetId: input.userId || input.roleId || input.organizationId,
      accessLevel: input.accessLevel
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  return { grant: serializeDoc<Record<string, unknown>>(hydratedGrant), created: true };
}

/**
 * Update an existing access grant (e.g. VIEW <-> EDIT).
 */
export async function updateDashboardAccess(
  user: AuthenticatedUser,
  dashboardId: string,
  accessId: string,
  input: z.infer<typeof updateDashboardAccessSchema>,
  audit: AuditTrail = {}
): Promise<Record<string, unknown>> {
  if (!dashboardId || !accessId) {
    throw AppError.badRequest('Dashboard ID and Access ID are required');
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== 'OWNER' && effectiveAccess !== 'EDIT') {
    throw AppError.forbidden(
      'Access denied: you must have EDIT or OWNER permissions to update sharing'
    );
  }

  const grant = await DashboardAccessModel.findOne({
    _id: toObjectId(accessId),
    dashboardId: dashboard._id
  }).lean();

  if (!grant) {
    throw AppError.notFound('Access grant');
  }

  // Owner protection
  if (grant.userId && grant.userId.toString() === dashboard.ownerId.toString()) {
    throw AppError.badRequest('Cannot modify access grant for the dashboard owner');
  }

  const updated = await DashboardAccessModel.findByIdAndUpdate(
    grant._id,
    { $set: { accessLevel: input.accessLevel } },
    { new: true }
  )
    .populate<{
      userId: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null } | null;
    }>('userId', 'name email avatarUrl')
    .exec();

  await logAuditEvent({
    organizationId: user.organizationId,
    userId: user.userId,
    action: 'DASHBOARD_ACCESS_UPDATED',
    resourceType: 'DashboardAccess',
    resourceId: grant._id.toString(),
    metadata: {
      dashboardId,
      accessId,
      accessLevel: input.accessLevel
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  return serializeDoc<Record<string, unknown>>(updated);
}

/**
 * Revoke an existing dashboard access grant.
 */
export async function revokeDashboardAccess(
  user: AuthenticatedUser,
  dashboardId: string,
  accessId: string,
  audit: AuditTrail = {}
): Promise<{ message: string }> {
  if (!dashboardId || !accessId) {
    throw AppError.badRequest('Dashboard ID and Access ID are required');
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== 'OWNER' && effectiveAccess !== 'EDIT') {
    throw AppError.forbidden(
      'Access denied: you must have EDIT or OWNER permissions to revoke sharing'
    );
  }

  const grant = await DashboardAccessModel.findOne({
    _id: toObjectId(accessId),
    dashboardId: dashboard._id
  }).lean();

  if (!grant) {
    throw AppError.notFound('Access grant');
  }

  // Owner protection
  if (grant.userId && grant.userId.toString() === dashboard.ownerId.toString()) {
    throw AppError.badRequest('Cannot revoke access for the dashboard owner');
  }

  await DashboardAccessModel.deleteOne({ _id: grant._id }).exec();

  await logAuditEvent({
    organizationId: user.organizationId,
    userId: user.userId,
    action: 'DASHBOARD_ACCESS_REVOKED',
    resourceType: 'DashboardAccess',
    resourceId: accessId,
    metadata: {
      dashboardId,
      revokedGrant: {
        userId: grant.userId,
        roleId: grant.roleId,
        organizationId: grant.organizationId,
        accessLevel: grant.accessLevel
      }
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  return { message: 'Access grant revoked successfully' };
}

export interface AvailableRecipientsResult {
  users: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    roleName: string;
  }>;
  roles: Array<{ id: string; name: string; description: string | null }>;
  organization: { id: string; name: string; slug: string } | null;
}

/**
 * Search and list eligible organization members, roles, and organization details for sharing.
 * Strictly scoped to the authenticated organization with no credential exposure.
 */
export async function getAvailableRecipients(
  user: AuthenticatedUser,
  dashboardId: string,
  query: z.infer<typeof searchRecipientsQuerySchema> = {}
): Promise<AvailableRecipientsResult> {
  if (!dashboardId) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const { dashboard, effectiveAccess } = await evaluateEffectiveAccess(dashboardId, user);

  if (effectiveAccess !== 'OWNER' && effectiveAccess !== 'EDIT') {
    throw AppError.forbidden(
      'Access denied: you do not have permission to manage dashboard access'
    );
  }

  // 1. Fetch organization members matching optional search.
  //    Prisma filtered on the related `user` relation; Mongo cannot join that
  //    way, so the name/email search runs as a separate `users` query first.
  let allowedUserIds: mongoose.Types.ObjectId[] | null = null;
  if (query.search) {
    const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchedUsers = await UserModel.find({ $or: [{ name: rx }, { email: rx }] })
      .select('_id')
      .lean();
    allowedUserIds = matchedUsers.map((user) => user._id);
    if (allowedUserIds.length === 0) {
      allowedUserIds = [new mongoose.Types.ObjectId()];
    }
  }

  const memberFilter: mongoose.QueryFilter<IOrganizationMemberDocument> = {
    organizationId: toObjectId(user.organizationId),
    status: MEMBERSHIP_STATUS.ACTIVE
  };
  if (allowedUserIds) {
    memberFilter.userId = { $in: allowedUserIds };
  }

  const members = await OrganizationMemberModel.find(memberFilter)
    .populate<{
      userId: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null };
    }>('userId', 'name email avatarUrl')
    .populate<{ roleId: { _id: mongoose.Types.ObjectId; name: string } }>('roleId', 'name')
    .limit(50)
    .lean();

  const normalizedMembers = members as unknown as Array<{
    userId: { _id: mongoose.Types.ObjectId; name: string; email: string; avatarUrl: string | null } | null;
    roleId: { _id: mongoose.Types.ObjectId; name: string } | null;
  }>;

  // Filter out the dashboard owner from shareable users
  const shareableUsers = normalizedMembers
    .filter((member) => member.userId && member.userId._id.toString() !== dashboard.ownerId.toString())
    .map((member) => ({
      id: member.userId!._id.toString(),
      name: member.userId!.name,
      email: member.userId!.email,
      avatarUrl: member.userId!.avatarUrl ?? null,
      roleName: member.roleId?.name ?? 'MEMBER'
    }));

  // 2. Fetch available system roles
  const roles = await RoleModel.find({})
    .select('name description')
    .sort({ name: 1 })
    .lean();

  // 3. Fetch current organization
  const organization = await OrganizationModel.findById(toObjectId(user.organizationId))
    .select('name slug')
    .lean();

  return {
    users: shareableUsers,
    roles: roles.map((role) => ({
      id: role._id.toString(),
      name: role.name,
      description: role.description
    })),
    organization: organization
      ? {
          id: organization._id.toString(),
          name: organization.name,
          slug: organization.slug
        }
      : null
  };
}
