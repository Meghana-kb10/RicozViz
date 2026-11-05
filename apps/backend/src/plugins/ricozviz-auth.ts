import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedUser, AccessTokenPayload } from '@repo/types';
import { ORGANIZATION_STATUS } from '@repo/types';
import { OrganizationModel, toObjectId } from '@repo/database';
import { verifyAccessToken, verifyAdminAccessToken } from '../lib/jwt.js';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** RicozViz principal, attached by `requireAuth`. */
    ricozvizUser?: AuthenticatedUser;
  }
}

/**
 * RicozViz JWT guard.
 *
 * Verifies the `Authorization: Bearer <token>` header and attaches the decoded
 * principal to `request.ricozvizUser`. Throwing lets the global error handler
 * render the standard error envelope.
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw AppError.unauthorized('No token provided');
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (custErr) {
    try {
      const adminPayload = verifyAdminAccessToken(token);
      if (adminPayload) {
        throw AppError.forbidden('Admin tokens cannot access customer routes');
      }
    } catch (adminCheckErr) {
      if (adminCheckErr instanceof AppError && adminCheckErr.statusCode === 403) {
        throw adminCheckErr;
      }
    }
    throw custErr;
  }

  if (payload.aud === 'admin') {
    throw AppError.forbidden('Admin tokens cannot access customer routes');
  }

  if (payload.imp) {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      throw AppError.forbidden('Impersonation sessions are strictly read-only');
    }
  }

  if (!payload.organizationId || !payload.roleId || !payload.roleName) {
    throw AppError.unauthorized('Invalid customer token claims');
  }

  const orgId = toObjectId(payload.organizationId);
  if (orgId) {
    const org = await OrganizationModel.findById(orgId).select('status').lean();
    if (org && org.status === ORGANIZATION_STATUS.SUSPENDED) {
      throw new AppError(403, 'TENANT_SUSPENDED', 'Organization account is suspended. Contact platform administrator.');
    }
  }

  request.ricozvizUser = {
    userId: payload.sub,
    email: payload.email,
    organizationId: payload.organizationId,
    roleId: payload.roleId,
    roleName: payload.roleName,
    permissions: payload.permissions ?? [],
    isImpersonated: payload.imp,
    impersonator: payload.impersonator
  };
}

/** RBAC guard — must run after `requireAuth`. */
export function requirePermission(permissionKey: string) {
  return async function permissionGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.ricozvizUser;
    if (!user) {
      sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      return;
    }
    if (!user.permissions.includes(permissionKey)) {
      throw AppError.forbidden(`Permission required: ${permissionKey}`);
    }
  };
}

/** RBAC guard accepting any one of the supplied permission keys. */
export function requireAnyPermission(...permissionKeys: string[]) {
  return async function anyPermissionGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.ricozvizUser;
    if (!user) {
      sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      return;
    }
    if (!permissionKeys.some((key) => user.permissions.includes(key))) {
      throw AppError.forbidden(`Permission required: ${permissionKeys.join(' or ')}`);
    }
  };
}

/**
 * Guards against cross-tenant access: the principal's organization must match
 * the organization that owns the requested resource.
 */
export function assertSameOrganization(userOrgId: string, requestedOrgId: string): void {
  if (userOrgId !== requestedOrgId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }
}

/** Narrowed accessor that throws when the principal is missing. */
export function getPrincipal(request: FastifyRequest): AuthenticatedUser {
  if (!request.ricozvizUser) {
    logger.warn(`Unauthenticated access on ${request.method} ${request.url}`);
    throw AppError.unauthorized();
  }
  return request.ricozvizUser;
}