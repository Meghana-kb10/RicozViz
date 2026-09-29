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
  // ---- Zod validation errors ----
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".");
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(issue.message);
    }
    sendError(res, 400, "VALIDATION_ERROR", "Validation failed", details);
    return;
  }

  // ---- Operational application errors ----
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error("Non-operational AppError", { err, path: req.path });
    }
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // ---- Unknown / unexpected errors ----
  const isProduction = config.NODE_ENV === "production";

  logger.error("Unhandled error", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  sendError(
    res,
    500,
    "INTERNAL_ERROR",
    isProduction
      ? "An unexpected error occurred. Please try again later."
      : err instanceof Error
        ? err.message
        : "Unknown error"
  );
}
