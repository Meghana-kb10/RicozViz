/**
 * Minimal console logger for the database package.
 *
 * `@repo/database` deliberately depends only on `@repo/types` and `mongoose`,
 * so it cannot import `@repo/utils` (which pulls in Tailwind helpers meant for
 * the browser). This keeps seed and connection logging dependency-free.
 */
export const dbLogger = {
  info(message: string, meta?: unknown): void {
    console.log(`[Database] ${new Date().toISOString()} ${message}`, meta ?? '');
  },
  warn(message: string, meta?: unknown): void {
    console.warn(`[Database] ${new Date().toISOString()} ${message}`, meta ?? '');
  },
  error(message: string, meta?: unknown): void {
    console.error(`[Database] ${new Date().toISOString()} ${message}`, meta ?? '');
  }
};