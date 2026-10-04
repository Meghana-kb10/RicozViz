// ============================================================
// Scheduled Report Background Worker
// ============================================================
// Periodically polls for active dashboard report schedules whose
// nextRunAt is due. Reuses the existing report generation engine
// and dispatches via ReportDeliveryDispatcher.
// Prevents duplicate concurrent execution with mutex locking.
// ============================================================

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { generateDashboardReportSnapshot } from "../dashboard/dashboard.service.js";
import { reportDeliveryDispatcher } from "./report-delivery.dispatcher.js";

export interface ScheduledReportRunResult {
  reportId: string;
  dashboardId: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  deliveryStatus?: "SUCCESS" | "FAILED";
  nextRunAt?: string;
  error?: string;
  durationMs?: number;
}

export interface WorkerPollSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  runs: ScheduledReportRunResult[];
}

export class ScheduledReportWorker {
  private activeJobIds = new Set<string>();
  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Starts the background poll loop with a configurable interval (default 60s).
   * Unrefs the timer so it does not block Node event loop during shutdown.
   */
  start(pollIntervalMs = 60_000): void {
    if (this.pollTimer) {
      return;
    }

    logger.info(`[ReportWorker] Background scheduled report worker started`, {
      intervalMs: pollIntervalMs,
    });

    this.pollTimer = setInterval(() => {
      void this.executeDueReports().catch((err) => {
        logger.error("[ReportWorker] Unhandled error during report poll cycle", {
          error: err.message,
        });
      });
    }, pollIntervalMs);

    // Unref timer so process can exit cleanly
    if (typeof this.pollTimer.unref === "function") {
      this.pollTimer.unref();
    }
  }

  /**
   * Stops the background poll loop cleanly.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      logger.info("[ReportWorker] Background scheduled report worker stopped");
    }
  }

  /**
   * Check if a specific report is currently undergoing generation/delivery.
   */
  isJobRunning(reportId: string): boolean {
    return this.activeJobIds.has(reportId);
  }

  /**
   * Calculates the next execution timestamp based on frequency.
   */
  calculateNextRunAt(frequency: string, baseDate = new Date()): Date {
    const norm = String(frequency || "DAILY").toUpperCase();
    if (norm === "WEEKLY") {
      return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    if (norm === "MONTHLY") {
      return new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    // Default DAILY: +24h
    return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  }

  /**
   * Scans active reports and runs due schedules.
   * Can be called manually by test suites or on-demand triggers.
   */
  async executeDueReports(now = new Date()): Promise<WorkerPollSummary> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0, skipped: 0, runs: [] };
    }

    this.isProcessing = true;
    const runs: ScheduledReportRunResult[] = [];

    try {
      // Find active reports
      const activeReports = await prisma.report.findMany({
        where: {
          status: "ACTIVE",
        },
      });

      for (const report of activeReports) {
        const delivery = (report.deliveryConfig || {}) as Record<string, any>;

        // If explicitly disabled in delivery config, skip
        if (delivery.enabled === false) {
          continue;
        }

        const nextRunAtStr = delivery.nextRunAt as string | undefined;
        if (nextRunAtStr) {
          const nextRunAt = new Date(nextRunAtStr);
          // If not due yet, skip
          if (nextRunAt.getTime() > now.getTime()) {
            continue;
          }
        }

        // Duplicate execution prevention: check if job is already in flight
        if (this.activeJobIds.has(report.id)) {
          runs.push({
            reportId: report.id,
            dashboardId: report.dashboardId,
            status: "SKIPPED",
            error: "Job already executing (duplicate prevented)",
          });
          continue;
        }

        // Acquire in-memory lock
        this.activeJobIds.add(report.id);
        const jobStartTime = Date.now();

        try {
          logger.info(`[ReportWorker] Executing scheduled report`, {
            reportId: report.id,
            dashboardId: report.dashboardId,
            name: report.name,
          });

          // 1. Generate dashboard snapshot using existing query engine
          const snapshot = await generateDashboardReportSnapshot(
            report.dashboardId,
            report.organizationId
          );

          // 2. Dispatch delivery via delivery dispatcher
          const deliverySummary = await reportDeliveryDispatcher.dispatch({
            reportId: report.id,
            dashboardId: report.dashboardId,
            dashboardName: snapshot.dashboardName,
            organizationId: report.organizationId,
            deliveryConfig: {
              recipients: Array.isArray(delivery.recipients) ? delivery.recipients : [],
              webhookUrl: typeof delivery.webhookUrl === "string" ? delivery.webhookUrl : undefined,
              deliveryType: delivery.deliveryType || "EMAIL",
              format: delivery.format || report.format,
            },
            snapshot,
          });

          // 3. Calculate new nextRunAt and update lastRunAt
          const frequency = String(delivery.frequency || "DAILY").toUpperCase();
          const nextRunDate = this.calculateNextRunAt(frequency, now);

          await prisma.report.update({
            where: { id: report.id },
            data: {
              deliveryConfig: {
                ...delivery,
                lastRunAt: now.toISOString(),
                nextRunAt: nextRunDate.toISOString(),
                lastDeliveryStatus: deliverySummary.success ? "SUCCESS" : "FAILED",
                lastDeliveryAt: now.toISOString(),
                lastDeliveryError: deliverySummary.error || null,
              },
            },
          });

          const durationMs = Date.now() - jobStartTime;

          // Record report execution history
          await prisma.reportExecution.create({
            data: {
              reportId: report.id,
              dashboardId: report.dashboardId,
              status: deliverySummary.success ? "SUCCESS" : "FAILED",
              durationMs,
              chartCount: snapshot.chartCount,
              totalRecords: snapshot.summary.totalRecords,
              summary: snapshot.summary as any,
              errorMessage: deliverySummary.error || null,
            },
          }).catch(() => null);

          runs.push({
            reportId: report.id,
            dashboardId: report.dashboardId,
            status: "SUCCESS",
            deliveryStatus: deliverySummary.success ? "SUCCESS" : "FAILED",
            nextRunAt: nextRunDate.toISOString(),
            durationMs,
          });

          logger.info(`[ReportWorker] Scheduled report executed successfully`, {
            reportId: report.id,
            dashboardId: report.dashboardId,
            durationMs,
            deliverySuccess: deliverySummary.success,
          });
        } catch (jobErr: any) {
          const durationMs = Date.now() - jobStartTime;
          const errorMessage = jobErr?.message || "Unknown report execution failure";

          logger.error(`[ReportWorker] Scheduled report execution failed`, {
            reportId: report.id,
            dashboardId: report.dashboardId,
            error: errorMessage,
            durationMs,
          });

          // Compute backoff/nextRunAt so failing job doesn't continuously loop
          const frequency = String(delivery.frequency || "DAILY").toUpperCase();
          const nextRunDate = this.calculateNextRunAt(frequency, now);

          await prisma.report
            .update({
              where: { id: report.id },
              data: {
                deliveryConfig: {
                  ...delivery,
                  lastRunAt: now.toISOString(),
                  nextRunAt: nextRunDate.toISOString(),
                  lastDeliveryStatus: "FAILED",
                  lastDeliveryAt: now.toISOString(),
                  lastDeliveryError: errorMessage,
                },
              },
            })
            .catch(() => null);

          runs.push({
            reportId: report.id,
            dashboardId: report.dashboardId,
            status: "FAILED",
            error: errorMessage,
            durationMs,
          });
        } finally {
          // Release lock
          this.activeJobIds.delete(report.id);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    const succeeded = runs.filter((r) => r.status === "SUCCESS").length;
    const failed = runs.filter((r) => r.status === "FAILED").length;
    const skipped = runs.filter((r) => r.status === "SKIPPED").length;

    return {
      processed: runs.length,
      succeeded,
      failed,
      skipped,
      runs,
    };
  }
}

export const scheduledReportWorker = new ScheduledReportWorker();
