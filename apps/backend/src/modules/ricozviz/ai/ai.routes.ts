import type { FastifyInstance } from 'fastify';
import { aiController } from './ai.controller.js';
import { requireAuth } from '../../../plugins/ricozviz-auth.js';

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // All AI endpoints require authentication
  app.post('/ask', { preHandler: [requireAuth] }, aiController.ask.bind(aiController));
  app.post(
    '/nl-to-chart',
    { preHandler: [requireAuth] },
    aiController.nlToChart.bind(aiController)
  );
  app.post(
    '/insights',
    { preHandler: [requireAuth] },
    aiController.insights.bind(aiController)
  );
  app.post(
    '/dashboard-summary',
    { preHandler: [requireAuth] },
    aiController.dashboardSummary.bind(aiController)
  );
}