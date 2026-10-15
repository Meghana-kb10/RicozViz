import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import { toObjectId } from '@repo/database';
import {
  queryAuditLogs,
  getAuditLogStats,
  type QueryAuditLogsServiceParams
} from './audit.service.js';
import { auditPreviewService } from './audit-preview.service.js';
import type { RevokeTokenPayload } from '@repo/types';

interface AuditLogQuery {
  workspaceId?: string;
  action?: string;
  resourceType?: string;
  userId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export class AuditController {
  /** GET /api/v1/audit-logs */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const query = (request.query ?? {}) as AuditLogQuery;

    const params: QueryAuditLogsServiceParams = {
      organizationId: principal.organizationId,
      workspaceId: query.workspaceId,
      action: query.action,
      resourceType: query.resourceType,
      userId: query.userId,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0
    };

    const result = await queryAuditLogs(params);
    sendSuccess(reply, result);
  }

  /** GET /api/v1/audit-logs/stats */
  async stats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const query = (request.query ?? {}) as AuditLogQuery;

    const result = await getAuditLogStats(principal.organizationId, query.workspaceId);
    sendSuccess(reply, result);
  }

  /** GET /api/v1/audit-logs/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as { id: string };

    const objectId = toObjectId(id);
    if (!objectId) {
      throw AppError.badRequest('Invalid audit log id');
    }

    const result = await queryAuditLogs({ organizationId: principal.organizationId, limit: 200 });
    const found = result.logs.find((log) => log.id === objectId.toString());
    if (!found) {
      throw AppError.notFound('Audit log');
    }

    sendSuccess(reply, found);
  }

  /** GET /api/v1/audit-logs/preview */
  async preview(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const previewData = await auditPreviewService.getAuditTrailPreview();
    sendSuccess(reply, previewData);
  }

  /** POST /api/v1/audit-logs/revoke-token */
  async revokeToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = (request.body ?? {}) as RevokeTokenPayload;
    const result = await auditPreviewService.revokeToken(body);
    sendSuccess(reply, result, 200);
  }

  /** GET /api/v1/audit-logs/verify-chain */
  async verifyChain(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await auditPreviewService.verifyChainIntegrity();
    sendSuccess(reply, result);
  }
}

export const auditController = new AuditController();