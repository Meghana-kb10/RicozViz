# RicozViz Admin Application - Feature Backlog & Operator Capabilities

> This document catalogs all platform-operator, cross-tenant governance, background worker orchestration, and system-level administrative features trimmed from the customer-facing application (`apps/ricozviz-customer`). These capabilities form the core architectural backlog for the dedicated operator portal (`apps/ricozviz-admin`).

---

## 1. Executive Overview & Boundaries

The customer application (`apps/ricozviz-customer`) is strictly scoped to single-workspace user operations: building dashboards, querying datasets, configuring alerts, creating exports, and managing workspace collaborators.

The platform operator portal (`apps/ricozviz-admin`) governs the entire RicozViz ecosystem across all tenants, background processes, compliance audits, and data engine infrastructure.

| Domain | Customer App Scope (`apps/ricozviz-customer`) | Operator Admin Scope (`apps/ricozviz-admin`) |
| :--- | :--- | :--- |
| **Audit Ledger** | Scoped to caller's active `workspaceId` (tabular view) | Cross-tenant immutable WORM ledger, block verification, global session monitoring |
| **Tenancy** | Switch between authorized workspaces | Global tenant onboarding, plan tiers, workspace quotas, tenant isolation audit |
| **Background Daemons** | Configures scheduled exports / alert thresholds | Worker daemon monitoring, distributed lock status, job retries, dead-letter inspect |
| **Security Governance** | Workspace role assignments (Viewer, Editor, Admin) | Cryptographic token revocation, dynamic RLS simulation, CISO dossier generator |
| **Query Engine** | DuckDB queries on workspace datasets | Direct Query IDE, DuckDB WASM benchmark diagnostics, engine cluster health |

---

## 2. Operator Features & Candidate Modules

### A. Multi-Tenant WORM Audit Ledger & Global Session Presence
- **Source Component**: `MultiTenantAuditTrailMockup.tsx` (previously in customer audit preview mode)
- **Target Route**: `apps/ricozviz-admin/src/app/audit/page.tsx`
- **Capabilities**:
  - **Cross-Organization Stream**: Real-time inspection of append-only SHA-256 hash chains spanning all organizations (`org_acme_corp`, `org_apex_fintech`, etc.).
  - **Active Session Presence**: Cross-tenant tracking of authenticated users, active workspace contexts, user agents, IP addresses, and session lifespans.
  - **Emergency Cryptographic Revocation**: Instant revocation of access tokens across any tenant or user ID with immutable WORM audit log entry (`TOKEN_REVOCATION` block).
  - **Cryptographic Chain Verification**: End-to-end cryptographic verification (`verifyChainIntegrity`) scanning hash continuity from genesis block to current block height.
- **Backend Endpoints**:
  - `GET /api/v1/audit/preview` (`apiGetAuditTrailPreview`)
  - `POST /api/v1/audit/revoke` (`apiRevokeToken`)
  - `POST /api/v1/audit/verify` (`apiVerifyLedgerChain`)

### B. Background Worker Orchestration & Distributed Lease Monitoring
- **Target Route**: `apps/ricozviz-admin/src/app/workers/page.tsx`
- **Capabilities**:
  - **Distributed Lock Inspector**: Real-time view of `WorkerLockModel` MongoDB leases (`jobName`, `owner` instance ID, `expiresAt`, `acquiredAt`).
  - **Job Execution History**: 30-day retention query table from `WorkerRunModel` (`jobName`, `startedAt`, `finishedAt`, `status`: `RUNNING` / `SUCCESS` / `FAILED` / `SKIPPED`, `itemsProcessed`, `durationMs`, `error`).
  - **Manual Job Dispatch**: Operator button to trigger on-demand execution of `scheduledRefreshWorker`, `scheduledAlertWorker`, or `scheduledReportWorker`.
  - **Worker Daemon Health Heartbeat**: Health check pinging active worker process instances.
- **Backend Endpoints / Service APIs**:
  - `GET /api/v1/admin/workers/runs` (`apiListWorkerRuns`)
  - `POST /api/v1/admin/workers/trigger` (`apiTriggerWorkerJob`)
  - `GET /api/v1/admin/workers/health` (`apiGetWorkerHealth`)

### C. Dedicated RLS Governance & Policy Simulation Engine
- **Source Component**: `DedicatedRlsGovernanceBlock.tsx`
- **Target Route**: `apps/ricozviz-admin/src/app/security/rls/page.tsx`
- **Capabilities**:
  - **Interactive Tenancy Simulation**: Interactive toggle switching between simulated tenant scopes (`US_EAST_FINANCE`, `EU_CENTRAL_HEALTHCARE`, `APAC_OPERATIONS`) to preview query engine SQL WHERE-clause rewrites.
  - **Dynamic Column Masking**: Live evaluation of column masking transformations (e.g. `mask_revenue_eur`, `anonymize_ssn`, `sha256_customer_id`).
  - **Zero-Storage Rebuild Audit**: Visual proof of how data masking is executed at query time without mutating underlying Parquet or DuckDB storage tables.
- **Backend Endpoints**:
  - `GET /api/v1/governance/rls-policies` (`apiGetRlsPolicies`)
  - `POST /api/v1/governance/simulate-rls` (`apiSimulateRls`)

### D. Platform Query IDE & Live Performance Benchmark
- **Source Component**: `QueryIdeWindow.tsx`
- **Target Route**: `apps/ricozviz-admin/src/app/system/ide/page.tsx`
- **Capabilities**:
  - **Operator Query Workbench**: Multi-tab SQL query editor with syntax highlighting, line numbers, autocomplete, and DuckDB dialect support.
  - **Execution Profiler**: Microsecond execution telemetry, vectorized chunk counters, and DuckDB plan visualization.
  - **Benchmark Suite**: One-click synthetic benchmark running analytical aggregations across 100k, 1M, and 10M rows to measure system throughput.

### E. Enterprise Security Governance & CISO Accreditations
- **Source Component**: `SecurityGovernanceBadges.tsx`
- **Target Route**: `apps/ricozviz-admin/src/app/security/compliance/page.tsx`
- **Capabilities**:
  - **Compliance Badges**: Auditing and badge attestation for SOC-2 Type II, HIPAA BAA readiness, GDPR Right-to-be-Forgotten, and ISO 27001.
  - **CISO Trust Dossier Generator**: One-click export of system posture, cryptographic ledger health, and encryption-at-rest verification reports.
- **Backend Endpoints**:
  - `GET /api/v1/governance/badges` (`apiGetGovernanceBadges`)
  - `GET /api/v1/governance/ciso-trust-pack` (`apiGetCisoTrustPack`)

### F. Global Tenant & Workspace Administration
- **Target Route**: `apps/ricozviz-admin/src/app/tenants/page.tsx`
- **Capabilities**:
  - **Tenant Provisioning**: Onboard new client enterprises, assign dedicated workspace clusters, and configure default storage connectors.
  - **Resource Quotas**: Set and monitor limits for dataset row counts, DuckDB memory ceilings, concurrent WebSocket presence connections, and scheduled report limits.
  - **Cross-Tenant Access Audit**: Verification dashboard ensuring strict zero-cross-tenant data leakage.

### G. System Terminal & Developer Console
- **Source Component**: `TerminalQuickstartSnippet.tsx`
- **Target Route**: `apps/ricozviz-admin/src/app/system/terminal/page.tsx`
- **Capabilities**:
  - CLI quickstart command generator, API token issuance for headless agents, and SDK installation snippets.

---

## 3. Implementation Plan for `apps/ricozviz-admin`

When instructed to initialize `apps/ricozviz-admin`:
1. Clone `apps/next-default` or copy `apps/ricozviz-customer` skeleton (retaining obsidian + coral palette).
2. Configure port `3002` (`"dev": "next dev --port 3002"`).
3. Set session cookie to `rv_admin_session`.
4. Import shared UI primitives from `@repo/components` (`BrandLogo`, `StatCard`, `StatusBadge`, `DataTable`).
5. Import API methods from `@repo/api` (including worker endpoints `apiListWorkerRuns`, `apiTriggerWorkerJob`, and audit preview endpoints).
