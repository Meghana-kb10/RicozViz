import type { FastifyInstance } from 'fastify';
import { exportController } from './export.controller.js';
import { requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/',
    { preHandler: [requireAuth, requirePermission('DATA_EXPORT')] },
    exportController.create.bind(exportController)
  );

  app.get(
    '/history',
    { preHandler: [requireAuth, requirePermission('DATA_EXPORT')] },
    exportController.history.bind(exportController)
  );
}