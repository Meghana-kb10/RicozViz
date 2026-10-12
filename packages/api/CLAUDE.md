# CLAUDE.md - API Package Guidelines

## Overview
`@repo/api` provides a modular, isomorphic, strongly-typed HTTP API client and response factory utilities for both browser and server runtime environments.

```
packages/api/src/
├── client.ts            # Main ApiClient aggregating feature modules
├── http.ts              # Isomorphic HTTP transport wrapping fetch
├── storage.ts           # Token storage abstractions (Memory & Browser localStorage)
├── types.ts             # ApiClientConfig, RequestOptions, ApiResponse, ApiError
├── modules/             # Modular API domains
│   ├── auth.ts          # AuthApi (login, register, logout, refreshToken, forgotPassword, me)
│   ├── users.ts         # UsersApi (CRUD user operations)
│   ├── products.ts      # ProductsApi (CRUD product operations)
│   └── health.ts        # HealthApi (health check endpoints)
└── index.ts             # Public package exports
```

---

## Commands
- **Typecheck**: `pnpm --filter @repo/api check-types`
- **Build**: `pnpm --filter @repo/api build`

---

## Architecture & Code Conventions

1. **Modular Client API**:
   - Access endpoints through namespaced properties on `ApiClient`:
     - `api.auth.login(input)`
     - `api.auth.register(input)`
     - `api.users.getAll(query)`
     - `api.products.getById(id)`
     - `api.health.check()`

2. **Token Management**:
   - `TokenStorage` stores both `accessToken` and `refreshToken`.
   - `ApiClient` automatically attaches `Authorization: Bearer <token>` to requests when a token is present.
   - On 401 response, `handleTokenRefresh()` automatically attempts refresh via `POST /api/auth/refresh-token` before failing.

3. **Response Factories**:
   - `createApiResponse<T>(data, message)` -> `{ success: true, data, message, timestamp }`
   - `createApiError(error, message)` -> `{ success: false, error, message, timestamp }`

4. **Empty Payload Rule**:
   - For endpoints like `POST /api/auth/logout`, `http.post` must NOT set a `Content-Type: application/json` header with an empty string body. Either send `{}` or omit the body.
