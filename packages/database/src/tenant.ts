import mongoose from 'mongoose';
import { toObjectId } from './models/model.util';

export type TenantFilter = Record<string, unknown>;

export interface TenantContext {
  organizationId: string | mongoose.Types.ObjectId;
  workspaceId?: string | mongoose.Types.ObjectId | null;
  /** All workspace IDs the user is a member of within the organization. */
  userWorkspaceIds?: Array<string | mongoose.Types.ObjectId>;
  /** When true, allows resources with workspaceId: null (organization-wide resources). */
  allowGlobal?: boolean;
}

/**
 * Builds a robust MongoDB filter query that guarantees organization and workspace boundaries.
 * Prevents cross-tenant data leakage by enforcing tenant ownership on every query.
 */
export function buildTenantFilter(
  context: TenantContext,
  baseFilter: TenantFilter = {}
): TenantFilter {
  const orgObjectId = toObjectId(context.organizationId);
  if (!orgObjectId) {
    throw new Error('Tenant context requires a valid organizationId');
  }

  const filter: TenantFilter = {
    ...baseFilter,
    organizationId: orgObjectId
  };

  // If a specific workspace is targeted, enforce exact match
  if (context.workspaceId) {
    const wsObjectId = toObjectId(context.workspaceId);
    if (wsObjectId) {
      filter.workspaceId = wsObjectId;
      return filter;
    }
  }

  // If user has specific workspace memberships within the organization
  if (context.userWorkspaceIds && context.userWorkspaceIds.length > 0) {
    const validWsIds = context.userWorkspaceIds
      .map((id) => toObjectId(id))
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

    if (context.allowGlobal) {
      filter.$or = [
        { workspaceId: { $in: validWsIds } },
        { workspaceId: null }
      ];
    } else {
      filter.workspaceId = { $in: validWsIds };
    }
    return filter;
  }

  // If global resources are explicitly allowed
  if (context.allowGlobal) {
    filter.workspaceId = null;
  }

  return filter;
}

/**
 * Verifies that a retrieved resource belongs to the caller's organization and workspace.
 * Throws an Error with a standardized message if isolation is violated.
 */
export function assertTenantAccess(
  resource: { organizationId?: unknown; workspaceId?: unknown } | null | undefined,
  context: { organizationId: string | mongoose.Types.ObjectId; workspaceId?: string | mongoose.Types.ObjectId | null; roleName?: string }
): void {
  if (!resource) {
    const err = new Error('Resource not found');
    (err as unknown as { statusCode: number }).statusCode = 404;
    throw err;
  }

  const callerOrgId = context.organizationId.toString();
  const resourceOrgId = resource.organizationId ? resource.organizationId.toString() : '';

  if (resourceOrgId !== callerOrgId) {
    const err = new Error('Cross-tenant access forbidden');
    (err as unknown as { statusCode: number }).statusCode = 403;
    throw err;
  }

  // If caller specified a workspace and the resource has a workspace, verify match
  if (context.workspaceId && resource.workspaceId) {
    const callerWsId = context.workspaceId.toString();
    const resourceWsId = resource.workspaceId.toString();
    const isAdmin = context.roleName?.toUpperCase() === 'ADMIN' || context.roleName?.toUpperCase() === 'OWNER';

    if (callerWsId !== resourceWsId && !isAdmin) {
      const err = new Error('Cross-workspace access forbidden');
      (err as unknown as { statusCode: number }).statusCode = 403;
      throw err;
    }
  }
}
