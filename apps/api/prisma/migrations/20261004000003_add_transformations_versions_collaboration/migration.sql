-- ============================================================
-- RicozViz — Add Dataset Versioning, Transformations & Chart Sharing
-- Migration: 20261004000003_add_transformations_versions_collaboration
-- ============================================================

-- 1. AlterTable "datasets"
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "parentDatasetId" TEXT;
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "transformationSteps" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "datasets_parentDatasetId_idx" ON "datasets"("parentDatasetId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'datasets_parentDatasetId_fkey'
    ) THEN
        ALTER TABLE "datasets" ADD CONSTRAINT "datasets_parentDatasetId_fkey"
            FOREIGN KEY ("parentDatasetId") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 2. AlterTable "charts"
ALTER TABLE "charts" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "charts" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "charts" ADD COLUMN IF NOT EXISTS "shareTokenActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "charts" ADD COLUMN IF NOT EXISTS "sharedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "charts_shareToken_key" ON "charts"("shareToken");

-- 3. CreateTable "dataset_versions"
CREATE TABLE IF NOT EXISTS "dataset_versions" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeSummary" TEXT,
    "transformationConfig" JSONB NOT NULL DEFAULT '[]',
    "schemaSnapshot" JSONB NOT NULL DEFAULT '{}',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dataset_versions_datasetId_versionNumber_key" ON "dataset_versions"("datasetId", "versionNumber");
CREATE INDEX IF NOT EXISTS "dataset_versions_datasetId_idx" ON "dataset_versions"("datasetId");
CREATE INDEX IF NOT EXISTS "dataset_versions_createdById_idx" ON "dataset_versions"("createdById");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dataset_versions_datasetId_fkey'
    ) THEN
        ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_datasetId_fkey"
            FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dataset_versions_createdById_fkey'
    ) THEN
        ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
