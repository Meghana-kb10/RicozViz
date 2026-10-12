import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createVisualization,
  createVisualizationSchema,
  createChartShareLink,
  deleteVisualization,
  getSharedChartByToken,
  getSharedChartDataByToken,
  getVisualization,
  getVisualizationData,
  listVisualizations,
  revokeChartShareLink,
  updateVisualization,
  updateVisualizationSchema,
  type AuditRequestMeta
} from './visualization.service.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';

interface VisualizationParams {
  id?: string;
  shareToken?: string;
}

interface VisualizationQuery {
  workspaceId?: string;
  includeData?: string;
}

/** Forward request metadata into the audit trail, mirroring the legacy `req.ip`. */
function readAuditMeta(request: FastifyRequest): AuditRequestMeta {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  };
}

export class VisualizationController {
  /** POST /api/v1/visualizations */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const input = createVisualizationSchema.parse(request.body);

    const result = await createVisualization(
      input,
      {
        userId: principal.userId,
        organizationId: principal.organizationId,
        roleName: principal.roleName
      },
      readAuditMeta(request)
    );

    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/visualizations */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const query = (request.query ?? {}) as VisualizationQuery;

    const result = await listVisualizations(
      {
        workspaceId: typeof query.workspaceId === 'string' ? query.workspaceId : undefined,
        includeData: query.includeData === 'true'
      },
      {
        userId: principal.userId,
        organizationId: principal.organizationId,
        roleName: principal.roleName
      }
    );

    sendSuccess(reply, result);
  }

  /** GET /api/v1/visualizations/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as VisualizationParams;
    const query = (request.query ?? {}) as VisualizationQuery;

    const result = await getVisualization(
      requireParam(id),
      { includeData: query.includeData === 'true' },
      {
        userId: principal.userId,
        organizationId: principal.organizationId,
        roleName: principal.roleName
      }
    );

    sendSuccess(reply, result);
  }

  /** GET /api/v1/visualizations/:id/data */
  async getData(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as VisualizationParams;

    const result = await getVisualizationData(requireParam(id), {
      userId: principal.userId,
      organizationId: principal.organizationId,
      roleName: principal.roleName
    });

    sendSuccess(reply, result);
  }

  /** PATCH /api/v1/visualizations/:id */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as VisualizationParams;
    const input = updateVisualizationSchema.parse(request.body);

    const result = await updateVisualization(
      requireParam(id),
      input,
      {
        userId: principal.userId,
        organizationId: principal.organizationId,
        roleName: principal.roleName
      },
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/visualizations/:id */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as VisualizationParams;

    const result = await deleteVisualization(
      requireParam(id),
      { userId: principal.userId, organizationId: principal.organizationId },
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/visualizations/:id/share */
  async share(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as VisualizationParams;

    const result = await createChartShareLink(requireParam(id), {
      userId: principal.userId,
      organizationId: principal.organizationId,
      roleName: principal.roleName
    });

    sendSuccess(reply, result, 200);
  }

  /** DELETE /api/v1/visualizations/:id/share */
  async revokeShare(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as VisualizationParams;

    const result = await revokeChartShareLink(requireParam(id), {
      userId: principal.userId,
      organizationId: principal.organizationId,
      roleName: principal.roleName
    });

    sendSuccess(reply, result, 200);
  }

  // ---- Public routes (no authentication required) ----

  /** GET /api/v1/visualizations/shared/:shareToken */
  async getShared(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { shareToken } = request.params as VisualizationParams;

    const result = await getSharedChartByToken(requireParam(shareToken));
    sendSuccess(reply, result, 200);
  }

  /** POST /api/v1/visualizations/shared/:shareToken/data */
  async getSharedData(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { shareToken } = request.params as VisualizationParams;

    const result = await getSharedChartDataByToken(requireParam(shareToken));
    sendSuccess(reply, result, 200);
  }
}

function requireParam(value: string | undefined): string {
  if (!value) {
    throw AppError.badRequest('Missing required route parameter');
  }
  return value;
}

export const visualizationController = new VisualizationController();