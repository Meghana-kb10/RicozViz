# CLAUDE.md - Core Monorepo Master Template Guidelines

> **Template Monorepo Notice**: This repository is the golden master template for multi-project architecture at Ricoz. Every project instantiated from this template must adhere strictly to the standardized directory layout, package boundaries, coding conventions, and architectural parity defined below.
> 
> **Boilerplate Codebases (`apps/next` & `apps/vite`)**: The existing frontend apps in `apps/next` and `apps/vite` serve as canonical reference boilerplates. When a project requires multiple specialized frontend applications (e.g., `customer`, `partner`, `admin`, `merchant`), developers can copy either boilerplate, rename it, and configure it following the instructions below.

---

## 1. Monorepo Architecture & Template Scope

This monorepo is orchestrated with **Turborepo** and **pnpm workspaces**. It enforces absolute separation between backend services, frontend consumer clients, and shared core packages.

```text
core-mono-template/
├── apps/
│   ├── backend/               # Fastify 5 REST API + Mongoose 9 + Zod validation (port 4000)
│   ├── next/                  # Next.js 15 (App Router) + React 19 + Material UI (port 3000) [Boilerplate]
│   └── vite/                  # Vite 6 + React Router v8 + React 19 + Material UI (port 5173) [Boilerplate]
├── packages/
│   ├── api/                   # Isomorphic Axios API client & typed endpoint services
│   ├── components/            # Shared React UI primitives, Material ripple, & AuthCard
│   ├── database/              # Mongoose singleton connection manager & base schemas
│   ├── tailwind-config/       # Material Design 3 tokens, CSS theme vars, & elevations
│   ├── types/                 # Canonical TypeScript domain models (zero runtime dependencies)
│   ├── utils/                 # Pure isomorphic helpers (cn, logger, formatCurrency, formatDate)
│   └── validation/            # Centralized Zod schemas & runtime validation runners
├── package.json               # Root workspace manifest & orchestrator scripts
├── pnpm-workspace.yaml        # Monorepo workspace package globs
├── turbo.json                 # Turbo pipeline task definitions & caching rules
└── tsconfig.base.json         # Base TypeScript compiler options extended by all packages
```

---

## 2. Step-by-Step Guide: Setting Up This Monorepo for a Specific Project

Follow these steps when creating a new client/company project from this master template:

### Step 1: Clone and Initialize Clean Git History
```bash
# 1. Clone template into your target project directory
git clone <template-repo-url> my-project
cd my-project

# 2. Re-initialize a fresh Git history
rm -rf .git
git init
git branch -M main
```

### Step 2: Configure Workspace & Project Identifiers
1. **Root `package.json`**: Update the root package name to match your project:
   ```json
   {
     "name": "my-project-monorepo",
     "version": "1.0.0"
   }
   ```
2. **Global App Configurations**:
   - In each app's `src/config/app.config.ts`, update `appName` (e.g. `MyProject Customer`, `MyProject Admin`).

### Step 3: Configure Environment Variables
Copy and configure environment files for every app:
```bash
# Backend configuration
cp apps/backend/.env.example apps/backend/.env

# Next.js configuration
cp apps/next/.env.example apps/next/.env.local

# Vite configuration
cp apps/vite/.env.example apps/vite/.env
```

1. **Backend Database Configuration (`apps/backend/.env`)**:
   - Set `MONGODB_URI` to your project's MongoDB connection string.
   - Set `MONGODB_DB_NAME` to your project's unique database name (e.g. `myproject_prod` or `myproject_dev`).
   - Set `PORT` (default `4000`).
   - Set `CORS_ORIGIN` to include all client app URLs (e.g. `http://localhost:3000,http://localhost:3001,http://localhost:5173`).
   - Set `JWT_SECRET` to a strong random key.
2. **Frontend Configurations**:
   - Set `NEXT_PUBLIC_API_URL` or `VITE_API_URL` to point to the backend API (`http://localhost:4000/api`).

### Step 4: Install Dependencies & Verify Base
```bash
pnpm install
pnpm run check-types
pnpm dev
```

### Step 5: Define Project Domain Models & Validation
1. **Types**: Add project domain types in `packages/types/src/index.ts`.
2. **Schemas**: Add corresponding Zod validation schemas in `packages/validation/src/<domain>/` and export from `packages/validation/src/index.ts`.
3. **Database**: Add Mongoose models in `packages/database/src/models/` (or `apps/backend/src/models/`).
4. **Backend Routes**: Create domain routes, controller, and service in `apps/backend/src/modules/<feature>/` and register in `apps/backend/src/modules/index.ts`.
5. **API Client**: Add typed API caller methods in `packages/api/src/modules/<feature>.ts`.

---

## 3. Boilerplate Guide: Adding New Apps (Customer, Partner, Admin, etc.)

`apps/next` and `apps/vite` are reference boilerplates. Most real-world projects require multiple role-based frontend portals (e.g. `customer`, `partner`, `admin`, `merchant`, `console`). You can generate new apps simply by cloning either boilerplate.

### Choosing the Right Boilerplate:
- **Use Next.js (`apps/next`)** when the app requires Server-Side Rendering (SSR), Static Site Generation (SSG), search engine SEO (landing pages, marketing portals, e-commerce storefronts).
- **Use Vite (`apps/vite`)** when the app is a heavy client-side Single Page Application (SPA), authenticated dashboard, internal admin portal, or partner console.

### Step-by-Step: Cloning a Boilerplate to Create a New App

#### Example: Creating an `apps/admin` (Next.js) or `apps/customer` (Vite)

1. **Copy the Boilerplate Folder**:
   ```bash
   # Option A: Creating a Next.js-based app (e.g. 'admin')
   cp -r apps/next apps/admin

   # Option B: Creating a Vite-based app (e.g. 'customer')
   cp -r apps/vite apps/customer
   ```

2. **Update App `package.json`**:
   - Open `apps/<new-app>/package.json` and update the `name`:
     ```json
     {
       "name": "admin-app",
       "version": "1.0.0",
       "private": true
     }
     ```

3. **Assign a Unique Development Port**:
   - Prevent port collisions by assigning distinct ports to each app:
     - `apps/backend`: Port `4000`
     - `apps/next`: Port `3000`
     - `apps/vite`: Port `5173`
     - `apps/admin`: Port `3001` (update `dev` script: `next dev -p 3001`)
     - `apps/customer`: Port `5174` (update `vite.config.ts` server port: `server: { port: 5174 }`)
   - Update CORS in `apps/backend/.env` to allow the new port (`http://localhost:3001`, `http://localhost:5174`).

4. **Update App Metadata & Routing**:
   - Open `apps/<new-app>/src/config/app.config.ts`:
     ```typescript
     export const appConfig = {
       name: 'Admin Console',
       description: 'Administrative management console for MyProject',
       api: {
         baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
         timeout: 10000,
       },
     };
     ```
   - Update `src/config/page-route.config.ts` with the routes specific to that portal.

5. **Maintain the Standardized Folder Architecture**:
   - Clean up demo pages in `src/app/`, but **strictly preserve** the folder hierarchy:
     `assets`, `components/ui`, `components/layout`, `config`, `context`, `hooks`, and `app`.
   - Keep page-specific subcomponents in `[pageName]/components/` following the nested rule:
     `pageName -> components -> header -> [header.tsx + components -> navbar -> navbar.tsx]`.

6. **Link Workspace & Validate**:
   ```bash
   # Re-link workspaces from monorepo root
   pnpm install

   # Verify zero compilation or typing errors
   pnpm run check-types

   # Launch dev server for the new app
   pnpm --filter admin-app dev
   ```

---

## 4. How to Run the Project Properly

### 1. Install Workspace Dependencies
Always install from the root using `pnpm`:
```bash
pnpm install
```

### 2. Running in Development Mode
- **Run all applications concurrently** (Backend, Next.js, Vite, and custom apps):
  ```bash
  pnpm dev
  ```
- **Run individual applications**:
  ```bash
  # Run Fastify Backend (http://localhost:4000)
  pnpm --filter backend dev

  # Run Next.js 15 App (http://localhost:3000)
  pnpm --filter next-app dev

  # Run Vite 6 React Router App (http://localhost:5173)
  pnpm --filter vite-app dev

  # Run newly cloned apps (e.g. admin-app)
  pnpm --filter admin-app dev
  ```

### 3. Typechecking & Quality Assurance
Run these before any commit or pull request:
```bash
# Typecheck all packages and apps in the monorepo
pnpm run check-types

# Typecheck a specific app or package
pnpm --filter backend check-types
pnpm --filter next-app check-types
pnpm --filter vite-app check-types
pnpm --filter @repo/api check-types

# Lint all packages
pnpm run lint
```

### 4. Building for Production
```bash
# Build all packages and applications via Turbo
pnpm run build

# Start production server for backend
pnpm --filter backend start

# Start production server for Next.js
pnpm --filter next-app start

# Preview production build for Vite
pnpm --filter vite-app preview
```

---

## 5. Standardized Files & Folder Structure to Maintain

Every application and package in this template follows a strict, non-negotiable folder structure.

### A. Frontend Application Structure (`apps/next`, `apps/vite`, and cloned apps)
Both frontend clients and any newly created portals maintain **1:1 structural and behavioral parity**.

```text
src/
├── assets/                    # Static assets (SVG icons, images, branding logos)
├── components/
│   ├── layout/                # Global layout wrappers (RootLayout, AuthLayout, DashboardLayout)
│   └── ui/                    # App-level UI primitives & custom Material components
├── config/
│   ├── app.config.ts          # Application metadata, title, API base URLs, feature flags
│   ├── page-route.config.ts   # Strongly typed route constants (PAGE_ROUTES.HOME, PAGE_ROUTES.AUTH.LOGIN)
│   └── index.ts               # Clean barrel export for all configurations
├── context/                   # Global React contexts (AuthContext, ThemeContext)
├── hooks/                     # Global reusable hooks (useAuth, useDebounce, useMediaQuery)
└── app/                       # Page routes & nested features
    ├── layout.tsx             # Root layout wrapper
    ├── page.tsx               # Index/Landing page
    ├── auth/                  # Grouped auth layout & subpages
    │   ├── layout.tsx         # Dedicated auth layout (AuthCard container, branding)
    │   ├── login/
    │   │   ├── page.tsx       # Login page entry
    │   │   ├── components/    # Page-specific components ONLY
    │   │   │   ├── header/    # Nested component unit
    │   │   │   │   ├── header.tsx
    │   │   │   │   └── components/
    │   │   │   │       └── navbar/
    │   │   │   │           └── navbar.tsx
    │   │   │   └── login-form/
    │   │   │       └── login-form.tsx
    │   │   ├── context/       # Page-specific state/context (if needed)
    │   │   └── hooks/         # Page-specific hooks (e.g., useLoginForm)
    │   ├── signup/            # Follows identical nested pattern
    │   └── forgot-password/   # Follows identical nested pattern
    └── routes.ts              # (Vite only) React Router v8 RouteConfig matching page-route.config.ts
```

#### The Subcomponent Hierarchy Rule:
- Global shared components live in `src/components/ui` or `@repo/components`.
- Page-specific components **must remain inside the page folder**: `[pageName]/components/`.
- Deeply nested subcomponents must follow the pattern:
  `pageName -> components -> header -> [header.tsx + components -> navbar -> navbar.tsx]`.
  Do NOT flatten page-specific subcomponents into the top-level `src/components`.

### B. Route Configuration Parity
Never hardcode route string literals in components or anchors.
- Define route paths in `src/config/page-route.config.ts`:
  ```typescript
  export const PAGE_ROUTES = {
    HOME: '/',
    AUTH: {
      LOGIN: '/auth/login',
      SIGNUP: '/auth/signup',
      FORGOT_PASSWORD: '/auth/forgot-password',
    },
    DASHBOARD: '/dashboard',
  } as const;
  ```
- In **Vite**, `src/app/routes.ts` registers routes using `@react-router/dev/routes`:
  ```typescript
  import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

  export default [
    index('page.tsx'),
    layout('auth/layout.tsx', [
      route('login', 'auth/login/page.tsx'),
      route('signup', 'auth/signup/page.tsx'),
      route('forgot-password', 'auth/forgot-password/page.tsx'),
    ]),
  ] satisfies RouteConfig;
  ```

### C. Backend Structure (`apps/backend`)
```text
src/
├── config/                    # Environment variable loader & typed config schema (env.ts)
├── middleware/                # Fastify validation hooks & auth guards
├── modules/                   # Domain feature modules
│   ├── auth/                  # Auth module
│   │   ├── auth.controller.ts # Fastify request handlers
│   │   ├── auth.service.ts    # Business logic & repository operations
│   │   └── auth.routes.ts     # Fastify route definitions & schema binding
│   └── index.ts               # Module aggregator mounting all routes to Fastify instance
├── plugins/                   # Fastify plugins (CORS, error handler, request logger)
├── app.ts                     # Fastify application factory (`buildApp()`)
└── index.ts                   # Server entry point (database connection & graceful shutdown)
```

### D. Packages Architecture (`packages/`)
- **`@repo/types`**: Type definitions only (`type`, `interface`). Zero runtime JavaScript (`dependencies: {}`).
- **`@repo/validation`**: Centralized Zod schemas (`loginRequestSchema`, `userSchema`) and validation runners (`validate`, `safeValidate`, `ValidationError`).
- **`@repo/database`**: Mongoose connection singleton (`connectDatabase`), schema models (`User`, `Product`), and seed scripts.
- **`@repo/api`**: Isomorphic Axios HTTP client (`ApiClient`), token management, and domain endpoint modules (`authApi`, `userApi`).
- **`@repo/components`**: Shared UI primitives (`Button`, `Card`, `Input`, `Modal`, `Badge`, `Dropdown`) and `<TouchRipple />`.
- **`@repo/utils`**: Pure helper functions (`cn`, `formatCurrency`, `formatDate`, `slugify`, `truncate`, `sleep`) and structured `logger`.
- **`@repo/tailwind-config`**: Central styling presets, CSS variables (`theme.css`), and Material elevation utilities (`styles.css`).

---

## 6. Development Conventions & Rules

### 1. Package Boundaries & Imports
- **Internal packages**: Always import using `@repo/<package-name>` (e.g. `import { cn } from '@repo/utils';`).
- **No Relative Cross-Package Imports**: Never import using `../../packages/` or relative paths reaching outside the project root.
- **No Frontend in Backend**: Never import `@repo/components` inside `apps/backend` or database scripts.
- **Zero Schema Duplication**: Never define duplicate Zod schemas or TypeScript types inside frontend apps. Place them in `@repo/validation` or `@repo/types`.

### 2. ESM Standards in Backend
- Backend operates under `"type": "module"`.
- Relative imports between TypeScript files in `apps/backend` **must include the `.js` extension**:
  ```typescript
  import { config } from './config/env.js';
  import { authService } from './modules/auth/auth.service.js';
  ```

### 3. Backend Error Logging & Responses
- Fastify errors must be explicitly logged with full stack traces using `@repo/utils`:
  ```typescript
  import { logger } from '@repo/utils';

  try {
    const data = await authService.login(body);
    return reply.status(200).send({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Login controller failure', error);
    return reply.status(400).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
  ```
- All responses must conform to the `ApiResponse<T>` envelope: `{ success, data, message, error, timestamp }`.

### 4. Material UI Feel & Styling Standards
Both frontends adhere to a refined **Material Design 3 aesthetic**:
- **Design Tokens**: Defined in `@repo/tailwind-config/theme.css` using custom properties (`--color-surface-bg`, `--color-primary`, `--color-primary-hover`).
- **Elevations**: Use dual-shadow classes `.mui-elevation-0` through `.mui-elevation-8`.
- **Interactive Feedback**: Interactive buttons, cards, and list elements must include the `<TouchRipple />` component from `@repo/components` or `@repo/tailwind-config/styles.css`.
- **Class Merging**: Always use `cn(...)` from `@repo/utils` to combine Tailwind classes cleanly.

### 5. Verification Before Every Commit
Before finalizing any modification or adding any feature:
1. Run `pnpm run check-types` from the monorepo root to guarantee zero type regressions.
2. Ensure all frontend apps compile and retain 1:1 structural and behavioral parity.
