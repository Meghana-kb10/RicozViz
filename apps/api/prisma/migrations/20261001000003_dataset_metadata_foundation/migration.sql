-- ============================================================
-- RicozViz — Dataset Management Step 1: Metadata Foundation
-- Migration: 20261001000003_dataset_metadata_foundation
-- ============================================================

-- CreateEnum
CREATE TYPE "DatasetSourceType" AS ENUM ('CSV', 'XLSX', 'JSON');

-- AlterEnum
ALTER TYPE "DatasetStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "DatasetStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "DatasetStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- AlterTable
ALTER TABLE "datasets" ADD COLUMN "sourceType" "DatasetSourceType" DEFAULT 'CSV',
ADD COLUMN "fileName" TEXT,
ADD COLUMN "fileSize" INTEGER,
ADD COLUMN "rowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "columnCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "datasets" ALTER COLUMN "type" SET DEFAULT 'UPLOADED';
