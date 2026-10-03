-- ============================================================
-- RicozViz — Initial Database Migration
-- Migration: 20260929000001_initial_ricozviz_schema
-- Generated from: apps/api/prisma/schema.prisma
-- ============================================================
-- NOTE: This migration file was created manually because
-- Docker Desktop was not running at the time of schema creation.
-- When Docker Desktop is available, run:
--   docker compose up -d
--   cd apps/api && npx prisma migrate dev
-- Prisma will detect this file and apply it, or regenerate it
-- if the schema has changed since this was written.
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE "UserStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION'
);

CREATE TYPE "OrganizationStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

CREATE TYPE "MembershipStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'INVITED'
);

CREATE TYPE "DataSourceType" AS ENUM (
  'POSTGRESQL',
  'MYSQL',
  'SQLITE',
  'MONGODB',
  'REST_API',
  'CSV_UPLOAD',
  'GOOGLE_SHEETS',
  'BIGQUERY',
  'SNOWFLAKE',
  'REDSHIFT',
  'OTHER'
);

CREATE TYPE "DataSourceStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'ERROR',
  'PENDING'
);

CREATE TYPE "DatasetType" AS ENUM (
  'CONNECTED',
  'UPLOADED',
  'DERIVED'
);

CREATE TYPE "DatasetStatus" AS ENUM (
  'ACTIVE',
  'DRAFT',
  'ARCHIVED',
  'ERROR'
);

CREATE TYPE "DashboardStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE "DashboardVisibility" AS ENUM (
  'PRIVATE',
  'ORGANIZATION',
  'PUBLIC'
);

CREATE TYPE "ReportStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'ARCHIVED'
);

CREATE TYPE "ReportFormat" AS ENUM (
  'PDF',
  'CSV',
  'PNG',
  'EXCEL'
);

CREATE TYPE "DashboardAccessLevel" AS ENUM (
  'VIEW',
  'EDIT',
  'ADMIN'
);

-- ============================================================
-- TABLES
-- ============================================================

-- users
CREATE TABLE "users" (
  "id"           TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "avatarUrl"    TEXT,
  "status"       "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- organizations
CREATE TABLE "organizations" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "logoUrl"   TEXT,
  "status"    "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- roles
CREATE TABLE "roles" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- permissions
CREATE TABLE "permissions" (
  "id"          TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- role_permissions
CREATE TABLE "role_permissions" (
  "id"           TEXT NOT NULL,
  "roleId"       TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key"
  ON "role_permissions"("roleId", "permissionId");
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- organization_members
CREATE TABLE "organization_members" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "roleId"         TEXT NOT NULL,
  "status"         "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_members_userId_organizationId_key"
  ON "organization_members"("userId", "organizationId");
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");
CREATE INDEX "organization_members_roleId_idx" ON "organization_members"("roleId");

-- data_sources
CREATE TABLE "data_sources" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "type"           "DataSourceType" NOT NULL,
  "status"         "DataSourceStatus" NOT NULL DEFAULT 'PENDING',
  "connectionMeta" JSONB NOT NULL DEFAULT '{}',
  "credentialRef"  TEXT,
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_sources_organizationId_idx" ON "data_sources"("organizationId");
CREATE INDEX "data_sources_createdById_idx" ON "data_sources"("createdById");

-- datasets
CREATE TABLE "datasets" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "dataSourceId"   TEXT,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "type"           "DatasetType" NOT NULL,
  "status"         "DatasetStatus" NOT NULL DEFAULT 'DRAFT',
  "schemaMeta"     JSONB NOT NULL DEFAULT '{}',
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "datasets_organizationId_idx" ON "datasets"("organizationId");
CREATE INDEX "datasets_dataSourceId_idx" ON "datasets"("dataSourceId");
CREATE INDEX "datasets_createdById_idx" ON "datasets"("createdById");

-- dashboards
CREATE TABLE "dashboards" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "status"         "DashboardStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility"     "DashboardVisibility" NOT NULL DEFAULT 'PRIVATE',
  "ownerId"        TEXT NOT NULL,
  "layoutConfig"   JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dashboards_organizationId_idx" ON "dashboards"("organizationId");
CREATE INDEX "dashboards_ownerId_idx" ON "dashboards"("ownerId");
CREATE INDEX "dashboards_organizationId_status_idx" ON "dashboards"("organizationId", "status");

-- charts
CREATE TABLE "charts" (
  "id"          TEXT NOT NULL,
  "dashboardId" TEXT NOT NULL,
  "datasetId"   TEXT,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "chartType"   TEXT NOT NULL,
  "config"      JSONB NOT NULL DEFAULT '{}',
  "position"    JSONB NOT NULL DEFAULT '{}',
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "charts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "charts_dashboardId_idx" ON "charts"("dashboardId");
CREATE INDEX "charts_datasetId_idx" ON "charts"("datasetId");

-- dashboard_access
CREATE TABLE "dashboard_access" (
  "id"          TEXT NOT NULL,
  "dashboardId" TEXT NOT NULL,
  "userId"      TEXT,
  "roleId"      TEXT,
  "accessLevel" "DashboardAccessLevel" NOT NULL DEFAULT 'VIEW',
  "grantedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_access_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dashboard_access_dashboardId_idx" ON "dashboard_access"("dashboardId");
CREATE INDEX "dashboard_access_userId_idx" ON "dashboard_access"("userId");
CREATE INDEX "dashboard_access_roleId_idx" ON "dashboard_access"("roleId");

-- reports
CREATE TABLE "reports" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "dashboardId"    TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "status"         "ReportStatus" NOT NULL DEFAULT 'ACTIVE',
  "format"         "ReportFormat" NOT NULL DEFAULT 'PDF',
  "cronExpression" TEXT,
  "deliveryConfig" JSONB NOT NULL DEFAULT '{}',
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reports_organizationId_idx" ON "reports"("organizationId");
CREATE INDEX "reports_dashboardId_idx" ON "reports"("dashboardId");
CREATE INDEX "reports_createdById_idx" ON "reports"("createdById");

-- audit_logs
CREATE TABLE "audit_logs" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "action"         TEXT NOT NULL,
  "resourceType"   TEXT NOT NULL,
  "resourceId"     TEXT,
  "ipAddress"      TEXT,
  "userAgent"      TEXT,
  "metadata"       JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "role_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_members_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON UPDATE CASCADE;

ALTER TABLE "data_sources"
  ADD CONSTRAINT "data_sources_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "data_sources_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON UPDATE CASCADE;

ALTER TABLE "datasets"
  ADD CONSTRAINT "datasets_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "datasets_dataSourceId_fkey"
    FOREIGN KEY ("dataSourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "datasets_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON UPDATE CASCADE;

ALTER TABLE "dashboards"
  ADD CONSTRAINT "dashboards_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "dashboards_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON UPDATE CASCADE;

ALTER TABLE "charts"
  ADD CONSTRAINT "charts_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "charts_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dashboard_access"
  ADD CONSTRAINT "dashboard_access_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "dashboard_access_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "reports_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON UPDATE CASCADE,
  ADD CONSTRAINT "reports_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON UPDATE CASCADE,
  ADD CONSTRAINT "audit_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;
