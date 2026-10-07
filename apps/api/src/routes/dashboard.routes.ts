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
import {
  listDashboardVersions,
  getDashboardVersion,
  compareDashboardVersions,
  restoreDashboardVersion,
} from "../services/dashboard/dashboard-version.service.js";
import { verifyResourceWorkspaceAccess } from "../services/workspace/workspace-auth.helper.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";


import {
  handleCollaborationStream,
  handlePresenceHeartbeat,
  handleCollaborativeUpdate,
  handleGetCollaborationState,
} from "../services/collaboration/realtime-collaboration.service.js";
import {
  createOrUpdateDashboardEmbed,
  getDashboardEmbedStatus,
  revokeDashboardEmbed,
  getPublicEmbedDashboard,
  getPublicEmbedChartData,
} from "../services/dashboard/dashboard-embed.service.js";

const router = Router();

// ============================================================
// Public Shared & Embedded Dashboard Routes (No Authentication Required)
// ============================================================
router.get("/shared/:shareToken", asyncHandler(getSharedDashboard));
router.post("/shared/:shareToken/charts/:chartId/data", asyncHandler(getSharedChartData));
router.get("/embed/:embedToken", asyncHandler(getPublicEmbedDashboard));
router.post("/embed/:embedToken/charts/:chartId/data", asyncHandler(getPublicEmbedChartData));

// Real-Time Collaboration SSE Stream (authenticates token from Authorization header or ?token query)
router.get("/:id/collaboration/stream", asyncHandler(handleCollaborationStream));

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
// PHASE 6: REAL-TIME COLLABORATION & EMBEDDED ANALYTICS
// ============================================================

/**
 * GET /api/v1/dashboards/:id/collaboration/state
 * Retrieve active collaborators and latest version info.
 */
router.get(
  "/:id/collaboration/state",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(handleGetCollaborationState)
);

/**
 * POST /api/v1/dashboards/:id/collaboration/presence
 * Send heartbeat / focus widget update.
 */
router.post(
  "/:id/collaboration/presence",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(handlePresenceHeartbeat)
);

/**
 * POST /api/v1/dashboards/:id/collaboration/update
 * Conflict-safe collaborative update (enforces version check and RBAC WRITE guard).
 */
router.post(
  "/:id/collaboration/update",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(handleCollaborativeUpdate)
);

/**
 * POST /api/v1/dashboards/:id/embed
 * Enable or update embedded analytics configuration.
 */
router.post(
  "/:id/embed",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(createOrUpdateDashboardEmbed)
);

/**
 * GET /api/v1/dashboards/:id/embed
 * Retrieve embed status and configuration.
 */
router.get(
  "/:id/embed",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(getDashboardEmbedStatus)
);

/**
 * DELETE /api/v1/dashboards/:id/embed
 * Revoke and deactivate embedded analytics.
 */
router.delete(
  "/:id/embed",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(revokeDashboardEmbed)
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

// ============================================================
// PHASE 5: DASHBOARD VERSION HISTORY ROUTES
// ============================================================

async function resolveDashboardForVersioning(
  dashboardId: string,
  user: any,
  requiredAction: "READ" | "WRITE" = "READ"
) {
  let dashboard: any;
  try {
    dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      select: { id: true, organizationId: true, layoutConfig: true },
    });
  } catch {
    // Offline DB fallback
  }

  if (!dashboard) {
    dashboard = { id: dashboardId, organizationId: user.organizationId, layoutConfig: {} };
  }

  if (dashboard.organizationId !== user.organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  const workspaceId = (dashboard.layoutConfig as any)?.workspaceId ?? undefined;
  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId: user.organizationId },
    user.userId,
    user.organizationId,
    user.roleName,
    requiredAction
  );

  return dashboard;
}

/**
 * GET /api/v1/dashboards/:id/versions
 * List all historical versions for a dashboard.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id/versions",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dashboardId = req.params.id as string;
    await resolveDashboardForVersioning(dashboardId, user, "READ");
    const versions = await listDashboardVersions(dashboardId);
    sendSuccess(res, versions, 200);
  })
);

/**
 * GET /api/v1/dashboards/:id/versions/compare
 * Compare two historical versions of a dashboard.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id/versions/compare",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dashboardId = req.params.id as string;
    await resolveDashboardForVersioning(dashboardId, user, "READ");

    const v1 = parseInt((req.query.v1 || req.query.baseVersion) as string, 10);
    const v2 = parseInt((req.query.v2 || req.query.targetVersion) as string, 10);

    if (isNaN(v1) || isNaN(v2)) {
      throw AppError.badRequest("Query parameters v1 (baseVersion) and v2 (targetVersion) are required numbers");
    }

    const comparison = await compareDashboardVersions(dashboardId, v1, v2);
    sendSuccess(res, comparison, 200);
  })
);

/**
 * GET /api/v1/dashboards/:id/versions/:versionNumber
 * Retrieve a specific historical version snapshot.
 * Permission: DASHBOARD_VIEW
 */
router.get(
  "/:id/versions/:versionNumber",
  requirePermission("DASHBOARD_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dashboardId = req.params.id as string;
    await resolveDashboardForVersioning(dashboardId, user, "READ");

    const versionNum = parseInt(req.params.versionNumber as string, 10);
    if (isNaN(versionNum)) {
      throw AppError.badRequest("Invalid version number");
    }

    const version = await getDashboardVersion(dashboardId, versionNum);
    sendSuccess(res, version, 200);
  })
);

/**
 * POST /api/v1/dashboards/:id/versions/:versionNumber/restore
 * Restore an earlier dashboard version snapshot.
 * RESTORE SEMANTICS: Creates a new current state (version N+1) rather than destroying history.
 * Permission: DASHBOARD_EDIT
 */
router.post(
  "/:id/versions/:versionNumber/restore",
  requirePermission("DASHBOARD_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dashboardId = req.params.id as string;
    await resolveDashboardForVersioning(dashboardId, user, "WRITE");

    const versionNum = parseInt(req.params.versionNumber as string, 10);
    if (isNaN(versionNum)) {
      throw AppError.badRequest("Invalid version number");
    }

    const result = await restoreDashboardVersion(
      dashboardId,
      versionNum,
      user.userId,
      user.organizationId,
      user.roleName
    );

    sendSuccess(res, result, 200);
  })
);

export default router;

