// ========================================
// Dashboard Templates Routes — /api/v1/templates
// ========================================

import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAnyPermission } from "../middleware/auth.middleware.js";
import { sendSuccess } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  listTemplates,
  getTemplateById,
  createTemplateFromDashboard,
  instantiateDashboardFromTemplate,
} from "../services/template/template.service.js";

const router = Router();

router.use(requireAuth);

const createFromDashboardSchema = z.object({
  dashboardId: z.string().uuid("Invalid dashboard ID"),
  name: z.string().min(1, "Template name is required").max(100),
  description: z.string().max(500).optional(),
  category: z.string().min(1, "Category is required"),
  workspaceId: z.string().optional(),
});

const instantiateSchema = z.object({
  name: z.string().min(1, "Dashboard name is required").max(100),
  description: z.string().max(500).optional(),
  workspaceId: z.string().optional(),
  targetDatasetId: z.string().optional(),
});

/**
 * GET /api/v1/templates
 * List system and custom dashboard templates.
 * Permission: TEMPLATE_VIEW or DASHBOARD_VIEW
 */
router.get(
  "/",
  requireAnyPermission("TEMPLATE_VIEW", "DASHBOARD_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;

    const templates = await listTemplates(user.organizationId, workspaceId, category);
    sendSuccess(res, templates, 200);
  })
);

/**
 * GET /api/v1/templates/:id
 * Retrieve a single template with layout and widget configuration.
 * Permission: TEMPLATE_VIEW or DASHBOARD_VIEW
 */
router.get(
  "/:id",
  requireAnyPermission("TEMPLATE_VIEW", "DASHBOARD_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const template = await getTemplateById(req.params.id as string, user.organizationId);
    sendSuccess(res, template, 200);
  })
);

/**
 * POST /api/v1/templates/from-dashboard
 * Save an existing dashboard as a reusable template.
 * Permission: TEMPLATE_CREATE or DASHBOARD_EDIT
 */
router.post(
  "/from-dashboard",
  requireAnyPermission("TEMPLATE_CREATE", "DASHBOARD_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsed = createFromDashboardSchema.parse(req.body);

    const template = await createTemplateFromDashboard({
      dashboardId: parsed.dashboardId,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      userId: user.userId,
      organizationId: user.organizationId,
      workspaceId: parsed.workspaceId,
      userRoleName: user.roleName,
    });

    sendSuccess(res, template, 201);
  })
);

/**
 * POST /api/v1/templates/:id/instantiate
 * Create a new, independent dashboard cloned from a template.
 * Permission: TEMPLATE_APPLY or DASHBOARD_CREATE
 */
router.post(
  ["/:id/instantiate", "/:id/apply"],
  requireAnyPermission("TEMPLATE_APPLY", "DASHBOARD_CREATE"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsed = instantiateSchema.parse(req.body);

    const dashboard = await instantiateDashboardFromTemplate({
      templateId: req.params.id as string,
      name: parsed.name,
      description: parsed.description,
      workspaceId: parsed.workspaceId,
      targetDatasetId: parsed.targetDatasetId,
      userId: user.userId,
      organizationId: user.organizationId,
      userRoleName: user.roleName,
    });

    sendSuccess(res, dashboard, 201);
  })
);

export default router;
