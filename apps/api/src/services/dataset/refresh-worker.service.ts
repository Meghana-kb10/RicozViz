// ============================================================
// Scheduled Dataset Refresh Background Worker
// ============================================================
// Periodically polls for active dataset refresh schedules whose
// nextRefreshAt is due. Executes using the dataset refresh pipeline,
// updates metadata, records execution history, and prevents overlapping
// jobs with mutex locking.
// ============================================================

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import {
  executeDatasetRefresh,
  extractRefreshSchedule,
  isDatasetRefreshing,
  type DatasetRefreshResult,
} from "./dataset-refresh.service.js";

export interface RefreshWorkerPollSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  runs: Array<{
    datasetId: string;
    datasetName: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    rowCount?: number;
    durationMs?: number;
    error?: string;
  }>;
}

export class ScheduledRefreshWorker {
  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Starts the background poll loop with a configurable interval (default 60s).
   */
  start(pollIntervalMs = 60_000): void {
    if (this.pollTimer) {
      return;
    }

    logger.info("[RefreshWorker] Background scheduled dataset refresh worker started", {
      intervalMs: pollIntervalMs,
    });

    this.pollTimer = setInterval(() => {
      void this.executeDueRefreshes().catch((err) => {
        logger.error("[RefreshWorker] Unhandled error during dataset refresh poll cycle", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, pollIntervalMs);

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
      logger.info("[RefreshWorker] Background scheduled dataset refresh worker stopped");
    }
  }

  /**
   * Check if a dataset is currently being refreshed.
   */
  isJobRunning(datasetId: string): boolean {
    return isDatasetRefreshing(datasetId);
  }

  /**
   * Scans datasets across organizations and runs due refresh schedules.
   * Can be called manually by test suites or scheduled poll timer.
   */
  async executeDueRefreshes(now = new Date()): Promise<RefreshWorkerPollSummary> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0, skipped: 0, runs: [] };
    }

    this.isProcessing = true;
    const runs: RefreshWorkerPollSummary["runs"] = [];

    try {
      const candidates = await prisma.dataset.findMany({
        where: {
          status: { not: "ARCHIVED" },
        },
        select: {
          id: true,
          name: true,
          organizationId: true,
          schemaMeta: true,
        },
      });

      for (const ds of candidates) {
        const schedule = extractRefreshSchedule(ds);

        // Skip if schedule is disabled or not set
        if (!schedule.enabled || !schedule.nextRefreshAt) {
          continue;
        }

        const nextRun = new Date(schedule.nextRefreshAt);
        if (nextRun.getTime() > now.getTime()) {
          // Not due yet
          continue;
        }

        // Prevent overlapping refresh
        if (this.isJobRunning(ds.id)) {
          runs.push({
            datasetId: ds.id,
            datasetName: ds.name,
            status: "SKIPPED",
            error: "Refresh already in progress (concurrency lock)",
          });
          continue;
        }

        try {
          logger.info(`[RefreshWorker] Running due scheduled refresh for dataset "${ds.name}"`, {
            datasetId: ds.id,
            frequency: schedule.frequency,
          });

          const result: DatasetRefreshResult = await executeDatasetRefresh(
            ds.id,
            ds.organizationId,
            "SCHEDULE"
          );

          runs.push({
            datasetId: ds.id,
            datasetName: ds.name,
            status: "SUCCESS",
            rowCount: result.rowCount,
            durationMs: result.durationMs,
          });
        } catch (jobErr: any) {
          const errMsg = jobErr?.message || "Scheduled refresh execution failure";
          logger.error(`[RefreshWorker] Scheduled refresh failed for dataset "${ds.name}"`, {
            datasetId: ds.id,
            error: errMsg,
          });

          runs.push({
            datasetId: ds.id,
            datasetName: ds.name,
            status: "FAILED",
            error: errMsg,
          });
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

export const scheduledRefreshWorker = new ScheduledRefreshWorker();
