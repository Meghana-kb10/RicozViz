# AGENTS.md - Components Package Agentic Playbook

## Agent Role & Scope
You are working on `@repo/components`. Your mission is to provide clean, accessible, framework-neutral React components and auth state management that can be consumed seamlessly by both Next.js and Vite apps.

---

## Key Workflows

### 1. Extending AuthContext
When adding new authentication methods (e.g. `resetPassword`, `updateProfile`):
1. Update `AuthContextType` interface in `src/AuthContext.tsx`.
2. Add the corresponding method implementation in `AuthProvider` calling `api.auth.<method>()`.
3. Memoize the handler with `React.useCallback`.
4. Add the handler to the `value` object in `useMemo`.
5. Run `pnpm --filter @repo/components check-types`.

### 2. Creating New Shared UI Components
1. Create `src/<ComponentName>.tsx`.
2. Define clean TypeScript props extending standard HTML attributes (e.g. `React.HTMLAttributes<HTMLDivElement>`).
3. Support an optional `className` prop and merge styles using `cn(baseStyles, className)`.
4. Export in `src/index.ts`.

---

## Constraints & Gotchas
- Never introduce Node.js or SSR-only APIs (`fs`, `process.env`) directly into component render functions without client checks.
- Keep `@repo/components` purely focused on shared cross-app logic; page-specific layouts belong in the app packages.
