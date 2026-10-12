// ============================================================
// Collaboration Routes — /api/v1/dashboards/:id/collaboration
// ============================================================

import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';
import { collaborationController } from './collaboration.controller.js';

export async function collaborationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/dashboards/:id/collaboration/stream
   * Server-Sent Events channel. Authenticates from the Authorization header or
   * the `?token=` query parameter, so `requireAuth` is intentionally absent.
   */
  app.get('/stream', collaborationController.stream.bind(collaborationController));

  /**
   * GET /api/v1/dashboards/:id/collaboration/state
   * Retrieve active collaborators and latest version info.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/state',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    collaborationController.state.bind(collaborationController)
  );

  /**
   * POST /api/v1/dashboards/:id/collaboration/presence
   * Send heartbeat / focus widget update.
   * Permission: DASHBOARD_VIEW
   */
  app.post(
    '/presence',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    collaborationController.presence.bind(collaborationController)
  );

  /**
   * POST /api/v1/dashboards/:id/collaboration/update
   * Conflict-safe collaborative update (enforces version check and RBAC WRITE guard).
   * Permission: DASHBOARD_EDIT
   */
  app.post(
    '/update',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    collaborationController.update.bind(collaborationController)
  );
}
