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
    adminTokenPayload?: AdminAccessTokenPayload & { jti?: string };
  }
}

function extractBearerToken(request: FastifyRequest): string {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw AppError.unauthorized('No authorization token provided');
  }
  return token;
}

function verifyAdminTokenWithCustomerCheck(token: string): AdminAccessTokenPayload & { jti?: string } {
  try {
    return verifyAdminAccessToken(token);
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
}

/**
 * Standard platform admin guard: strictly requires twoFactorVerified: true.
 * Rejects 2fa-pending tokens and unverified sessions with 403 Forbidden.
 */
export async function platformAdminGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request);
  const payload = verifyAdminTokenWithCustomerCheck(token);

  if (payload.type === '2fa-pending' || !payload.twoFactorVerified) {
    throw AppError.forbidden('Forbidden: Two-factor authentication verification required');
  }

  request.adminUser = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role
  };
  request.adminTokenPayload = payload;
}

/**
 * Guard for /auth/totp/enroll: accepts either a 2fa-pending token (for first-time enrollment)
 * or a fully verified access token (for re-enrollment).
 */
export async function platformAdminPendingGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request);
  const payload = verifyAdminTokenWithCustomerCheck(token);

  request.adminUser = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role
  };
  request.adminTokenPayload = payload;
}

/**
 * Strict guard for /auth/totp/verify: accepts ONLY a 2fa-pending token with JTI.
 * Rejects full access tokens with 400 Bad Request.
 */
export async function platformAdminVerifyGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request);
  const payload = verifyAdminTokenWithCustomerCheck(token);

  if (payload.type !== '2fa-pending') {
    throw AppError.badRequest('Two-factor verification accepts only a 2FA-pending token');
  }

  if (!payload.jti) {
    throw AppError.unauthorized('Invalid pending token: missing token identifier');
  }

  request.adminUser = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role
  };
  request.adminTokenPayload = payload;
}
