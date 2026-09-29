// ========================================
// API Response Helpers
// ========================================

import type { Response } from "express";
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiMeta,
  ApiError,
} from "../types/api.types.js";

/**
 * Send a standardized success response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: ApiMeta
): void {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta !== undefined ? { meta } : {}),
  };
  res.status(statusCode).json(body);
}

/**
 * Send a standardized error response.
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, string[]>
): void {
  const error: ApiError = {
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  };
  const body: ApiErrorResponse = {
    success: false,
    error,
  };
  res.status(statusCode).json(body);
}
