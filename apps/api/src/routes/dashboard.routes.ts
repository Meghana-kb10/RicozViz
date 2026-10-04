// ========================================
// Dashboard Routes — /api/v1/dashboards
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requirePermission,
  requireAnyPermission,
} from "../middleware/auth.middleware.js";
import { sendSuccess } from "../utils/response.js";
import {
  GrantAccessSchema,
  listDashboardCollaborators,
  grantDashboardCollaborator,
  revokeDashboardCollaborator,
} from "../services/collaboration/collaboration.service.js";
import {
  createDashboard,
  listDashboards,
  getDashboard,
  updateDashboard,
  deleteDashboard,
  createShareLink,
  getShareLinkStatus,
  disableShareLink,
  getSharedDashboard,
  getSharedChartData,
  getDashboardSchedule,
  upsertDashboardSchedule,
  deleteDashboardSchedule,
  generateDashboardReport,
  createDashboardReport,
  runDashboardReport,
  getDashboardReportHistory,
} from "../services/dashboard/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import chartRouter from "./chart.routes.js";

const router = Router();

// ============================================================
// Public Shared Dashboard Routes (No Authentication Required)
// ============================================================
router.get("/shared/:shareToken", asyncHandler(getSharedDashboard));
router.post("/shared/:shareToken/charts/:chartId/data", asyncHandler(getSharedChartData));

// Subrouter for charts nested under a dashboard: /api/v1/dashboards/:dashboardId/charts
router.use("/:dashboardId/charts", chartRouter);

// All subsequent dashboard management endpoints require authentication
router.use(requireAuth);

/**
 * POST /api/v1/dashboards/:id/share
 * Generate or activate a public share link for a dashboard.
 * Permission: DASHBOARD_EDIT
 */
router.post(
  "/:id/share",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(createShareLink)
);

/**
 * GET /api/v1/dashboards/:id/share
 * Check share link status.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id/share",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(getShareLinkStatus)
);

/**
 * DELETE /api/v1/dashboards/:id/share
 * Deactivate a dashboard share link.
 * Permission: DASHBOARD_EDIT
 */
router.delete(
  "/:id/share",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(disableShareLink)
);

// ============================================================
// FEATURE 15: WORKSPACE COLLABORATION & RESOURCE SHARING
// ============================================================

/**
 * GET /api/v1/dashboards/:id/collaborators
 * List collaborators and access levels for a dashboard.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id/collaborators",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const result = await listDashboardCollaborators(
      req.params.id as string,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, result, 200);
  })
);

/**
 * POST /api/v1/dashboards/:id/collaborators
 * Grant access to a workspace member.
 * Permission: DASHBOARD_SHARE or COLLABORATION_MANAGE
 */
router.post(
  "/:id/collaborators",
  requireAnyPermission("DASHBOARD_SHARE", "COLLABORATION_MANAGE", "DASHBOARD_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsed = GrantAccessSchema.parse(req.body);
    const result = await grantDashboardCollaborator(
      req.params.id as string,
      parsed.targetUserId,
      parsed.accessLevel,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, result, 201);
  })
);

/**
 * DELETE /api/v1/dashboards/:id/collaborators/:accessId
 * Revoke collaborator access.
 * Permission: DASHBOARD_SHARE or COLLABORATION_MANAGE
 */
router.delete(
  "/:id/collaborators/:accessId",
  requireAnyPermission("DASHBOARD_SHARE", "COLLABORATION_MANAGE", "DASHBOARD_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const result = await revokeDashboardCollaborator(
      req.params.id as string,
      req.params.accessId as string,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, result, 200);
  })
);

/**
 * GET /api/v1/dashboards/:id/schedule
 * Retrieve scheduled report configuration for a dashboard.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id/schedule",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(getDashboardSchedule)
);

/**
 * POST /api/v1/dashboards/:id/schedule
 * Create or update scheduled report configuration for a dashboard.
 * Permission: DASHBOARD_EDIT
 */
router.post(
  "/:id/schedule",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(upsertDashboardSchedule)
);

/**
 * DELETE /api/v1/dashboards/:id/schedule
 * Delete scheduled report configuration for a dashboard.
 * Permission: DASHBOARD_EDIT
 */
router.delete(
  "/:id/schedule",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(deleteDashboardSchedule)
);

/**
 * POST /api/v1/dashboards/:id/reports/generate
 * Generate on-demand or scheduled report snapshot reusing dashboard queries.
 * Permission: DASHBOARD_VIEW
 */
router.post(
  "/:id/reports/generate",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(generateDashboardReport)
);

/**
 * POST /api/v1/dashboards/:id/reports
 * Create a scheduled report for a dashboard.
 * Permission: DASHBOARD_EDIT
 */
router.post(
  "/:id/reports",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(createDashboardReport)
);

/**
 * POST /api/v1/dashboards/:id/reports/:reportId/run
 * Run an existing report manually.
 * Permission: DASHBOARD_VIEW
 */
router.post(
  "/:id/reports/:reportId/run",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(runDashboardReport)
);

/**
 * GET /api/v1/dashboards/:id/reports/history
 * List historical report executions.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id/reports/history",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(getDashboardReportHistory)
);

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
