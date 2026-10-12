# Core Monorepo Master Template

A modular, enterprise-grade Turborepo master template managed with **pnpm**, designed as the single architectural blueprint for building high-performance web applications and backend services across Ricoz.

> **💡 Boilerplate Notice**: `apps/next` and `apps/vite` are reference boilerplates. To add new applications (e.g. `customer`, `partner`, `admin`, `merchant`), simply duplicate either boilerplate, rename it, and configure its port!


---


## 🏗️ Architecture & Workspaces

```text
core-mono-template/
├── apps/
│   ├── backend/               # Fastify 5 REST API + Mongoose 9 + Zod (Port 4000)
│   ├── next/                  # Next.js 15 App Router + React 19 + Material UI (Port 3000) [Boilerplate]
│   └── vite/                  # Vite 6 + React Router v8 SPA + Material UI (Port 5173) [Boilerplate]
│
├── packages/
│   ├── api/                   # Isomorphic Axios API client & typed endpoints
│   ├── components/            # Material Design 3 React primitives & TouchRipple
│   ├── database/              # Mongoose singleton connection & schema models
│   ├── tailwind-config/       # Shared theme tokens, CSS variables, & elevations
│   ├── types/                 # Canonical TypeScript domain types & API contracts
│   ├── utils/                 # Isomorphic utilities (cn, logger, formatters)
│   └── validation/            # Centralized Zod schemas & validation runners
│
├── package.json               # Root workspace configuration
├── pnpm-workspace.yaml        # pnpm workspace definition
├── turbo.json                 # Turborepo 2 pipeline configuration
└── tsconfig.base.json         # Shared base TypeScript configuration
```

---

## 🚀 Setting Up This Template for a New Project (Step-by-Step)

Follow these steps when creating a new client or company project from this template:

### 1. Clone & Re-initialize Git
```bash
git clone <template-repo-url> my-new-project
cd my-new-project

# Start clean Git history
rm -rf .git
git init
git branch -M main
```

### 2. Configure Project Identity
- Update `"name": "my-project-monorepo"` in root `package.json`.
- Update `src/config/app.config.ts` in apps with your project's brand name.

### 3. Setup Environment Variables
```bash
# Backend configuration
cp apps/backend/.env.example apps/backend/.env

# Next.js configuration
cp apps/next/.env.example apps/next/.env.local

# Vite configuration
cp apps/vite/.env.example apps/vite/.env
```
- In `apps/backend/.env`:
  - Set `MONGODB_URI` to your MongoDB connection string.
  - Set `MONGODB_DB_NAME` to your project's database name (e.g. `myproject_dev`).
  - Set `CORS_ORIGIN` to allow your client apps.
  - Set `JWT_SECRET` to a secure random string.

### 4. Install Dependencies & Verify
```bash
pnpm install
pnpm run check-types
pnpm dev
```

---

## 📦 Adding a New App (Cloning Next.js or Vite Boilerplate)

Need multiple portals such as `apps/customer`, `apps/partner`, `apps/admin`, or `apps/merchant`? Clone either boilerplate:

| Need SSR / SEO / Marketing / Storefront | Need SPA / Internal Dashboard / Console |
| :--- | :--- |
| **Clone `apps/next`** | **Clone `apps/vite`** |

### Step-by-Step Example (Adding an `admin` app):
1. **Copy the boilerplate**:
   ```bash
   cp -r apps/next apps/admin
   ```
2. **Rename in `package.json`**:
   - In `apps/admin/package.json`, set `"name": "admin-app"`.
3. **Assign an unused port**:
   - In `apps/admin/package.json` scripts: `"dev": "next dev -p 3001"`.
   - Update `CORS_ORIGIN` in `apps/backend/.env` to include `http://localhost:3001`.
4. **Update App Metadata**:
   - In `apps/admin/src/config/app.config.ts`, set `appName: 'Admin Portal'`.
   - In `apps/admin/src/config/page-route.config.ts`, define your admin routes.
5. **Install & Verify**:
   ```bash
   pnpm install
   pnpm run check-types
   pnpm --filter admin-app dev
   ```

---

## 📁 Standardized Folder Structure Guidelines

All frontend apps (Next.js, Vite, and newly cloned apps) maintain **1:1 structural and behavioral parity**:

```text
src/
├── assets/                    # Global static assets (SVGs, icons, images)
├── components/
│   ├── layout/                # Global layout containers (AuthLayout, DashboardLayout)
│   └── ui/                    # App-level reusable UI primitives
├── config/
│   ├── app.config.ts          # App metadata & API configuration
│   ├── page-route.config.ts   # Strongly typed route constants (PAGE_ROUTES)
│   └── index.ts               # Barrel export
├── context/                   # Global React contexts (AuthContext, ThemeContext)
├── hooks/                     # Global custom hooks (useAuth, useDebounce)
└── app/                       # Application route tree
    ├── layout.tsx             # Root application shell
    ├── page.tsx               # Home / Landing page
    ├── auth/                  # Grouped route layout
    │   ├── layout.tsx         # Auth wrapper layout
    │   └── login/
    │       ├── page.tsx       # Login page entry
    │       ├── components/    # Page-specific components ONLY
    │       │   ├── header/    # Nested subcomponent pattern
    │       │   │   ├── header.tsx
    │       │   │   └── components/
    │       │   │       └── navbar/
    │       │   │           └── navbar.tsx
    │       │   └── login-form/
    │       │       └── login-form.tsx
    │       ├── context/       # Page-specific context
    │       └── hooks/         # Page-specific hooks
    └── routes.ts              # (Vite only) React Router v8 RouteConfig
```

### Subcomponent Hierarchy Rule
Page-specific subcomponents must never be placed in the global `src/components/ui`. They must reside directly inside the page's `components/` directory, following nested subfolders for complex hierarchies:
`pageName -> components -> header -> [header.tsx + components -> navbar -> navbar.tsx]`.

---

## 📏 Core Rules & Conventions

1. **Package Boundaries**:
   - Internal libraries must be imported using `@repo/*` namespace (e.g. `@repo/utils`, `@repo/validation`).
   - Never use relative imports across packages.
   - Never import frontend packages (`@repo/components`) in backend code.
2. **ESM Compliance**:
   - Backend runs in ESM (`"type": "module"`). Relative TypeScript file imports require explicit `.js` extensions (e.g. `import { config } from './config/env.js';`).
3. **Type Safety & Validation**:
   - Never duplicate Zod schemas or interfaces across apps. Place them in `@repo/validation` and `@repo/types`.
4. **Material Design 3 Styling**:
   - Use design tokens from `@repo/tailwind-config/theme.css`.
   - Apply elevation classes (`.mui-elevation-1` to `.mui-elevation-8`).
   - Include `<TouchRipple />` on interactive elements for consistent tactile feedback.
5. **Logging**:
   - Always log backend errors via `logger.error("Description", error)` from `@repo/utils` so complete stack traces are output.

---

## 🛠️ Verification Commands

```bash
# Typecheck all packages/apps
pnpm run check-types

# Build all packages/apps
pnpm run build

# Lint all code
pnpm run lint
```

For AI agent workflows, refer to [AGENTS.md](file:///d:/ricoz-projects/core-mono-template/AGENTS.md). For detailed Claude guidelines, see [CLAUDE.md](file:///d:/ricoz-projects/core-mono-template/CLAUDE.md).
