import type { FastifyReply, FastifyRequest } from 'fastify';
import { createApiResponse } from '@repo/api';
import { healthService } from './health.service.js';

export class HealthController {
  async getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const health = healthService.getHealth();
    reply.status(200).send(createApiResponse(health));
  }
}

export const healthController = new HealthController();
