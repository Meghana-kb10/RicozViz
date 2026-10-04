// ============================================================
// KPI / Metrics Layer Service
// ============================================================
// Provides governed, reusable business metrics with secure query
// execution, calculation verification, target tracking, and tenant isolation.
// ============================================================

import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { logAuditEvent } from "../audit.service.js";
import { datasetQueryEngine } from "../dataset/query-engine.js";
import { validateSqlIdentifier } from "../dataset/schema-discovery.service.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";
import type { MetricAggregation, MetricFormat } from "@prisma/client";

const VALID_AGGREGATIONS: MetricAggregation[] = ["SUM", "AVG", "COUNT", "MIN", "MAX"];
const VALID_FORMATS: MetricFormat[] = ["NUMBER", "CURRENCY", "PERCENT"];

/**
 * Format metric value based on configured format.
 */
export function formatMetricValue(val: number, format: MetricFormat): string {
  if (format === "CURRENCY") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }
  if (format === "PERCENT") {
    return `${(val * (val <= 1 && val >= -1 ? 100 : 1)).toFixed(1)}%`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(val);
}

/**
 * POST /api/v1/metrics
 * Create a new reusable KPI / business metric.
 */
export async function createMetric(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const {
    name,
    description,
    workspaceId,
    datasetId,
    calculation = "SUM",
    field,
    format = "NUMBER",
    targetValue,
  } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw AppError.badRequest("Metric name is required (1-100 characters)");
  }
  if (name.trim().length > 100) {
    throw AppError.badRequest("Metric name cannot exceed 100 characters");
  }

  if (!workspaceId || typeof workspaceId !== "string") {
    throw AppError.badRequest("Workspace ID is required");
  }

  // Validate workspace access
  await resolveWorkspaceAccess(workspaceId, userId, organizationId, roleName);

  if (!datasetId || typeof datasetId !== "string") {
    throw AppError.badRequest("Dataset ID is required");
  }

  // Verify dataset belongs to workspace and organization
  const dataset = await prisma.dataset.findFirst({
    where: {
      id: datasetId,
      organizationId,
      workspaceId,
    },
    include: {
      columns: true,
    },
  });

  if (!dataset) {
    throw AppError.notFound("Dataset not found in specified workspace");
  }

  const normCalc = String(calculation).toUpperCase() as MetricAggregation;
  if (!VALID_AGGREGATIONS.includes(normCalc)) {
    throw AppError.badRequest(
      `Invalid calculation aggregation. Must be one of: ${VALID_AGGREGATIONS.join(", ")}`
    );
  }

  const normFormat = String(format).toUpperCase() as MetricFormat;
  if (!VALID_FORMATS.includes(normFormat)) {
    throw AppError.badRequest(
      `Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}`
    );
  }

  if (!field || typeof field !== "string") {
    throw AppError.badRequest("Field (column name) is required");
  }

  const trimmedField = field.trim();
  // Validate column name against SQL identifier rules
  if (trimmedField !== "*") {
    validateSqlIdentifier(trimmedField);
  }

  // Check column exists in dataset
  if (trimmedField !== "*") {
    const colExists = dataset.columns.some(
      (c) => c.name.toLowerCase() === trimmedField.toLowerCase()
    );
    if (!colExists) {
      throw AppError.badRequest(
        `Field "${trimmedField}" does not exist in dataset "${dataset.name}"`
      );
    }

    // Verify non-numeric column is not used for numeric aggregations
    if (normCalc === "SUM" || normCalc === "AVG") {
      const col = dataset.columns.find(
        (c) => c.name.toLowerCase() === trimmedField.toLowerCase()
      );
      if (col && col.dataType !== "NUMBER") {
        throw AppError.badRequest(
          `Aggregation "${normCalc}" requires a numeric field, but "${trimmedField}" has type ${col.dataType}`
        );
      }
    }
  }

  let parsedTarget: number | null = null;
  if (targetValue !== undefined && targetValue !== null && targetValue !== "") {
    parsedTarget = Number(targetValue);
    if (isNaN(parsedTarget) || !isFinite(parsedTarget)) {
      throw AppError.badRequest("Target value must be a valid finite number");
    }
  }

  const metric = await prisma.metric.create({
    data: {
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : null,
      organizationId,
      workspaceId,
      datasetId,
      calculation: normCalc,
      field: trimmedField,
      format: normFormat,
      targetValue: parsedTarget,
      createdById: userId,
    },
    include: {
      dataset: {
        select: { id: true, name: true },
      },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "METRIC_CREATED",
    resourceType: "Metric",
    resourceId: metric.id,
    metadata: {
      name: metric.name,
      calculation: metric.calculation,
      field: metric.field,
      workspaceId,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, metric, 201);
}

/**
 * GET /api/v1/metrics
 * List reusable metrics for an organization or filtered by workspace.
 */
export async function listMetrics(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const workspaceId = req.query["workspaceId"] as string | undefined;
  const datasetId = req.query["datasetId"] as string | undefined;

  const whereClause: Record<string, any> = {
    organizationId,
  };

  if (workspaceId) {
    await resolveWorkspaceAccess(workspaceId, userId, organizationId, roleName);
    whereClause.workspaceId = workspaceId;
  }

  if (datasetId) {
    whereClause.datasetId = datasetId;
  }

  const metrics = await prisma.metric.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      dataset: {
        select: { id: true, name: true, rowCount: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { alerts: true },
      },
    },
  });

  sendSuccess(res, metrics);
}

/**
 * GET /api/v1/metrics/:id
 * Retrieve a specific metric by ID.
 */
export async function getMetric(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Metric ID is required");
  }

  const metric = await prisma.metric.findUnique({
    where: { id },
    include: {
      dataset: {
        select: { id: true, name: true, columns: true, rowCount: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      alerts: true,
    },
  });

  if (!metric) {
    throw AppError.notFound("Metric not found");
  }

  if (metric.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: metric belongs to a different organization");
  }

  await resolveWorkspaceAccess(metric.workspaceId, userId, organizationId, roleName);

  sendSuccess(res, metric);
}

/**
 * PATCH /api/v1/metrics/:id
 * Update metric configuration or target.
 */
export async function updateMetric(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;
  const { name, description, calculation, field, format, targetValue } = req.body;

  if (!id) {
    throw AppError.badRequest("Metric ID is required");
  }

  const existing = await prisma.metric.findUnique({
    where: { id },
    include: { dataset: { include: { columns: true } } },
  });

  if (!existing) {
    throw AppError.notFound("Metric not found");
  }

  if (existing.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: metric belongs to a different organization");
  }

  await resolveWorkspaceAccess(existing.workspaceId, userId, organizationId, roleName);

  const dataToUpdate: Record<string, any> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      throw AppError.badRequest("Metric name must be between 1 and 100 characters");
    }
    dataToUpdate.name = name.trim();
  }

  if (description !== undefined) {
    dataToUpdate.description = typeof description === "string" ? description.trim() : null;
  }

  if (calculation !== undefined) {
    const normCalc = String(calculation).toUpperCase() as MetricAggregation;
    if (!VALID_AGGREGATIONS.includes(normCalc)) {
      throw AppError.badRequest(`Invalid calculation aggregation: ${calculation}`);
    }
    dataToUpdate.calculation = normCalc;
  }

  if (format !== undefined) {
    const normFormat = String(format).toUpperCase() as MetricFormat;
    if (!VALID_FORMATS.includes(normFormat)) {
      throw AppError.badRequest(`Invalid format: ${format}`);
    }
    dataToUpdate.format = normFormat;
  }

  if (field !== undefined) {
    const trimmedField = String(field).trim();
    if (trimmedField !== "*") {
      validateSqlIdentifier(trimmedField);
      const exists = existing.dataset.columns.some(
        (c) => c.name.toLowerCase() === trimmedField.toLowerCase()
      );
      if (!exists) {
        throw AppError.badRequest(`Field "${trimmedField}" does not exist in dataset`);
      }
    }
    dataToUpdate.field = trimmedField;
  }

  if (targetValue !== undefined) {
    if (targetValue === null || targetValue === "") {
      dataToUpdate.targetValue = null;
    } else {
      const parsed = Number(targetValue);
      if (isNaN(parsed) || !isFinite(parsed)) {
        throw AppError.badRequest("Target value must be a valid finite number");
      }
      dataToUpdate.targetValue = parsed;
    }
  }

  const updated = await prisma.metric.update({
    where: { id },
    data: dataToUpdate,
    include: {
      dataset: {
        select: { id: true, name: true },
      },
    },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "METRIC_UPDATED",
    resourceType: "Metric",
    resourceId: id,
    metadata: dataToUpdate,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, updated);
}

/**
 * DELETE /api/v1/metrics/:id
 * Remove a metric and associated alerts.
 */
export async function deleteMetric(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Metric ID is required");
  }

  const metric = await prisma.metric.findUnique({
    where: { id },
  });

  if (!metric) {
    throw AppError.notFound("Metric not found");
  }

  if (metric.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: metric belongs to a different organization");
  }

  await resolveWorkspaceAccess(metric.workspaceId, userId, organizationId, roleName);

  await prisma.metric.delete({
    where: { id },
  });

  await logAuditEvent({
    organizationId,
    userId,
    action: "METRIC_DELETED",
    resourceType: "Metric",
    resourceId: id,
    metadata: { name: metric.name },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  sendSuccess(res, { message: `Metric "${metric.name}" deleted successfully` });
}

/**
 * POST /api/v1/metrics/:id/calculate
 * Computes the real-time aggregated value of a metric using the secure query engine.
 */
export async function calculateMetric(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const { id } = req.params;

  if (!id) {
    throw AppError.badRequest("Metric ID is required");
  }

  const metric = await prisma.metric.findUnique({
    where: { id },
    include: {
      dataset: {
        include: { columns: true },
      },
    },
  });

  if (!metric) {
    throw AppError.notFound("Metric not found");
  }

  if (metric.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: metric belongs to a different organization");
  }

  await resolveWorkspaceAccess(metric.workspaceId, userId, organizationId, roleName);

  const startTime = Date.now();

  // Execute aggregation query via safe query engine
  const queryResult = await datasetQueryEngine.executeQuery(metric.dataset, {
    limit: 1,
    measures: [
      {
        column: metric.field,
        aggregation: metric.calculation,
        alias: "metric_val",
      },
    ],
  });

  const durationMs = Date.now() - startTime;
  const rawRow = queryResult.rows[0];
  const rawValue = rawRow ? Number(rawRow["metric_val"]) || 0 : 0;
  const formattedValue = formatMetricValue(rawValue, metric.format);

  let targetDelta: number | null = null;
  let targetPercentage: number | null = null;
  let targetMet: boolean | null = null;

  if (metric.targetValue !== null && metric.targetValue !== undefined) {
    targetDelta = rawValue - metric.targetValue;
    targetPercentage = metric.targetValue !== 0 ? (rawValue / metric.targetValue) * 100 : 0;
    targetMet = rawValue >= metric.targetValue;
  }

  sendSuccess(res, {
    metricId: metric.id,
    name: metric.name,
    calculation: metric.calculation,
    field: metric.field,
    format: metric.format,
    rawValue,
    formattedValue,
    targetValue: metric.targetValue,
    targetDelta,
    targetPercentage: targetPercentage !== null ? Math.round(targetPercentage * 10) / 10 : null,
    targetMet,
    executionTimeMs: durationMs,
    calculatedAt: new Date().toISOString(),
  });
}
