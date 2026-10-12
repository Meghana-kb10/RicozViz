# CLAUDE.md - Utils Package Guidelines

## Overview
`@repo/utils` provides shared, pure helper utilities across all frontends (`apps/next`, `apps/vite`), backend (`apps/backend`), and packages (`@repo/components`). It includes classname merging (`cn`), formatting helpers (`formatCurrency`, `formatDate`), text utilities (`slugify`, `truncate`), timing utilities (`sleep`), and structured console logging (`logger`).

```
packages/utils/
├── src/
│   └── index.ts         # Central utility exports (cn, formatters, logger, sleep)
├── package.json         # Dependencies: clsx, tailwind-merge
└── tsconfig.json        # Compiler configuration
```

---

## Commands
- **Typecheck**: `pnpm --filter @repo/utils check-types`
- **Build**: `pnpm --filter @repo/utils build`

---

## Architecture & Code Conventions

1. **Class Merging (`cn`)**:
   - Uses `clsx` and `tailwind-merge` to resolve conditional classes and deduplicate conflicting Tailwind utility classes.
   - Used universally across all UI components:
     ```typescript
     import { cn } from '@repo/utils';
     <button className={cn('base-style', isActive && 'active-style', className)} />
     ```

2. **Formatting & String Helpers**:
   - `formatCurrency(amount, currency = 'USD')`: Standardized currency representation via `Intl.NumberFormat`.
   - `formatDate(date)`: Formats timestamps via `Intl.DateTimeFormat` with date and short time.
   - `slugify(text)`: Transforms titles/strings into clean, URL-safe slugs.
   - `truncate(text, maxLength)`: Shortens text safely with an ellipsis.

3. **Structured Logger (`logger`)**:
   - Provides `logger.info`, `logger.warn`, and `logger.error`.
   - In `logger.error(msg, error)`, if an `Error` object is provided, it extracts `error.stack || error.message` so full stack traces appear in server logs rather than generic object summaries.
   - Consumed by both backend controllers and client services for consistent log output.

4. **Pure Function Discipline**:
   - Functions in `@repo/utils` must be pure, deterministic, and free of side effects or framework-specific runtime hooks.
