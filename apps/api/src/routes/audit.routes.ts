// ========================================
// Audit Log Routes — /api/v1/audit-logs
// ========================================

import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";
import { sendSuccess } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { queryAuditLogs, getAuditLogStats } from "../services/audit.service.js";
import { verifyResourceWorkspaceAccess } from "../services/workspace/workspace-auth.helper.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/audit-logs
 * Query append-only audit events with filters, search, and pagination.
 * Permission: AUDIT_LOG_VIEW
 */
router.get(
  "/",
  requirePermission("AUDIT_LOG_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const resourceType = typeof req.query.resourceType === "string" ? req.query.resourceType : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

    if (workspaceId) {
      await verifyResourceWorkspaceAccess(
        { workspaceId, organizationId: user.organizationId },
        user.userId,
        user.organizationId,
        user.roleName,
        "READ"
      );
    }

    const result = await queryAuditLogs({
      organizationId: user.organizationId,
      workspaceId,
      action,
      resourceType,
      userId,
      status,
      startDate,
      endDate,
      search,
      limit,
      offset,
    });

    sendSuccess(res, result, 200);
  })
);

/**
 * GET /api/v1/audit-logs/stats
 * Summary statistics of audit events for compliance & monitoring.
 * Permission: AUDIT_LOG_VIEW
 */
router.get(
  "/stats",
  requirePermission("AUDIT_LOG_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;

    if (workspaceId) {
      await verifyResourceWorkspaceAccess(
        { workspaceId, organizationId: user.organizationId },
        user.userId,
        user.organizationId,
        user.roleName,
        "READ"
      );
    }

    const stats = await getAuditLogStats(user.organizationId, workspaceId);
    sendSuccess(res, stats, 200);
  })
);

export default router;
