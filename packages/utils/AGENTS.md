# AGENTS.md - @repo/utils Agent Playbook

## Package Identity & Scope
`@repo/utils` is the shared runtime utility library. It must contain only general-purpose, lightweight, environment-agnostic helper functions that can execute seamlessly in Node.js, browsers, and edge environments.

---

## Agent Rules & Guidelines

### 1. Zero Heavy Dependencies
- Keep dependencies minimal. Currently limited to `clsx` and `tailwind-merge`.
- Do NOT add heavy third-party libraries (e.g. `lodash`, `moment`, `date-fns`) if standard Web APIs (`Intl`, native `Date`, regex, `Math`) suffice.

### 2. Universal / Isomorphic Execution
- Every utility function exported from `src/index.ts` must work identically in both Node.js (backend) and browser/Vite/Next environments.
- Do NOT use browser-only globals (like `window`, `document`, `navigator`) without feature-detection checks.
- Do NOT use Node-only modules (like `fs`, `path`, `process`) in `@repo/utils`.

### 3. Error Logging Best Practice
- The `logger.error` method is designed to print readable stack traces:
  ```typescript
  export const logger = {
    // ...
    error: (msg: string, error?: unknown) => {
      const detail = error instanceof Error ? (error.stack || error.message) : error;
      console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, detail ?? '');
    }
  };
  ```
- Always pass the raw `error` object into `logger.error("Message", error)` from catch blocks across the monorepo so stack traces are preserved.

### 4. Adding New Utilities
- When adding a new utility:
  1. Add typed function in `packages/utils/src/index.ts`.
  2. Ensure edge-case handling (null, undefined, invalid numbers or dates).
  3. Verify typecheck: `pnpm --filter @repo/utils check-types`.
  4. Verify consumer typecheck: `pnpm check-types`.

---

## Verification & Typechecking
```bash
# Typecheck utils package
pnpm --filter @repo/utils check-types

# Validate entire monorepo
pnpm check-types
```
