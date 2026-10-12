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
}

export const auditController = new AuditController();