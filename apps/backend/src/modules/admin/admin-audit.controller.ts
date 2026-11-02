// ==============================================================================
// Platform Admin Audit Controller
// ==============================================================================
// Provides global immutable WORM audit ledger access across all tenants, and
// mathematical verification of SHA-256 hash chains.
// ==============================================================================

import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuditLogModel, toObjectId } from '@repo/database';
import { auditPreviewService } from '../ricozviz/audit/audit-preview.service.js';
import { sendSuccess } from '../../utils/response.js';
import { validate } from '@repo/validation';
import { adminAuditQuerySchema } from '@repo/validation';

export class AdminAuditController {
  /**
   * Global audit ledger listing spanning all tenants with multi-field filtering.
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = validate(adminAuditQuerySchema, request.query);
    const filter: Record<string, unknown> = {};

    if (query.tenantId) {
      const orgId = toObjectId(query.tenantId);
      if (orgId) {
        filter.organizationId = orgId;
      }
    }

    if (query.action) {
      filter.action = query.action;
    }

    if (query.resourceType) {
      filter.resourceType = query.resourceType;
    }

    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);
      filter.createdAt = dateFilter;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { action: searchRegex },
        { resourceType: searchRegex },
        { resourceId: searchRegex },
        { ipAddress: searchRegex }
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .populate('user', 'name email')
        .populate('workspace', 'name')
        .lean(),
      AuditLogModel.countDocuments(filter)
    ]);

    const formatted = logs.map((log: any) => ({
      id: log._id.toString(),
      organizationId: log.organizationId?.toString(),
      workspaceId: log.workspaceId?.toString(),
      userId: log.userId?.toString(),
      userName: log.user?.name,
      userEmail: log.user?.email,
      workspaceName: log.workspace?.name,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      status: log.status || 'SUCCESS',
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      createdAt: log.createdAt
    }));

    sendSuccess(reply, { logs: formatted, total, limit: query.limit, offset: query.offset }, 200);
  }

  /**
   * Verify cryptographic WORM hash-chain continuity globally and per tenant.
   */
  async verify(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const integrity = await auditPreviewService.verifyChainIntegrity();
    sendSuccess(reply, integrity, 200);
  }
}

export const adminAuditController = new AdminAuditController();
