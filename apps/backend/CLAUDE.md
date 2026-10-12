# CLAUDE.md - Backend Service Guidelines

## Overview
The `backend` application is a high-performance REST API built on **Fastify 5**, **Mongoose 8**, and **Zod** validation. It provides JWT-based authentication, user management, product catalogues, and health checks.

```
apps/backend/
├── src/
│   ├── config/          # Environment configuration & cascading loader
│   ├── models/          # Mongoose database schemas & models
│   ├── modules/         # Feature modules (controller, service, routes)
│   │   ├── auth/        # Login, registration, token refresh, forgot-password, logout
│   │   ├── user/        # User CRUD & role management
│   │   ├── product/     # Product catalogue management
│   │   └── health/      # Liveness & readiness probes
│   ├── plugins/         # Global Fastify plugins
│   │   ├── authenticate.ts # Bearer token preHandler & authorize role guard
│   │   ├── error-handler.ts# Uniform error formatting & 404 handler
│   │   └── logger.ts    # Request, response, and failure logging hooks
│   ├── repositories/    # Data access layer interfacing Mongoose
│   ├── app.ts           # Fastify app factory (buildApp)
│   └── index.ts         # Server bootstrap and graceful shutdown
```

---

## Commands
- **Start dev server**: `pnpm --filter backend dev` (Runs on `http://localhost:4000`)
- **Build production bundle**: `pnpm --filter backend build`
- **Start production server**: `pnpm --filter backend start`
- **Typecheck**: `pnpm --filter backend check-types`
- **Run tests**: `pnpm --filter backend test`

---

## Architecture & Code Conventions

1. **Layered Structure**:
   - **Routes**: Define HTTP paths, preHandler hooks (`authenticate`, `authorize`), and route handlers.
   - **Controllers**: Validate request body/params using Zod via `validate(...)`, call services, log errors via `logger.error`, and format responses with `createApiResponse` / `createApiError`.
   - **Services**: Pure business logic, token generation, password hashing (bcrypt), and transactional operations.
   - **Repositories**: Direct interaction with Mongoose models.

2. **Error Logging Rule**:
   - Every controller `catch` block MUST call `logger.error(...)` with the original error and descriptive action context before calling `reply.status(...).send(createApiError(...))`.
   - Fastify's `onError` and `onSend` hooks automatically log unhandled errors and responses with status `>= 400`.

3. **ESM Imports**:
   - Relative imports between local files must use explicit `.js` extensions (e.g. `import { authService } from './auth.service.js';`).
   - Shared packages must be imported via `@repo/*` (`@repo/api`, `@repo/database`, `@repo/types`, `@repo/utils`, `@repo/validation`).

---

## Environment Configuration
- Variables are defined in `.env.development`, `.env.test`, `.env.production`.
- Key variables:
  - `PORT`: Server port (default: `4000`)
  - `MONGODB_URI`: Full connection string
  - `MONGODB_DB_NAME` / `DB_NAME`: Database name (e.g. `core-mono-dev`)
  - `CORS_ORIGIN`: Allowed origins (e.g. `http://localhost:3000,http://localhost:5173`)
  - `JWT_SECRET`: Secret key for JWT signing & verification (minimum 32 chars)
