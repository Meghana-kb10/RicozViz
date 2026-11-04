import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import type { AccessTokenPayload, AdminAccessTokenPayload } from '@repo/types';

export interface RicozVizAccessTokenPayload extends AccessTokenPayload {
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  familyId?: string;
  aud?: string;
  type: 'refresh';
}

// ---- Customer Token generation -----------------------------------------------

export function signAccessToken(payload: Omit<RicozVizAccessTokenPayload, 'type'>): string {
  const options: SignOptions = {
    expiresIn: config.jwtAccessExpiresIn as SignOptions['expiresIn']
  };
  return jwt.sign({ ...payload, aud: payload.aud || 'customer', type: 'access' }, config.jwtAccessSecret, options);
}

export function signRefreshToken(userId: string, tokenVersion: number, familyId?: string): string {
  const options: SignOptions = {
    expiresIn: config.jwtRefreshExpiresIn as SignOptions['expiresIn']
  };
  return jwt.sign(
    { sub: userId, tokenVersion, familyId, aud: 'customer', jti: crypto.randomUUID(), type: 'refresh' },
    config.jwtRefreshSecret,
    options
  );
}

// ---- Admin Token generation --------------------------------------------------

export function signAdminAccessToken(payload: {
  sub: string;
  email: string;
  twoFactorVerified: boolean;
}): string {
  const options: SignOptions = {
    expiresIn: '15m'
  };
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      role: 'PLATFORM_ADMIN',
      aud: 'admin',
      twoFactorVerified: payload.twoFactorVerified,
      type: 'access'
    },
    config.jwtAdminSecret,
    options
  );
}

export function signAdminRefreshToken(userId: string, tokenVersion: number, familyId?: string): string {
  const options: SignOptions = {
    expiresIn: '7d'
  };
  return jwt.sign(
    {
      sub: userId,
      tokenVersion,
      familyId,
      aud: 'admin',
      role: 'PLATFORM_ADMIN',
      twoFactorVerified: true,
      jti: crypto.randomUUID(),
      type: 'refresh'
    },
    config.jwtAdminSecret,
    options
  );
}

// ---- Customer Token verification ---------------------------------------------

export function verifyAccessToken(token: string): RicozVizAccessTokenPayload {
  try {
    const payload = jwt.verify(token, config.jwtAccessSecret) as RicozVizAccessTokenPayload;
    if (payload.type !== 'access') {
      throw AppError.unauthorized('Invalid token type');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Access token expired');
    }
    throw AppError.unauthorized('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, config.jwtRefreshSecret) as RefreshTokenPayload;
    if (payload.type !== 'refresh') {
      throw AppError.unauthorized('Invalid token type');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Refresh token expired');
    }
    throw AppError.unauthorized('Invalid refresh token');
  }
}

// ---- Admin Token verification ------------------------------------------------

export function verifyAdminAccessToken(token: string): AdminAccessTokenPayload {
  try {
    const payload = jwt.verify(token, config.jwtAdminSecret) as AdminAccessTokenPayload;
    if (payload.type !== 'access') {
      throw AppError.unauthorized('Invalid token type');
    }
    if (payload.aud !== 'admin' || payload.role !== 'PLATFORM_ADMIN') {
      throw AppError.forbidden('Forbidden: Not an authorized platform admin token');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Admin access token expired');
    }
    throw AppError.unauthorized('Invalid admin access token');
  }
}

export function verifyAdminRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, config.jwtAdminSecret) as RefreshTokenPayload;
    if (payload.type !== 'refresh') {
      throw AppError.unauthorized('Invalid token type');
    }
    if (payload.aud !== 'admin') {
      throw AppError.forbidden('Forbidden: Invalid admin refresh audience');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Admin refresh token expired');
    }
    throw AppError.unauthorized('Invalid admin refresh token');
  }
}

// ---- Cookies -----------------------------------------------------------------

export const REFRESH_TOKEN_COOKIE = 'ricozviz_refresh';
export const ADMIN_REFRESH_COOKIE = 'rv_admin_session';

export function getRefreshCookieOptions(maxAge: number) {
  const isProduction = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge,
    path: '/api/v1/auth'
  };
}

export function getAdminRefreshCookieOptions(maxAge: number) {
  const isProduction = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge,
    path: '/admin/auth'
  };
}
