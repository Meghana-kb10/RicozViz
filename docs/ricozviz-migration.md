# RicozViz Migration Guide

RicozViz was migrated from its original `RicozViz_old` layout (npm workspaces,
Express 4, Prisma/PostgreSQL, Next.js 16 at the repo root) into this Turborepo
+ pnpm template. This document records what moved where and why.

## Layout at a glance

| Concern | Legacy | Now |
| --- | --- | --- |
| Web app | `apps/web` (standalone Next.js) | `apps/ricozviz-customer` |
| API server | `apps/api` (Express) | `apps/backend` (Fastify 5) |
| Database | `apps/api/prisma` (PostgreSQL) | `packages/database` (Mongoose/MongoDB) |
| Domain types | `apps/web/lib/api.ts` + `apps/api` inline | `packages/types/src/ricozviz` |
| HTTP client | `apps/web/lib/api.ts` | `packages/api/src/ricozviz` |
| Config | `.env` per app | single root `.env` (see `.env.example`) |

The template's original demo code (`apps/next-default`, `apps/vite`, the
`auth`/`user`/`product`/`health` backend modules, `@repo/components`) is **left
untouched** so the template stays a valid reference boilerplate.

## UI fidelity

`apps/ricozviz-customer` preserves the legacy UI:

- `app/` → `src/app/`, `components/`, `contexts/`, and `lib/` copied with the
  API facade exception below.
- No page, component, class name, Tailwind token or `globals.css` value changed.
- All relative imports (`../contexts/auth-context`) still resolve because the
  directory layout is unchanged.
- `tsconfig.json` maps `@/*` → `./src/*`, so every `@/lib/api` import works.
- `src/lib/api.ts` is the deliberate exception: it preserves the legacy named
  API exports as an explicit facade over `@repo/api`; the page and component
  source remains unchanged.

This is why `src/lib/api.ts` must keep exporting the **exact same symbol names**
as the legacy file: 33k lines of pages import from it. It is now a thin barrel
that re-exports the real implementations from `@repo/api`.

## Why MongoDB / Mongoose

Mongoose was chosen over Prisma because the template is MongoDB-first. The
trade-offs that were handled explicitly:

- **IDs.** Prisma used `uuid()` strings; Mongoose uses `ObjectId`. Every route
  param is funnelled through `toObjectId()` from `@repo/database`, and the
  serializer converts `ObjectId` back to a string, so the HTTP contract is
  unchanged.
- **Transactions.** Prisma's `$transaction` has no MongoDB equivalent. The
  multi-document writes (auth registration) do **manual rollback** — see
  `auth.service.ts`, which deletes what it created on failure.
- **Uniqueness.** Prisma `@unique` becomes a Mongo index. Duplicate-key errors
  surface as `code === 11000` and are mapped to `409 CONFLICT` centrally in
  `plugins/error-handler.ts`.
- **Case-insensitive search.** Prisma `contains` + `mode: 'insensitive'`
  becomes `new RegExp(escapeRegExp(s), 'i')`. Always escape user input.
- **JSON columns.** Prisma `Json` becomes `Schema.Types.Mixed` with a
  **function** default (`() => ({})`) so documents never share a literal.
- **Aliases.** The legacy `prisma.report` / `prisma.visualization` aliases are
  gone; use `ReportModel` and `ChartModel`.

The full query-by-query mapping table lives in
[`apps/backend/src/modules/ricozviz/README.md`](apps/backend/src/modules/ricozviz/README.md).

The dataset API is split across `datasetRoutes` (CRUD, ingestion, preview and
refresh) and `advancedDatasetRoutes` (profiling, blending, calculated fields,
transformations, versioning/lineage and row-level security). Both are mounted
under `/api/v1/datasets` so the legacy web client keeps its existing paths.

## Why the migrated modules are namespaced

`apps/backend/src/modules/ricozviz/` exists because the template already owns
`modules/auth`, `modules/user`, `modules/product`, `modules/health`. Two modules
cannot share a name, so the migrated domain sits in a subfolder. This also means
two auth systems coexist deliberately:

- `requireAuth` / `requirePermission` — RicozViz JWT + RBAC (migrated).
- `authenticate` / `authorize` — template demo session tokens (untouched).

They attach to different request properties (`ricozvizUser` vs `user`) and never
cross over.

## Zod schemas

The legacy code declared its Zod schemas inline in each service file, and they
are ported that way to keep the diff reviewable. `AGENTS.md` Workflow C suggests
`packages/validation`, but centralising ~200 schemas would either duplicate them
or churn files that currently typecheck. `@repo/validation` keeps its template
demo schemas. Revisit this if a third consumer ever needs these schemas.

## Export style

This repository forbids `export * from "..."`. Every barrel lists its symbols
explicitly so the public surface stays greppable and ESM resolution stays
predictable. If you add a barrel, follow that rule.

## Backend ESM

`apps/backend` is `"type": "module"`. Relative imports **must** carry the `.js`
extension (`import { config } from './config/env.js'`). The template's own
`plugins/index.ts` originally violated this; it has been fixed.

## Background workers

The legacy `server.ts` started three `setInterval` workers. They are ported as
singletons with `.start(intervalMs)` / `.stop()` and are wired in
`apps/backend/src/index.ts`:

- `scheduledReportWorker`
- `scheduledAlertWorker`
- `scheduledRefreshWorker`

## Running it

```bash
pnpm install
cp .env.example .env          # then set JWT secrets and MONGODB_URI
pnpm dev:backend              # Fastify on :4000
pnpm dev:ricozviz             # Next.js on :3001
pnpm run check-types          # must report zero errors
```

MongoDB must be reachable at `MONGODB_URI`. The backend boots anyway when the
database is down (it logs a warning), so the frontend can still be developed
against offline/mock data.