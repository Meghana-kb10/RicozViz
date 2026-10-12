# AGENTS.md - @repo/tailwind-config Agent Playbook

## Package Identity & Scope
`@repo/tailwind-config` is the centralized styling and design token package consumed by `apps/next`, `apps/vite`, and `packages/components`. It defines CSS variables, theme tokens, and Material Design 3 elevation and ripple utility styles.

---

## Agent Rules & Guidelines

### 1. Zero Runtime JS Footprint
- Keep JavaScript exports in `src/index.ts` strictly limited to design tokens, type definitions, or color constant maps.
- Do not introduce runtime state, React dependencies, or heavy computation here.

### 2. CSS Custom Properties / Variable Discipline
- Define global theme variables in `src/theme.css`.
- Use consistent semantic naming:
  - Surface: `--color-surface-bg`, `--color-surface-card`, `--color-surface-border`
  - Primary / Brand: `--color-primary`, `--color-primary-hover`, `--color-primary-contrast`
  - Semantic Status: `--color-success`, `--color-warning`, `--color-danger`, `--color-info`
- When modifying or adding variables, ensure backwards compatibility across both `@repo/components` and consumer apps (`apps/next`, `apps/vite`).

### 3. Tailwind v4 Compatibility
- Both `apps/next` (PostCSS) and `apps/vite` (Vite Tailwind plugin) consume Tailwind CSS v4.
- Avoid legacy Tailwind v3 JavaScript config patterns (like `tailwind.config.js` plugins) unless strictly required for custom tools. Modern Tailwind v4 prefers `@theme` and `@utility` rules in CSS.
- Ensure all CSS rules in `src/styles.css` and `src/theme.css` compile cleanly in both build pipelines.

### 4. Material Design 3 Utilities
- Standard elevations use `.mui-elevation-0` through `.mui-elevation-8` using dual-shadow formulas for ambient and key lighting.
- Keep ripple utility classes (`.animate-mui-ripple`, etc.) pure CSS to avoid hydration mismatches.

---

## Verification & Typechecking
```bash
# Verify TypeScript definitions
pnpm --filter @repo/tailwind-config check-types

# Verify consuming apps compile styling cleanly
pnpm --filter next build
pnpm --filter vite build
```
