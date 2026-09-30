// ========================================
// Dashboard Routes — /api/v1/dashboards
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";
import {
  createDashboard,
  listDashboards,
  getDashboard,
  updateDashboard,
  deleteDashboard,
} from "../services/dashboard/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// All dashboard endpoints require authentication
router.use(requireAuth);

/**
 * POST /api/v1/dashboards
 * Create a new dashboard.
 * Permission: DASHBOARD_CREATE
 */
router.post(
  "/",
  requirePermission("DASHBOARD_CREATE"),
  asyncHandler(createDashboard)
);

/**
 * GET /api/v1/dashboards
 * List dashboards belonging to the user's organization.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(listDashboards)
);

/**
 * GET /api/v1/dashboards/:id
 * Retrieve a single dashboard with layout and charts.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(getDashboard)
);

/**
 * PATCH /api/v1/dashboards/:id
 * Update dashboard metadata, layout configuration, or status.
 * Permission: DASHBOARD_EDIT
 */
router.patch(
  "/:id",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(updateDashboard)
);

/**
 * DELETE /api/v1/dashboards/:id
 * Delete a dashboard.
 * Permission: DASHBOARD_DELETE (ADMIN only)
 */
router.delete(
  "/:id",
  requirePermission("DASHBOARD_DELETE"),
  asyncHandler(deleteDashboard)
);

export default router;
