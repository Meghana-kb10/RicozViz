# CLAUDE.md - Validation Package Guidelines

## Overview
`@repo/validation` is the centralized runtime validation and schema definition package built with Zod. It enforces data integrity at API boundaries, form inputs, route parameters, and database query filters across backend and frontend applications.

```
packages/validation/
├── src/
│   ├── auth/            # Auth schemas: login, register, token refresh, password resets
│   ├── common/          # Common schemas: pagination, mongoId, api responses
│   ├── product/         # Product domain schemas: queries, creation, updates
│   ├── user/            # User domain schemas: profiles, role checks, password changes
│   ├── validate.ts      # Core validation runners (validate, validateAsync, safeValidate, ValidationError)
│   └── index.ts         # Consolidated exports
├── package.json         # Dependency: zod (^3.24.2)
└── tsconfig.json        # Compiler configuration
```

---

## Commands
- **Typecheck**: `pnpm --filter @repo/validation check-types`
- **Build**: `pnpm --filter @repo/validation build`

---

## Architecture & Code Conventions

1. **Validation Helpers (`src/validate.ts`)**:
   - `validate(schema, data)`: Synchronously parses data; throws typed `ValidationError` on failure.
   - `validateAsync(schema, data)`: Asynchronously parses data (useful for async transforms or database existence checks).
   - `safeValidate(schema, data)`: Discriminated union result (`{ success: true, data }` or `{ success: false, errors, fieldErrors }`).
   - `ValidationError`: Custom error class containing formatted error array and nested `fieldErrors` map (`Record<string, string[]>`).

2. **Schema Organization**:
   - Each domain resides in its own subfolder:
     - `auth/`: `loginRequestSchema`, `registerRequestSchema`, `refreshTokenRequestSchema`, etc.
     - `user/`: `createUserRequestSchema`, `updateUserRequestSchema`, `changePasswordRequestSchema`, `userQuerySchema`.
     - `product/`: `createProductRequestSchema`, `updateProductRequestSchema`, `productQuerySchema`.
     - `common/`: `paginationQuerySchema`, `idParamSchema`, `mongoIdSchema`, `mongoIdParamSchema`.

3. **Inferred Types**:
   - Always export matching TypeScript inferred types alongside schemas using `z.infer<typeof schema>`:
     ```typescript
     export const loginRequestSchema = z.object({
       email: z.string().email(),
       password: z.string().min(8)
     });
     export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
     ```

4. **Integration Across the Monorepo**:
   - **Backend**: Express validation middleware (`validateBody`, `validateQuery`, `validateParams`) wraps these schemas.
   - **Frontends**: Form state and API payloads validate through `safeValidate` or directly via form hooks.
   - **API Client**: `@repo/api` uses these request input types for typed HTTP client calls.
