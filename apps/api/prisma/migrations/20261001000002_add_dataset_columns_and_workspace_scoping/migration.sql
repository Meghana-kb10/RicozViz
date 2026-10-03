-- ============================================================
-- RicozViz — Add DatasetColumn Model and Workspace Scoping
-- Migration: 20261001000002_add_dataset_columns_and_workspace_scoping
-- ============================================================

-- CreateEnum
CREATE TYPE "DatasetColumnType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME');

-- AlterTable "data_sources"
ALTER TABLE "data_sources" ADD COLUMN "workspaceId" TEXT;

-- AlterTable "datasets"
ALTER TABLE "datasets" ADD COLUMN "workspaceId" TEXT;

-- CreateTable "dataset_columns"
CREATE TABLE "dataset_columns" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" "DatasetColumnType" NOT NULL DEFAULT 'STRING',
    "nullable" BOOLEAN NOT NULL DEFAULT true,
    "ordinalPosition" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_columns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_sources_workspaceId_idx" ON "data_sources"("workspaceId");

-- CreateIndex
CREATE INDEX "datasets_workspaceId_idx" ON "datasets"("workspaceId");

-- CreateIndex
CREATE INDEX "dataset_columns_datasetId_idx" ON "dataset_columns"("datasetId");

-- CreateIndex
CREATE INDEX "dataset_columns_datasetId_ordinalPosition_idx" ON "dataset_columns"("datasetId", "ordinalPosition");

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_columns" ADD CONSTRAINT "dataset_columns_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
