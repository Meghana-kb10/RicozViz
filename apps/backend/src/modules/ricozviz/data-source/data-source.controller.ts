import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import {
  createDataSourceSchema,
  updateDataSourceSchema,
  testRawConnectionSchema,
  createDataSource,
  listDataSources,
  getDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  testRawConnection,
  type DataSourceRequestContext
} from './data-source.service.js';

interface DataSourceParams {
  id: string;
}

interface DataSourceQuery {
  workspaceId?: string;
}

/** Read a single-valued custom header (`x-workspace-id` may repeat). */
function headerValue(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Audit metadata forwarded to the service (legacy read `req.ip` / `req.get`). */
function requestContext(request: FastifyRequest): DataSourceRequestContext {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    workspaceHeaderId: headerValue(request, 'x-workspace-id')
  };
}

function requireDataSourceId(request: FastifyRequest): string {
  const { id } = request.params as DataSourceParams;
  if (!id) {
    throw AppError.badRequest('Data source ID is required');
  }
  return id;
}

export class DataSourceController {
  /** POST /api/v1/data-sources */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const input = createDataSourceSchema.parse(request.body);
    const payload = await createDataSource(principal, input, requestContext(request));
    sendSuccess(reply, payload, 201);
  }

  /** GET /api/v1/data-sources */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const query = (request.query ?? {}) as DataSourceQuery;
    const headerWorkspaceId = headerValue(request, 'x-workspace-id');

    const payload = await listDataSources(principal, {
      workspaceId: query.workspaceId || headerWorkspaceId
    });
    sendSuccess(reply, payload);
  }

  /** GET /api/v1/data-sources/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const payload = await getDataSource(principal, requireDataSourceId(request));
    sendSuccess(reply, payload);
  }

  /** PATCH /api/v1/data-sources/:id */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const input = updateDataSourceSchema.parse(request.body);
    const payload = await updateDataSource(
      principal,
      requireDataSourceId(request),
      input,
      requestContext(request)
    );
    sendSuccess(reply, payload);
  }

  /** DELETE /api/v1/data-sources/:id */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const payload = await deleteDataSource(
      principal,
      requireDataSourceId(request),
      requestContext(request)
    );
    sendSuccess(reply, payload);
  }

  /** POST /api/v1/data-sources/:id/test-connection */
  async testConnection(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const payload = await testDataSourceConnection(
      principal,
      requireDataSourceId(request),
      requestContext(request)
    );
    sendSuccess(reply, payload);
  }

  /** POST /api/v1/data-sources/test-connection */
  async testRaw(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    getPrincipal(request);
    const input = testRawConnectionSchema.parse(request.body);
    const payload = await testRawConnection(input);
    sendSuccess(reply, payload);
  }
}

export const dataSourceController = new DataSourceController();
