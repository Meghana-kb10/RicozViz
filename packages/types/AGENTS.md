# AGENTS.md - @repo/types Agent Playbook

## Package Identity & Scope
`@repo/types` is the single source of truth for canonical data contracts, domain entities, and network payloads across the monorepo. It must remain strictly type-only with zero runtime JavaScript output.

---

## Agent Rules & Guidelines

### 1. Zero Runtime Code Rule
- Never add executable JavaScript/TypeScript (no functions, no constants, no classes, no enums with runtime emission—prefer TypeScript string unions like `'admin' | 'user' | 'guest'`).
- The package `dependencies` in `package.json` must remain empty `{}`.
- If runtime logic, parser, or schema validator is needed, place it in `@repo/validation` or `@repo/utils`, NOT `@repo/types`.

### 2. Modifying Domain Interfaces
- When adding or changing fields on `User`, `Product`, `AuthResponse`, or `ApiResponse`:
  1. Update `packages/types/src/index.ts`.
  2. Update matching Zod schemas in `packages/validation/src/schemas/`.
  3. Check Mongoose schemas in `packages/database/src/models/` for database parity.
  4. Check consuming API clients in `packages/api/src/`.
  5. Run monorepo typecheck: `pnpm check-types`.

### 3. Union Types Over Enums
- Prefer string literal unions (e.g., `export type UserRole = 'admin' | 'user' | 'guest';`) over TypeScript `enum`.
- String literal unions serialize cleanly across JSON boundaries without requiring runtime helper objects or numeric index lookups.

### 4. Consistent API Envelope
- All network payload types must align with `ApiResponse<T>`:
  ```typescript
  export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    timestamp: string;
  }
  ```

---

## Verification & Typechecking
```bash
# Typecheck types package
pnpm --filter @repo/types check-types

# Validate full monorepo downstream consumers
pnpm check-types
```
