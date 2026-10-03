// ========================================
// Shared API Response Types
// ========================================
// Used by both apps/api (to construct responses) and
// apps/web (to type-safely consume them).
// ========================================

/**
 * Standard success response envelope.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

/**
 * Standard error response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Structured API error.
 */
export interface ApiError {
  code: string;
  message: string;
  /** Field-level validation errors (e.g. from Zod) */
  details?: Record<string, string[]>;
}

/**
 * Pagination and request metadata attached to list responses.
 */
export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  [key: string]: unknown;
}

/**
 * Union of the two standard response shapes.
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ---- Health check response ----
export interface HealthCheckData {
  status: "ok" | "degraded" | "error";
  service: string;
  version?: string;
  timestamp: string;
  uptime?: number;
}
