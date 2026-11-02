import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import type { AccessTokenPayload } from '@repo/types';

export interface RicozVizAccessTokenPayload extends AccessTokenPayload {
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  familyId?: string;
  type: 'refresh';
}

// ---- Token generation --------------------------------------------------------

export function signAccessToken(payload: Omit<RicozVizAccessTokenPayload, 'type'>): string {
  const options: SignOptions = {
    expiresIn: config.jwtAccessExpiresIn as SignOptions['expiresIn']
  };
  return jwt.sign({ ...payload, type: 'access' }, config.jwtAccessSecret, options);
}

export function signRefreshToken(userId: string, tokenVersion: number, familyId?: string): string {
  const options: SignOptions = {
    expiresIn: config.jwtRefreshExpiresIn as SignOptions['expiresIn']
  };
  return jwt.sign(
    { sub: userId, tokenVersion, familyId, jti: crypto.randomUUID(), type: 'refresh' },
    config.jwtRefreshSecret,
    options
  );
}

// ---- Token verification ------------------------------------------------------

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

// ---- Refresh cookie ----------------------------------------------------------

export const REFRESH_TOKEN_COOKIE = 'ricozviz_refresh';

export function getRefreshCookieOptions(maxAge: number) {
  const isProduction = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge, // milliseconds
    path: '/api/v1/auth'
  };
}