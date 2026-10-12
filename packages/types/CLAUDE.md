# CLAUDE.md - Types Package Guidelines

## Overview
`@repo/types` is the zero-dependency, canonical type-definition package for the entire monorepo. It contains core domain models, API response wrappers, authentication contracts, and system health status types shared across apps (`backend`, `next`, `vite`) and packages (`api`, `validation`, `database`, `components`).

```
packages/types/
├── src/
│   └── index.ts         # Centralized type and interface declarations
├── package.json         # Package configuration (zero runtime dependencies)
└── tsconfig.json        # TypeScript compiler options
```

---

## Commands
- **Typecheck**: `pnpm --filter @repo/types check-types`
- **Build**: `pnpm --filter @repo/types build`

---

## Architecture & Code Conventions

1. **Zero Runtime Dependencies**:
   - `@repo/types` contains only TypeScript `type` and `interface` declarations.
   - Do NOT add runtime code, functions, classes, or external runtime dependencies.
   - This ensures rapid compilation, clean tree-shaking, and universal compatibility (Node.js, browser, edge runtimes).

2. **Core Domain Models**:
   - `User`, `CreateUserInput`: Canonical identity models.
   - `Product`: Catalog domain entity.
   - `AuthTokens`, `AuthResponse`: Authentication session and token contracts.
   - `ApiResponse<T>`: Standardized envelope format (`{ success, data, message, error, timestamp }`).
   - `HealthStatus`: Service status reporting format.

3. **Immutability & Extensibility**:
   - Export plain interfaces and union types.
   - For generic responses or pagination wrappers, leverage type parameterization (e.g. `ApiResponse<T = unknown>`).
   - Avoid circular type references between packages.

4. **Synchronizing with Validation**:
   - When updating models in `@repo/types`, verify matching Zod validation schemas in `@repo/validation` (`packages/validation/src/schemas/`).
