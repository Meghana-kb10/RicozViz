// ========================================
// Workspace Service
// ========================================
// Workspace CRUD, membership, role-based access control, organization tenancy
// isolation and safe user data exposure.
//
// Ported from the legacy Express/Prisma implementation
// (`services/workspace.service.ts` + `services/workspace/workspace-auth.helper.ts`)
// onto Fastify + Mongoose. The HTTP layer lives in `workspace.controller.ts`.
// ========================================

import mongoose from 'mongoose';
import { z } from 'zod';
import {
  WorkspaceModel,
  WorkspaceMemberModel,
  OrganizationMemberModel,
  UserModel,
  toObjectId,
  serializeDocs,
  type IWorkspaceDocument
} from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import { WORKSPACE_ROLE } from '@repo/types';
import type { AuthenticatedUser, WorkspaceData, WorkspaceRole } from '@repo/types';

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

/**
 * Resource identifiers are Mongo `ObjectId`s instead of the legacy UUIDs.
 * The original error messages are preserved verbatim so the web client keeps
 * showing the same copy.
 */
function objectIdString(message: string) {
  return z
    .string()
    .min(1, message)
    .refine((value) => mongoose.Types.ObjectId.isValid(value), { message });
}

export const createWorkspaceSchema = z.object({
  name: z
    .string({ required_error: 'Workspace name is required' })
    .trim()
    .min(1, 'Workspace name cannot be empty')
    .max(100, 'Workspace name cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Workspace name cannot be empty')
    .max(100, 'Workspace name cannot exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .nullable()
});

export const addWorkspaceMemberSchema = z.object({
  userId: objectIdString('Invalid user ID format'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'EDITOR', 'VIEWER']).default('MEMBER')
});

export const updateWorkspaceMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'EDITOR', 'VIEWER'])
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UpdateWorkspaceMemberRoleInput = z.infer<typeof updateWorkspaceMemberRoleSchema>;

// ============================================================
// RESPONSE SHAPES
// ============================================================

/** Sanitized user projection embedded in workspace member payloads. */
export interface WorkspaceMemberUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  status: string;
}

/** `GET /workspaces/:id/members` element. */
export interface WorkspaceMemberEntry {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  createdAt: string;
  user: WorkspaceMemberUser;
}

/** `POST /workspaces/:id/members` element (201). */
export type WorkspaceMemberCreated = WorkspaceMemberEntry;

/** `PATCH /workspaces/:id/members/:userId` payload. */
export interface WorkspaceMemberRoleUpdate {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  user: WorkspaceMemberUser;
}

/** `DELETE /workspaces/:id` payload. */
export interface DeleteWorkspaceResult {
  message: string;
  id: string;
}

/** `DELETE /workspaces/:id/members/:userId` payload. */
export interface RemoveWorkspaceMemberResult {
  message: string;
  workspaceId: string;
  userId: string;
}

/** `serializeDoc` output for a `WorkspaceMember` document. */
interface SerializedWorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: string;
}

/** `serializeDoc` output for a selected `User` document. */
interface SerializedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  status: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function toWorkspaceRole(value: string): WorkspaceRole {
  return value as WorkspaceRole;
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return base || 'workspace';
}

async function ensureUniqueSlug(
  organizationId: mongoose.Types.ObjectId,
  baseSlug: string,
  excludeWorkspaceId?: mongoose.Types.ObjectId
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  for (let attempt = 0; attempt < 50; attempt++) {
    const filter: mongoose.QueryFilter<IWorkspaceDocument> = { organizationId, slug };
    if (excludeWorkspaceId) {
      filter._id = { $ne: excludeWorkspaceId };
    }

    const existing = await WorkspaceModel.findOne(filter).select('_id').lean();

    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}

/** Narrow the JWT principal into the two ObjectIds every query needs. */
function principalIds(principal: AuthenticatedUser): {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
} {
  const userId = toObjectId(principal.userId);
  const organizationId = toObjectId(principal.organizationId);
  if (!userId || !organizationId) {
    throw AppError.unauthorized('Invalid session context');
  }
  return { userId, organizationId };
}

function requireObjectId(value: string, resource: string): mongoose.Types.ObjectId {
  const objectId = toObjectId(value);
  if (!objectId) {
    throw AppError.notFound(resource);
  }
  return objectId;
}

/** Load a batch of sanitized users keyed by id (Mongo has no `include: { user }`). */
async function loadUsersById(userIds: mongoose.Types.ObjectId[]): Promise<Map<string, WorkspaceMemberUser>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const uniqueIds = Array.from(new Map(userIds.map((id) => [id.toString(), id])).values());

  const users = await UserModel.find({ _id: { $in: uniqueIds } })
    .select('name email avatarUrl status')
    .exec();

  const safeUsers = serializeDocs<SerializedUser>(users);

  return new Map(
    safeUsers.map((user) => [
      user.id,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? null,
        status: user.status ?? ''
      }
    ])
  );
}

export interface UserWorkspaceContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
  };
  userRole: WorkspaceRole;
  isOrgAdmin: boolean;
}

/**
 * Load a workspace inside the caller's organization and resolve the caller's
 * effective workspace role.
 *
 * Organization admins bypass the membership requirement and are treated as
 * workspace `ADMIN` when they have no explicit membership row.
 */
export async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<UserWorkspaceContext> {
  const workspaceObjectId = requireObjectId(workspaceId, 'Workspace not found');
  const organizationObjectId = requireObjectId(organizationId, 'Workspace not found');
  const userObjectId = toObjectId(userId);

  const workspace = await WorkspaceModel.findOne({
    _id: workspaceObjectId,
    organizationId: organizationObjectId
  })
    .lean()
    .exec();

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  const isOrgAdmin = userRoleName === 'ADMIN';

  const membership = userObjectId
    ? await WorkspaceMemberModel.findOne({ workspaceId: workspaceObjectId, userId: userObjectId })
        .select('role')
        .lean()
        .exec()
    : null;

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden('Access denied: You do not have access to this workspace');
  }

  const userRole: WorkspaceRole = membership ? toWorkspaceRole(membership.role) : WORKSPACE_ROLE.ADMIN;

  return {
    workspace: {
      id: workspace._id.toString(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description ?? null,
      organizationId: workspace.organizationId.toString(),
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString()
    },
    userRole,
    isOrgAdmin
  };
}

// ============================================================
// WORKSPACE CRUD
// ============================================================

/**
 * POST /api/v1/workspaces
 * Create a workspace in the caller's organization; the creator becomes OWNER.
 */
export async function createWorkspace(
  principal: AuthenticatedUser,
  input: CreateWorkspaceInput
): Promise<WorkspaceData> {
  const { userId, organizationId } = principalIds(principal);

  const baseSlug = generateSlug(input.name);
  const slug = await ensureUniqueSlug(organizationId, baseSlug);

  // Prisma wrapped both writes in `$transaction`; MongoDB has no cross-document
  // transaction here, so the workspace is rolled back manually on failure.
  const workspace = await WorkspaceModel.create({
    name: input.name,
    slug,
    description: input.description ?? null,
    organizationId
  });

  let member;
  try {
    member = await WorkspaceMemberModel.create({
      workspaceId: workspace._id,
      userId,
      role: WORKSPACE_ROLE.OWNER
    });
  } catch (error) {
    await WorkspaceModel.deleteOne({ _id: workspace._id })
      .exec()
      .catch((rollbackError: unknown) => {
        logger.warn('Failed to roll back workspace creation', {
          workspaceId: workspace._id.toString(),
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        });
      });
    throw error;
  }

  void logAuditEvent({
    userId: userId.toString(),
    organizationId: organizationId.toString(),
    action: 'WORKSPACE_CREATE',
    resourceType: 'WORKSPACE',
    resourceId: workspace._id.toString(),
    metadata: { name: workspace.name, slug: workspace.slug }
  });

  return {
    id: workspace._id.toString(),
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description ?? null,
    organizationId: workspace.organizationId.toString(),
    role: toWorkspaceRole(member.role),
    memberCount: 1,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString()
  };
}

/**
 * GET /api/v1/workspaces
 * Organization admins see every workspace; everyone else sees their memberships.
 */
export async function listWorkspaces(principal: AuthenticatedUser): Promise<WorkspaceData[]> {
  const { userId, organizationId } = principalIds(principal);
  const isOrgAdmin = principal.roleName === 'ADMIN';

  let workspaceDocs;

  if (isOrgAdmin) {
    workspaceDocs = await WorkspaceModel.find({ organizationId }).sort({ createdAt: -1 }).lean().exec();
  } else {
    const memberships = await WorkspaceMemberModel.find({ userId }).select('workspaceId').lean().exec();
    workspaceDocs = await WorkspaceModel.find({
      organizationId,
      _id: { $in: memberships.map((membership) => membership.workspaceId) }
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  if (workspaceDocs.length === 0) {
    return [];
  }

  const workspaceIds = workspaceDocs.map((workspace) => workspace._id);

  // `_count: { select: { members: true } }` -> a single grouped aggregate.
  const memberCounts = await WorkspaceMemberModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>(
    [{ $match: { workspaceId: { $in: workspaceIds } } }, { $group: { _id: '$workspaceId', count: { $sum: 1 } } }]
  );
  const countByWorkspace = new Map(memberCounts.map((entry) => [entry._id.toString(), entry.count]));

  const ownMemberships = await WorkspaceMemberModel.find({ workspaceId: { $in: workspaceIds }, userId })
    .select('workspaceId role')
    .lean()
    .exec();
  const roleByWorkspace = new Map(
    ownMemberships.map((membership) => [membership.workspaceId.toString(), toWorkspaceRole(membership.role)])
  );

  return workspaceDocs.map((workspace) => {
    const workspaceId = workspace._id.toString();
    const userMembershipRole = roleByWorkspace.get(workspaceId);
    const role: WorkspaceRole =
      userMembershipRole ?? (isOrgAdmin ? WORKSPACE_ROLE.ADMIN : WORKSPACE_ROLE.MEMBER);

    return {
      id: workspaceId,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description ?? null,
      organizationId: workspace.organizationId.toString(),
      role,
      memberCount: countByWorkspace.get(workspaceId) ?? 0,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString()
    };
  });
}

/**
 * GET /api/v1/workspaces/:id
 * Retrieve details for a specific workspace.
 */
export async function getWorkspace(
  principal: AuthenticatedUser,
  workspaceId: string
): Promise<WorkspaceData> {
  const workspaceObjectId = requireObjectId(workspaceId, 'Workspace not found');

  const { workspace, userRole } = await resolveWorkspaceAccess(
    workspaceId,
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  const memberCount = await WorkspaceMemberModel.countDocuments({
    workspaceId: workspaceObjectId
  }).exec();

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    organizationId: workspace.organizationId,
    role: userRole,
    memberCount,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };
}

/**
 * PATCH /api/v1/workspaces/:id
 * Update name/description. Only OWNER, workspace ADMIN or an organization admin.
 */
export async function updateWorkspace(
  principal: AuthenticatedUser,
  workspaceId: string,
  input: UpdateWorkspaceInput
): Promise<WorkspaceData> {
  const { organizationId } = principalIds(principal);

  const { workspace, userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN && !isOrgAdmin) {
    throw AppError.forbidden('Only workspace owners or admins can update workspace details');
  }

  let slug = workspace.slug;
  if (input.name && input.name !== workspace.name) {
    const baseSlug = generateSlug(input.name);
    slug = await ensureUniqueSlug(organizationId, baseSlug, toObjectId(workspace.id) ?? undefined);
  }

  const update: Record<string, unknown> = {};
  if (input.name) {
    update['name'] = input.name;
    update['slug'] = slug;
  }
  if (input.description !== undefined) {
    update['description'] = input.description;
  }

  const updated = await WorkspaceModel.findByIdAndUpdate(toObjectId(workspace.id), { $set: update }, { new: true })
    .lean()
    .exec();

  if (!updated) {
    throw AppError.notFound('Workspace not found');
  }

  const memberCount = await WorkspaceMemberModel.countDocuments({ workspaceId: updated._id }).exec();

  void logAuditEvent({
    userId: principal.userId,
    organizationId: principal.organizationId,
    action: 'WORKSPACE_UPDATE',
    resourceType: 'WORKSPACE',
    resourceId: workspaceId,
    metadata: { changes: input }
  });

  return {
    id: updated._id.toString(),
    name: updated.name,
    slug: updated.slug,
    description: updated.description ?? null,
    organizationId: updated.organizationId.toString(),
    role: userRole,
    memberCount,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString()
  };
}

/**
 * DELETE /api/v1/workspaces/:id
 * Only OWNER (or organization admin). Safe deletion: the workspace and its
 * membership joins are removed without touching users or the organization.
 */
export async function deleteWorkspace(
  principal: AuthenticatedUser,
  workspaceId: string
): Promise<DeleteWorkspaceResult> {
  const workspaceObjectId = requireObjectId(workspaceId, 'Workspace not found');

  const { workspace, userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  if (userRole !== WORKSPACE_ROLE.OWNER && !isOrgAdmin) {
    throw AppError.forbidden('Only workspace owners can delete this workspace');
  }

  await WorkspaceModel.deleteOne({ _id: workspaceObjectId }).exec();

  // Prisma's `onDelete: Cascade` on Workspace.members has no Mongoose equivalent.
  await WorkspaceMemberModel.deleteMany({ workspaceId: workspaceObjectId })
    .exec()
    .catch((error: unknown) => {
      logger.warn('Failed to remove workspace member joins', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  void logAuditEvent({
    userId: principal.userId,
    organizationId: principal.organizationId,
    action: 'WORKSPACE_DELETE',
    resourceType: 'WORKSPACE',
    resourceId: workspaceId,
    metadata: { name: workspace.name }
  });

  return { message: 'Workspace deleted successfully', id: workspaceId };
}

// ============================================================
// WORKSPACE MEMBERSHIP
// ============================================================

/**
 * GET /api/v1/workspaces/:id/members
 * List members with sanitized user information.
 */
export async function listWorkspaceMembers(
  principal: AuthenticatedUser,
  workspaceId: string
): Promise<WorkspaceMemberEntry[]> {
  const workspaceObjectId = requireObjectId(workspaceId, 'Workspace not found');

  await resolveWorkspaceAccess(workspaceId, principal.userId, principal.organizationId, principal.roleName);

  const members = await WorkspaceMemberModel.find({ workspaceId: workspaceObjectId })
    .sort({ createdAt: 1 })
    .exec();

  const serializedMembers = serializeDocs<SerializedWorkspaceMember>(members);
  const usersById = await loadUsersById(members.map((member) => member.userId));

  return serializedMembers.map((member) => ({
    id: member.id,
    workspaceId: member.workspaceId,
    role: toWorkspaceRole(member.role),
    createdAt: member.createdAt,
    // Mongo has no FK cascade for `WorkspaceMember.userId`, so a deleted user
    // leaves a hole in the projection; keep the row instead of failing the list.
    user: usersById.get(member.userId) ?? {
      id: member.userId,
      name: '',
      email: '',
      avatarUrl: null,
      status: ''
    }
  }));
}

/**
 * POST /api/v1/workspaces/:id/members
 * Add an organization user to the workspace. Only OWNER or ADMIN (or org admin).
 */
export async function addWorkspaceMember(
  principal: AuthenticatedUser,
  workspaceId: string,
  input: AddWorkspaceMemberInput
): Promise<WorkspaceMemberCreated> {
  const workspaceObjectId = requireObjectId(workspaceId, 'Workspace not found');
  const { organizationId } = principalIds(principal);
  const targetUserId = requireObjectId(input.userId, 'User');

  const { userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN && !isOrgAdmin) {
    throw AppError.forbidden('Only workspace owners or admins can add members');
  }

  // 1. Verify target user belongs to the same organization
  const orgMembership = await OrganizationMemberModel.findOne({
    userId: targetUserId,
    organizationId
  })
    .lean()
    .exec();

  if (!orgMembership) {
    throw AppError.badRequest('Target user does not belong to this organization');
  }

  // 2. Check for duplicate workspace membership
  const existingMember = await WorkspaceMemberModel.findOne({
    workspaceId: workspaceObjectId,
    userId: targetUserId
  })
    .lean()
    .exec();

  if (existingMember) {
    throw AppError.conflict('User is already a member of this workspace');
  }

  // 3. Create membership (Prisma `include: { user }` becomes a second lookup)
  const targetUser = await UserModel.findById(targetUserId)
    .select('name email avatarUrl status')
    .lean()
    .exec();

  if (!targetUser) {
    throw AppError.notFound('User');
  }

  const member = await WorkspaceMemberModel.create({
    workspaceId: workspaceObjectId,
    userId: targetUserId,
    role: input.role
  });

  void logAuditEvent({
    userId: principal.userId,
    organizationId: principal.organizationId,
    action: 'WORKSPACE_MEMBER_ADD',
    resourceType: 'WORKSPACE',
    resourceId: workspaceId,
    metadata: { addedUserId: input.userId, role: input.role }
  });

  return {
    id: member._id.toString(),
    workspaceId: member.workspaceId.toString(),
    role: toWorkspaceRole(member.role),
    createdAt: member.createdAt.toISOString(),
    user: {
      id: targetUserId.toString(),
      name: targetUser.name,
      email: targetUser.email,
      avatarUrl: targetUser.avatarUrl ?? null,
      status: targetUser.status ?? ''
    }
  };
}

/**
 * DELETE /api/v1/workspaces/:id/members/:userId
 * OWNER or ADMIN, self-removal, or organization admin. The final OWNER is
 * protected.
 */
export async function removeWorkspaceMember(
  principal: AuthenticatedUser,
  workspaceId: string,
  targetUserId: string
): Promise<RemoveWorkspaceMemberResult> {
  const workspaceObjectId = requireObjectId(workspaceId, 'Workspace not found');
  const targetUserObjectId = requireObjectId(targetUserId, 'Member not found in this workspace');

  const { userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  const isSelf = principal.userId === targetUserId;

  if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN && !isOrgAdmin && !isSelf) {
    throw AppError.forbidden('Only workspace owners or admins can remove members');
  }

  // 1. Verify target membership exists
  const targetMember = await WorkspaceMemberModel.findOne({
    workspaceId: workspaceObjectId,
    userId: targetUserObjectId
  })
    .select('role')
    .lean()
    .exec();

  if (!targetMember) {
    throw AppError.notFound('Member not found in this workspace');
  }

  // 2. Safeguard: if the target is the last OWNER, refuse
  if (targetMember.role === WORKSPACE_ROLE.OWNER) {
    const ownerCount = await WorkspaceMemberModel.countDocuments({
      workspaceId: workspaceObjectId,
      role: WORKSPACE_ROLE.OWNER
    })
      .exec();

    if (ownerCount <= 1) {
      throw AppError.badRequest('Cannot remove the final owner from a workspace');
    }
  }

  // 3. Delete membership
  await WorkspaceMemberModel.deleteOne({
    workspaceId: workspaceObjectId,
    userId: targetUserObjectId
  }).exec();

  void logAuditEvent({
    userId: principal.userId,
    organizationId: principal.organizationId,
    action: 'WORKSPACE_MEMBER_REMOVE',
    resourceType: 'WORKSPACE',
    resourceId: workspaceId,
    metadata: { removedUserId: targetUserId }
  });

  return {
    message: 'Member removed from workspace successfully',
    workspaceId,
    userId: targetUserId
  };
}

/**
 * PATCH /api/v1/workspaces/:id/members/:userId
 * Update a member's role (OWNER or ADMIN only). The final OWNER cannot be demoted.
 */
export async function updateWorkspaceMemberRole(
  principal: AuthenticatedUser,
  workspaceId: string,
  targetUserId: string,
  input: UpdateWorkspaceMemberRoleInput
): Promise<WorkspaceMemberRoleUpdate> {
  const workspaceObjectId = requireObjectId(workspaceId, 'Workspace not found');
  const targetUserObjectId = requireObjectId(targetUserId, 'Member not found in this workspace');

  const { userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN && !isOrgAdmin) {
    throw AppError.forbidden('Only workspace owners or admins can update member roles');
  }

  const existingMember = await WorkspaceMemberModel.findOne({
    workspaceId: workspaceObjectId,
    userId: targetUserObjectId
  })
    .select('role')
    .lean()
    .exec();

  if (!existingMember) {
    throw AppError.notFound('Member not found in this workspace');
  }

  // Safeguard: cannot demote the final OWNER
  if (existingMember.role === WORKSPACE_ROLE.OWNER && input.role !== WORKSPACE_ROLE.OWNER) {
    const ownerCount = await WorkspaceMemberModel.countDocuments({
      workspaceId: workspaceObjectId,
      role: WORKSPACE_ROLE.OWNER
    })
      .exec();

    if (ownerCount <= 1) {
      throw AppError.badRequest('Cannot demote the final owner of a workspace');
    }
  }

  const updatedMember = await WorkspaceMemberModel.findOneAndUpdate(
    { workspaceId: workspaceObjectId, userId: targetUserObjectId },
    { $set: { role: input.role } },
    { new: true }
  )
    .exec();

  if (!updatedMember) {
    throw AppError.notFound('Member not found in this workspace');
  }

  const targetUser = await UserModel.findById(targetUserObjectId)
    .select('name email avatarUrl status')
    .lean()
    .exec();

  if (!targetUser) {
    throw AppError.notFound('User');
  }

  void logAuditEvent({
    userId: principal.userId,
    organizationId: principal.organizationId,
    action: 'WORKSPACE_MEMBER_ROLE_UPDATE',
    resourceType: 'WORKSPACE',
    resourceId: workspaceId,
    metadata: {
      targetUserId,
      previousRole: existingMember.role,
      newRole: input.role
    }
  });

  return {
    id: updatedMember._id.toString(),
    workspaceId: updatedMember.workspaceId.toString(),
    role: toWorkspaceRole(updatedMember.role),
    user: {
      id: targetUserObjectId.toString(),
      name: targetUser.name,
      email: targetUser.email,
      avatarUrl: targetUser.avatarUrl ?? null,
      status: targetUser.status ?? ''
    }
  };
}

// ============================================================
// RESOURCE-LEVEL WORKSPACE AUTHORIZATION
// ============================================================
// Ported from `services/workspace/workspace-auth.helper.ts`. Shared by every
// workspace-scoped module (dashboards, datasets, charts, ...).

/**
 * Dashboards predate the first-class workspace relation and keep their
 * workspace binding in `layoutConfig`. Keep the extraction in one place so all
 * dashboard-adjacent features apply the same tenant boundary.
 */
export function getDashboardWorkspaceId(layoutConfig: unknown): string | undefined {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return undefined;
  }

  const workspaceId = (layoutConfig as Record<string, unknown>)['workspaceId'];
  return typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId : undefined;
}

/**
 * Resolves the target workspaceId for resource creation or query filtering.
 * - If `targetWorkspaceId` is supplied by the client, membership is verified.
 * - Otherwise it falls back to the user's first accessible workspace.
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

    const memberships = await WorkspaceMemberModel.find({ userId: userObjectId })
      .select('workspaceId')
      .lean()
      .exec();

    if (memberships.length === 0) {
      return null;
    }

    const workspace = await WorkspaceModel.findOne({
      organizationId: organizationObjectId,
      _id: { $in: memberships.map((membership) => membership.workspaceId) }
    })
      .select('_id')
      .lean()
      .exec();

    return workspace ? workspace._id.toString() : null;
  } catch {
    return null;
  }
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
 * Verifies that the authenticated user has access to the workspace of the given
 * resource. If the resource belongs to a workspace, checks the user's membership
 * (or organization admin status).
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
