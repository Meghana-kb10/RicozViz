import type { FastifyInstance } from 'fastify';
import { auditController } from './audit.controller.js';
import { requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  const guard = [requireAuth, requirePermission('AUDIT_LOG_VIEW')];

  // Public/preview endpoints for interactive multi-tenant audit trail showcases
  app.get('/preview', auditController.preview.bind(auditController));
  app.get('/verify-chain', auditController.verifyChain.bind(auditController));
  app.post('/revoke-token', auditController.revokeToken.bind(auditController));

  // Authenticated tenant audit queries
  app.get('/', { preHandler: guard }, auditController.list.bind(auditController));
  // Registered before `/:id` so "stats" is not captured as a path parameter.
  app.get('/stats', { preHandler: guard }, auditController.stats.bind(auditController));
  app.get('/:id', { preHandler: guard }, auditController.getOne.bind(auditController));
}