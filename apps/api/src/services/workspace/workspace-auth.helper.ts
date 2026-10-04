// ========================================
// Workspace Authorization Helper for Resources
// ========================================
// Validates workspace membership and ensures data source
// and dataset requests are securely scoped to user workspaces.
// ========================================

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { resolveWorkspaceAccess } from "../workspace.service.js";

/**
 * Resolves target workspaceId for resource creation or query filtering.
 * - If targetWorkspaceId is supplied by the client, verifies membership.
 * - If not supplied, falls back to the user's first accessible workspace in the organization.
 */
export async function resolveTargetWorkspaceId(
  targetWorkspaceId: string | undefined | null,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<string | null> {
  if (targetWorkspaceId) {
    await resolveWorkspaceAccess(targetWorkspaceId, userId, organizationId, userRoleName);
    return targetWorkspaceId;
  }

  // Fallback to first accessible workspace for this user in the organization
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspace: { organizationId },
    },
    select: { workspaceId: true },
  });

  return membership?.workspaceId ?? null;
}

/**
 * Verifies that the authenticated user has access to the workspace of the given resource.
 * If resource belongs to a workspace, checks user's membership (or org admin).
 * Prevents Workspace A users from accessing Workspace B resources.
 */
export async function verifyResourceWorkspaceAccess(
  resource: { workspaceId?: string | null; organizationId: string },
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: "READ" | "WRITE" = "READ"
): Promise<void> {
  // 1. Organization tenant isolation
  if (resource.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  // 2. Workspace scoping
  if (resource.workspaceId) {
    const access = await resolveWorkspaceAccess(resource.workspaceId, userId, organizationId, userRoleName);
    if (requiredAction === "WRITE" && access.userRole === "VIEWER" && !access.isOrgAdmin) {
      throw AppError.forbidden("Access denied: Viewers have read-only access to this workspace");
    }
  }
}
