// ========================================
// Shared Common Utility Types
// ========================================

/**
 * Make specific keys of T required.
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys of T optional.
 */
export type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Branded/nominal type helper.
 * Usage: type UserId = Brand<string, "UserId">
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Common identifier types (will be expanded as entities are defined).
 */
export type ISO8601String = string;
export type UUIDString = string;

/**
 * Sort direction for list queries.
 */
export type SortDirection = "asc" | "desc";

/**
 * Generic paginated list.
 */
export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
