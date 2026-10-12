import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  clearAlert,
  createAlert,
  deleteAlert,
  evaluateAlert,
  evaluateAllWorkspaceAlerts,
  getAlert,
  listAlerts,
  updateAlert,
  type AlertListQuery,
  type AlertPrincipal,
  type CreateAlertBody,
  type UpdateAlertBody
} from './alert.service.js';
import type { AuditRequestMeta } from '../visualization/visualization.service.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';

interface AlertParams {
  id?: string;
  workspaceId?: string;
}

function readAuditMeta(request: FastifyRequest): AuditRequestMeta {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  };
}

function readPrincipal(request: FastifyRequest): AlertPrincipal {
  const principal = getPrincipal(request);
  return {
    userId: principal.userId,
    organizationId: principal.organizationId,
    email: principal.email,
    roleName: principal.roleName
  };
}

function requireParam(value: string | undefined, message: string): string {
  if (!value) {
    throw AppError.badRequest(message);
  }
  return value;
}

export class AlertController {
  /** POST /api/v1/alerts */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = (request.body ?? {}) as CreateAlertBody;

    const result = await createAlert(body, readPrincipal(request), readAuditMeta(request));
    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/alerts */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = (request.query ?? {}) as AlertListQuery;

    const result = await listAlerts(
      {
        workspaceId: typeof query.workspaceId === 'string' ? query.workspaceId : undefined,
        metricId: typeof query.metricId === 'string' ? query.metricId : undefined
      },
      readPrincipal(request)
    );

    sendSuccess(reply, result);
  }

  /** GET /api/v1/alerts/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as AlertParams;

    const result = await getAlert(requireParam(id, 'Alert ID is required'), readPrincipal(request));
    sendSuccess(reply, result);
  }

  /** PATCH /api/v1/alerts/:id */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as AlertParams;
    const body = (request.body ?? {}) as UpdateAlertBody;

    const result = await updateAlert(
      requireParam(id, 'Alert ID is required'),
      body,
      readPrincipal(request),
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/alerts/:id */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as AlertParams;

    const result = await deleteAlert(
      requireParam(id, 'Alert ID is required'),
      readPrincipal(request),
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/alerts/:id/evaluate */
  async evaluate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as AlertParams;

    const result = await evaluateAlert(
      requireParam(id, 'Alert ID is required'),
      readPrincipal(request),
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/alerts/:id/clear */
  async clear(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as AlertParams;

    const result = await clearAlert(
      requireParam(id, 'Alert ID is required'),
      readPrincipal(request),
      readAuditMeta(request)
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/alerts/workspace/:workspaceId/evaluate-all */
  async evaluateAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { workspaceId } = request.params as AlertParams;

    const result = await evaluateAllWorkspaceAlerts(
      requireParam(workspaceId, 'Workspace ID is required'),
      readPrincipal(request)
    );

    sendSuccess(reply, result);
  }
}

export const alertController = new AlertController();