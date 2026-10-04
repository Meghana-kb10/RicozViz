// ========================================
// Export Center Routes — /api/v1/exports
// ========================================

import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../middleware/auth.middleware.js";
import { sendSuccess } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { exportResource, listExportHistory } from "../services/export/export.service.js";

const router = Router();

router.use(requireAuth);

const exportRequestSchema = z.object({
  resourceType: z.enum(["DATASET", "VISUALIZATION", "DASHBOARD"]),
  resourceId: z.string().min(1, "Resource ID is required"),
  format: z.enum(["CSV", "EXCEL", "PDF", "PNG"]),
  workspaceId: z.string().optional(),
  options: z
    .object({
      includeHeaders: z.boolean().optional(),
      rowLimit: z.number().int().positive().max(25000).optional(),
      title: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /api/v1/exports
 * Execute a bounded export for a dataset, visualization, or dashboard.
 * Supports CSV, Excel (.xlsx), PDF, and PNG formats.
 * Permission: DATA_EXPORT
 */
router.post(
  "/",
  requirePermission("DATA_EXPORT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsed = exportRequestSchema.parse(req.body);

    const result = await exportResource({
      resourceType: parsed.resourceType,
      resourceId: parsed.resourceId,
      format: parsed.format,
      options: parsed.options,
      userId: user.userId,
      organizationId: user.organizationId,
      workspaceId: parsed.workspaceId,
      userRoleName: user.roleName,
    });

    sendSuccess(res, result, 200);
  })
);

/**
 * GET /api/v1/exports/history
 * List recent export executions for the current workspace / organization.
 * Permission: DATA_EXPORT
 */
router.get(
  "/history",
  requirePermission("DATA_EXPORT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;

    const history = await listExportHistory(user.organizationId, workspaceId, limit);
    sendSuccess(res, history, 200);
  })
);

export default router;
