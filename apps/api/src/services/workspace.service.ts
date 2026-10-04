// ========================================
// Workspace Service
// ========================================
// Manages workspace CRUD, membership, role-based access control,
// organization tenancy isolation, and safe user data exposure.
// ========================================

import type { Request, Response } from "express";
import { z } from "zod";
import type { Prisma, WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";
import { logAuditEvent } from "./audit.service.js";

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

export const createWorkspaceSchema = z.object({
  name: z
    .string({ required_error: "Workspace name is required" })
    .trim()
    .min(1, "Workspace name cannot be empty")
    .max(100, "Workspace name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name cannot be empty")
    .max(100, "Workspace name cannot exceed 100 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "EDITOR", "VIEWER"]).default("MEMBER"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || "workspace";
}

async function ensureUniqueSlug(
  organizationId: string,
  baseSlug: string,
  excludeWorkspaceId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  for (let attempt = 0; attempt < 50; attempt++) {
    const existing = await prisma.workspace.findFirst({
      where: {
        organizationId,
        slug,
        ...(excludeWorkspaceId ? { NOT: { id: excludeWorkspaceId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}

export interface UserWorkspaceContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  userRole: WorkspaceRole;
  isOrgAdmin: boolean;
}

export async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<UserWorkspaceContext> {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      organizationId,
    },
  });

  if (!workspace) {
    throw AppError.notFound("Workspace not found");
  }

  const isOrgAdmin = userRoleName === "ADMIN";

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden("Access denied: You do not have access to this workspace");
  }

  const userRole: WorkspaceRole = membership?.role ?? "ADMIN";

  return {
    workspace,
    userRole,
    isOrgAdmin,
  };
}

// ============================================================
// WORKSPACE CRUD CONTROLLERS
// ============================================================

/**
 * POST /api/v1/workspaces
 * Create a new workspace in the authenticated user's organization.
 * Automatically designates creator as OWNER.
 */
export async function createWorkspace(req: Request, res: Response): Promise<void> {
  const { userId, organizationId } = req.user!;
  const input = createWorkspaceSchema.parse(req.body);

  const baseSlug = generateSlug(input.name);
  const slug = await ensureUniqueSlug(organizationId, baseSlug);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const workspace = await tx.workspace.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        organizationId,
      },
    });

    const member = await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: "OWNER",
      },
    });

    return { workspace, member };
  });

  void logAuditEvent({
    userId,
    organizationId,
    action: "WORKSPACE_CREATE",
    resourceType: "WORKSPACE",
    resourceId: result.workspace.id,
    metadata: { name: result.workspace.name, slug: result.workspace.slug },
  });

  sendSuccess(
    res,
    {
      id: result.workspace.id,
      name: result.workspace.name,
      slug: result.workspace.slug,
      description: result.workspace.description,
      organizationId: result.workspace.organizationId,
      role: result.member.role,
      memberCount: 1,
      createdAt: result.workspace.createdAt.toISOString(),
      updatedAt: result.workspace.updatedAt.toISOString(),
    },
    201
  );
}

/**
 * GET /api/v1/workspaces
 * List all workspaces accessible to the authenticated user within their organization.
 */
export async function listWorkspaces(req: Request, res: Response): Promise<void> {
  const { userId, organizationId, roleName } = req.user!;
  const isOrgAdmin = roleName === "ADMIN";

  let workspaces;

  if (isOrgAdmin) {
    // Org admins can view all workspaces within their organization
    workspaces = await prisma.workspace.findMany({
      where: { organizationId },
      include: {
        members: {
          select: {
            userId: true,
            role: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    // Regular users view workspaces they are actively members of
    workspaces = await prisma.workspace.findMany({
      where: {
        organizationId,
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          where: { userId },
          select: {
            userId: true,
            role: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const data = workspaces.map((ws) => {
    const userMembership = ws.members.find((m) => m.userId === userId);
    const role: WorkspaceRole = userMembership?.role ?? (isOrgAdmin ? "ADMIN" : "MEMBER");

    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      description: ws.description,
      organizationId: ws.organizationId,
      role,
      memberCount: ws._count.members,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
    };
  });

  sendSuccess(res, data);
}

/**
 * GET /api/v1/workspaces/:id
 * Retrieve details for a specific workspace.
 */
export async function getWorkspace(req: Request, res: Response): Promise<void> {
  const { userId, organizationId, roleName } = req.user!;
  const workspaceId = req.params["id"];
  if (!workspaceId) {
    throw AppError.badRequest("Workspace ID is required");
  }

  const { workspace, userRole } = await resolveWorkspaceAccess(
    workspaceId,
    userId,
    organizationId,
    roleName
  );

  const memberCount = await prisma.workspaceMember.count({
    where: { workspaceId },
  });

  sendSuccess(res, {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    organizationId: workspace.organizationId,
    role: userRole,
    memberCount,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  });
}

/**
 * PATCH /api/v1/workspaces/:id
 * Update workspace name or description. Only OWNER or ADMIN (or Org Admin).
 */
export async function updateWorkspace(req: Request, res: Response): Promise<void> {
  const { userId, organizationId, roleName } = req.user!;
  const workspaceId = req.params["id"];
  if (!workspaceId) {
    throw AppError.badRequest("Workspace ID is required");
  }
  const input = updateWorkspaceSchema.parse(req.body);

  const { workspace, userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    userId,
    organizationId,
    roleName
  );

  if (userRole !== "OWNER" && userRole !== "ADMIN" && !isOrgAdmin) {
    throw AppError.forbidden("Only workspace owners or admins can update workspace details");
  }

  let slug = workspace.slug;
  if (input.name && input.name !== workspace.name) {
    const baseSlug = generateSlug(input.name);
    slug = await ensureUniqueSlug(organizationId, baseSlug, workspace.id);
  }

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(input.name ? { name: input.name, slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  void logAuditEvent({
    userId,
    organizationId,
    action: "WORKSPACE_UPDATE",
    resourceType: "WORKSPACE",
    resourceId: workspaceId,
    metadata: { changes: input },
  });

  sendSuccess(res, {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    organizationId: updated.organizationId,
    role: userRole,
    memberCount: updated._count.members,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

/**
 * DELETE /api/v1/workspaces/:id
 * Delete a workspace. Only OWNER (or Org Admin).
 * Safe deletion: removes workspace and member joins without touching users or organization.
 */
export async function deleteWorkspace(req: Request, res: Response): Promise<void> {
  const { userId, organizationId, roleName } = req.user!;
  const workspaceId = req.params["id"];
  if (!workspaceId) {
    throw AppError.badRequest("Workspace ID is required");
  }

  const { workspace, userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    userId,
    organizationId,
    roleName
  );

  if (userRole !== "OWNER" && !isOrgAdmin) {
    throw AppError.forbidden("Only workspace owners can delete this workspace");
  }

  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  void logAuditEvent({
    userId,
    organizationId,
    action: "WORKSPACE_DELETE",
    resourceType: "WORKSPACE",
    resourceId: workspaceId,
    metadata: { name: workspace.name },
  });

  sendSuccess(res, { message: "Workspace deleted successfully", id: workspaceId });
}

// ============================================================
// WORKSPACE MEMBERSHIP CONTROLLERS
// ============================================================

/**
 * GET /api/v1/workspaces/:id/members
 * List all members of a workspace with sanitized user information.
 */
export async function listWorkspaceMembers(req: Request, res: Response): Promise<void> {
  const { userId, organizationId, roleName } = req.user!;
  const workspaceId = req.params["id"];
  if (!workspaceId) {
    throw AppError.badRequest("Workspace ID is required");
  }

  await resolveWorkspaceAccess(workspaceId, userId, organizationId, roleName);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const safeMembers = members.map((m) => ({
    id: m.id,
    workspaceId: m.workspaceId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      status: m.user.status,
    },
  }));

  sendSuccess(res, safeMembers);
}

/**
 * POST /api/v1/workspaces/:id/members
 * Add a member to a workspace. Must be from the same organization.
 * Only OWNER or ADMIN (or Org Admin).
 */
export async function addWorkspaceMember(req: Request, res: Response): Promise<void> {
  const { userId, organizationId, roleName } = req.user!;
  const workspaceId = req.params["id"];
  if (!workspaceId) {
    throw AppError.badRequest("Workspace ID is required");
  }
  const input = addWorkspaceMemberSchema.parse(req.body);

  const { userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    userId,
    organizationId,
    roleName
  );

  if (userRole !== "OWNER" && userRole !== "ADMIN" && !isOrgAdmin) {
    throw AppError.forbidden("Only workspace owners or admins can add members");
  }

  // 1. Verify target user belongs to the same organization
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: input.userId,
        organizationId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          status: true,
        },
      },
    },
  });

  if (!orgMembership) {
    throw AppError.badRequest("Target user does not belong to this organization");
  }

  // 2. Check for duplicate workspace membership
  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: input.userId,
      },
    },
  });

  if (existingMember) {
    throw AppError.conflict("User is already a member of this workspace");
  }

  // 3. Create membership
  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: input.userId,
      role: input.role,
    },
  });

  void logAuditEvent({
    userId,
    organizationId,
    action: "WORKSPACE_MEMBER_ADD",
    resourceType: "WORKSPACE",
    resourceId: workspaceId,
    metadata: { addedUserId: input.userId, role: input.role },
  });

  sendSuccess(
    res,
    {
      id: member.id,
      workspaceId: member.workspaceId,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      user: {
        id: orgMembership.user.id,
        name: orgMembership.user.name,
        email: orgMembership.user.email,
        avatarUrl: orgMembership.user.avatarUrl,
        status: orgMembership.user.status,
      },
    },
    201
  );
}

/**
 * DELETE /api/v1/workspaces/:id/members/:userId
 * Remove a member from a workspace.
 * Only OWNER or ADMIN (or self-removal, or Org Admin).
 * Safeguard: Cannot remove the final OWNER of a workspace.
 */
export async function removeWorkspaceMember(req: Request, res: Response): Promise<void> {
  const { userId: currentUserId, organizationId, roleName } = req.user!;
  const workspaceId = req.params["id"];
  const targetUserId = req.params["userId"];
  if (!workspaceId) {
    throw AppError.badRequest("Workspace ID is required");
  }
  if (!targetUserId) {
    throw AppError.badRequest("Target User ID is required");
  }

  const { userRole, isOrgAdmin } = await resolveWorkspaceAccess(
    workspaceId,
    currentUserId,
    organizationId,
    roleName
  );

  const isSelf = currentUserId === targetUserId;

  if (userRole !== "OWNER" && userRole !== "ADMIN" && !isOrgAdmin && !isSelf) {
    throw AppError.forbidden("Only workspace owners or admins can remove members");
  }

  // 1. Verify target membership exists
  const targetMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: targetUserId,
      },
    },
  });

  if (!targetMember) {
    throw AppError.notFound("Member not found in this workspace");
  }

  // 2. Safeguard: if target member is OWNER, ensure at least one other OWNER remains
  if (targetMember.role === "OWNER") {
    const ownerCount = await prisma.workspaceMember.count({
      where: {
        workspaceId,
        role: "OWNER",
      },
    });

    if (ownerCount <= 1) {
      throw AppError.badRequest("Cannot remove the final owner from a workspace");
    }
  }

  // 3. Delete membership
  await prisma.workspaceMember.delete({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: targetUserId,
      },
    },
  });

  void logAuditEvent({
    userId: currentUserId,
    organizationId,
    action: "WORKSPACE_MEMBER_REMOVE",
    resourceType: "WORKSPACE",
    resourceId: workspaceId,
    metadata: { removedUserId: targetUserId },
  });

  sendSuccess(res, {
    message: "Member removed from workspace successfully",
    workspaceId,
    userId: targetUserId,
  });
}
