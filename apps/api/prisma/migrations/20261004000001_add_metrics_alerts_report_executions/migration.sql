-- ============================================================
-- RicozViz — Add Metrics, Alerts, and Report Executions
-- Migration: 20261004000001_add_metrics_alerts_report_executions
-- Generated from: apps/api/prisma/schema.prisma
-- ============================================================

-- CreateEnum
CREATE TYPE "MetricFormat" AS ENUM ('NUMBER', 'CURRENCY', 'PERCENT');

-- CreateEnum
CREATE TYPE "MetricAggregation" AS ENUM ('SUM', 'AVG', 'COUNT', 'MIN', 'MAX');

-- CreateEnum
CREATE TYPE "AlertCondition" AS ENUM ('GREATER_THAN', 'LESS_THAN', 'EQUALS', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OK', 'TRIGGERED', 'PENDING');

-- CreateEnum
CREATE TYPE "ReportExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable "metrics"
CREATE TABLE IF NOT EXISTS "metrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "calculation" "MetricAggregation" NOT NULL DEFAULT 'SUM',
    "field" TEXT NOT NULL,
    "format" "MetricFormat" NOT NULL DEFAULT 'NUMBER',
    "targetValue" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable "alerts"
CREATE TABLE IF NOT EXISTS "alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "condition" "AlertCondition" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "lastEvaluatedAt" TIMESTAMP(3),
    "lastTriggeredAt" TIMESTAMP(3),
    "lastValue" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable "alert_history"
CREATE TABLE IF NOT EXISTS "alert_history" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable "report_executions"
CREATE TABLE IF NOT EXISTS "report_executions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "status" "ReportExecutionStatus" NOT NULL DEFAULT 'SUCCESS',
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "chartCount" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "metrics_organizationId_idx" ON "metrics"("organizationId");
CREATE INDEX IF NOT EXISTS "metrics_workspaceId_idx" ON "metrics"("workspaceId");
CREATE INDEX IF NOT EXISTS "metrics_datasetId_idx" ON "metrics"("datasetId");
CREATE INDEX IF NOT EXISTS "metrics_createdById_idx" ON "metrics"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "alerts_organizationId_idx" ON "alerts"("organizationId");
CREATE INDEX IF NOT EXISTS "alerts_workspaceId_idx" ON "alerts"("workspaceId");
CREATE INDEX IF NOT EXISTS "alerts_metricId_idx" ON "alerts"("metricId");
CREATE INDEX IF NOT EXISTS "alerts_createdById_idx" ON "alerts"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "alert_history_alertId_idx" ON "alert_history"("alertId");
CREATE INDEX IF NOT EXISTS "alert_history_triggeredAt_idx" ON "alert_history"("triggeredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "report_executions_reportId_idx" ON "report_executions"("reportId");
CREATE INDEX IF NOT EXISTS "report_executions_dashboardId_idx" ON "report_executions"("dashboardId");
CREATE INDEX IF NOT EXISTS "report_executions_executedAt_idx" ON "report_executions"("executedAt");

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
