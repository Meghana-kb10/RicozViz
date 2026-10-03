-- ============================================================
-- RicozViz — Add Dashboard Share Fields
-- Migration: 20261002000001_add_dashboard_share_fields
-- Generated from: apps/api/prisma/schema.prisma
-- ============================================================

-- AlterTable "dashboards"
ALTER TABLE "dashboards" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "dashboards" ADD COLUMN IF NOT EXISTS "shareTokenActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dashboards" ADD COLUMN IF NOT EXISTS "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "dashboards_shareToken_key" ON "dashboards"("shareToken");
