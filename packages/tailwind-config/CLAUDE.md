# CLAUDE.md - Tailwind Config Package Guidelines

## Overview
`@repo/tailwind-config` provides the centralized design tokens, CSS variables, utility classes, and Material Design 3 elevation system for all UI applications in the monorepo.

```
packages/tailwind-config/
├── src/
│   ├── theme.css        # CSS variables for primary, surface, and semantic colors
│   ├── styles.css       # Centralized utility & component classes (@repo/tailwind-config/styles.css)
│   └── index.ts         # TypeScript token constants and color presets
├── package.json         # Exports definition for CSS and JS
└── tsconfig.json        # Compiler configuration
```

---

## Commands
- **Typecheck**: `pnpm --filter @repo/tailwind-config check-types`
- **Build**: `pnpm --filter @repo/tailwind-config build`

---

## Architecture & Code Conventions

1. **Design Tokens & Theme Variables**:
   - `theme.css` specifies base CSS custom properties:
     - Surface colors: `--color-surface-bg`, `--color-surface-card`, `--color-surface-border`
     - Brand colors: `--color-primary`, `--color-primary-hover`
     - Status colors: `--color-success`, `--color-warning`, `--color-danger`, `--color-info`

2. **Tailwind v4 & v3 Integration**:
   - Both Next.js (`@tailwindcss/postcss`) and Vite (`@tailwindcss/vite`) import this package's CSS directly via `@import "@repo/tailwind-config/styles.css";`.

3. **Material Design 3 Extensions**:
   - Elevation shadows (`.mui-elevation-0` through `.mui-elevation-8`).
   - Ripple animations (`.animate-mui-ripple`).
   - Standard font family (`Roboto`).
