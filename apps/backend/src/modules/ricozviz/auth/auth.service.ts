import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  UserModel,
  OrganizationModel,
  OrganizationMemberModel,
  RoleModel,
  RolePermissionModel,
  PermissionModel,
  WorkspaceModel,
  WorkspaceMemberModel,
  ensureSystemRolesAndPermissions,
  toObjectId,
  serializeDoc,
  type IOrganizationMemberDocument
} from '@repo/database';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshCookieOptions
} from '../../../lib/jwt.js';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import { USER_STATUS, WORKSPACE_ROLE, MEMBERSHIP_STATUS, ORGANIZATION_STATUS } from '@repo/types';
import type {
  OrganizationProfile,
  RicozVizAuthResponse,
  RicozVizLoginInput,
  RicozVizMeResponse,
  RicozVizRefreshResponse,
  RicozVizRegisterInput,
  UserProfile,
  WorkspaceData
} from '@repo/types';

// ---- Validation schemas ------------------------------------------------------

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  organizationName: z.string().min(1, 'Organization name is required').max(100)
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export type RegisterInput = RicozVizRegisterInput;
export type LoginInput = RicozVizLoginInput;

/** Issued token pair plus the derived refresh cookie. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  permissions: string[];
}

const BCRYPT_ROUNDS = 12;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Compare against a decoy hash when the user is missing, to avoid timing leaks. */
const DUMMY_HASH = '$2a$12$dummy.hash.to.prevent.timing.attacks.123456789';

// ---- Helpers -----------------------------------------------------------------

/** Strip every sensitive field from a user document. */
export function buildSafeUser(user: {
  id?: unknown;
  email: string;
  name: string;
  avatarUrl?: string | null;
  status?: string;
  createdAt: Date;
  organizationId?: string;
}): UserProfile {
  return {
    id: String(user.id ?? ''),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status ?? USER_STATUS.ACTIVE,
    createdAt: user.createdAt.toISOString()
  };
}

/** Resolve the permission keys granted to a role. */
export async function getPermissionsForRoleId(
  roleId: mongoose.Types.ObjectId
): Promise<string[]> {
  const joins = await RolePermissionModel.find({ roleId }).lean();
  if (joins.length === 0) {
    return [];
  }
  const permissions = await PermissionModel.find({
    _id: { $in: joins.map((join) => join.permissionId) }
  })
    .select('key')
    .lean();
  return permissions.map((permission) => permission.key);
}

/** Populated shape returned by `getMembership`. */
export interface MembershipResult {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  role: { id: string; name: string };
  permissions: string[];
}

/** Load the caller's active organization membership with role + permissions. */
export async function getMembership(
  userId: string,
  organizationId?: string
): Promise<MembershipResult | null> {
  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    return null;
  }

  const filter: mongoose.QueryFilter<IOrganizationMemberDocument> = {
    userId: userObjectId,
    status: MEMBERSHIP_STATUS.ACTIVE
  };
  if (organizationId) {
    filter.organizationId = toObjectId(organizationId);
  }

  const membership = await OrganizationMemberModel.findOne(filter)
    .populate<{
      organizationId: {
        _id: mongoose.Types.ObjectId;
        name: string;
        slug: string;
        status: string;
      };
    }>(
      'organizationId',
      'name slug status'
    )
    .populate<{ roleId: { _id: mongoose.Types.ObjectId; name: string } }>('roleId')
    .exec();

  if (!membership) {
    return null;
  }

  const organization = membership.organizationId as unknown as {
    _id: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    status: string;
  };
  const role = membership.roleId as unknown as {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
  const permissions = await getPermissionsForRoleId(role._id);

  return {
    organizationId: organization._id,
    userId: membership.userId,
    roleId: role._id,
    organization: {
      id: organization._id.toString(),
      name: organization.name,
      slug: organization.slug,
      status: organization.status
    },
    role: {
      id: role._id.toString(),
      name: role.name
    },
    permissions
  };
}

/** Sign an access/refresh pair for a member. */
export async function issueTokens(input: {
  userId: string;
  email: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  tokenVersion: number;
}): Promise<IssuedTokens> {
  const accessToken = signAccessToken({
    sub: input.userId,
    email: input.email,
    organizationId: input.organizationId,
    roleId: input.roleId,
    roleName: input.roleName,
    permissions: input.permissions
  });

  return {
    accessToken,
    refreshToken: signRefreshToken(input.userId, input.tokenVersion),
    permissions: input.permissions
  };
}

export function refreshCookieOptions() {
  return getRefreshCookieOptions(SEVEN_DAYS_MS);
}

function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || 'org';
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  for (let attempts = 0; attempts < 100; attempts++) {
    const existing = await OrganizationModel.findOne({ slug }).lean();
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return `${baseSlug}-${Date.now()}`;
}

export interface RegisterResult extends RicozVizAuthResponse {
  workspace: Pick<WorkspaceData, 'id' | 'name' | 'slug'>;
}

/**
 * Services return the JSON body plus the refresh token separately: the token
 * is written straight into an HttpOnly cookie by the controller and must never
 * appear in the response payload.
 */
export interface SessionResult<T> {
  payload: T;
  refreshToken: string;
}

// ============================================================
// REGISTER — POST /api/v1/auth/register
// ============================================================

export async function register(input: RegisterInput): Promise<SessionResult<RegisterResult>> {
  const email = input.email.toLowerCase();

  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    throw AppError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // ---- Resolve the ADMIN role, self-healing the catalogue if needed ----
  let adminRole = await RoleModel.findOne({ name: 'ADMIN' }).lean();
  if (!adminRole) {
    logger.warn('ADMIN role or permissions missing — auto-initializing system roles');
    await ensureSystemRolesAndPermissions();
    adminRole = await RoleModel.findOne({ name: 'ADMIN' }).lean();
  }
  if (!adminRole) {
    logger.error('ADMIN role could not be loaded or initialized');
    throw AppError.internal('System configuration error: roles not initialized');
  }

  const slug = await ensureUniqueSlug(generateSlug(input.organizationName));

  // ---- Create user + organization + membership + default workspace ----
  // MongoDB is schemaless so there is no cross-collection transaction here;
  // each step is idempotent enough to be retried by the caller.
  const user = await UserModel.create({
    email,
    passwordHash,
    name: input.name,
    status: USER_STATUS.ACTIVE,
    tokenVersion: 0
  });

  let organization;
  try {
    organization = await OrganizationModel.create({
      name: input.organizationName,
      slug,
      status: ORGANIZATION_STATUS.ACTIVE
    });
  } catch (error) {
    await UserModel.deleteOne({ _id: user._id }).exec();
    throw error;
  }

  let workspace;
  try {
    await OrganizationMemberModel.create({
      userId: user._id,
      organizationId: organization._id,
      roleId: adminRole._id,
      status: MEMBERSHIP_STATUS.ACTIVE
    });

    workspace = await WorkspaceModel.create({
      name: `${input.organizationName} Workspace`,
      slug: 'default',
      description: `Default workspace for ${input.organizationName}`,
      organizationId: organization._id
    });

    await WorkspaceMemberModel.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: WORKSPACE_ROLE.OWNER
    });
  } catch (error) {
    await WorkspaceModel.deleteMany({ organizationId: organization._id }).exec();
    await OrganizationMemberModel.deleteMany({ organizationId: organization._id }).exec();
    await OrganizationModel.deleteOne({ _id: organization._id }).exec();
    await UserModel.deleteOne({ _id: user._id }).exec();
    throw error;
  }

  logger.info('User registered successfully', {
    userId: user._id.toString(),
    organizationId: organization._id.toString(),
    workspaceId: workspace._id.toString()
  });

  await logAuditEvent({
    organizationId: organization._id.toString(),
    workspaceId: workspace._id.toString(),
    userId: user._id.toString(),
    action: 'USER_REGISTER',
    resourceType: 'User',
    resourceId: user._id.toString(),
    metadata: { email: user.email }
  });

  const permissions = await getPermissionsForRoleId(adminRole._id);
  const tokens = await issueTokens({
    userId: user._id.toString(),
    email: user.email,
    organizationId: organization._id.toString(),
    roleId: adminRole._id.toString(),
    roleName: adminRole.name,
    permissions,
    tokenVersion: 0
  });

  return {
    refreshToken: tokens.refreshToken,
    payload: {
      user: buildSafeUser({
        ...serializeDoc<{
          id: string;
          email: string;
          name: string;
          avatarUrl: string | null;
          status: string;
          createdAt: string;
        }>(user),
        createdAt: user.createdAt
      }),
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        slug: organization.slug,
        status: organization.status
      },
      workspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        slug: workspace.slug
      },
      role: adminRole.name,
      permissions,
      accessToken: tokens.accessToken
    }
  };
}

// ============================================================
// LOGIN — POST /api/v1/auth/login
// ============================================================

export async function login(input: LoginInput): Promise<SessionResult<RicozVizAuthResponse>> {
  const email = input.email.toLowerCase();

  const user = await UserModel.findOne({ email }).select('+passwordHash').exec();

  const passwordMatch = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatch) {
    if (user) {
      await logAuditEvent({
        organizationId: user._id.toString(),
        userId: user._id.toString(),
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user._id.toString(),
        status: 'FAILURE',
        metadata: { email }
      });
    }
    throw AppError.unauthorized('Invalid email or password');
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw AppError.unauthorized('Account is not active');
  }

  const membership = await getMembership(user._id.toString());
  if (!membership) {
    throw AppError.unauthorized('No active organization membership found');
  }

  const { organization, role } = membership;
  const tokenVersion = user.tokenVersion ?? 0;

  const tokens = await issueTokens({
    userId: user._id.toString(),
    email: user.email,
    organizationId: organization.id,
    roleId: role.id,
    roleName: role.name,
    permissions: membership.permissions,
    tokenVersion
  });

  await logAuditEvent({
    organizationId: organization.id,
    userId: user._id.toString(),
    action: 'USER_LOGIN',
    resourceType: 'User',
    resourceId: user._id.toString(),
    metadata: { email: user.email }
  });

  return {
    refreshToken: tokens.refreshToken,
    payload: {
      user: buildSafeUser({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        status: user.status ?? USER_STATUS.ACTIVE,
        createdAt: user.createdAt
      }),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status
      },
      role: role.name,
      permissions: tokens.permissions,
      accessToken: tokens.accessToken
    }
  };
}

// ============================================================
// ME — GET /api/v1/auth/me
// ============================================================

export async function me(userId: string, organizationId: string): Promise<RicozVizMeResponse> {
  const userObjectId = toObjectId(userId);
  const user = userObjectId ? await UserModel.findById(userObjectId).lean() : null;

  if (!user) {
    throw AppError.unauthorized('User not found');
  }

  const membership = await getMembership(userId, organizationId);
  if (!membership) {
    throw AppError.forbidden('No active organization membership');
  }

  const { organization, role } = membership;

  return {
    user: buildSafeUser({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      status: user.status ?? USER_STATUS.ACTIVE,
      createdAt: user.createdAt
    }),
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status
    },
    role: role.name,
    permissions: membership.permissions
  };
}

// ============================================================
// REFRESH — POST /api/v1/auth/refresh
// ============================================================

export async function refresh(
  cookieToken?: string
): Promise<SessionResult<RicozVizRefreshResponse>> {
  if (!cookieToken) {
    throw AppError.unauthorized('No refresh token provided');
  }

  const payload = verifyRefreshToken(cookieToken);
  const userObjectId = toObjectId(payload.sub);
  const user = userObjectId ? await UserModel.findById(userObjectId).lean() : null;

  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw AppError.unauthorized('User not found or inactive');
  }

  if (payload.tokenVersion !== (user.tokenVersion ?? 0)) {
    throw AppError.unauthorized('Refresh token has been invalidated');
  }

  const membership = await getMembership(user._id.toString());
  if (!membership) {
    throw AppError.unauthorized('No active organization membership');
  }

  const { organization, role } = membership;

  const tokens = await issueTokens({
    userId: user._id.toString(),
    email: user.email,
    organizationId: organization.id,
    roleId: role.id,
    roleName: role.name,
    permissions: membership.permissions,
    tokenVersion: payload.tokenVersion
  });

  return {
    refreshToken: tokens.refreshToken,
    payload: { accessToken: tokens.accessToken, permissions: tokens.permissions }
  };
}

// ============================================================
// LOGOUT — POST /api/v1/auth/logout
// ============================================================

export async function logout(
  principal?: { userId: string; organizationId: string }
): Promise<{ message: string }> {
  if (principal) {
    const userObjectId = toObjectId(principal.userId);
    if (userObjectId) {
      // Incrementing tokenVersion invalidates every previously issued refresh token.
      await UserModel.updateOne({ _id: userObjectId }, { $inc: { tokenVersion: 1 } })
        .exec()
        .catch((err: unknown) => {
          logger.warn('Failed to increment tokenVersion on logout', {
            error: err instanceof Error ? err.message : String(err)
          });
        });
    }

    await logAuditEvent({
      organizationId: principal.organizationId,
      userId: principal.userId,
      action: 'USER_LOGOUT',
      resourceType: 'User',
      resourceId: principal.userId
    });
  }

  return { message: 'Logged out successfully' };
}

export { REFRESH_TOKEN_COOKIE };