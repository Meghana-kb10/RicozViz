# CLAUDE.md - Next.js App Guidelines

## Overview
The `next-app` is a modern web application built on **Next.js 15 (App Router)** and **React 19**, styled with **Tailwind CSS** and an authentic **Material UI (Material Design 3)** design system.

```
apps/next/src/
├── assets/              # Shared assets (icons.tsx, index.ts)
├── components/
│   ├── layout/          # Global layout (Header, Navbar, Footer)
│   └── ui/              # Material UI primitives (Button, Input, Card, Badge, TouchRipple)
├── config/              # App & route configs (app.config.ts, page-route.config.ts)
├── context/             # Global contexts (auth.context.tsx)
├── hooks/               # Global hooks (useAuth.ts, useNotification.ts)
└── app/                 # Next.js App Router pages
    ├── components/      # Page-specific components (header -> navbar subcomponents)
    ├── hooks/           # Page-specific hooks (useHomeState.ts)
    ├── context/         # Page-specific context (home.context.tsx)
    ├── login/           # Login page with co-located components, hooks, context
    ├── signup/          # Registration page with co-located components, hooks, context
    ├── forgot-password/ # Password recovery page with co-located components, hooks, context
    ├── layout.tsx       # Root layout with Google Fonts Roboto
    └── page.tsx         # Home dashboard page
```

---

## Commands
- **Start dev server**: `pnpm --filter next-app dev` (Runs on `http://localhost:3000`)
- **Build production bundle**: `pnpm --filter next-app build`
- **Start production server**: `pnpm --filter next-app start`
- **Typecheck**: `pnpm --filter next-app check-types`
- **Lint**: `pnpm --filter next-app lint`

---

## Architecture & Code Conventions

1. **Modular `src` Structure**:
   - Common code resides directly in `src/{assets, components/ui, components/layout, config, context, hooks}`.
   - Page-specific code is strictly co-located inside the page folder (`[pageName]/{components, hooks, context}`).
   - Subcomponent nesting rule: `pageName -> components -> header -> [header.tsx + components -> navbar -> navbar.tsx]`.

2. **Material UI Design Language**:
   - **Font**: Google Fonts `Roboto` (`font-roboto`).
   - **Elevations**: Material Design 3 elevation tokens (`.mui-elevation-0` to `.mui-elevation-8`).
   - **Buttons**: `contained`, `outlined`, `text`, `tonal`, and `danger` variants with interactive `<TouchRipple />`.
   - **Inputs**: Material Outlined TextFields with floating labels that animate to notch on focus/value.
   - **Cards**: Elevated surfaces with `CardHeader`, `CardContent`, `CardActions`, and `CardActionArea`.
   - **Chips**: Pill badges with filled/outlined styles and icon support.

3. **Path Aliasing**:
   - Use `@/*` pointing to `./src/*` (e.g. `@/components/ui/button`, `@/config/page-route.config`).
