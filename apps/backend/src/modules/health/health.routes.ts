import type { FastifyInstance } from 'fastify';
import { healthController } from './health.controller.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', healthController.getHealth.bind(healthController));
}
