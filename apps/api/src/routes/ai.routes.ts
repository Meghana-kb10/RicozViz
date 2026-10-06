// ========================================
// AI Analytics Routes — /api/v1/ai
// ========================================
// Exposes Phase 2 AI Analytics capabilities:
// 1. POST /api/v1/ai/ask — AI Data Analyst question
// 2. POST /api/v1/ai/nl-to-chart — Natural Language to Chart specification
// 3. POST /api/v1/ai/insights — Automatic statistical insights & anomaly detection
// 4. POST /api/v1/ai/dashboard-summary — AI-powered dashboard summary
// ========================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { sendSuccess } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  askDataAnalyst,
  nlToChart,
  generateDatasetInsights,
  generateDashboardSummary,
} from "../services/ai/ai-analytics.service.js";

const router = Router();

// All AI endpoints require authentication
router.use(requireAuth);

// ------------------------------------------------------------
// Validation Schemas
// ------------------------------------------------------------

const filterSchema = z.object({
  column: z.string().min(1),
  operator: z.string().default("="),
  value: z.unknown(),
});

const askAnalystSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  question: z.string().min(1, "question is required"),
  filters: z.array(filterSchema).optional(),
  dashboardId: z.string().optional(),
});

const nlToChartSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  prompt: z.string().min(1, "prompt is required"),
  filters: z.array(filterSchema).optional(),
});

const insightsSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  dimension: z.string().optional(),
  measure: z.string().optional(),
  filters: z.array(filterSchema).optional(),
  data: z.array(z.record(z.unknown())).optional(),
});

const dashboardSummarySchema = z.object({
  dashboardId: z.string().min(1, "dashboardId is required"),
  activeFilters: z.array(filterSchema).optional(),
});

// ------------------------------------------------------------
// Route Handlers
// ------------------------------------------------------------

/**
 * POST /api/v1/ai/ask
 * AI Data Analyst grounded Q&A
 */
router.post(
  "/ask",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleName } = req.user!;
    const body = askAnalystSchema.parse(req.body);

    const result = await askDataAnalyst(userId, organizationId, roleName, {
      datasetId: body.datasetId,
      question: body.question,
      filters: body.filters,
      dashboardId: body.dashboardId,
    });

    sendSuccess(res, result);
  })
);

/**
 * POST /api/v1/ai/nl-to-chart
 * Natural Language to Chart generation
 */
router.post(
  "/nl-to-chart",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleName } = req.user!;
    const body = nlToChartSchema.parse(req.body);

    const result = await nlToChart(userId, organizationId, roleName, {
      datasetId: body.datasetId,
      prompt: body.prompt,
      filters: body.filters,
    });

    sendSuccess(res, result);
  })
);

/**
 * POST /api/v1/ai/insights
 * Automatic insights and anomaly detection
 */
router.post(
  "/insights",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleName } = req.user!;
    const body = insightsSchema.parse(req.body);

    const result = await generateDatasetInsights(userId, organizationId, roleName, {
      datasetId: body.datasetId,
      dimension: body.dimension,
      measure: body.measure,
      filters: body.filters,
      data: body.data,
    });

    sendSuccess(res, result);
  })
);

/**
 * POST /api/v1/ai/dashboard-summary
 * AI-powered dashboard summary
 */
router.post(
  "/dashboard-summary",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, roleName } = req.user!;
    const body = dashboardSummarySchema.parse(req.body);

    const result = await generateDashboardSummary(userId, organizationId, roleName, {
      dashboardId: body.dashboardId,
      activeFilters: body.activeFilters,
    });

    sendSuccess(res, result);
  })
);

export default router;
