// ========================================
// Alert Routes — /api/v1/alerts
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requireAnyPermission,
} from "../middleware/auth.middleware.js";
import {
  createAlert,
  listAlerts,
  getAlert,
  updateAlert,
  deleteAlert,
  evaluateAlert,
  evaluateAllWorkspaceAlerts,
} from "../services/alert/alert.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/v1/alerts
 * Create a new smart data alert rule.
 */
router.post(
  "/",
  requireAnyPermission("ALERT_CREATE", "DATASET_CREATE", "DATASET_EDIT"),
  asyncHandler(createAlert)
);

/**
 * GET /api/v1/alerts
 * List all alerts for organization or workspace.
 */
router.get(
  "/",
  requireAnyPermission("ALERT_VIEW", "DATASET_VIEW"),
  asyncHandler(listAlerts)
);

/**
 * GET /api/v1/alerts/:id
 * Retrieve a specific alert with history.
 */
router.get(
  "/:id",
  requireAnyPermission("ALERT_VIEW", "DATASET_VIEW"),
  asyncHandler(getAlert)
);

/**
 * PATCH /api/v1/alerts/:id
 * Update alert threshold, condition, or status.
 */
router.patch(
  "/:id",
  requireAnyPermission("ALERT_EDIT", "DATASET_EDIT"),
  asyncHandler(updateAlert)
);

/**
 * DELETE /api/v1/alerts/:id
 * Remove an alert.
 */
router.delete(
  "/:id",
  requireAnyPermission("ALERT_DELETE", "DATASET_DELETE"),
  asyncHandler(deleteAlert)
);

/**
 * POST /api/v1/alerts/:id/evaluate
 * Trigger live evaluation of an alert against current data.
 */
router.post(
  "/:id/evaluate",
  requireAnyPermission("ALERT_VIEW", "DATASET_VIEW"),
  asyncHandler(evaluateAlert)
);

/**
 * POST /api/v1/alerts/workspace/:workspaceId/evaluate-all
 * Evaluate all active alerts in a workspace.
 */
router.post(
  "/workspace/:workspaceId/evaluate-all",
  requireAnyPermission("ALERT_VIEW", "DATASET_VIEW"),
  asyncHandler(evaluateAllWorkspaceAlerts)
);

export default router;
