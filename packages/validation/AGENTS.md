# AGENTS.md - @repo/validation Agent Playbook

## Package Identity & Scope
`@repo/validation` is the authoritative schema validation package powered by Zod. It enforces boundary contracts for API requests, parameters, queries, and form inputs.

---

## Agent Rules & Guidelines

### 1. Single Source of Schema Truth
- Never create duplicate inline Zod schemas in `apps/backend`, `apps/next`, or `apps/vite`.
- If an endpoint or form requires validation:
  1. Define or extend the schema in `packages/validation/src/<domain>/`.
  2. Export the schema and its inferred type (`export type XInput = z.infer<typeof xSchema>;`) in `packages/validation/src/index.ts`.
  3. Import and consume in the relevant app or package.

### 2. Schema Structure & Naming Conventions
- Suffix request schemas with `RequestSchema` (e.g. `loginRequestSchema`, `createProductRequestSchema`).
- Suffix query schemas with `QuerySchema` (e.g. `paginationQuerySchema`, `userQuerySchema`).
- Suffix parameter schemas with `ParamSchema` or `ParamsSchema` (e.g. `idParamSchema`, `mongoIdParamSchema`).
- Suffix inferred input types with `Input` (e.g. `LoginRequestInput`, `PaginationQueryInput`).

### 3. Clear, Actionable Error Messages
- Always supply clear custom error messages for human-facing constraints:
  ```typescript
  password: z.string().min(8, 'Password must be at least 8 characters long')
  ```
- Use `formatZodFieldErrors` to generate `{ [field: string]: string[] }` structures for frontends to map directly to form input error states.

### 4. Zero Framework-Specific Coupling
- `@repo/validation` depends only on `zod`.
- Do not import Express, React, Next.js, or browser APIs into `@repo/validation`.
- Middleware implementations using these schemas belong in `apps/backend/src/middleware/validate.middleware.ts`.

---

## Verification & Typechecking
```bash
# Typecheck validation package
pnpm --filter @repo/validation check-types

# Validate entire monorepo
pnpm check-types
```
