// ==============================================================================
// Platform Admin Security Guard
// ==============================================================================
// Enforces that incoming requests carry a valid admin access token with:
//  - aud: 'admin'
//  - role: 'PLATFORM_ADMIN'
//  - twoFactorVerified: true
// Rejects customer tokens and unverified 2FA sessions with 403 Forbidden.
// ==============================================================================

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AdminAccessTokenPayload } from '@repo/types';
import { verifyAdminAccessToken, verifyAccessToken } from '../../lib/jwt.js';
import { AppError } from '../../utils/errors.js';

export interface AdminPrincipal {
  userId: string;
  email: string;
  role: 'PLATFORM_ADMIN';
}

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: AdminPrincipal;
  }
}

export async function platformAdminGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw AppError.unauthorized('No authorization token provided');
  }

  let payload: AdminAccessTokenPayload;
  try {
    payload = verifyAdminAccessToken(token);
  } catch (adminErr) {
    // If it's a valid customer token, explicitly reject with 403 Forbidden
    try {
      const customerPayload = verifyAccessToken(token);
      if (customerPayload) {
        throw AppError.forbidden('Customer tokens cannot access platform admin endpoints');
      }
    } catch (custErr) {
      if (custErr instanceof AppError && custErr.statusCode === 403) {
        throw custErr;
      }
    }
    throw adminErr;
  }

  if (!payload.twoFactorVerified) {
    throw AppError.forbidden('Forbidden: Two-factor authentication verification required');
  }

  request.adminUser = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role
  };
}
