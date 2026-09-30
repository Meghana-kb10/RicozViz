// ========================================
// Async Handler Utility
// ========================================
// Wraps async route handlers to forward errors to Express's
// global error handler without try/catch boilerplate.
// ========================================

import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Wraps an async Express route handler.
 * Any thrown error (including AppError, ZodError, etc.) is forwarded
 * to the global error handler via next(err).
 */
export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
