/**
 * Resolve the backend API origin for server-side BFF route handlers.
 * Prefers internal service origin (ADMIN_API_ORIGIN, e.g. http://backend:4000 in Docker),
 * falling back to public URLs and localhost for local development.
 */
export function getAdminBackendUrl(): string {
  return (
    process.env.ADMIN_API_ORIGIN ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  );
}
