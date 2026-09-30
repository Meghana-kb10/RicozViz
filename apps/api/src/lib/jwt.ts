// ========================================
// JWT Token Service
// ========================================
// Handles access and refresh token generation and verification.
// Tokens are signed with separate secrets for access and refresh.
// ========================================

import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config/env.js";
import { AppError } from "../utils/errors.js";

// ---- Token payload types ----

export interface AccessTokenPayload {
  sub: string;          // userId
  email: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;          // userId
  tokenVersion: number; // Incremented on logout to invalidate old tokens
  type: "refresh";
}

// ---- Token generation ----

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  const options: SignOptions = { expiresIn: config.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(
    { ...payload, type: "access" },
    config.JWT_ACCESS_SECRET,
    options
  );
}

export function signRefreshToken(
  userId: string,
  tokenVersion: number
): string {
  const options: SignOptions = { expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(
    { sub: userId, tokenVersion, type: "refresh" },
    config.JWT_REFRESH_SECRET,
    options
  );
}

// ---- Token verification ----

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (payload.type !== "access") {
      throw AppError.unauthorized("Invalid token type");
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized("Access token expired");
    }
    throw AppError.unauthorized("Invalid access token");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (payload.type !== "refresh") {
      throw AppError.unauthorized("Invalid token type");
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized("Refresh token expired");
    }
    throw AppError.unauthorized("Invalid refresh token");
  }
}

// ---- Cookie helpers ----

export const REFRESH_TOKEN_COOKIE = "ricozviz_refresh";

export function getRefreshCookieOptions(maxAge: number) {
  const isProduction = config.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
    maxAge, // milliseconds
    path: "/api/v1/auth",
  };
}
