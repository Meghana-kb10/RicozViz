// ============================================================
// Smart Data Alerts Engine & Service
// ============================================================
// Provides automated metric threshold evaluation, trigger detection,
// status management, alert history auditing, duplicate spam prevention,
// clearing notifications, and tenant isolation.
// ============================================================

import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import { datasetQueryEngine } from "../dataset/query-engine.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";
import { formatMetricValue } from "../metric/metric.service.js";
import type { AlertCondition, AlertStatus } from "@prisma/client";

export const VALID_CONDITIONS: AlertCondition[] = [
  "GREATER_THAN",
  "LESS_THAN",
  "EQUALS",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN_OR_EQUAL",
];

/**
 * Normalizes user input operators into system canonical format.
 * Supports >, <, >=, <=, =, increase %, decrease %.
 */
export function normalizeConditionInput(condition: string): {
  prismaCondition: AlertCondition;
  isPercentIncrease: boolean;
  isPercentDecrease: boolean;
  canonicalName: string;
} {
  const norm = String(condition || "").trim().toUpperCase();

  if (norm === ">" || norm === "GT" || norm === "GREATER_THAN") {
    return { prismaCondition: "GREATER_THAN", isPercentIncrease: false, isPercentDecrease: false, canonicalName: "GREATER_THAN" };
  }
  if (norm === "<" || norm === "LT" || norm === "LESS_THAN") {
    return { prismaCondition: "LESS_THAN", isPercentIncrease: false, isPercentDecrease: false, canonicalName: "LESS_THAN" };
  }
  if (norm === ">=" || norm === "GTE" || norm === "GREATER_THAN_OR_EQUAL") {
    return { prismaCondition: "GREATER_THAN_OR_EQUAL", isPercentIncrease: false, isPercentDecrease: false, canonicalName: "GREATER_THAN_OR_EQUAL" };
  }
  if (norm === "<=" || norm === "LTE" || norm === "LESS_THAN_OR_EQUAL") {
    return { prismaCondition: "LESS_THAN_OR_EQUAL", isPercentIncrease: false, isPercentDecrease: false, canonicalName: "LESS_THAN_OR_EQUAL" };
  }
  if (norm === "=" || norm === "==" || norm === "EQ" || norm === "EQUALS") {
    return { prismaCondition: "EQUALS", isPercentIncrease: false, isPercentDecrease: false, canonicalName: "EQUALS" };
  }
  if (
    norm === "INCREASE %" ||
    norm === "PERCENT_INCREASE" ||
    norm === "INCREASE_PERCENT" ||
    norm === "INCREASE_PCT" ||
    norm === "INCREASE"
  ) {
    return { prismaCondition: "GREATER_THAN", isPercentIncrease: true, isPercentDecrease: false, canonicalName: "PERCENT_INCREASE" };
  }
  if (
    norm === "DECREASE %" ||
    norm === "PERCENT_DECREASE" ||
    norm === "DECREASE_PERCENT" ||
    norm === "DECREASE_PCT" ||
    norm === "DECREASE"
  ) {
    return { prismaCondition: "LESS_THAN", isPercentIncrease: false, isPercentDecrease: true, canonicalName: "PERCENT_DECREASE" };
  }

  throw AppError.badRequest(
    `Invalid alert condition: "${condition}". Supported conditions: >, <, >=, <=, =, increase %, decrease %`
  );
}

/**
 * Extracts true condition if stored with percentage tag.
 */
export function extractEffectiveCondition(
  prismaCondition: AlertCondition | string,
  description?: string | null
): string {
  if (description) {
    if (description.includes("[CONDITION:PERCENT_INCREASE]")) return "PERCENT_INCREASE";
    if (description.includes("[CONDITION:PERCENT_DECREASE]")) return "PERCENT_DECREASE";
  }
  return String(prismaCondition);
}

/**
 * Pure evaluation function for comparing metric value against threshold,
 * supporting standard operators (> < >= <= =) and percentage trends.
 */
export function testAlertCondition(
  value: number,
  condition: AlertCondition | string,
  threshold: number,
  previousValue?: number | null
): boolean {
  const norm = String(condition || "").trim().toUpperCase();

  switch (norm) {
    case "GREATER_THAN":
    case ">":
    case "GT":
      return value > threshold;

    case "LESS_THAN":
    case "<":
    case "LT":
      return value < threshold;

    case "EQUALS":
    case "=":
    case "==":
    case "EQ":
      return Math.abs(value - threshold) < 0.0001;

    case "GREATER_THAN_OR_EQUAL":
    case ">=":
    case "GTE":
      return value >= threshold;

    case "LESS_THAN_OR_EQUAL":
    case "<=":
    case "LTE":
      return value <= threshold;

    case "PERCENT_INCREASE":
    case "INCREASE %":
    case "INCREASE_PERCENT":
    case "INCREASE_PCT":
    case "INCREASE": {
      if (previousValue === null || previousValue === undefined || previousValue === 0) {
        return false;
      }
      const diffPct = ((value - previousValue) / Math.abs(previousValue)) * 100;
      return diffPct >= threshold;
    }

    case "PERCENT_DECREASE":
    case "DECREASE %":
    case "DECREASE_PERCENT":
    case "DECREASE_PCT":
    case "DECREASE": {
      if (previousValue === null || previousValue === undefined || previousValue === 0) {
        return false;
      }
      const dropPct = ((previousValue - value) / Math.abs(previousValue)) * 100;
      return dropPct >= threshold;
    }

    default:
      return false;
  }
}

export const evaluateAlertCondition = testAlertCondition;

/**
 * Human-readable operator representation.
 */
export function getConditionSymbol(condition: AlertCondition | string): string {
  const norm = String(condition || "").toUpperCase().trim();
  switch (norm) {
    case "GREATER_THAN":
      return ">";
    case "LESS_THAN":
      return "<";
    case "EQUALS":
      return "=";
    case "GREATER_THAN_OR_EQUAL":
      return "≥";
    case "LESS_THAN_OR_EQUAL":
      return "≤";
    case "PERCENT_INCREASE":
      return "increase >=";
    case "PERCENT_DECREASE":
      return "decrease >=";
    default:
      return norm;
  }
}

export function formatAlertResponse(alert: any) {
  const effectiveCondition = extractEffectiveCondition(alert.condition, alert.description);
  const cleanDescription = alert.description
    ? alert.description
        .replace("[CONDITION:PERCENT_INCREASE]", "")
        .replace("[CONDITION:PERCENT_DECREASE]", "")
        .trim()
    : null;

  return {
    ...alert,
    description: cleanDescription,
    condition: effectiveCondition,
    conditionSymbol: getConditionSymbol(effectiveCondition),
    isEnabled: Boolean(alert.enabled),
  };
}

/**
 * POST /api/v1/alerts
 * Create a new metric alert rule.
 */
export async function createAlert(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const {
    name,
    description,
    workspaceId,
    metricId,
    condition,
    threshold,
    enabled,
    isEnabled,
  } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw AppError.badRequest("Alert name is required (1-100 characters)");
  }
  if (name.trim().length > 100) {
    throw AppError.badRequest("Alert name cannot exceed 100 characters");
  }

  if (!workspaceId || typeof workspaceId !== "string") {
    throw AppError.badRequest("Workspace ID is required");
  }

  await resolveWorkspaceAccess(workspaceId, userId, organizationId, roleName);

  if (!metricId || typeof metricId !== "string") {
    throw AppError.badRequest("Metric ID is required");
  }

  const metric = await prisma.metric.findFirst({
    where: {
      id: metricId,
      organizationId,
      workspaceId,
    },
  });

  if (!metric) {
    throw AppError.notFound("Metric not found in specified workspace");
  }

  const norm = normalizeConditionInput(condition);

  const numThreshold = Number(threshold);
  if (threshold === undefined || threshold === null || isNaN(numThreshold) || !isFinite(numThreshold)) {
    throw AppError.badRequest("Alert threshold must be a valid finite number");
  }

  const alertEnabled = enabled !== undefined ? Boolean(enabled) : isEnabled !== undefined ? Boolean(isEnabled) : true;

  let finalDescription = typeof description === "string" ? description.trim() : "";
  if (norm.isPercentIncrease) {
    finalDescription = `[CONDITION:PERCENT_INCREASE] ${finalDescription}`.trim();
  } else if (norm.isPercentDecrease) {
    finalDescription = `[CONDITION:PERCENT_DECREASE] ${finalDescription}`.trim();
  }

  const alert = await prisma.alert.create({
    data: {
      name: name.trim(),
      description: finalDescription.length > 0 ? finalDescription : null,
      organizationId,
      workspaceId,
      metricId,
      condition: norm.prismaCondition,
      threshold: numThreshold,
      enabled: alertEnabled,
      status: "PENDING",
      createdById: userId,
    },
    include: {
      metric: {
        select: { id: true, name: true, format: true, calculation: true, field: true },
      },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "ALERT_CREATED",
    resourceType: "Alert",
    resourceId: alert.id,
    metadata: {
      name: alert.name,
      metricId,
      condition: norm.canonicalName,
      threshold: alert.threshold,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, formatAlertResponse(alert), 201);
}

/**
 * GET /api/v1/alerts
 * List all alerts in an organization or workspace.
 */
export async function listAlerts(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const workspaceId = req.query["workspaceId"] as string | undefined;
  const metricId = req.query["metricId"] as string | undefined;

  const whereClause: Record<string, any> = {
    organizationId,
  };

  if (workspaceId) {
    await resolveWorkspaceAccess(workspaceId, userId, organizationId, roleName);
    whereClause.workspaceId = workspaceId;
  }

  if (metricId) {
    whereClause.metricId = metricId;
  }

  const alerts = await prisma.alert.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      metric: {
        select: {
          id: true,
          name: true,
          format: true,
          calculation: true,
          field: true,
          dataset: { select: { id: true, name: true } },
        },
      },
      history: {
        orderBy: { triggeredAt: "desc" },
        take: 1,
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  sendSuccess(res, alerts.map(formatAlertResponse));
}

/**
 * GET /api/v1/alerts/:id
 * Retrieve a single alert with history logs.
 */
export async function getAlert(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Alert ID is required");
  }

  const alert = await prisma.alert.findUnique({
    where: { id },
    include: {
      metric: {
        include: {
          dataset: { select: { id: true, name: true, columns: true } },
        },
      },
      history: {
        orderBy: { triggeredAt: "desc" },
        take: 50,
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!alert) {
    throw AppError.notFound("Alert not found");
  }

  if (alert.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: alert belongs to a different organization");
  }

  await resolveWorkspaceAccess(alert.workspaceId, userId, organizationId, roleName);

  sendSuccess(res, formatAlertResponse(alert));
}

/**
 * PATCH /api/v1/alerts/:id
 * Update alert configuration or enable/disable state.
 */
export async function updateAlert(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;
  const { name, description, condition, threshold, enabled, isEnabled } = req.body;

  if (!id) {
    throw AppError.badRequest("Alert ID is required");
  }

  const existing = await prisma.alert.findUnique({
    where: { id },
  });

  if (!existing) {
    throw AppError.notFound("Alert not found");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: alert belongs to a different organization");
  }

  await resolveWorkspaceAccess(existing.workspaceId, userId, organizationId, roleName);

  const dataToUpdate: Record<string, any> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      throw AppError.badRequest("Alert name must be between 1 and 100 characters");
    }
    dataToUpdate.name = name.trim();
  }

  let finalDesc = typeof description === "string" ? description.trim() : (existing.description || "");

  if (condition !== undefined) {
    const norm = normalizeConditionInput(condition);
    dataToUpdate.condition = norm.prismaCondition;
    finalDesc = finalDesc
      .replace("[CONDITION:PERCENT_INCREASE]", "")
      .replace("[CONDITION:PERCENT_DECREASE]", "")
      .trim();
    if (norm.isPercentIncrease) {
      finalDesc = `[CONDITION:PERCENT_INCREASE] ${finalDesc}`.trim();
    } else if (norm.isPercentDecrease) {
      finalDesc = `[CONDITION:PERCENT_DECREASE] ${finalDesc}`.trim();
    }
    dataToUpdate.description = finalDesc.length > 0 ? finalDesc : null;
  } else if (description !== undefined) {
    dataToUpdate.description = typeof description === "string" && description.trim().length > 0 ? description.trim() : null;
  }

  if (threshold !== undefined) {
    const num = Number(threshold);
    if (isNaN(num) || !isFinite(num)) {
      throw AppError.badRequest("Threshold must be a valid finite number");
    }
    dataToUpdate.threshold = num;
  }

  if (enabled !== undefined || isEnabled !== undefined) {
    dataToUpdate.enabled = Boolean(enabled ?? isEnabled);
  }

  const updated = await prisma.alert.update({
    where: { id },
    data: dataToUpdate,
    include: {
      metric: {
        select: { id: true, name: true, format: true },
      },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "ALERT_UPDATED",
    resourceType: "Alert",
    resourceId: id,
    metadata: dataToUpdate,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, formatAlertResponse(updated));
}

/**
 * DELETE /api/v1/alerts/:id
 * Remove an alert and its history.
 */
export async function deleteAlert(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Alert ID is required");
  }

  const alert = await prisma.alert.findUnique({
    where: { id },
  });

  if (!alert) {
    throw AppError.notFound("Alert not found");
  }

  if (alert.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: alert belongs to a different organization");
  }

  await resolveWorkspaceAccess(alert.workspaceId, userId, organizationId, roleName);

  await prisma.alert.delete({
    where: { id },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "ALERT_DELETED",
    resourceType: "Alert",
    resourceId: id,
    metadata: { name: alert.name },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: `Alert "${alert.name}" deleted successfully` });
}

/**
 * POST /api/v1/alerts/:id/clear
 * Clear / acknowledge a triggered alert notification and reset status to OK.
 */
export async function clearAlert(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName, email } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Alert ID is required");
  }

  const alert = await prisma.alert.findUnique({
    where: { id },
    include: { metric: true },
  });

  if (!alert) {
    throw AppError.notFound("Alert not found");
  }

  if (alert.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: alert belongs to a different organization");
  }

  await resolveWorkspaceAccess(alert.workspaceId, userId, organizationId, roleName);

  const now = new Date();
  const [updatedAlert, historyEntry] = await prisma.$transaction([
    prisma.alert.update({
      where: { id },
      data: {
        status: "OK",
        lastTriggeredAt: null,
      },
      include: {
        metric: {
          select: { id: true, name: true, format: true },
        },
      },
    }),
    prisma.alertHistory.create({
      data: {
        alertId: id,
        value: alert.lastValue ?? 0,
        threshold: alert.threshold,
        condition: String(alert.condition),
        status: "OK",
        message: `Alert notification cleared and acknowledged by ${email || "user"}. Status reset to OK.`,
        triggeredAt: now,
      },
    }),
  ]);

  await logAuditEvent({
    organizationId,
    userId,
    action: "ALERT_CLEARED",
    resourceType: "Alert",
    resourceId: id,
    metadata: { alertName: alert.name, clearedAt: now.toISOString() },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    message: `Alert "${alert.name}" notification cleared successfully.`,
    alert: formatAlertResponse(updatedAlert),
    historyId: historyEntry.id,
  });
}

/**
 * POST /api/v1/alerts/:id/evaluate
 * Execute backend alert evaluation against real dataset metric with duplicate spam prevention.
 */
export async function evaluateAlert(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Alert ID is required");
  }

  const alert = await prisma.alert.findUnique({
    where: { id },
    include: {
      metric: {
        include: {
          dataset: true,
        },
      },
    },
  });

  if (!alert) {
    throw AppError.notFound("Alert not found");
  }

  if (alert.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: alert belongs to a different organization");
  }

  await resolveWorkspaceAccess(alert.workspaceId, userId, organizationId, roleName);

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
  const isTriggered = testAlertCondition(currentValue, effectiveCondition, alert.threshold, previousValue);
  const symbol = getConditionSymbol(effectiveCondition);

  const status: AlertStatus = isTriggered ? "TRIGGERED" : "OK";
  const now = new Date();

  const formattedCurrent = formatMetricValue(currentValue, alert.metric.format);
  const formattedThreshold = formatMetricValue(alert.threshold, alert.metric.format);

  const stateChanged = alert.status !== status;
  const isInitialEval = !alert.lastEvaluatedAt;
  const shouldLogHistory = stateChanged || isInitialEval;

  let message = "";
  if (isTriggered) {
    message = `Alert TRIGGERED: Metric "${alert.metric.name}" value (${formattedCurrent}) meets condition ${symbol} threshold (${formattedThreshold})`;
  } else if (stateChanged && alert.status === "TRIGGERED") {
    message = `Alert RECOVERED: Metric "${alert.metric.name}" value (${formattedCurrent}) has returned to normal (${symbol} ${formattedThreshold})`;
  } else {
    message = `Normal: Metric "${alert.metric.name}" value (${formattedCurrent}) satisfies threshold (${formattedThreshold})`;
  }

  // 3. Persist evaluation history and update alert status (prevent duplicate spam)
  const [updatedAlert, historyEntry] = await prisma.$transaction(async (tx) => {
    const updated = await tx.alert.update({
      where: { id },
      data: {
        status,
        lastEvaluatedAt: now,
        lastValue: currentValue,
        ...(isTriggered && stateChanged ? { lastTriggeredAt: now } : {}),
      },
      include: {
        metric: {
          select: { id: true, name: true, format: true },
        },
      },
    });

    const history = shouldLogHistory
      ? await tx.alertHistory.create({
          data: {
            alertId: id,
            value: currentValue,
            threshold: alert.threshold,
            condition: effectiveCondition,
            status,
            message,
            triggeredAt: now,
          },
        })
      : null;

    return [updated, history];
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: isTriggered ? "ALERT_TRIGGERED" : "ALERT_EVALUATED",
    resourceType: "Alert",
    resourceId: id,
    metadata: {
      alertName: alert.name,
      currentValue,
      threshold: alert.threshold,
      condition: effectiveCondition,
      isTriggered,
      stateChanged,
      duplicatePrevented: isTriggered && !stateChanged,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    alertId: alert.id,
    alertName: alert.name,
    metricName: alert.metric.name,
    condition: effectiveCondition,
    conditionSymbol: symbol,
    threshold: alert.threshold,
    formattedThreshold,
    currentValue,
    formattedCurrent,
    isTriggered,
    status: updatedAlert.status,
    stateChanged,
    duplicatePrevented: isTriggered && !stateChanged,
    lastEvaluatedAt: now.toISOString(),
    historyId: historyEntry?.id || null,
    message,
    notificationDelivery: isTriggered
      ? "Alert triggered! Notification recorded in alert history log."
      : "Metric in normal bounds.",
  });
}

/**
 * POST /api/v1/alerts/workspace/:workspaceId/evaluate-all
 * Evaluates all active alerts in a workspace with duplicate spam prevention.
 */
export async function evaluateAllWorkspaceAlerts(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { workspaceId } = req.params;

  if (!workspaceId) {
    throw AppError.badRequest("Workspace ID is required");
  }

  await resolveWorkspaceAccess(workspaceId, userId, organizationId, roleName);

  const activeAlerts = await prisma.alert.findMany({
    where: {
      workspaceId,
      organizationId,
      enabled: true,
    },
    include: {
      metric: {
        include: { dataset: true },
      },
    },
  });

  const results: Record<string, any>[] = [];

  for (const alert of activeAlerts) {
    try {
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

      const isTriggered = testAlertCondition(currentValue, effectiveCondition, alert.threshold, previousValue);
      const status: AlertStatus = isTriggered ? "TRIGGERED" : "OK";
      const now = new Date();

      const stateChanged = alert.status !== status;
      const isInitialEval = !alert.lastEvaluatedAt;
      const shouldLogHistory = stateChanged || isInitialEval;

      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          status,
          lastEvaluatedAt: now,
          lastValue: currentValue,
          ...(isTriggered && stateChanged ? { lastTriggeredAt: now } : {}),
        },
      });

      if (shouldLogHistory) {
        await prisma.alertHistory.create({
          data: {
            alertId: alert.id,
            value: currentValue,
            threshold: alert.threshold,
            condition: effectiveCondition,
            status,
            message: isTriggered
              ? `Alert condition met: ${currentValue} ${effectiveCondition} ${alert.threshold}`
              : `Normal reading: ${currentValue}`,
            triggeredAt: now,
          },
        });
      }

      results.push({
        alertId: alert.id,
        name: alert.name,
        currentValue,
        isTriggered,
        status,
        stateChanged,
      });
    } catch (err: any) {
      results.push({
        alertId: alert.id,
        name: alert.name,
        error: err.message,
        status: "ERROR",
      });
    }
  }

  sendSuccess(res, {
    totalEvaluated: results.length,
    triggeredCount: results.filter((r) => r.isTriggered).length,
    results,
  });
}
