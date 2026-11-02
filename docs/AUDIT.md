# RicozViz Architectural & Module Baseline Audit

**Audit Date**: November 2026  
**Environment**: Turborepo Monorepo (pnpm 10, TypeScript 5.8, Node.js 22, Next.js 15.5)  
**Verification Baseline**:
- `pnpm install`: Clean installation, 0 dependency conflicts.
- `pnpm run check-types`: **0 errors** across all 9 packages (`@repo/types`, `@repo/validation`, `@repo/utils`, `@repo/database`, `@repo/api`, `@repo/components`, `@repo/tailwind-config`, `apps/ricozviz-web-default`, `apps/backend`).
- `pnpm --filter backend test`: **4/4 test suites passed** (`response.test.ts`, `governance.test.ts`, `rls-simulator.test.ts`, `audit-preview.test.ts`).
- `pnpm run build`: **0 errors**, production bundles compiled cleanly for all applications and packages.

---

## 1. Executive Summary Table

| Module | Status | Gaps | File Paths |
| :--- | :--- | :--- | :--- |
| **`connectors`** | `partial` | • PostgreSQL (`pg`), MySQL (`mysql2`), SQLite (`better-sqlite3`), CSV/XLSX/JSON, and REST connectors are **real**.<br>• Enterprise cloud warehouses (Snowflake, BigQuery, ClickHouse, Databricks, Redshift, S3 Parquet) in `warehouse.connector.ts` are **mocked/simulated** with synthetic latency and dummy schemas.<br>• No real-time event streaming connectors (Kafka, Kinesis). | `apps/backend/src/modules/ricozviz/data-source/data-source.service.ts`<br>`apps/backend/src/modules/ricozviz/data-source/connectors/sql.connector.ts`<br>`apps/backend/src/modules/ricozviz/data-source/connectors/file.connector.ts`<br>`apps/backend/src/modules/ricozviz/data-source/connectors/rest.connector.ts`<br>`apps/backend/src/modules/ricozviz/data-source/connectors/warehouse.connector.ts` |
| **`datasets`** | `partial` | • Schema discovery, calculated fields AST compiler/evaluator, versioning, and Postgres pushdown are **real**.<br>• **DuckDB WASM / Arrow is completely absent**: Promoted across marketing copy and landing pages, but neither `duckdb` nor `@duckdb/duckdb-wasm` is installed in `package.json`. In-memory queries execute via a naive JavaScript array filter/reducer (`executeInMemoryQuery`).<br>• No partition pruning, distributed query plans, or large-volume pagination. | `apps/backend/src/modules/ricozviz/dataset/dataset.service.ts`<br>`apps/backend/src/modules/ricozviz/dataset/query-engine.ts`<br>`apps/backend/src/modules/ricozviz/dataset/calculated-field.engine.ts`<br>`apps/backend/src/modules/ricozviz/dataset/versioning.service.ts`<br>`apps/ricozviz-web-default/src/app/datasets/page.tsx` |
| **`blending`** | `partial` | • Real in-memory JavaScript hash join (`INNER` and `LEFT` joins) on sample rows with collision de-duplication (`_b`, `_b2`) and `DERIVED` lineage persistence.<br>• No `RIGHT` or `FULL OUTER` join operations.<br>• No federated SQL pushdown (cannot push joins down across remote database boundaries); bounded strictly by sample row memory limits. | `apps/backend/src/modules/ricozviz/dataset/dataset-blend.service.ts`<br>`apps/ricozviz-web-default/src/app/datasets/[id]/page.tsx` |
| **`visualizations`** | `real` | • Complete architecture supporting 14 chart forms (Bar, Line, Area, Pie, Donut, Scatter, Bubble, Radar, Funnel, Heatmap, Treemap, Gauge, KPI, Data Table).<br>• Fully wired Recharts & SVG renderers via `chart-query-mapper.ts`.<br>• Rule-based chart recommender evaluating cardinality and data types.<br>• Visualizations CRUD, public share token generation, and dashboard pinning are real.<br>• Minor gaps: High-performance WebGL rendering and geospatial GIS maps not implemented. | `apps/backend/src/modules/ricozviz/visualization/visualization.service.ts`<br>`apps/ricozviz-web-default/src/components/chart/ChartRenderer.tsx`<br>`apps/ricozviz-web-default/src/components/chart/chart-query-mapper.ts`<br>`apps/ricozviz-web-default/src/components/chart/chart-recommender.ts`<br>`apps/ricozviz-web-default/src/app/visualizations/page.tsx` |
| **`dashboards`** | `real` | • Full CRUD, dynamic multi-widget grid layouts, auto-refresh scheduling, point-in-time version snapshotting and diff restore (`apiCompareDashboardVersions`).<br>• Public share link generation and cryptographically signed HMAC iframe embed tokens.<br>• Minor gaps: Interactive cross-widget filtering (clicking a slice to filter sibling charts) is static. | `apps/backend/src/modules/ricozviz/dashboard/dashboard.service.ts`<br>`apps/ricozviz-web-default/src/app/dashboards/page.tsx`<br>`apps/ricozviz-web-default/src/app/dashboards/[id]/page.tsx`<br>`apps/ricozviz-web-default/src/app/dashboards/shared/[token]/page.tsx`<br>`apps/ricozviz-web-default/src/app/dashboards/embed/[token]/page.tsx` |
| **`NL-to-chart`** | `mocked` | • The endpoints `/api/v1/ai/ask`, `/api/v1/ai/nl-to-chart`, `/api/v1/ai/insights`, and `/api/v1/ai/dashboard-summary` do **not** invoke LLM inference (no OpenAI, Anthropic, or Gemini SDK calls).<br>• Uses regex and keyword pattern matching to return hardcoded template SQL queries and chart recommendations.<br>• No schema RAG, no context retrieval, no dynamic SQL generation. | `apps/backend/src/modules/ricozviz/ai/ai.service.ts`<br>`apps/backend/src/modules/ricozviz/ai/ai.controller.ts`<br>`apps/ricozviz-web-default/src/components/landing/InteractiveWorkbench.tsx`<br>`apps/ricozviz-web-default/src/components/landing/HeroBentoSection.tsx` |
| **`alerts`** | `partial` | • Metric threshold definitions, numerical comparisons (`GREATER_THAN`, `LESS_THAN`, `% increase`), alert lifecycle state machine (`OK` vs `TRIGGERED`), and scheduled evaluation runner (`scheduledAlertWorker`) are **real**.<br>• Outbound dispatch is **mocked**: Notifications do not connect to real SMTP, SendGrid, Twilio, Slack webhooks, or PagerDuty; triggers are logged only to MongoDB and backend console. | `apps/backend/src/modules/ricozviz/alert/alert.service.ts`<br>`apps/backend/src/modules/ricozviz/alert/alert.controller.ts`<br>`apps/backend/src/modules/ricozviz/alert/alert.scheduler.ts`<br>`apps/ricozviz-web-default/src/app/alerts/page.tsx` |
| **`exports`** | `partial` | • Real CSV generation and streaming download (`downloadCsv`), JSON dump generation, and recurring export cadence scheduler in database.<br>• Server-side PDF generation is absent (frontend relies on browser `window.print()` / html canvas).<br>• Scheduled email report delivery in `scheduledReportWorker` logs a simulated email message rather than transmitting real MIME emails via SMTP. | `apps/backend/src/modules/ricozviz/export/export.service.ts`<br>`apps/backend/src/modules/ricozviz/export/scheduled-report.worker.ts`<br>`apps/ricozviz-web-default/src/app/exports/page.tsx` |
| **`audit ledger`** | `real` | • Cryptographic WORM (Write-Once-Read-Many) append-only ledger using SHA-256 hash chains.<br>• Every audit event links previous block hash, sequence index, timestamp, and payload digest.<br>• Cryptographic verification (`verifyChainIntegrity`) validates tamper resistance.<br>• Multi-tenant tenantId scoping and token revocation events are cryptographically recorded. Verified by 5 passing unit tests. | `apps/backend/src/modules/ricozviz/audit/audit-preview.service.ts`<br>`apps/backend/src/modules/ricozviz/audit/audit-preview.controller.ts`<br>`apps/backend/src/modules/ricozviz/audit/audit-preview.test.ts`<br>`apps/ricozviz-web-default/src/app/audit/page.tsx` |
| **`RLS`** | `partial` | • Real SQL WHERE-clause rewrite in `rls.service.ts` injecting tenant and workspace boundaries.<br>• Column masking in `rls-simulator.ts` is an in-memory simulation tool for CISO compliance demonstrations, not enforced at the database proxy/storage level.<br>• SAML 2.0 / SCIM badge attestations in CISO overview are metadata badges; no actual SAML IdP SP metadata endpoints or SCIM 2.0 REST endpoints exist (system uses JWT + password). | `apps/backend/src/modules/ricozviz/dataset/rls.service.ts`<br>`apps/backend/src/modules/ricozviz/governance/governance.service.ts`<br>`apps/backend/src/modules/ricozviz/governance/rls-simulator.ts`<br>`apps/ricozviz-web-default/src/app/security/page.tsx`<br>`apps/ricozviz-web-default/src/components/shell/SecurityGovernanceBadges.tsx` |
| **`presence`** | `partial` | • Heartbeat polling via REST API (`POST /api/v1/collaboration/presence`) with in-memory TTL expiration and active collaborator listing.<br>• Not real-time WebSockets or Server-Sent Events (SSE); clients poll on interval.<br>• Landing page multiplayer canvas (`CollaborativeMultiplayerCanvas.tsx`) runs a pre-scripted CSS animation loop rather than broadcasting live cursor data. | `apps/backend/src/modules/ricozviz/collaboration/collaboration.service.ts`<br>`apps/backend/src/modules/ricozviz/collaboration/collaboration.controller.ts`<br>`apps/ricozviz-web-default/src/components/landing/CollaborativeMultiplayerCanvas.tsx` |

---

## 2. In-Depth Technical Deep-Dives & Gaps

### 2.1 Connectors (`apps/backend/src/modules/ricozviz/data-source/`)
- **Operational Reality**: PostgreSQL (`sql.connector.ts`), MySQL (`sql.connector.ts`), SQLite (`sql.connector.ts`), and local flat-file parsers (`file.connector.ts`) use actual database driver libraries (`pg`, `mysql2/promise`, `better-sqlite3`, `csv-parser`, `xlsx`). They connect to live databases, run real schema discovery queries (`information_schema.tables`, `information_schema.columns`, `SHOW FULL TABLES`), and fetch live records.
- **Critical Gap**: In `warehouse.connector.ts`, the connectors for Snowflake, ClickHouse, Google BigQuery, Databricks, Amazon Redshift, and S3 Parquet are **pure simulation mocks**. They validate configuration fields and return hardcoded mock responses:
  ```typescript
  // warehouse.connector.ts line 66
  return {
    status: 'CONNECTED',
    serverVersion: 'ClickHouse 24.3.1.2672-cloud',
    sslCipher: 'TLS_AES_256_GCM_SHA384 (TLSv1.3)',
  };
  ```
  Schema discovery for warehouses falls back to synthetic tables `[{ name: 'dataset_table' }]` and dummy columns `[{ name: 'id', type: 'VARCHAR' }]`.
- **Recommendation**: To make warehouses real, install and integrate official cloud drivers (`@clickhouse/client`, `@google-cloud/bigquery`, `snowflake-sdk`) or route queries through an external query proxy.

---

### 2.2 Datasets & DuckDB WASM Claim (`apps/backend/src/modules/ricozviz/dataset/`)
- **Operational Reality**: CRUD operations, MongoDB persistence, schema definitions, calculated field compilation (via custom AST parsing in `calculated-field.engine.ts`), and dataset version snapshotting are real. PostgreSQL queries are pushed down to PostgreSQL when `dataSource.type === 'POSTGRES'`.
- **Critical Gap**: **The "DuckDB In-Memory OLAP Engine" is a marketing myth in this codebase.** Neither `duckdb` nor `@duckdb/duckdb-wasm` or `apache-arrow` is present in any `package.json`. In-memory queries against uploaded CSVs or files fall back to `executeInMemoryQuery` in `query-engine.ts`, which uses standard JavaScript `.filter()`, `.reduce()`, and `.sort()` on arrays in Node memory:
  ```typescript
  // query-engine.ts lines 240-270
  // Rudimentary in-memory array filtering
  let filtered = [...sampleData];
  for (const filter of query.filters) { ... }
  ```
- **Recommendation**: Install `@duckdb/duckdb-wasm` in `apps/ricozviz-web-default` for browser-side fast Parquet/Arrow execution, or install native `duckdb` in `apps/backend` to deliver actual sub-second vectorized OLAP performance.

---

### 2.3 Dataset Blending (`apps/backend/src/modules/ricozviz/dataset/dataset-blend.service.ts`)
- **Operational Reality**: The backend implements an in-memory hash join algorithm (`executeInMemoryJoin`) for `INNER` and `LEFT` joins on datasets' sample records. It handles column name collision renaming (`_b`, `_b2`) and persists the resulting joined schema as a `DERIVED` dataset in MongoDB.
- **Critical Gap**:
  1. Only `INNER` and `LEFT` joins are implemented; `RIGHT` and `FULL_OUTER` throw `400 Bad Request`.
  2. Join execution is restricted to the preview/sample rows stored in MongoDB (up to 500 rows). It cannot execute federated joins across large tables or push SQL queries down to underlying databases.

---

### 2.4 Visualizations (`apps/backend/src/modules/ricozviz/visualization/`)
- **Operational Reality**: Visualization state management, persistence, and rendering are **fully real**. 14 chart architectures are supported:
  - Bar, Line, Area, Pie, Donut, Scatter, Bubble, Radar, Funnel, Heatmap, Treemap, Gauge, KPI, Data Table.
  - `chart-query-mapper.ts` transforms raw dataset rows into Recharts-compatible structures and handles color palettes (`#ff6b35` coral obsidian palette).
  - `chart-recommender.ts` inspects column metadata, distinct counts, and metrics to recommend optimal visualizations.
  - Public tokenized sharing and dashboard pin mutations are real.

---

### 2.5 Dashboards (`apps/backend/src/modules/ricozviz/dashboard/`)
- **Operational Reality**: Full dashboard lifecycle is **real**.
  - Dashboards can be created, updated, pinned, and deleted.
  - Layout coordinates `(x, y, w, h)` are persisted.
  - Point-in-time version snapshotting diffing (`apiCompareDashboardVersions`) and rollback (`apiRestoreDashboardVersion`) are real.
  - Signed iframe embeds use HMAC cryptographic token verification.

---

### 2.6 NL-to-Chart AI (`apps/backend/src/modules/ricozviz/ai/`)
- **Operational Reality**: The AI service (`ai.service.ts`) is **completely mocked with heuristic keyword matching**:
  ```typescript
  // ai.service.ts
  if (/churn|attrition/i.test(prompt)) {
    return {
      sql: 'SELECT cohort_month, churn_rate FROM subscription_cohorts ...',
      chartType: 'LINE',
      confidence: 0.94
    };
  }
  ```
  No LLM API keys (OpenAI, Gemini, Claude) are called. It provides an immediate interactive frontend illusion, but cannot interpret arbitrary natural language queries against user schemas.
- **Recommendation**: Integrate the Google Gemini API (`@google/genai` or `@google/generative-ai`) with structured JSON schema outputs to parse database schemas and generate actual SQL and chart configurations.

---

### 2.7 Metric Alerts (`apps/backend/src/modules/ricozviz/alert/`)
- **Operational Reality**: CRUD for alert configurations, threshold parsing (`GREATER_THAN`, `LESS_THAN`, `% change`), and interval evaluation against dataset metrics in `scheduledAlertWorker` are real.
- **Critical Gap**: When an alert fires, it triggers a log event and writes to MongoDB, but does not dispatch real emails or webhooks (missing SMTP/SendGrid/Slack integrations).

---

### 2.8 Exports & Reporting (`apps/backend/src/modules/ricozviz/export/`)
- **Operational Reality**: Streaming CSV generation (`downloadCsv`) and JSON file downloads are real.
- **Critical Gap**: PDF export relies exclusively on client-side browser print dialogues (`window.print()`). Backend lacks a headless Chromium renderer (Puppeteer / Playwright). Scheduled email delivery is a logged simulation.

---

### 2.9 Cryptographic Audit Ledger (`apps/backend/src/modules/ricozviz/audit/`)
- **Operational Reality**: Fully **real** and verified by automated unit tests (`audit-preview.test.ts`).
  - Implements SHA-256 hash chaining: `hash = SHA256(index + timestamp + prevHash + tenantId + payloadHash)`.
  - Integrity verification function `verifyChainIntegrity` checks every block link and flags tampering.
  - Immutable WORM architecture ensures multi-tenant compliance logs are cryptographically verifiable.

---

### 2.10 Row-Level Security (RLS) & Governance
- **Operational Reality**: Tenant isolation in `rls.service.ts` rewrites SQL queries to enforce tenant boundaries.
- **Critical Gap**:
  - `rls-simulator.ts` runs in-memory column masking demonstrations for CISO compliance previews; it does not install database-native RLS policies (e.g. Postgres `CREATE POLICY`).
  - SAML 2.0 / SCIM federations advertised in the security badges are compliance documentation cards rather than an active SAML SSO endpoint.

---

### 2.11 Collaboration & Presence (`apps/backend/src/modules/ricozviz/collaboration/`)
- **Operational Reality**: REST polling endpoint `/api/v1/collaboration/presence` stores active user cursors in an in-memory map with a 30-second TTL.
- **Critical Gap**: No WebSocket / SSE server. Clients must poll to receive updates. Interactive landing page cursors are pre-recorded CSS keyframe simulations.

---

## 3. Auth UI & Layout Enhancements Completed

In response to production UI feedback and zero-trust authentication compliance:
1. **Removed Non-Functional SAML SSO Tab**: Removed the SAML 2.0 / SSO tab from `/login` to eliminate false claims of active SAML IdP endpoints.
2. **Removed Demo Pre-Fill Button**: Removed the "Demo tenant: Pre-fill demo credentials" shortcut to ensure production-grade security posture.
3. **Eliminated Mobile Text Clipping in Natural Language AI Card**: Fixed button chip layout in `HeroBentoSection.tsx` so prompt tags and action badges scale responsively on all viewports without truncation or horizontal bleeding.

---

## 4. Prioritized Engineering Roadmap for Real Implementations

1. **Phase 2 — Real DuckDB Integration**:
   - Install `duckdb` (native backend) and `@duckdb/duckdb-wasm` (browser web-worker).
   - Route CSV/Parquet uploads directly into DuckDB tables for true sub-second vectorized analytics.
2. **Phase 3 — Real LLM NL-to-Chart**:
   - Connect Google Gemini 2.0 Flash / Pro API with structured output schema (`type: OBJECT`) to translate user prompts and schema catalogs into real SQL + visualization types.
3. **Phase 4 — Real Outbound Transports**:
   - Implement Nodemailer / SendGrid SMTP for alerts and scheduled exports.
   - Implement outgoing Webhooks for Slack / PagerDuty integrations.
4. **Phase 5 — Real-Time Collaboration**:
   - Replace REST polling with Fastify `@fastify/websocket` for sub-50ms multiplayer cursor and dashboard presence.
