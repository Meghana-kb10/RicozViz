import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';
import { logger } from '../../../utils/logger.js';
import {
  collaborativeUpdateSchema,
  openCollaborationStream,
  resolveUserFromTokenSource,
  handlePresenceHeartbeat,
  handleCollaborativeUpdate,
  handleGetCollaborationState,
  type SseSink
} from './realtime-collaboration.service.js';

interface CollaborationParams {
  id: string;
}

interface StreamQuery {
  token?: string;
}

export class CollaborationController {
  /**
   * GET /api/v1/dashboards/:id/collaboration/stream
   *
   * The stream authenticates from the `Authorization` header or a `?token=`
   * query parameter because browsers' `EventSource` cannot set headers, so the
   * route deliberately sits outside `requireAuth`.
   */
  async stream(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as CollaborationParams;
    const query = (request.query ?? {}) as StreamQuery;

    const user = resolveUserFromTokenSource({
      authorization: request.headers.authorization,
      queryToken: query.token
    });

    // Take ownership of the socket: this response never ends.
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const sink: SseSink = {
      write: (chunk: string) => reply.raw.write(chunk),
      end: () => reply.raw.end()
    };

    const { dispose } = await openCollaborationStream(user, id, sink);

    request.raw.on('close', () => {
      try {
        dispose();
      } catch (err) {
        logger.warn('Failed to dispose collaboration stream', {
          dashboardId: id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    });
  }

  /**
   * GET /api/v1/dashboards/:id/collaboration/state
   * Retrieve active collaborators and latest version info.
   */
  async state(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as CollaborationParams;
    const result = await handleGetCollaborationState(principal, id);
    sendSuccess(reply, result);
  }

  /**
   * POST /api/v1/dashboards/:id/collaboration/presence
   * Send heartbeat / focus widget update.
   */
  async presence(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as CollaborationParams;
    const body = (request.body ?? {}) as { clientId?: string; activeWidgetId?: string | null };
    const result = await handlePresenceHeartbeat(principal, id, body);
    sendSuccess(reply, result);
  }

  /**
   * POST /api/v1/dashboards/:id/collaboration/update
   * Conflict-safe collaborative update (enforces version check and RBAC WRITE guard).
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as CollaborationParams;
    const input = collaborativeUpdateSchema.parse(request.body ?? {});

    const result = await handleCollaborativeUpdate(principal, id, input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    });
    sendSuccess(reply, result, 200);
  }
}

export const collaborationController = new CollaborationController();
