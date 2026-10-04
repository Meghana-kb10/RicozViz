-- ============================================================
-- RicozViz — Add Templates, Export Center, Audit Scoping & Advanced RBAC
-- Migration: 20261004000002_add_templates_export_audit_rbac
-- Generated from: apps/api/prisma/schema.prisma
-- ============================================================

-- Expand WorkspaceRole enum
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'EDITOR';
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'VIEWER';

-- CreateEnum for Export Center
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'EXCEL', 'PDF', 'PNG');
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable "audit_logs"
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SUCCESS';

CREATE INDEX IF NOT EXISTS "audit_logs_workspaceId_idx" ON "audit_logs"("workspaceId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_workspaceId_fkey'
    ) THEN
        ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable "export_jobs"
CREATE TABLE IF NOT EXISTS "export_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceName" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'COMPLETED',
    "rowCount" INTEGER,
    "fileSize" INTEGER,
    "downloadUrl" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "export_jobs_organizationId_idx" ON "export_jobs"("organizationId");
CREATE INDEX IF NOT EXISTS "export_jobs_workspaceId_idx" ON "export_jobs"("workspaceId");
CREATE INDEX IF NOT EXISTS "export_jobs_userId_idx" ON "export_jobs"("userId");
CREATE INDEX IF NOT EXISTS "export_jobs_createdAt_idx" ON "export_jobs"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'export_jobs_organizationId_fkey'
    ) THEN
        ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'export_jobs_workspaceId_fkey'
    ) THEN
        ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'export_jobs_userId_fkey'
    ) THEN
        ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable "dashboard_templates"
CREATE TABLE IF NOT EXISTS "dashboard_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "layoutConfig" JSONB NOT NULL DEFAULT '{}',
    "chartsConfig" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dashboard_templates_organizationId_idx" ON "dashboard_templates"("organizationId");
CREATE INDEX IF NOT EXISTS "dashboard_templates_workspaceId_idx" ON "dashboard_templates"("workspaceId");
CREATE INDEX IF NOT EXISTS "dashboard_templates_category_idx" ON "dashboard_templates"("category");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_templates_organizationId_fkey'
    ) THEN
        ALTER TABLE "dashboard_templates" ADD CONSTRAINT "dashboard_templates_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_templates_workspaceId_fkey'
    ) THEN
        ALTER TABLE "dashboard_templates" ADD CONSTRAINT "dashboard_templates_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_templates_createdById_fkey'
    ) THEN
        ALTER TABLE "dashboard_templates" ADD CONSTRAINT "dashboard_templates_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
