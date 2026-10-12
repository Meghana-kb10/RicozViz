import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '@repo/types';
import { verifyAccessToken } from '../lib/jwt.js';
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

  const payload = verifyAccessToken(token);

  request.ricozvizUser = {
    userId: payload.sub,
    email: payload.email,
    organizationId: payload.organizationId,
    roleId: payload.roleId,
    roleName: payload.roleName,
    permissions: payload.permissions ?? []
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