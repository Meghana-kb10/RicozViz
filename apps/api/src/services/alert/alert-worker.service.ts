// ============================================================
// Scheduled Smart Data Alert Background Worker
// ============================================================
// Periodically polls enabled alerts, calculates real KPI values
// through datasetQueryEngine, evaluates conditions (including
// standard operators and percentage changes), updates alert state,
// and records alert history while strictly preventing duplicate spam.
// ============================================================

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { datasetQueryEngine } from "../dataset/query-engine.js";
import { formatMetricValue } from "../metric/metric.service.js";
import {
  testAlertCondition,
  getConditionSymbol,
  extractEffectiveCondition,
} from "./alert.service.js";
import type { AlertStatus } from "@prisma/client";

export interface ScheduledAlertRunResult {
  alertId: string;
  alertName: string;
  metricName: string;
  currentValue: number;
  threshold: number;
  isTriggered: boolean;
  status: AlertStatus;
  stateChanged: boolean;
  historyRecorded: boolean;
  error?: string;
  durationMs?: number;
}

export interface AlertWorkerPollSummary {
  processed: number;
  succeeded: number;
  triggered: number;
  failed: number;
  skipped: number;
  runs: ScheduledAlertRunResult[];
}

export class ScheduledAlertWorker {
  private activeJobIds = new Set<string>();
  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Starts the background poll loop with a configurable interval (default 60s).
   */
  start(pollIntervalMs = 60_000): void {
    if (this.pollTimer) {
      return;
    }

    logger.info("[AlertWorker] Background smart alert worker started", {
      intervalMs: pollIntervalMs,
    });

    this.pollTimer = setInterval(() => {
      void this.executeDueAlerts().catch((err) => {
        logger.error("[AlertWorker] Unhandled error during alert poll cycle", {
          error: err instanceof Error ? err.message : String(err),
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
      logger.info("[AlertWorker] Background smart alert worker stopped");
    }
  }

  /**
   * Check if a specific alert is currently undergoing evaluation.
   */
  isJobRunning(alertId: string): boolean {
    return this.activeJobIds.has(alertId);
  }

  /**
   * Evaluates all enabled alerts across all organizations.
   * Can be called periodically by worker timer or on-demand by test suites.
   */
  async executeDueAlerts(now = new Date()): Promise<AlertWorkerPollSummary> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, triggered: 0, failed: 0, skipped: 0, runs: [] };
    }

    this.isProcessing = true;
    const runs: ScheduledAlertRunResult[] = [];

    try {
      const activeAlerts = await prisma.alert.findMany({
        where: {
          enabled: true,
        },
        include: {
          metric: {
            include: {
              dataset: true,
            },
          },
        },
      });

      for (const alert of activeAlerts) {
        // Prevent overlapping evaluation of the same alert
        if (this.activeJobIds.has(alert.id)) {
          runs.push({
            alertId: alert.id,
            alertName: alert.name,
            metricName: alert.metric.name,
            currentValue: alert.lastValue ?? 0,
            threshold: alert.threshold,
            isTriggered: alert.status === "TRIGGERED",
            status: alert.status,
            stateChanged: false,
            historyRecorded: false,
            error: "Alert evaluation already in progress (concurrency lock)",
          });
          continue;
        }

        this.activeJobIds.add(alert.id);
        const startTime = Date.now();

        try {
          // 1. Calculate metric value via secure query engine
          const queryResult = await datasetQueryEngine.executeQuery(alert.metric.dataset, {
            limit: 1,
            measures: [
              {
                column: alert.metric.field,
                aggregation: alert.metric.calculation,
                alias: "metric_val",
              },
            ],
          });

          const rawRow = queryResult.rows[0];
          const currentValue = rawRow ? Number(rawRow["metric_val"]) || 0 : 0;
          const previousValue = alert.lastValue;
          const effectiveCondition = extractEffectiveCondition(alert.condition, alert.description);

          // 2. Evaluate condition
          const isTriggered = testAlertCondition(
            currentValue,
            effectiveCondition,
            alert.threshold,
            previousValue
          );

          const newStatus: AlertStatus = isTriggered ? "TRIGGERED" : "OK";
          const stateChanged = alert.status !== newStatus;
          const isInitialEval = !alert.lastEvaluatedAt;

          // Prevent duplicate alert spam:
          // Record history only on state transitions (OK -> TRIGGERED or TRIGGERED -> OK) or initial check
          const shouldRecordHistory = stateChanged || isInitialEval;

          const formattedCurrent = formatMetricValue(currentValue, alert.metric.format);
          const formattedThreshold = formatMetricValue(alert.threshold, alert.metric.format);
          const symbol = getConditionSymbol(alert.condition);

          let message = "";
          if (isTriggered) {
            message = `Alert TRIGGERED: Metric "${alert.metric.name}" value (${formattedCurrent}) meets condition ${symbol} threshold (${formattedThreshold})`;
          } else if (stateChanged && alert.status === "TRIGGERED") {
            message = `Alert RECOVERED: Metric "${alert.metric.name}" value (${formattedCurrent}) has returned to normal (${symbol} ${formattedThreshold})`;
          } else {
            message = `Normal reading: Metric "${alert.metric.name}" value (${formattedCurrent}) satisfies threshold (${formattedThreshold})`;
          }

          // 3. Persist alert state
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              status: newStatus,
              lastEvaluatedAt: now,
              lastValue: currentValue,
              ...(isTriggered && stateChanged ? { lastTriggeredAt: now } : {}),
            },
          });

          // 4. Record history if state changed (avoid duplicate spam)
          if (shouldRecordHistory) {
            await prisma.alertHistory.create({
              data: {
                alertId: alert.id,
                value: currentValue,
                threshold: alert.threshold,
                condition: effectiveCondition,
                status: newStatus,
                message,
                triggeredAt: now,
              },
            });
          }

          const durationMs = Date.now() - startTime;
          runs.push({
            alertId: alert.id,
            alertName: alert.name,
            metricName: alert.metric.name,
            currentValue,
            threshold: alert.threshold,
            isTriggered,
            status: newStatus,
            stateChanged,
            historyRecorded: shouldRecordHistory,
            durationMs,
          });
        } catch (jobErr: any) {
          const durationMs = Date.now() - startTime;
          const errMsg = jobErr?.message || "Failed to evaluate alert metric";

          logger.error(`[AlertWorker] Error evaluating alert "${alert.name}"`, {
            alertId: alert.id,
            error: errMsg,
            durationMs,
          });

          runs.push({
            alertId: alert.id,
            alertName: alert.name,
            metricName: alert.metric?.name || "Unknown",
            currentValue: alert.lastValue ?? 0,
            threshold: alert.threshold,
            isTriggered: false,
            status: alert.status,
            stateChanged: false,
            historyRecorded: false,
            error: errMsg,
            durationMs,
          });
        } finally {
          this.activeJobIds.delete(alert.id);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    const succeeded = runs.filter((r) => !r.error).length;
    const triggered = runs.filter((r) => r.isTriggered).length;
    const failed = runs.filter((r) => r.error).length;
    const skipped = runs.filter((r) => r.error?.includes("lock")).length;

    return {
      processed: runs.length,
      succeeded,
      triggered,
      failed,
      skipped,
      runs,
    };
  }
}

export const scheduledAlertWorker = new ScheduledAlertWorker();
