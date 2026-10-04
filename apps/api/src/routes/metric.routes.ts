// ========================================
// Metric Routes — /api/v1/metrics
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requireAnyPermission,
} from "../middleware/auth.middleware.js";
import {
  createMetric,
  listMetrics,
  getMetric,
  updateMetric,
  deleteMetric,
  calculateMetric,
} from "../services/metric/metric.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/v1/metrics
 * Create a new reusable KPI / business metric.
 */
router.post(
  "/",
  requireAnyPermission("METRIC_CREATE", "DATASET_CREATE", "DATASET_EDIT"),
  asyncHandler(createMetric)
);

/**
 * GET /api/v1/metrics
 * List metrics in workspace or organization.
 */
router.get(
  "/",
  requireAnyPermission("METRIC_VIEW", "DATASET_VIEW"),
  asyncHandler(listMetrics)
);

/**
 * GET /api/v1/metrics/:id
 * Retrieve specific metric.
 */
router.get(
  "/:id",
  requireAnyPermission("METRIC_VIEW", "DATASET_VIEW"),
  asyncHandler(getMetric)
);

/**
 * PATCH /api/v1/metrics/:id
 * Update metric details, configuration, or targets.
 */
router.patch(
  "/:id",
  requireAnyPermission("METRIC_EDIT", "DATASET_EDIT"),
  asyncHandler(updateMetric)
);

/**
 * DELETE /api/v1/metrics/:id
 * Delete metric.
 */
router.delete(
  "/:id",
  requireAnyPermission("METRIC_DELETE", "DATASET_DELETE"),
  asyncHandler(deleteMetric)
);

/**
 * POST /api/v1/metrics/:id/calculate
 * Calculate real-time metric value via secure query engine.
 */
router.post(
  "/:id/calculate",
  requireAnyPermission("METRIC_VIEW", "DATASET_VIEW"),
  asyncHandler(calculateMetric)
);

export default router;
