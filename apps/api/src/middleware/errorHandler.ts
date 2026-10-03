// ========================================
// Error Handling Middleware
// ========================================

import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/env.js";

/**
 * 404 handler — catches unmatched routes.
 * Mount AFTER all valid routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`);
}

/**
 * Sanitizes an object to remove sensitive keys (passwords, tokens, secrets)
 * before logging.
 */
function sanitizeMeta(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMeta(item, depth + 1));
  }

  const sensitiveKeys = new Set([
    "password",
    "passwordhash",
    "token",
    "accesstoken",
    "refreshtoken",
    "secret",
    "authorization",
    "cookie",
    "jwt_access_secret",
    "jwt_refresh_secret",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMeta(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Global error handler.
 * Express requires 4 parameters to recognize this as an error handler.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestInfo = {
    method: req.method,
    path: req.path,
    body: sanitizeMeta(req.body),
    query: sanitizeMeta(req.query),
    params: sanitizeMeta(req.params),
  };

  // ---- 1. Zod validation errors (400) ----
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".");
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(issue.message);
    }
    logger.warn("Validation failed (ZodError)", { ...requestInfo, details });
    sendError(res, 400, "VALIDATION_ERROR", "Validation failed", details);
    return;
  }

  // ---- 2. Application operational errors (AppError) ----
  const isAppError =
    err instanceof AppError ||
    (typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      "code" in err &&
      typeof (err as AppError).statusCode === "number" &&
      typeof (err as AppError).code === "string");

  if (isAppError) {
    const appErr = err as AppError;
    if (appErr.statusCode >= 500) {
      logger.error(`AppError ${appErr.statusCode}: ${appErr.message}`, {
        message: appErr.message,
        code: appErr.code,
        statusCode: appErr.statusCode,
        stack: appErr.stack,
        ...requestInfo,
      });
    } else {
      logger.warn(`AppError ${appErr.statusCode}: ${appErr.message}`, {
        message: appErr.message,
        code: appErr.code,
        statusCode: appErr.statusCode,
        ...requestInfo,
      });
    }
    sendError(res, appErr.statusCode, appErr.code, appErr.message, appErr.details);
    return;
  }

  // ---- 3. Prisma Known Request Errors ----
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("P")
  ) {
    const prismaErr = err as { code: string; message: string; meta?: { target?: unknown } };

    // P2002: Unique constraint violation
    if (prismaErr.code === "P2002") {
      const target = Array.isArray(prismaErr.meta?.target)
        ? (prismaErr.meta.target as string[]).join(", ")
        : String(prismaErr.meta?.target || "field");

      logger.warn(`Prisma unique constraint violation (P2002) on ${target}`, {
        target,
        ...requestInfo,
      });

      if (target.includes("email")) {
        sendError(res, 409, "CONFLICT", "An account with this email already exists");
        return;
      }
      sendError(res, 409, "CONFLICT", `A resource with this ${target} already exists`);
      return;
    }

    // P2025: Record not found
    if (prismaErr.code === "P2025") {
      sendError(res, 404, "NOT_FOUND", "Requested resource was not found");
      return;
    }

    logger.error(`Prisma error ${prismaErr.code}: ${prismaErr.message}`, {
      code: prismaErr.code,
      message: prismaErr.message,
      meta: prismaErr.meta,
      ...requestInfo,
    });

    sendError(res, 400, "DATABASE_ERROR", "A database error occurred");
    return;
  }

  // ---- 4. Unknown / unexpected errors (500) ----
  const isProduction = config.NODE_ENV === "production";
  const errMessage = err instanceof Error ? err.message : String(err);
  const errStack = err instanceof Error ? err.stack : undefined;

  logger.error(`Unhandled server exception: ${errMessage}`, {
    error: errMessage,
    stack: errStack,
    ...requestInfo,
  });

  sendError(
    res,
    500,
    "INTERNAL_ERROR",
    isProduction
      ? "An unexpected error occurred. Please try again later."
      : errMessage
  );
}
