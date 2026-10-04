// ============================================================
// Smart Data Alerts Engine & Service
// ============================================================
// Provides automated metric threshold evaluation, trigger detection,
// status management, alert history auditing, and tenant isolation.
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

const VALID_CONDITIONS: AlertCondition[] = [
  "GREATER_THAN",
  "LESS_THAN",
  "EQUALS",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN_OR_EQUAL",
];

/**
 * Pure evaluation function for comparing metric value against threshold.
 */
export function testAlertCondition(
  value: number,
  condition: AlertCondition,
  threshold: number
): boolean {
  switch (condition) {
    case "GREATER_THAN":
      return value > threshold;
    case "LESS_THAN":
      return value < threshold;
    case "EQUALS":
      return Math.abs(value - threshold) < 0.0001;
    case "GREATER_THAN_OR_EQUAL":
      return value >= threshold;
    case "LESS_THAN_OR_EQUAL":
      return value <= threshold;
    default:
      return false;
  }
}

/**
 * Human-readable operator representation.
 */
export function getConditionSymbol(condition: AlertCondition): string {
  switch (condition) {
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
    default:
      return condition;
  }
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
    enabled = true,
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

  const normCondition = String(condition).toUpperCase() as AlertCondition;
  if (!VALID_CONDITIONS.includes(normCondition)) {
    throw AppError.badRequest(
      `Invalid alert condition. Must be one of: ${VALID_CONDITIONS.join(", ")}`
    );
  }

  const numThreshold = Number(threshold);
  if (threshold === undefined || threshold === null || isNaN(numThreshold) || !isFinite(numThreshold)) {
    throw AppError.badRequest("Alert threshold must be a valid finite number");
  }

  const alert = await prisma.alert.create({
    data: {
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : null,
      organizationId,
      workspaceId,
      metricId,
      condition: normCondition,
      threshold: numThreshold,
      enabled: Boolean(enabled),
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
      condition: alert.condition,
      threshold: alert.threshold,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, alert, 201);
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

  sendSuccess(res, alerts);
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

  sendSuccess(res, alert);
}

/**
 * PATCH /api/v1/alerts/:id
 * Update alert configuration or enable/disable state.
 */
export async function updateAlert(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;
  const { name, description, condition, threshold, enabled } = req.body;

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

  if (description !== undefined) {
    dataToUpdate.description = typeof description === "string" ? description.trim() : null;
  }

  if (condition !== undefined) {
    const norm = String(condition).toUpperCase() as AlertCondition;
    if (!VALID_CONDITIONS.includes(norm)) {
      throw AppError.badRequest(`Invalid condition: ${condition}`);
    }
    dataToUpdate.condition = norm;
  }

  if (threshold !== undefined) {
    const num = Number(threshold);
    if (isNaN(num) || !isFinite(num)) {
      throw AppError.badRequest("Threshold must be a valid finite number");
    }
    dataToUpdate.threshold = num;
  }

  if (enabled !== undefined) {
    dataToUpdate.enabled = Boolean(enabled);
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

  sendSuccess(res, updated);
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
 * POST /api/v1/alerts/:id/evaluate
 * Execute backend alert evaluation against real dataset metric.
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
  const formattedCurrent = formatMetricValue(currentValue, alert.metric.format);
  const formattedThreshold = formatMetricValue(alert.threshold, alert.metric.format);

  // 2. Evaluate condition
  const isTriggered = testAlertCondition(currentValue, alert.condition, alert.threshold);
  const symbol = getConditionSymbol(alert.condition);

  const status: AlertStatus = isTriggered ? "TRIGGERED" : "OK";
  const now = new Date();

  const message = isTriggered
    ? `Alert TRIGGERED: Metric "${alert.metric.name}" value (${formattedCurrent}) is ${alert.condition} threshold (${formattedThreshold})`
    : `Normal: Metric "${alert.metric.name}" value (${formattedCurrent}) satisfies threshold (${formattedThreshold})`;

  // 3. Persist evaluation history and update alert status
  const [updatedAlert, historyEntry] = await prisma.$transaction([
    prisma.alert.update({
      where: { id },
      data: {
        status,
        lastEvaluatedAt: now,
        lastValue: currentValue,
        ...(isTriggered ? { lastTriggeredAt: now } : {}),
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
        value: currentValue,
        threshold: alert.threshold,
        condition: alert.condition,
        status,
        message,
        triggeredAt: now,
      },
    }),
  ]);

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
      condition: alert.condition,
      isTriggered,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, {
    alertId: alert.id,
    alertName: alert.name,
    metricName: alert.metric.name,
    condition: alert.condition,
    conditionSymbol: symbol,
    threshold: alert.threshold,
    formattedThreshold,
    currentValue,
    formattedCurrent,
    isTriggered,
    status: updatedAlert.status,
    lastEvaluatedAt: now.toISOString(),
    historyId: historyEntry.id,
    message,
    notificationDelivery:
      "Evaluation completed. Notification recorded in alert history log. (External email delivery requires SMTP provider configuration).",
  });
}

/**
 * POST /api/v1/alerts/workspace/:workspaceId/evaluate-all
 * Evaluates all active alerts in a workspace.
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
      const isTriggered = testAlertCondition(currentValue, alert.condition, alert.threshold);
      const status: AlertStatus = isTriggered ? "TRIGGERED" : "OK";
      const now = new Date();

      await prisma.$transaction([
        prisma.alert.update({
          where: { id: alert.id },
          data: {
            status,
            lastEvaluatedAt: now,
            lastValue: currentValue,
            ...(isTriggered ? { lastTriggeredAt: now } : {}),
          },
        }),
        prisma.alertHistory.create({
          data: {
            alertId: alert.id,
            value: currentValue,
            threshold: alert.threshold,
            condition: alert.condition,
            status,
            message: isTriggered
              ? `Alert condition met: ${currentValue} ${alert.condition} ${alert.threshold}`
              : `Normal reading: ${currentValue}`,
            triggeredAt: now,
          },
        }),
      ]);

      results.push({
        alertId: alert.id,
        name: alert.name,
        currentValue,
        isTriggered,
        status,
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
