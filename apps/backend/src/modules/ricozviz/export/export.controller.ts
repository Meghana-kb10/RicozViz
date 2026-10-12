import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  exportRequestSchema,
  exportResource,
  listExportHistory,
  verifyResourceWorkspaceAccess
} from './export.service.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';

interface ExportHistoryQuery {
  workspaceId?: string;
  limit?: string;
}

export class ExportController {
  /** POST /api/v1/exports */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const parsed = exportRequestSchema.parse(request.body);
    const effectiveRowLimit = parsed.options?.rowLimit ?? parsed.rowLimit;

    const result = await exportResource({
      resourceType: parsed.resourceType,
      resourceId: parsed.resourceId,
      format: parsed.format,
      options: {
        ...parsed.options,
        rowLimit: effectiveRowLimit
      },
      userId: principal.userId,
      organizationId: principal.organizationId,
      workspaceId: parsed.workspaceId,
      userRoleName: principal.roleName
    });

    sendSuccess(reply, result, 200);
  }

  /** GET /api/v1/exports/history */
  async history(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const query = (request.query ?? {}) as ExportHistoryQuery;

    const workspaceId =
      typeof query.workspaceId === 'string' ? query.workspaceId : undefined;
    const limit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : 50;

    if (workspaceId) {
      await verifyResourceWorkspaceAccess(
        { workspaceId, organizationId: principal.organizationId },
        principal.userId,
        principal.organizationId,
        principal.roleName,
        'READ'
      );
    }

    const history = await listExportHistory(principal.organizationId, workspaceId, limit);
    sendSuccess(reply, history, 200);
  }
}

export const exportController = new ExportController();