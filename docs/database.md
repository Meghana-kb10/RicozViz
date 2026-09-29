# RicozViz — Database Architecture

> **Step:** Day 1, Step 3  
> **Database:** PostgreSQL 16  
> **ORM:** Prisma 5  
> **Schema file:** [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)

---

## 1. Purpose

The RicozViz database stores all persistent application data for an enterprise multi-tenant analytics platform. It is designed to support:

- Isolated multi-tenant organizations
- Fine-grained role-based access control
- Enterprise data source and dataset management
- Dashboard and chart configuration storage
- Governed publishing and sharing
- Scheduled report management
- Immutable audit logging for compliance

---

## 2. Main Entities

| Model | Table | Purpose |
|---|---|---|
| `User` | `users` | Registered platform users |
| `Organization` | `organizations` | Tenant organizations |
| `OrganizationMember` | `organization_members` | User ↔ Org ↔ Role junction |
| `Role` | `roles` | Named permission groups (ADMIN, ANALYST, BUSINESS_USER) |
| `Permission` | `permissions` | Granular action capabilities |
| `RolePermission` | `role_permissions` | Role ↔ Permission many-to-many |
| `DataSource` | `data_sources` | Configured database/API connections |
| `Dataset` | `datasets` | Named data views / uploaded files |
| `Dashboard` | `dashboards` | Dashboard containers |
| `Chart` | `charts` | Individual visualization widgets |
| `DashboardAccess` | `dashboard_access` | Per-user or per-role sharing grants |
| `Report` | `reports` | Scheduled/on-demand report definitions |
| `AuditLog` | `audit_logs` | Immutable governance log |

---

## 3. Entity Relationship Diagram

```
Organization
├── OrganizationMembers
│   ├── User
│   │   ├── ownedDashboards
│   │   ├── createdDataSources
│   │   ├── createdDatasets
│   │   ├── createdReports
│   │   ├── dashboardAccess
│   │   └── auditLogs
│   └── Role
│       └── RolePermissions
│           └── Permission
│
├── DataSources
│   └── Datasets
│       └── Charts (via dashboardId + datasetId)
│
├── Dashboards
│   ├── Charts
│   │   └── Dataset (optional reference)
│   ├── DashboardAccess
│   │   ├── User (userId)
│   │   └── Role (roleId)
│   └── Reports
│
├── Reports
│
└── AuditLogs
```

---

## 4. Detailed Relationships

### User
- Has many `OrganizationMember` records (supports multi-org in the future)
- Owns many `Dashboard` records
- Creates many `DataSource`, `Dataset`, `Report` records
- Has many `DashboardAccess` grants
- Generates many `AuditLog` entries

### Organization
- Has many `OrganizationMember` records (each linking a User + Role)
- Owns many `DataSource`, `Dataset`, `Dashboard`, `Report`, `AuditLog` records
- **All resource queries must be scoped to `organizationId`** (multi-tenancy enforcement)

### Role ↔ Permission
- Many-to-many via `RolePermission` join table
- Compound unique constraint: `(roleId, permissionId)`
- Cascade delete: deleting a role or permission removes all join rows

### OrganizationMember
- Compound unique constraint: `(userId, organizationId)` — one active role per org per user
- Cascade delete: removing user or organization removes membership

### DataSource
- Belongs to one `Organization`
- Has many `Dataset` records
- `connectionMeta` (JSON): stores host, port, db name, schema, SSL mode — **no secrets**
- `credentialRef` (String?): opaque pointer to external secrets vault

### Dataset
- Belongs to one `Organization`
- Optionally references one `DataSource` (NULL for uploaded/file-based datasets)
- `schemaMeta` (JSON): column names, types, row count snapshot
- Has many `Chart` references

### Dashboard
- Belongs to one `Organization`
- Has one `owner` (User)
- Has many `Chart` records (deleted on dashboard delete)
- Has many `DashboardAccess` grants
- `layoutConfig` (JSON): grid configuration

### Chart
- Belongs to one `Dashboard` (cascade delete)
- Optionally references one `Dataset` (set NULL on dataset delete)
- `config` (JSON): full visualization specification (axes, filters, colors, aggregations)
- `position` (JSON): grid layout coordinates `{x, y, w, h}`

### DashboardAccess
- Grants VIEW/EDIT/ADMIN access to either a **User** or a **Role**
- Application layer enforces: `userId` XOR `roleId` must be non-null

### Report
- Belongs to one `Organization` and one `Dashboard`
- `cronExpression`: standard 5-field cron (NULL = on-demand)
- `deliveryConfig` (JSON): recipients, webhook URL, etc.

### AuditLog
- Append-only — never updated or deleted
- `action`: verb-noun string e.g. `"DASHBOARD_PUBLISHED"`
- `resourceType` + `resourceId`: identifies the affected entity
- `metadata` (JSON): extra context (old/new values, etc.)

---

## 5. Multi-Tenancy Design

RicozViz uses a **shared database, shared schema** multi-tenancy model with row-level isolation enforced by the application layer.

### How it works

Every organization-owned resource carries an `organizationId` foreign key:

```
DataSource.organizationId  → Organization.id
Dataset.organizationId     → Organization.id
Dashboard.organizationId   → Organization.id
Report.organizationId      → Organization.id
AuditLog.organizationId    → Organization.id
```

### Enforcement (future — Day 1 Step 4+)

Every API query will be scoped with an organization filter derived from the authenticated user's membership:

```typescript
// Example of what will be enforced at the service layer:
const dashboards = await prisma.dashboard.findMany({
  where: {
    organizationId: currentUser.organizationId, // Enforced always
    status: "PUBLISHED",
  },
});
```

### Isolation guarantee

- Organization A users **cannot** query Organization B resources
- The `organizationId` index on every resource table makes these queries fast
- `AuditLog` also carries `organizationId` for compliance scoping

---

## 6. Security Considerations

### Passwords
- `User.passwordHash` stores only the **hashed** password (bcrypt/argon2 — to be implemented in authentication step)
- Plaintext passwords are **never stored**

### Data Source Credentials
- `DataSource.connectionMeta` stores only **non-secret** connection metadata (host, port, db name)
- Actual credentials (passwords, API keys, tokens) are **never stored in the database**
- `DataSource.credentialRef` is a future opaque pointer to an external secrets vault (AWS Secrets Manager, HashiCorp Vault, etc.)

### Audit Trail
- `AuditLog` is append-only — no UPDATE or DELETE operations
- Stores IP address and user agent for forensic analysis

### Soft Deletion
- Resources use `status` enums (`ARCHIVED`, `INACTIVE`) rather than hard deletes where appropriate
- Hard deletes cascade correctly (e.g., deleting a Dashboard cascades to its Charts and Access grants)

---

## 7. Enums Reference

| Enum | Values |
|---|---|
| `UserStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_VERIFICATION` |
| `OrganizationStatus` | `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| `MembershipStatus` | `ACTIVE`, `INACTIVE`, `INVITED` |
| `DataSourceType` | `POSTGRESQL`, `MYSQL`, `MONGODB`, `REST_API`, `CSV_UPLOAD`, `BIGQUERY`, `SNOWFLAKE`, `REDSHIFT`, `OTHER`, ... |
| `DataSourceStatus` | `ACTIVE`, `INACTIVE`, `ERROR`, `PENDING` |
| `DatasetType` | `CONNECTED`, `UPLOADED`, `DERIVED` |
| `DatasetStatus` | `ACTIVE`, `DRAFT`, `ARCHIVED`, `ERROR` |
| `DashboardStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `DashboardVisibility` | `PRIVATE`, `ORGANIZATION`, `PUBLIC` |
| `ReportStatus` | `ACTIVE`, `PAUSED`, `ARCHIVED` |
| `ReportFormat` | `PDF`, `CSV`, `PNG`, `EXCEL` |
| `DashboardAccessLevel` | `VIEW`, `EDIT`, `ADMIN` |

---

## 8. Indexes

| Table | Index | Purpose |
|---|---|---|
| `users` | `email` (unique) | Login lookup |
| `organizations` | `slug` (unique) | URL-friendly org identifier |
| `organization_members` | `(userId, organizationId)` (unique) | One membership per user per org |
| `organization_members` | `organizationId`, `userId`, `roleId` | Membership queries |
| `role_permissions` | `(roleId, permissionId)` (unique) | Prevent duplicate grants |
| `role_permissions` | `roleId`, `permissionId` | Permission lookup by role |
| `data_sources` | `organizationId`, `createdById` | Org-scoped listing |
| `datasets` | `organizationId`, `dataSourceId`, `createdById` | Org/source-scoped listing |
| `dashboards` | `organizationId`, `ownerId` | Org-scoped listing |
| `dashboards` | `(organizationId, status)` | Published dashboard filtering |
| `charts` | `dashboardId`, `datasetId` | Dashboard chart loading |
| `dashboard_access` | `dashboardId`, `userId`, `roleId` | Access control lookups |
| `reports` | `organizationId`, `dashboardId`, `createdById` | Org-scoped listing |
| `audit_logs` | `organizationId`, `userId`, `createdAt` | Governance queries |
| `audit_logs` | `(organizationId, createdAt)` | Time-range compliance queries |
| `audit_logs` | `(resourceType, resourceId)` | Per-resource audit trail |

---

## 9. Migration Commands

```bash
# From repo root:

# 1. Generate Prisma client after schema changes
npm run db:generate

# 2. Create and apply a development migration
npm run db:migrate
# Prompts for migration name — use: initial_ricozviz_schema

# 3. Deploy migrations in production (no interactive prompt)
cd apps/api && npm run db:migrate:deploy

# 4. Push schema without creating migration files (dev shortcut)
npm run db:push

# 5. Open Prisma Studio (database GUI)
cd apps/api && npm run db:studio
```

---

## 10. Seed Commands

```bash
# From repo root:
cd apps/api && npx prisma db seed

# OR add to package.json scripts and run:
npm run db:seed --workspace=apps/api
```

Seed inserts:
- **3 system roles:** ADMIN, ANALYST, BUSINESS_USER
- **21 permissions:** full permission set
- **Role-permission assignments:** ADMIN (all), ANALYST (data/dashboard), BUSINESS_USER (view-only)

The seed is **idempotent** — safe to run multiple times via `upsert`.
