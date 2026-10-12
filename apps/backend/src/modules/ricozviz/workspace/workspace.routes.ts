import type { FastifyInstance } from 'fastify';
import { workspaceController } from './workspace.controller.js';
import { requireAuth } from '../../../plugins/ricozviz-auth.js';

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  // Every workspace endpoint requires an authenticated user. Workspace-level
  // authorization (OWNER / ADMIN / member) is enforced inside the service.
  const guard = [requireAuth];

  /**
   * POST /api/v1/workspaces — create a workspace in the caller's organization.
   */
  app.post('/', { preHandler: guard }, workspaceController.create.bind(workspaceController));

  /**
   * GET /api/v1/workspaces — list every workspace accessible to the caller.
   */
  app.get('/', { preHandler: guard }, workspaceController.list.bind(workspaceController));

  /**
   * GET /api/v1/workspaces/:id — retrieve a specific workspace.
   */
  app.get('/:id', { preHandler: guard }, workspaceController.getOne.bind(workspaceController));

  /**
   * PATCH /api/v1/workspaces/:id — update name or description (OWNER/ADMIN only).
   */
  app.patch('/:id', { preHandler: guard }, workspaceController.update.bind(workspaceController));

  /**
   * DELETE /api/v1/workspaces/:id — delete a workspace (OWNER only).
   */
  app.delete('/:id', { preHandler: guard }, workspaceController.remove.bind(workspaceController));

  /**
   * GET /api/v1/workspaces/:id/members — list workspace members.
   */
  app.get('/:id/members', { preHandler: guard }, workspaceController.listMembers.bind(workspaceController));

  /**
   * POST /api/v1/workspaces/:id/members — add an organization user (OWNER/ADMIN only).
   */
  app.post('/:id/members', { preHandler: guard }, workspaceController.addMember.bind(workspaceController));

  /**
   * PATCH /api/v1/workspaces/:id/members/:userId — update a member's role (OWNER/ADMIN only).
   */
  app.patch(
    '/:id/members/:userId',
    { preHandler: guard },
    workspaceController.updateMemberRole.bind(workspaceController)
  );

  /**
   * DELETE /api/v1/workspaces/:id/members/:userId — remove a member (OWNER/ADMIN only, or self).
   */
  app.delete(
    '/:id/members/:userId',
    { preHandler: guard },
    workspaceController.removeMember.bind(workspaceController)
  );
}
