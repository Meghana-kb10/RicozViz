# CLAUDE.md - Vite Client Guidelines

## Overview
The `vite-app` is a single-page application built on **Vite 6** and **React Router v8** (`@react-router/dev/vite`), configured with `appDirectory: 'src/app'` and styled with **Tailwind CSS** and an authentic **Material UI (Material Design 3)** design system.

```
apps/vite/src/
├── assets/              # Shared assets (icons.tsx, index.ts)
├── components/
│   ├── layout/          # Global layout (Header, Navbar, Footer)
│   └── ui/              # Material UI primitives (Button, Input, Card, Badge, TouchRipple)
├── config/              # App & route configs (app.config.ts, page-route.config.ts)
├── context/             # Global contexts (auth.context.tsx)
├── hooks/               # Global hooks (useAuth.ts, useNotification.ts)
└── app/                 # React Router v8 app directory
    ├── routes.ts        # Route manifest configuration
    ├── root.tsx         # Root document, error boundary, & Google Fonts Roboto
    ├── app.css          # Global Tailwind CSS & Material elevation tokens
    ├── page.tsx         # Home dashboard page
    ├── components/      # Page-specific components (header -> navbar subcomponents)
    ├── hooks/           # Page-specific hooks (useHomeState.ts)
    ├── context/         # Page-specific context (home.context.tsx)
    └── auth/            # Auth route group
        ├── layout.tsx   # Auth ambient glow layout
        ├── login/       # Login page with co-located components, hooks, context
        ├── signup/      # Registration page with co-located components, hooks, context
        └── forgot-password/ # Password recovery page with co-located components, hooks, context
```

---

## Commands
- **Start dev server**: `pnpm --filter vite-app dev` (Runs on `http://localhost:5173`)
- **Build production bundle**: `pnpm --filter vite-app build`
- **Typecheck & typegen**: `pnpm --filter vite-app check-types` (`react-router typegen && tsc --noEmit`)
- **Preview production build**: `pnpm --filter vite-app preview`

---

## Architecture & Code Conventions

1. **React Router v8 Framework Mode**:
   - `react-router.config.ts` sets `appDirectory: 'src/app'`.
   - `src/app/routes.ts` defines routes relative to `src/app`:
     ```typescript
     export default [
       index('page.tsx'),
       layout('auth/layout.tsx', [
         route('login', 'auth/login/page.tsx'),
         route('signup', 'auth/signup/page.tsx'),
         route('forgot-password', 'auth/forgot-password/page.tsx'),
       ]),
     ] satisfies RouteConfig;
     ```
2. **Material UI Design System**:
   - Google Fonts `Roboto`, Material elevations (`.mui-elevation-*`), `<TouchRipple />` on interactive surfaces, floating-label `Input`, and elevated `Card`.
3. **Routing Navigation**:
   - Use `Link` from `react-router` with `to={PAGE_ROUTES.HOME}` (not `href`).
   - Use `useNavigate()` from `react-router` for programmatic navigation (not `next/navigation`).
4. **Path Aliasing**:
   - Configured via `@/*` pointing to `./src/*` in both `tsconfig.json` and `vite.config.ts`.
