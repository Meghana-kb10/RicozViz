// ==============================================================================
// Platform Admin Users Controller
// ==============================================================================
// Governs platform users: cross-tenant user listings, status toggle, force logout
// (session invalidation + tokenVersion increment), and read-only 15-minute impersonation.
// ==============================================================================

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  UserModel,
  OrganizationMemberModel,
  RefreshTokenModel,
  toObjectId
} from '@repo/database';
import { signAccessToken } from '../../lib/jwt.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { logAuditEvent } from '../ricozviz/audit/audit.service.js';
import { validate } from '@repo/validation';
import { adminUserListQuerySchema, adminUserStatusUpdateSchema } from '@repo/validation';

export class AdminUsersController {
  /**
   * List users across all tenants with search and pagination.
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = validate(adminUserListQuerySchema, request.query);
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    // Filter by tenantId if provided
    if (query.tenantId) {
      const orgId = toObjectId(query.tenantId);
      if (orgId) {
        const memberUserIds = await OrganizationMemberModel.find({ organizationId: orgId }).distinct('userId');
        filter._id = { $in: memberUserIds };
      }
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .lean(),
      UserModel.countDocuments(filter)
    ]);

    const enriched = await Promise.all(
      users.map(async (u) => {
        const memberships = await OrganizationMemberModel.find({ userId: u._id }).lean();
        return {
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status || 'ACTIVE',
          twoFactorEnabled: Boolean(u.twoFactorEnabled),
          createdAt: u.createdAt,
          organizationCount: memberships.length
        };
      })
    );

    sendSuccess(reply, { users: enriched, total, limit: query.limit, offset: query.offset }, 200);
  }

  /**
   * Detailed user profile including organization memberships.
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = toObjectId(id);
    if (!userId) throw AppError.badRequest('Invalid user ID');

    const user = await UserModel.findById(userId).lean();
    if (!user) throw AppError.notFound('User not found');

    const memberships = await OrganizationMemberModel.find({ userId }).lean();

    sendSuccess(
      reply,
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'ACTIVE',
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        memberships: memberships.map((m) => ({
          organizationId: m.organizationId.toString(),
          status: m.status,
          roleId: m.roleId?.toString()
        }))
      },
      200
    );
  }

  /**
   * Set user status (ACTIVE, INACTIVE, SUSPENDED).
   */
  async setStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = validate(adminUserStatusUpdateSchema, request.body);
    const userId = toObjectId(id);
    if (!userId) throw AppError.badRequest('Invalid user ID');

    const user = await UserModel.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    const prevStatus = user.status;
    user.status = body.status;
    await user.save();

    await logAuditEvent({
      organizationId: 'platform',
      userId: request.adminUser!.userId,
      action: 'ADMIN_USER_STATUS_CHANGED',
      resourceType: 'USER',
      resourceId: user._id.toString(),
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        targetEmail: user.email,
        prevStatus,
        newStatus: body.status
      }
    });

    sendSuccess(reply, { id: user._id.toString(), status: body.status, message: `User status set to ${body.status}` }, 200);
  }

  /**
   * Force logout: revokes all refresh token families and increments tokenVersion.
   */
  async forceLogout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = toObjectId(id);
    if (!userId) throw AppError.badRequest('Invalid user ID');

    const user = await UserModel.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    // 1. Invalidate all stored refresh tokens for user
    const deleteResult = await RefreshTokenModel.deleteMany({ userId });

    // 2. Increment tokenVersion to invalidate active access tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logAuditEvent({
      organizationId: 'platform',
      userId: request.adminUser!.userId,
      action: 'ADMIN_USER_FORCE_LOGOUT',
      resourceType: 'USER',
      resourceId: user._id.toString(),
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        targetEmail: user.email,
        refreshTokensRevoked: deleteResult.deletedCount,
        newTokenVersion: user.tokenVersion
      }
    });

    sendSuccess(reply, { message: 'User sessions successfully invalidated across all devices' }, 200);
  }

  /**
   * Issue a strictly read-only, time-limited (15 min) impersonation token.
   */
  async impersonate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = toObjectId(id);
    if (!userId) throw AppError.badRequest('Invalid user ID');

    const user = await UserModel.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    const membership = await OrganizationMemberModel.findOne({ userId }).lean();
    const orgId = membership?.organizationId?.toString() || 'default_org';

    // Issue 15-minute customer access token with imp: true
    const impersonationToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      organizationId: orgId,
      roleId: membership?.roleId?.toString() || 'role_viewer',
      roleName: 'VIEWER',
      permissions: ['DATASET_VIEW', 'DASHBOARD_VIEW', 'CHART_VIEW'],
      imp: true,
      impersonator: request.adminUser!.email
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: request.adminUser!.userId,
      action: 'ADMIN_USER_IMPERSONATION_STARTED',
      resourceType: 'USER',
      resourceId: user._id.toString(),
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        targetEmail: user.email,
        readOnly: true,
        expiresInMinutes: 15
      }
    });

    sendSuccess(
      reply,
      {
        impersonationToken,
        readOnly: true,
        expiresInMinutes: 15,
        targetUser: {
          id: user._id.toString(),
          email: user.email,
          name: user.name
        }
      },
      200
    );
  }
}

export const adminUsersController = new AdminUsersController();
