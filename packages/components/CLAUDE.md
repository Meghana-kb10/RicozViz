# CLAUDE.md - Components Package Guidelines

## Overview
`@repo/components` contains shared, framework-agnostic React components, including the authentication context provider (`AuthProvider`), auth hook (`useAuth`), authentication card (`AuthCard`), and reusable UI primitives.

```
packages/components/src/
├── AuthContext.tsx      # AuthContext, AuthProvider, and useAuth hook
├── AuthCard.tsx         # Universal tabbed auth card (login, register, forgot-password)
├── Button.tsx           # Shared base button
├── Card.tsx             # Shared base card container
├── Badge.tsx            # Shared base status badge
└── index.ts             # Public package exports
```

---

## Commands
- **Typecheck**: `pnpm --filter @repo/components check-types`
- **Build**: `pnpm --filter @repo/components build`

---

## Architecture & Code Conventions

1. **Client Agnostic**:
   - Components in this package must be usable in both Next.js 15 and Vite SPA environments.
   - Do not import `next/navigation`, `next/link`, or `react-router` directly inside `@repo/components`.
   - Provide callbacks (`onSuccess`, `onBackToHome`) for routing and navigation.

2. **AuthContext Integration**:
   - `AuthProvider` instantiates and wraps `@repo/api`'s `ApiClient`.
   - `useAuth()` provides reactive access to:
     - `user: User | null`
     - `token: string | null`
     - `isAuthenticated: boolean`
     - `isLoading: boolean`
     - `login(input)`
     - `register(input)`
     - `forgotPassword(input)`
     - `logout()`
     - `refreshProfile()`

3. **Styling**:
   - Tailwind utility classes combined using `cn(...)` from `@repo/utils`.
