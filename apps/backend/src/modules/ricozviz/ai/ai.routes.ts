import type { FastifyInstance } from 'fastify';
import { aiController } from './ai.controller.js';
import { requireAuth } from '../../../plugins/ricozviz-auth.js';

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  const aiRateLimit = {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  };

  // All AI endpoints require authentication and strict rate limiting (20 req/min)
  app.post('/ask', { preHandler: [requireAuth], ...aiRateLimit }, aiController.ask.bind(aiController));
  app.post(
    '/nl-to-chart',
    { preHandler: [requireAuth], ...aiRateLimit },
    aiController.nlToChart.bind(aiController)
  );
  app.post(
    '/insights',
    { preHandler: [requireAuth], ...aiRateLimit },
    aiController.insights.bind(aiController)
  );
  app.post(
    '/dashboard-summary',
    { preHandler: [requireAuth], ...aiRateLimit },
    aiController.dashboardSummary.bind(aiController)
  );
}