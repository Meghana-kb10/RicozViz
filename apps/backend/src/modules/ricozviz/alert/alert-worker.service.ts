// ============================================================
// Scheduled Smart Data Alert Background Worker
// ============================================================
// Periodically polls enabled alerts across every organization, calculates the
// real KPI value through the dataset query engine, evaluates conditions
// (standard operators and percentage changes), updates alert state and records
// history while strictly preventing duplicate spam.
// ============================================================

import mongoose from 'mongoose';
import { AlertHistoryModel, AlertModel, MetricModel } from '@repo/database';
import { ALERT_STATUS } from '@repo/types';
import type { AlertStatus, MetricAggregation } from '@repo/types';
import { logger } from '../../../utils/logger.js';
import {
  executeLocalDatasetQuery,
  loadDatasetSnapshot
} from '../visualization/visualization.service.js';
import { formatMetricValue } from '../metric/metric.service.js';
import {
  extractEffectiveCondition,
  getConditionSymbol,
  testAlertCondition
} from './alert.service.js';
import { dispatchAlertNotifications } from './notification.service.js';
import type { NotificationDispatchResult } from './notification.service.js';

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

interface WorkerAlertRow {
  _id: mongoose.Types.ObjectId;
  metricId: mongoose.Types.ObjectId;
  name: string;
  condition: string;
  description: string | null;
  threshold: number;
  enabled: boolean;
  status: string;
  lastEvaluatedAt: Date | null;
  lastValue: number | null;
}

export class ScheduledAlertWorker {
  private activeJobIds = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  /**
   * Starts the background poll loop with a configurable interval (default 60s).
   */
  start(pollIntervalMs = 60_000): void {
    if (this.pollTimer) {
      return;
    }

    logger.info('[AlertWorker] Background smart alert worker started', {
      intervalMs: pollIntervalMs
    });

    this.pollTimer = setInterval(() => {
      void this.executeDueAlerts().catch((err: unknown) => {
        logger.error('[AlertWorker] Unhandled error during alert poll cycle', {
          error: err instanceof Error ? err.message : String(err)
        });
      });
    }, pollIntervalMs);

    // Unref the timer so the process can exit cleanly.
    if (typeof this.pollTimer.unref === 'function') {
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
      logger.info('[AlertWorker] Background smart alert worker stopped');
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
   * Callable from the timer or on demand by test suites.
   */
  async executeDueAlerts(now = new Date()): Promise<AlertWorkerPollSummary> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, triggered: 0, failed: 0, skipped: 0, runs: [] };
    }

    this.isProcessing = true;
    const runs: ScheduledAlertRunResult[] = [];

    try {
      const activeAlerts = (await AlertModel.find({ enabled: true }).lean()) as unknown as WorkerAlertRow[];

      for (const alert of activeAlerts) {
        const alertId = alert._id.toString();

        // Prevent overlapping evaluation of the same alert
        if (this.activeJobIds.has(alertId)) {
          const metric = await MetricModel.findById(alert.metricId).lean();
          runs.push({
            alertId,
            alertName: alert.name,
            metricName: metric?.name ?? 'Unknown',
            currentValue: alert.lastValue ?? 0,
            threshold: alert.threshold,
            isTriggered: alert.status === ALERT_STATUS.TRIGGERED,
            status: alert.status as AlertStatus,
            stateChanged: false,
            historyRecorded: false,
            error: 'Alert evaluation already in progress (concurrency lock)'
          });
          continue;
        }

        this.activeJobIds.add(alertId);
        const startTime = Date.now();

        try {
          const metric = await MetricModel.findById(alert.metricId).lean();

          if (!metric) {
            throw new Error('Metric linked to alert not found');
          }

          const snapshot = await loadDatasetSnapshot(metric.datasetId.toString());
          if (!snapshot) {
            throw new Error('Dataset linked to metric not found');
          }

          // 1. Calculate metric value via the secure query engine
          const queryResult = await executeLocalDatasetQuery(snapshot, {
            limit: 1,
            measures: [
              {
                column: metric.field,
                aggregation: metric.calculation as MetricAggregation,
                alias: 'metric_val'
              }
            ]
          });

          const rawRow = queryResult.rows[0];
          const currentValue = rawRow ? Number(rawRow['metric_val']) || 0 : 0;
          const previousValue = alert.lastValue;
          const effectiveCondition = extractEffectiveCondition(alert.condition, alert.description);

          // 2. Evaluate condition
          const isTriggered = testAlertCondition(
            currentValue,
            effectiveCondition,
            alert.threshold,
            previousValue
          );

          const newStatus: AlertStatus = isTriggered ? ALERT_STATUS.TRIGGERED : ALERT_STATUS.OK;
          const stateChanged = alert.status !== newStatus;
          const isInitialEval = !alert.lastEvaluatedAt;

          // Prevent duplicate alert spam: record history only on state
          // transitions (OK -> TRIGGERED or TRIGGERED -> OK) or the initial check.
          const shouldRecordHistory = stateChanged || isInitialEval;

          const formattedCurrent = formatMetricValue(currentValue, metric.format as string);
          const formattedThreshold = formatMetricValue(alert.threshold, metric.format as string);
          const symbol = getConditionSymbol(alert.condition);

          let message = '';
          if (isTriggered) {
            message = `Alert TRIGGERED: Metric "${metric.name}" value (${formattedCurrent}) meets condition ${symbol} threshold (${formattedThreshold})`;
          } else if (stateChanged && alert.status === ALERT_STATUS.TRIGGERED) {
            message = `Alert RECOVERED: Metric "${metric.name}" value (${formattedCurrent}) has returned to normal (${symbol} ${formattedThreshold})`;
          } else {
            message = `Normal reading: Metric "${metric.name}" value (${formattedCurrent}) satisfies threshold (${formattedThreshold})`;
          }

          // 3. Persist alert state
          const updateData: Record<string, unknown> = {
            status: newStatus,
            lastEvaluatedAt: now,
            lastValue: currentValue
          };
          if (isTriggered && stateChanged) {
            updateData.lastTriggeredAt = now;
          }
          await AlertModel.updateOne({ _id: alert._id }, { $set: updateData }).exec();

          // 4. Record history if state changed (avoid duplicate spam)
          if (shouldRecordHistory) {
            let dispatchResult: NotificationDispatchResult = {
              deliveryStatus: 'SKIPPED',
              deliveryChannel: null,
              deliveredAt: null,
              deliveryError: null
            };
            if (isTriggered) {
              dispatchResult = await dispatchAlertNotifications({
                alertId,
                alertName: alert.name,
                metricName: metric.name,
                condition: effectiveCondition,
                threshold: alert.threshold,
                currentValue,
                triggeredAt: now,
                recipients: (alert as any).recipients,
                slackWebhookUrl: (alert as any).slackWebhookUrl
              });
            }

            await AlertHistoryModel.create({
              alertId: alert._id,
              value: currentValue,
              threshold: alert.threshold,
              condition: effectiveCondition,
              status: newStatus,
              message,
              triggeredAt: now,
              deliveryStatus: dispatchResult.deliveryStatus,
              deliveredAt: dispatchResult.deliveredAt,
              deliveryError: dispatchResult.deliveryError,
              deliveryChannel: dispatchResult.deliveryChannel
            });
          }

          const durationMs = Date.now() - startTime;
          runs.push({
            alertId,
            alertName: alert.name,
            metricName: metric.name,
            currentValue,
            threshold: alert.threshold,
            isTriggered,
            status: newStatus,
            stateChanged,
            historyRecorded: shouldRecordHistory,
            durationMs
          });
        } catch (jobErr: unknown) {
          const durationMs = Date.now() - startTime;
          const errMsg = jobErr instanceof Error ? jobErr.message : 'Failed to evaluate alert metric';

          logger.error(`[AlertWorker] Error evaluating alert "${alert.name}"`, {
            alertId,
            error: errMsg,
            durationMs
          });

          runs.push({
            alertId,
            alertName: alert.name,
            metricName: 'Unknown',
            currentValue: alert.lastValue ?? 0,
            threshold: alert.threshold,
            isTriggered: false,
            status: alert.status as AlertStatus,
            stateChanged: false,
            historyRecorded: false,
            error: errMsg,
            durationMs
          });
        } finally {
          this.activeJobIds.delete(alertId);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    const succeeded = runs.filter((r) => !r.error).length;
    const triggered = runs.filter((r) => r.isTriggered).length;
    const failed = runs.filter((r) => r.error).length;
    const skipped = runs.filter((r) => r.error?.includes('lock')).length;

    return {
      processed: runs.length,
      succeeded,
      triggered,
      failed,
      skipped,
      runs
    };
  }
}

export const scheduledAlertWorker = new ScheduledAlertWorker();

/**
 * Aliases so the worker module exposes the same evaluation entry points as the
 * HTTP-facing alert service (used by the `evaluate-all` routes and tests).
 */
export { evaluateAlert, evaluateAllWorkspaceAlerts } from './alert.service.js';