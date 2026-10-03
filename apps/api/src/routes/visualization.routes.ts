// ========================================
// Visualization Routes — /api/v1/visualizations
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requireAnyPermission,
} from "../middleware/auth.middleware.js";
import {
  createVisualization,
  listVisualizations,
  getVisualization,
  getVisualizationData,
  updateVisualization,
  deleteVisualization,
} from "../services/visualization/visualization.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// All visualization endpoints require authentication
router.use(requireAuth);

/**
 * POST /api/v1/visualizations
 * Create a new visualization linked to a dataset.
 */
router.post(
  "/",
  requireAnyPermission("CHART_CREATE", "DASHBOARD_EDIT", "DATASET_CREATE"),
  asyncHandler(createVisualization)
);

/**
 * GET /api/v1/visualizations
 * List visualizations (with optional workspaceId or includeData=true).
 */
router.get(
  "/",
  requireAnyPermission("CHART_VIEW", "DASHBOARD_VIEW", "DATASET_VIEW"),
  asyncHandler(listVisualizations)
);

/**
 * GET /api/v1/visualizations/:id
 * Retrieve a specific visualization (with optional includeData=true).
 */
router.get(
  "/:id",
  requireAnyPermission("CHART_VIEW", "DASHBOARD_VIEW", "DATASET_VIEW"),
  asyncHandler(getVisualization)
);

/**
 * GET /api/v1/visualizations/:id/data
 * Execute visualization configuration against its dataset and return chart-ready data.
 */
router.get(
  "/:id/data",
  requireAnyPermission("CHART_VIEW", "DASHBOARD_VIEW", "DATASET_VIEW"),
  asyncHandler(getVisualizationData)
);

/**
 * PATCH /api/v1/visualizations/:id
 * Update visualization title, chartType, or configuration.
 */
router.patch(
  "/:id",
  requireAnyPermission("CHART_EDIT", "DASHBOARD_EDIT"),
  asyncHandler(updateVisualization)
);

/**
 * DELETE /api/v1/visualizations/:id
 * Delete a visualization.
 */
router.delete(
  "/:id",
  requireAnyPermission("CHART_DELETE", "DASHBOARD_DELETE"),
  asyncHandler(deleteVisualization)
);

export default router;
