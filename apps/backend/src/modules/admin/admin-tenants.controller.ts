// ==============================================================================
// Platform Admin Tenants Controller
// ==============================================================================
// Manages organization tenant lifecycles: listing, usage analytics, plan changes,
// and emergency suspension / unsuspension with immutable audit logging.
// ==============================================================================

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  OrganizationModel,
  OrganizationMemberModel,
  WorkspaceModel,
  DatasetModel,
  DashboardModel,
  toObjectId
} from '@repo/database';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { logAuditEvent } from '../ricozviz/audit/audit.service.js';
import { validate } from '@repo/validation';
import {
  adminTenantListQuerySchema,
  adminTenantPlanUpdateSchema,
  adminTenantSuspendSchema
} from '@repo/validation';

export class AdminTenantsController {
  /**
   * List all tenants with search, status filtering, member counts, and dataset/dashboard counts.
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = validate(adminTenantListQuerySchema, request.query);
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { slug: searchRegex }];
    }

    const [tenants, total] = await Promise.all([
      OrganizationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .lean(),
      OrganizationModel.countDocuments(filter)
    ]);

    // Enrich with member, workspace, and dataset counts
    const enriched = await Promise.all(
      tenants.map(async (t) => {
        const [memberCount, workspaceCount, datasetCount, dashboardCount] = await Promise.all([
          OrganizationMemberModel.countDocuments({ organizationId: t._id }),
          WorkspaceModel.countDocuments({ organizationId: t._id }),
          DatasetModel.countDocuments({ organizationId: t._id }),
          DashboardModel.countDocuments({ organizationId: t._id })
        ]);

        return {
          id: t._id.toString(),
          name: t.name,
          slug: t.slug,
          status: t.status || 'ACTIVE',
          plan: t.plan || 'STARTER',
          memberCount,
          workspaceCount,
          datasetCount,
          dashboardCount,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        };
      })
    );

    sendSuccess(reply, { tenants: enriched, total, limit: query.limit, offset: query.offset }, 200);
  }

  /**
   * Detailed tenant view including usage quotas and workspaces.
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const orgId = toObjectId(id);
    if (!orgId) throw AppError.badRequest('Invalid tenant ID');

    const tenant = await OrganizationModel.findById(orgId).lean();
    if (!tenant) throw AppError.notFound('Tenant not found');

    const [members, workspaces, datasetCount, dashboardCount] = await Promise.all([
      OrganizationMemberModel.find({ organizationId: orgId }).lean(),
      WorkspaceModel.find({ organizationId: orgId }).lean(),
      DatasetModel.countDocuments({ organizationId: orgId }),
      DashboardModel.countDocuments({ organizationId: orgId })
    ]);

    sendSuccess(
      reply,
      {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status || 'ACTIVE',
        plan: tenant.plan || 'STARTER',
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        metrics: {
          memberCount: members.length,
          workspaceCount: workspaces.length,
          datasetCount,
          dashboardCount
        },
        workspaces: workspaces.map((w) => ({
          id: w._id.toString(),
          name: w.name,
          slug: w.slug
        }))
      },
      200
    );
  }

  /**
   * Suspend a tenant, blocking all member access with immediate 403 on customer routes.
   */
  async suspend(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = validate(adminTenantSuspendSchema, request.body);
    const orgId = toObjectId(id);
    if (!orgId) throw AppError.badRequest('Invalid tenant ID');

    const tenant = await OrganizationModel.findById(orgId);
    if (!tenant) throw AppError.notFound('Tenant not found');

    const previousStatus = tenant.status || 'ACTIVE';
    tenant.status = 'SUSPENDED';
    await tenant.save();

    await logAuditEvent({
      organizationId: tenant._id.toString(),
      userId: request.adminUser!.userId,
      action: 'ADMIN_TENANT_SUSPENDED',
      resourceType: 'ORGANIZATION',
      resourceId: tenant._id.toString(),
      ipAddress: request.ip,
      metadata: {
        reason: body.reason,
        adminEmail: request.adminUser!.email,
        previousStatus,
        newStatus: 'SUSPENDED'
      }
    });

    sendSuccess(reply, { id: tenant._id.toString(), status: 'SUSPENDED', message: 'Tenant successfully suspended' }, 200);
  }

  /**
   * Unsuspend a tenant, restoring customer route access.
   */
  async unsuspend(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const orgId = toObjectId(id);
    if (!orgId) throw AppError.badRequest('Invalid tenant ID');

    const tenant = await OrganizationModel.findById(orgId);
    if (!tenant) throw AppError.notFound('Tenant not found');

    const previousStatus = tenant.status;
    tenant.status = 'ACTIVE';
    await tenant.save();

    await logAuditEvent({
      organizationId: tenant._id.toString(),
      userId: request.adminUser!.userId,
      action: 'ADMIN_TENANT_UNSUSPENDED',
      resourceType: 'ORGANIZATION',
      resourceId: tenant._id.toString(),
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        previousStatus,
        newStatus: 'ACTIVE'
      }
    });

    sendSuccess(reply, { id: tenant._id.toString(), status: 'ACTIVE', message: 'Tenant successfully restored' }, 200);
  }

  /**
   * Update tenant plan tier.
   */
  async updatePlan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = validate(adminTenantPlanUpdateSchema, request.body);
    const orgId = toObjectId(id);
    if (!orgId) throw AppError.badRequest('Invalid tenant ID');

    const tenant = await OrganizationModel.findById(orgId);
    if (!tenant) throw AppError.notFound('Tenant not found');

    const previousPlan = tenant.plan || 'STARTER';
    tenant.plan = body.plan;
    await tenant.save();

    await logAuditEvent({
      organizationId: tenant._id.toString(),
      userId: request.adminUser!.userId,
      action: 'ADMIN_TENANT_PLAN_CHANGED',
      resourceType: 'ORGANIZATION',
      resourceId: tenant._id.toString(),
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        previousPlan,
        newPlan: body.plan
      }
    });

    sendSuccess(reply, { id: tenant._id.toString(), plan: body.plan, message: `Plan updated to ${body.plan}` }, 200);
  }
}

export const adminTenantsController = new AdminTenantsController();
