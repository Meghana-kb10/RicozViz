# AGENTS.md - Master Template Agentic Workflow & Operational Playbook

> **Role & Purpose**: This repository is the foundational master template for multiple projects across Ricoz. AI coding agents operating in this repository must maintain the strict architectural boundaries, directory conventions, and behavioral parity outlined below.
>
> **Boilerplate Usage**: `apps/next` and `apps/vite` are reference boilerplates. When an agent is instructed to create a new application (e.g. `customer`, `partner`, `admin`), it should copy either `apps/next` or `apps/vite`, update the package name and port, and preserve the identical nested directory structure.


---

## 1. Core Operating Principles for Agents

1. **Verify Before and After Every Change**:
   - Always run `pnpm run check-types` before completing tasks. Never mark a task complete if there are type errors in any package.
2. **Respect Package Boundaries**:
   - Do NOT duplicate models, interfaces, or schemas across apps. If a type or schema is needed across packages, it belongs in `@repo/types` or `@repo/validation`.
   - Never import frontend packages (`@repo/components`) inside `apps/backend` or database scripts.
   - Internal imports must strictly use `@repo/*` namespace specifiers; never use relative paths reaching outside a package root.
3. **Preserve Architectural & Visual Parity**:
   - Every frontend capability (e.g. auth pages, app navigation, route configuration, layouts) implemented in `apps/next` **must also be implemented in `apps/vite`** and vice versa.
   - All frontends must maintain the exact same look, feel, and folder layout.
4. **Follow the Standardized Directory Layout**:
   - Respect global common folders (`assets`, `components/ui`, `components/layout`, `config`, `context`, `hooks`).
   - Page-specific code must stay inside nested page folders (`[pageName]/components`, `[pageName]/hooks`, `[pageName]/context`).
   - Obey the nested subcomponent rule:
     `pageName -> components -> header -> [header.tsx + components -> navbar -> navbar.tsx]`.

---

## 2. Standard Folder Structure Checklist

When creating or modifying frontend features in `apps/next`, `apps/vite`, or any cloned app (`apps/admin`, `apps/customer`, etc.), adhere to this checklist:

```text
src/
├── assets/                  # Shared static assets (SVG, icons, images)
├── components/
│   ├── layout/              # Shared layout shells (e.g. AuthLayout, DashboardLayout)
│   └── ui/                  # Shared UI primitives (buttons, inputs, cards)
├── config/
│   ├── app.config.ts        # App title, metadata, API endpoint constants
│   ├── page-route.config.ts # Typed PAGE_ROUTES constants (e.g., PAGE_ROUTES.AUTH.LOGIN)
│   └── index.ts             # Export barrel
├── context/                 # Global React contexts (AuthContext, ThemeContext)
├── hooks/                   # Global custom hooks (useAuth, useDebounce)
└── app/                     # Page routing directory
    ├── layout.tsx           # Top-level shell
    ├── page.tsx             # Landing / index page
    └── <feature>/           # Route feature folder
        ├── layout.tsx       # Optional feature layout
        └── <pageName>/
            ├── page.tsx     # Page view component
            ├── components/  # Page-specific components only
            │   └── <section>/
            │       ├── <section>.tsx
            │       └── components/
            │           └── <subcomponent>/
            │               └── <subcomponent>.tsx
            ├── context/     # Page-isolated React context
            └── hooks/       # Page-isolated custom hooks
```

---

## 3. Step-by-Step Agent Workflows

### Workflow A: Adding a New App (Cloning Next.js or Vite Boilerplate)
1. **Choose Base**:
   - Use `apps/next` if SSR / SEO is required (e.g. customer-facing storefront, marketing).
   - Use `apps/vite` if SPA / internal portal is required (e.g. admin console, partner portal).
2. **Duplicate & Rename**:
   - Copy `apps/next` or `apps/vite` to `apps/<new-app-name>` (e.g., `apps/admin`).
   - In `apps/<new-app-name>/package.json`, set `"name": "<new-app-name>-app"`.
3. **Configure Distinct Port**:
   - Assign an unused dev port (e.g. `3001` or `5174`) in `package.json` scripts or `vite.config.ts`.
   - Update CORS in `apps/backend/.env` to allow requests from the new port.
4. **Configure App Metadata**:
   - Update `appName` and description in `apps/<new-app-name>/src/config/app.config.ts`.
   - Update routes in `src/config/page-route.config.ts`.
5. **Install & Verify**:
   - Run `pnpm install` at root to link the new app workspace.
   - Run `pnpm run check-types` to ensure zero errors.

### Workflow B: Creating a New Page (Next.js & Vite Parity)
1. **Update Route Constants**:
   - Add new route paths to `src/config/page-route.config.ts` in **both** `apps/next` and `apps/vite`.
2. **Next.js Implementation**:
   - Create `apps/next/src/app/<route>/page.tsx`.
   - If page has isolated subcomponents, place them in `apps/next/src/app/<route>/components/`.
   - Adhere to the nested subcomponent pattern for multi-level child components.
3. **Vite React Router v8 Implementation**:
   - Create identical folder structure in `apps/vite/src/app/<route>/page.tsx`.
   - Register route in `apps/vite/src/app/routes.ts` referencing the new file path.
4. **Validation**:
   - Run `pnpm run check-types` to ensure zero compilation or typegen issues.

### Workflow C: Adding a Backend Endpoint Module
1. **Type Definitions**:
   - Add input/output domain types to `packages/types/src/index.ts`.
2. **Validation Schemas**:
   - Create Zod schemas in `packages/validation/src/<feature>/` and re-export in `packages/validation/src/index.ts`.
3. **Database Model (if persistent)**:
   - Create Mongoose schema and model in `packages/database/src/models/<feature>.ts`.
4. **Service & Controller**:
   - Create business logic in `apps/backend/src/modules/<feature>/<feature>.service.ts`.
   - Create Fastify request handlers in `apps/backend/src/modules/<feature>/<feature>.controller.ts`.
   - Log any caught errors using `logger.error("Controller failure", error)`.
5. **Route Registration**:
   - Create Fastify routes in `apps/backend/src/modules/<feature>/<feature>.routes.ts` and mount in `apps/backend/src/modules/index.ts`.
   - Remember relative TypeScript imports in backend ESM need `.js` extensions.
6. **API Client Integration**:
   - Add typed API methods to `packages/api/src/modules/<feature>.ts`.

### Workflow D: Modifying Material UI & Shared Styling
1. Central theme variables live in `packages/tailwind-config/src/theme.css`.
2. Elevation utility classes (`.mui-elevation-0` through `.mui-elevation-8`) live in `packages/tailwind-config/src/styles.css`.
3. Interactive elements must feature `<TouchRipple />` from `@repo/components` for authentic Material Design feedback.
4. Always wrap class bindings using `cn(...)` from `@repo/utils`.

---

## 4. Troubleshooting & Known Gotchas

- **Backend ESM Imports**: Relative imports within `apps/backend/src/` **must** include the `.js` file extension (e.g. `import { config } from './config/env.js';`).
- **Empty Body on POST Requests**: Fastify 5 rejects empty string bodies when `Content-Type: application/json` is sent. In `@repo/api`, ensure empty POST requests omit the body or pass `{}`.
- **Vite React Router Typegen**: If route typing in `apps/vite` falls out of sync, run `pnpm --filter vite-app check-types` which triggers `react-router typegen && tsc --noEmit`.
- **Database Connection Resiliency**: Backend boots even if MongoDB is temporarily down (logged as warning), allowing local frontend development against mock or offline services.

---

## 5. Verification Commands
```bash
# Verify entire monorepo integrity
pnpm run check-types

# Verify production builds
pnpm run build
```

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
