import type { FastifyInstance } from 'fastify';
import { ricozvizHealthController } from './health.controller.js';

export async function ricozvizHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', ricozvizHealthController.check.bind(ricozvizHealthController));
}