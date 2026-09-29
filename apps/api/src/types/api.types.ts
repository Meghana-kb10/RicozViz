// ========================================
// Shared API Response Types (inlined from @ricozviz/shared)
// ========================================
// These types mirror packages/shared/src/types/api.ts
// They will be imported from the shared package once it's published/linked.
// ========================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthCheckData {
  status: "ok" | "degraded" | "error";
  service: string;
  version?: string;
  timestamp: string;
  uptime?: number;
}
