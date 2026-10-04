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
import {
  createChartShareLink,
  revokeChartShareLink,
  getSharedChartByToken,
  getSharedChartDataByToken,
} from "../services/collaboration/collaboration.service.js";
import { sendSuccess } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// ============================================================
// Public Shared Visualization Routes (No Authentication Required)
// ============================================================
router.get(
  "/shared/:shareToken",
  asyncHandler(async (req, res) => {
    const chart = await getSharedChartByToken(req.params.shareToken as string);
    sendSuccess(res, chart, 200);
  })
);

router.post(
  "/shared/:shareToken/data",
  asyncHandler(async (req, res) => {
    const data = await getSharedChartDataByToken(req.params.shareToken as string);
    sendSuccess(res, data, 200);
  })
);

// All subsequent visualization endpoints require authentication
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

/**
 * POST /api/v1/visualizations/:id/share
 * Generate/activate public share link for standalone visualization.
 * Permission: CHART_SHARE or CHART_EDIT
 */
router.post(
  "/:id/share",
  requireAnyPermission("CHART_SHARE", "CHART_EDIT", "DASHBOARD_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const result = await createChartShareLink(
      req.params.id as string,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, result, 200);
  })
);

/**
 * DELETE /api/v1/visualizations/:id/share
 * Revoke public share link for standalone visualization.
 * Permission: CHART_SHARE or CHART_EDIT
 */
router.delete(
  "/:id/share",
  requireAnyPermission("CHART_SHARE", "CHART_EDIT", "DASHBOARD_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const result = await revokeChartShareLink(
      req.params.id as string,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, result, 200);
  })
);

export default router;
