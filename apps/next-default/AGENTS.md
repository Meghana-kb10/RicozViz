# AGENTS.md - Next.js Agentic Playbook

## Agent Role & Scope
You are working on the Next.js 15 client application. Your primary responsibilities are user interface excellence, Material UI fidelity, responsive layouts, and robust client-side state handling.

---

## Key Workflows

### 1. Creating a New Page
1. Define the route path in `src/config/page-route.config.ts`.
2. Create the directory: `src/app/<pageName>/`.
3. Scaffold the subfolders:
   ```
   src/app/<pageName>/
   ├── page.tsx
   ├── components/
   │   ├── header/
   │   │   ├── header.tsx
   │   │   └── components/
   │   │       └── navbar/
   │   │           └── navbar.tsx
   │   └── <feature>-card/
   │       └── <feature>-card.tsx
   ├── hooks/
   │   └── use<Feature>State.ts
   └── context/
       └── <feature>.context.tsx
   ```
4. Wrap `page.tsx` with its page-specific context provider:
   ```tsx
   export default function MyPage() {
     return (
       <MyFeatureProvider>
         <MyPageHeader />
         <main>...</main>
       </MyFeatureProvider>
     );
   }
   ```

### 2. Implementing Material Form Controls
- Use `Input` with `label`, `error`, and `helperText`. Do not write manual external labels; `Input` implements the Material notch/floating label animation internally.
- Use `Button` with `variant="contained"` for primary actions and `variant="outlined"` for secondary actions.
- Wrap cards in `<Card variant="elevated">`.

### 3. Authentication Integration
- Access authentication state via `useAuth()` from `@/hooks/useAuth`.
- `useAuth()` exposes `{ user, token, isAuthenticated, isLoading, login, register, forgotPassword, logout }`.

---

## Quality Checklist
- Every interactive element has feedback (e.g. `<TouchRipple />` or active scale transition).
- Always run `pnpm --filter next-app check-types` after modifications.
- Maintain visual and behavioral parity with `apps/vite`.
