// ========================================
// Workspace Routes — /api/v1/workspaces
// ========================================

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "../services/workspace.service.js";

const router = Router();

// All workspace routes require an authenticated user
router.use(requireAuth);

/**
 * POST /api/v1/workspaces
 * Create a new workspace in the current user's organization.
 */
router.post("/", asyncHandler(createWorkspace));

/**
 * GET /api/v1/workspaces
 * List all workspaces accessible to the user.
 */
router.get("/", asyncHandler(listWorkspaces));

/**
 * GET /api/v1/workspaces/:id
 * Retrieve details of a specific workspace.
 */
router.get("/:id", asyncHandler(getWorkspace));

/**
 * PATCH /api/v1/workspaces/:id
 * Update workspace name or description (OWNER/ADMIN only).
 */
router.patch("/:id", asyncHandler(updateWorkspace));

/**
 * DELETE /api/v1/workspaces/:id
 * Delete a workspace (OWNER only).
 */
router.delete("/:id", asyncHandler(deleteWorkspace));

/**
 * GET /api/v1/workspaces/:id/members
 * List members of a workspace.
 */
router.get("/:id/members", asyncHandler(listWorkspaceMembers));

/**
 * POST /api/v1/workspaces/:id/members
 * Add an organization user to this workspace (OWNER/ADMIN only).
 */
router.post("/:id/members", asyncHandler(addWorkspaceMember));

/**
 * PATCH /api/v1/workspaces/:id/members/:userId
 * Update a workspace member's role (OWNER/ADMIN only).
 */
router.patch("/:id/members/:userId", asyncHandler(updateWorkspaceMemberRole));

/**
 * DELETE /api/v1/workspaces/:id/members/:userId
 * Remove a member from this workspace (OWNER/ADMIN only, or self).
 */
router.delete("/:id/members/:userId", asyncHandler(removeWorkspaceMember));

export default router;

