import { getConnectionState } from '@repo/database';
import { sendSuccess } from '../../../utils/response.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HealthStatus } from '@repo/types';

const SERVICE_NAME = 'ricozviz-api';
const SERVICE_VERSION = '1.0.0';
const startTime = Date.now();

export class RicozVizHealthController {
  /**
   * GET /api/v1/health
   *
   * Public endpoint — monitoring tools must be able to reach it unauthenticated.
   */
  async check(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    const data: HealthStatus = {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptime,
      timestamp: new Date().toISOString(),
      database: getConnectionState()
    };

    sendSuccess(reply, data);
  }
}

export const ricozvizHealthController = new RicozVizHealthController();