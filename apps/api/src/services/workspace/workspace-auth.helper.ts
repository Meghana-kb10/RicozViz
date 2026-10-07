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
 * Dashboards predate the first-class workspace relation and keep their
 * workspace binding in layoutConfig. Keep the extraction in one place so all
 * dashboard-adjacent features apply the same tenant boundary.
 */
export function getDashboardWorkspaceId(layoutConfig: unknown): string | undefined {
  if (!layoutConfig || typeof layoutConfig !== "object" || Array.isArray(layoutConfig)) {
    return undefined;
  }

  const workspaceId = (layoutConfig as Record<string, unknown>).workspaceId;
  return typeof workspaceId === "string" && workspaceId.trim() ? workspaceId : undefined;
}

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
  try {
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: { organizationId },
      },
      select: { workspaceId: true },
    });
    return membership?.workspaceId ?? null;
  } catch {
    return null;
  }
}

export type WorkspaceAction = "READ" | "WRITE" | "DELETE" | "ADMIN" | "SHARE";

const inMemoryWorkspaceRoleStore = new Map<string, string>();

export function registerInMemoryWorkspaceMember(workspaceId: string, userId: string, role: string): void {
  inMemoryWorkspaceRoleStore.set(`${workspaceId}:${userId}`, role);
}

export function clearInMemoryWorkspaceMembers(): void {
  inMemoryWorkspaceRoleStore.clear();
}

/**
 * Verifies that the authenticated user has access to the workspace of the given resource.
 * If resource belongs to a workspace, checks user's membership (or org admin).
 * Enforces role hierarchy: OWNER -> ADMIN -> EDITOR/MEMBER -> VIEWER.
 * Prevents Workspace A users from accessing Workspace B resources.
 */
export async function verifyResourceWorkspaceAccess(
  resource: { workspaceId?: string | null; organizationId: string },
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: WorkspaceAction = "READ"
): Promise<void> {
  // 1. Organization tenant isolation
  if (resource.organizationId !== organizationId) {
    throw AppError.forbidden("Access denied: resource belongs to a different organization");
  }

  // 2. Organization admins bypass workspace restrictions
  if (userRoleName === "ADMIN") {
    return;
  }

  // 3. Workspace scoping
  if (resource.workspaceId) {
    let userRole = inMemoryWorkspaceRoleStore.get(`${resource.workspaceId}:${userId}`);

    if (!userRole) {
      try {
        const access = await resolveWorkspaceAccess(resource.workspaceId, userId, organizationId, userRoleName);
        if (access.isOrgAdmin) {
          return; // Organization admins bypass workspace restrictions
        }
        userRole = access.userRole;
      } catch (err) {
        if (err instanceof AppError) throw err;
        return;
      }
    }

    if (requiredAction === "READ") {
      // All workspace members (OWNER, ADMIN, MEMBER, EDITOR, VIEWER) can read
      return;
    }

    if (requiredAction === "WRITE") {
      if (userRole === "VIEWER") {
        throw AppError.forbidden("Access denied: Viewers have read-only access to this workspace");
      }
      return;
    }

    if (requiredAction === "DELETE") {
      if (userRole !== "OWNER" && userRole !== "ADMIN") {
        throw AppError.forbidden("Access denied: Only workspace owners and admins can delete this resource");
      }
      return;
    }

    if (requiredAction === "SHARE") {
      if (userRole === "VIEWER") {
        throw AppError.forbidden("Access denied: Viewers cannot share workspace resources");
      }
      return;
    }

    if (requiredAction === "ADMIN") {
      if (userRole !== "OWNER" && userRole !== "ADMIN") {
        throw AppError.forbidden("Access denied: Only workspace owners and admins have administrative permissions");
      }
      return;
    }
  }
}

