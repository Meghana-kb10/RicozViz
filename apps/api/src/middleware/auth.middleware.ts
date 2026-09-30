// ========================================
// Authentication Middleware
// ========================================
// Verifies the JWT access token from the Authorization header.
// Attaches the decoded user context to req.user.
// ========================================

import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";
import { AppError } from "../utils/errors.js";

// ---- Extend Express Request type ----
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

/**
 * requireAuth — protects routes behind JWT authentication.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it and attaches the decoded user to req.user.
 *
 * On failure: throws 401 UNAUTHORIZED.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(AppError.unauthorized("Missing or malformed Authorization header"));
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    next(AppError.unauthorized("No token provided"));
    return;
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    next(err);
    return;
  }

  req.user = {
    userId: payload.sub,
    email: payload.email,
    organizationId: payload.organizationId,
    roleId: payload.roleId,
    roleName: payload.roleName,
    permissions: payload.permissions,
  };

  next();
}

/**
 * requirePermission — RBAC guard.
 *
 * Must be used AFTER requireAuth.
 * Checks that req.user.permissions includes the required permission key.
 *
 * On failure: throws 403 FORBIDDEN.
 */
export function requirePermission(permissionKey: string) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const user = req.user;

    if (!user) {
      next(AppError.unauthorized());
      return;
    }

    if (!user.permissions.includes(permissionKey)) {
      next(
        AppError.forbidden(
          `Permission required: ${permissionKey}`
        )
      );
      return;
    }

    next();
  };
}

/**
 * requireAnyPermission — RBAC guard accepting any of the specified permissions.
 */
export function requireAnyPermission(...permissionKeys: string[]) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const user = req.user;

    if (!user) {
      next(AppError.unauthorized());
      return;
    }

    const hasAny = permissionKeys.some((p) => user.permissions.includes(p));
    if (!hasAny) {
      next(
        AppError.forbidden(
          `Permission required: ${permissionKeys.join(" or ")}`
        )
      );
      return;
    }

    next();
  };
}

/**
 * requireOrganization — validates that the requesting user
 * belongs to the organization specified in the route/query.
 *
 * Prevents users from injecting a different organizationId
 * into requests to access cross-tenant resources.
 *
 * Usage: attach after requireAuth, pass the resolved orgId.
 */
export function assertSameOrganization(
  userOrgId: string,
  requestedOrgId: string
): void {
  if (userOrgId !== requestedOrgId) {
    throw AppError.forbidden(
      "Access denied: resource belongs to a different organization"
    );
  }
}
