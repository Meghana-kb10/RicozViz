// ========================================
// Chart Routes — /api/v1/dashboards/:dashboardId/charts
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requireAnyPermission,
} from "../middleware/auth.middleware.js";
import {
  createChart,
  listCharts,
  getChart,
  updateChart,
  deleteChart,
} from "../services/chart/chart.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router({ mergeParams: true });

// All chart endpoints require authentication
router.use(requireAuth);

/**
 * POST /api/v1/dashboards/:dashboardId/charts
 * Create a new chart in the dashboard.
 * Permission: CHART_CREATE or DASHBOARD_EDIT
 */
router.post(
  "/",
  requireAnyPermission("CHART_CREATE", "DASHBOARD_EDIT"),
  asyncHandler(createChart)
);

/**
 * GET /api/v1/dashboards/:dashboardId/charts
 * List all charts configured in the dashboard.
 * Permission: CHART_VIEW or DASHBOARD_VIEW
 */
router.get(
  "/",
  requireAnyPermission("CHART_VIEW", "DASHBOARD_VIEW"),
  asyncHandler(listCharts)
);

/**
 * GET /api/v1/dashboards/:dashboardId/charts/:chartId
 * Retrieve a specific chart.
 * Permission: CHART_VIEW or DASHBOARD_VIEW
 */
router.get(
  "/:chartId",
  requireAnyPermission("CHART_VIEW", "DASHBOARD_VIEW"),
  asyncHandler(getChart)
);

/**
 * PATCH /api/v1/dashboards/:dashboardId/charts/:chartId
 * Update chart configuration or details.
 * Permission: CHART_EDIT or DASHBOARD_EDIT
 */
router.patch(
  "/:chartId",
  requireAnyPermission("CHART_EDIT", "DASHBOARD_EDIT"),
  asyncHandler(updateChart)
);

/**
 * DELETE /api/v1/dashboards/:dashboardId/charts/:chartId
 * Delete a chart from the dashboard.
 * Permission: CHART_DELETE or DASHBOARD_DELETE
 */
router.delete(
  "/:chartId",
  requireAnyPermission("CHART_DELETE", "DASHBOARD_DELETE"),
  asyncHandler(deleteChart)
);

export default router;
