import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@repo/types';
import { createApiError } from '@repo/api';
import { logger } from '@repo/utils';
import { authService } from '../modules/auth/auth.service.js';

// Augment FastifyRequest to include authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Fastify preHandler hook to verify bearer authentication tokens.
 * Extracts token from Authorization header and attaches the authenticated user to `request.user`.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    logger.warn(`[Auth] Missing authorization header on ${request.method} ${request.url}`);
    reply.status(401).send(createApiError('Missing authorization header', 'Unauthorized'));
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    logger.warn(`[Auth] Invalid authorization header format on ${request.method} ${request.url}`);
    reply.status(401).send(
      createApiError('Invalid authorization header format. Expected "Bearer <token>"', 'Unauthorized')
    );
    return;
  }

  const token = parts[1]?.trim();
  if (!token) {
    logger.warn(`[Auth] Empty authentication token provided on ${request.method} ${request.url}`);
    reply.status(401).send(createApiError('Empty authentication token provided', 'Unauthorized'));
    return;
  }

  try {
    const user = await authService.validateToken(token);
    request.user = user;
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Invalid or expired token';
    logger.error(`[Auth] Token validation failed on ${request.method} ${request.url}: ${message}`, error);
    reply.status(401).send(createApiError(message, 'Unauthorized'));
    return;
  }
}

/**
 * Role-based authorization preHandler factory.
 * Requires authenticate to run before this hook.
 */
export function authorize(...roles: Array<'admin' | 'user' | 'guest'>) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      logger.warn(`[Auth] Unauthorized access attempt on ${request.method} ${request.url}: No user`);
      reply.status(401).send(createApiError('Authentication required', 'Unauthorized'));
      return;
    }

    if (roles.length > 0 && !roles.includes(request.user.role)) {
      logger.warn(
        `[Auth] Forbidden access on ${request.method} ${request.url}: User role "${request.user.role}" not in [${roles.join(', ')}]`
      );
      reply.status(403).send(createApiError('Forbidden: Insufficient permissions', 'Forbidden'));
      return;
    }
  };
}

/**
 * Registers authenticate decorator and default user property on Fastify instance.
 */
export function registerAuthenticate(app: FastifyInstance): void {
  app.decorateRequest('user', undefined);
  app.decorate('authenticate', authenticate);
}
