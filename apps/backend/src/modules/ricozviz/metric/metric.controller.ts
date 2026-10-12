import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  calculateMetric,
  createMetric,
  deleteMetric,
  getMetric,
  listMetrics,
  updateMetric,
  type CalculateMetricBody,
  type CreateMetricBody,
  type MetricListQuery,
  type PrincipalContext,
  type UpdateMetricBody
} from './metric.service.js';
import type { AuditRequestMeta } from '../visualization/visualization.service.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';

interface MetricParams {
  id?: string;
}

function readAuditMeta(request: FastifyRequest): AuditRequestMeta {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  };
}

function readPrincipal(request: FastifyRequest): PrincipalContext {
  const principal = getPrincipal(request);
  return {
    userId: principal.userId,
    organizationId: principal.organizationId,
    email: principal.email,
    roleName: principal.roleName
  };
}

function requireParam(value: string | undefined): string {
  if (!value) {
    throw AppError.badRequest('Missing required route parameter');
  }
  return value;
}

export class MetricController {
  /** POST /api/v1/metrics */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = (request.body ?? {}) as CreateMetricBody;

    const result = await createMetric(body, readPrincipal(request), readAuditMeta(request));
    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/metrics */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = (request.query ?? {}) as MetricListQuery;

    const result = await listMetrics(
      {
        workspaceId: typeof query.workspaceId === 'string' ? query.workspaceId : undefined,
        datasetId: typeof query.datasetId === 'string' ? query.datasetId : undefined
      },
      readPrincipal(request)
    );

    sendSuccess(reply, result);
  }

  /** GET /api/v1/metrics/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as MetricParams;

    const result = await getMetric(requireParam(id), readPrincipal(request));
    sendSuccess(reply, result);
  }

  /** PATCH /api/v1/metrics/:id */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as MetricParams;
    const body = (request.body ?? {}) as UpdateMetricBody;

    const result = await updateMetric(
      requireParam(id),
      body,
      readPrincipal(request),
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/metrics/:id */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as MetricParams;

    const result = await deleteMetric(
      requireParam(id),
      readPrincipal(request),
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/metrics/:id/calculate */
  async calculate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as MetricParams;
    const body = (request.body ?? {}) as CalculateMetricBody;

    const result = await calculateMetric(requireParam(id), body, readPrincipal(request));
    sendSuccess(reply, result);
  }
}

export const metricController = new MetricController();