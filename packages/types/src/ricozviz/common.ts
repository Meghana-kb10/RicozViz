/**
 * RicozViz API envelope and pagination contracts.
 *
 * The wire format is intentionally preserved from the legacy Express service:
 *   success -> { success: true,  data, meta? }
 *   failure -> { success: false, error: { code, message, details? } }
 * The web client depends on this exact shape, so it must not drift.
 */

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiSuccess<T = unknown> = ApiSuccessResponse<T>;

export type ApiFailure = ApiErrorResponse;

/**
 * Note: the union is intentionally NOT named `ApiResponse` — the template's
 * `@repo/types` already owns that identifier for its generic fetch envelope.
 */
export type RicozVizApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** User summary embedded in relations (owner, creator, member...). */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}