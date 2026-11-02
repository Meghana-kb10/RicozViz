import { broadcastWsDashboardUpdate } from './ws-collaboration.service.js';
import { createWsTicket } from './ws-ticket.service.js';
import type { WsTicketResponse } from '@repo/types';
// ============================================================
// Real-Time Collaboration Service
// ============================================================
// Powers multi-user real-time dashboard collaboration over
// Server-Sent Events (SSE) and HTTP synchronization channels.
// Features:
// - Live presence & active user tracking
// - Ephemeral active widget/cursor indicators
// - Real-time broadcast of dashboard layout & chart modifications
// - Concurrency control & conflict-safe updates (prevents silent overwrites)
// - Server-side RBAC and workspace authorization enforcement
// - Audit logging for collaborative sessions and modifications
// ============================================================

import crypto from 'crypto';
import { z } from 'zod';
import { DashboardModel, toObjectId } from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { verifyAccessToken } from '../../../lib/jwt.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import { getDashboardWorkspaceId, verifyResourceWorkspaceAccess } from '../dashboard/dashboard-access.service.js';
import {
  listDashboardVersions,
  createDashboardVersionSnapshot,
  registerInMemoryVersionDashboard
} from '../dashboard/dashboard-version.service.js';
import type { AuthenticatedUser, CollaborationStateResult, CollaboratorPresence } from '@repo/types';

export interface CollaboratorPresenceRecord extends CollaboratorPresence {}

/**
 * Minimal writable surface an SSE stream exposes. Keeping it abstract lets the
 * controller hand over Fastify's hijacked raw response without this module
 * depending on the HTTP framework.
 */
export interface SseSink {
  write(chunk: string): void;
  end(): void;
}

interface StreamClient {
  clientId: string;
  userId: string;
  sink: SseSink;
  pingTimer: ReturnType<typeof setInterval>;
}

// In-memory active presence and streaming hub
const dashboardSessions = new Map<string, Map<string, CollaboratorPresenceRecord>>();
const dashboardStreams = new Map<string, Map<string, StreamClient>>();
const inMemoryDashboards = new Map<string, Record<string, unknown>>();

export function registerInMemoryDashboard(dashboard: { id: string; [key: string]: unknown }): void {
  inMemoryDashboards.set(dashboard.id, dashboard as Record<string, unknown>);
}

export function clearInMemoryDashboards(): void {
  inMemoryDashboards.clear();
}

// Helper to broadcast an SSE message to all connected clients of a dashboard
export function broadcastDashboardEvent(
  dashboardId: string,
  event: Record<string, unknown>,
  excludeClientId?: string
): void {
  const streams = dashboardStreams.get(dashboardId);
  if (!streams || streams.size === 0) return;

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const [clientId, client] of streams.entries()) {
    if (excludeClientId && clientId === excludeClientId) continue;
    try {
      client.sink.write(payload);
    } catch (err) {
      logger.warn('Failed to write to SSE client stream', {
        clientId,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
}

/**
 * Retrieve active collaborators on a dashboard (for API and testing).
 */
export function getDashboardActiveCollaborators(dashboardId: string): CollaboratorPresenceRecord[] {
  const sessions = dashboardSessions.get(dashboardId);
  if (!sessions) return [];
  return Array.from(sessions.values());
}

/**
 * Reset in-memory collaboration state (for test cleanup).
 */
export function clearCollaborationState(): void {
  for (const streams of dashboardStreams.values()) {
    for (const client of streams.values()) {
      clearInterval(client.pingTimer);
      try {
        client.sink.end();
      } catch {
        // The socket is already gone — nothing to clean up.
      }
    }
  }
  dashboardStreams.clear();
  dashboardSessions.clear();
  inMemoryDashboards.clear();
}

/**
 * Authenticates the caller from the Authorization header or a `?token=` query
 * parameter (browsers' EventSource cannot set custom headers).
 */
export function resolveUserFromTokenSource(params: {
  authorization?: string;
  queryToken?: unknown;
}): AuthenticatedUser {
  let token: string | undefined;

  const authHeader = params.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof params.queryToken === 'string' && params.queryToken.trim().length > 0) {
    token = params.queryToken.trim();
  }

  if (!token) {
    throw AppError.unauthorized('Authentication required to join collaboration session');
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload.organizationId || !payload.roleId || !payload.roleName) {
      throw AppError.unauthorized('Invalid collaboration token claims');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      roleId: payload.roleId,
      roleName: payload.roleName,
      permissions: payload.permissions || []
    };
  } catch {
    throw AppError.unauthorized('Invalid or expired authentication token');
  }
}

/** Resolve the dashboard document used by the collaboration channel. */
export async function resolveCollaborationDashboard(
  dashboardId: string,
  user: AuthenticatedUser,
  requiredAction: 'READ' | 'WRITE'
): Promise<{ id: string; name: string; organizationId: string; layoutConfig: Record<string, unknown> }> {
  let dashboard: {
    id: string;
    name: string;
    organizationId: string;
    layoutConfig: Record<string, unknown>;
  } | null = null;

  const inMemory = inMemoryDashboards.get(dashboardId);
  if (!inMemory) {
    const dashboardObjectId = toObjectId(dashboardId);
    const found = dashboardObjectId
      ? await DashboardModel.findOne({
          _id: dashboardObjectId,
          organizationId: toObjectId(user.organizationId)
        }).lean()
      : null;

    if (found) {
      dashboard = {
        id: found._id.toString(),
        name: found.name,
        organizationId: found.organizationId.toString(),
        layoutConfig: (found.layoutConfig || {}) as Record<string, unknown>
      };
    }
  } else {
    dashboard = {
      id: String(inMemory.id ?? dashboardId),
      name: String(inMemory.name ?? ''),
      organizationId: String(inMemory.organizationId ?? user.organizationId),
      layoutConfig: (inMemory.layoutConfig || {}) as Record<string, unknown>
    };
  }

  if (!dashboard) {
    throw AppError.notFound('Dashboard not found');
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);
  await verifyResourceWorkspaceAccess(
    { workspaceId, organizationId: user.organizationId },
    user.userId,
    user.organizationId,
    user.roleName,
    requiredAction
  );

  return dashboard;
}

/**
 * GET /api/v1/dashboards/:id/collaboration/stream
 * Connects a client to the real-time SSE collaboration channel.
 *
 * Returns a disposer that must be called when the socket closes.
 */
export async function openCollaborationStream(
  user: AuthenticatedUser,
  dashboardId: string,
  sink: SseSink
): Promise<{ clientId: string; dispose: () => void }> {
  if (!dashboardId) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboard = await resolveCollaborationDashboard(dashboardId, user, 'READ');
  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  // 1. Emit the SSE preamble
  sink.write(': connection established\n\n');

  const clientId = `client-${crypto.randomBytes(8).toString('hex')}`;

  // 2. Register the presence session
  const userName = user.email.split('@')[0] || 'User';
  const presenceRecord: CollaboratorPresenceRecord = {
    clientId,
    userId: user.userId,
    name: userName,
    email: user.email,
    role: user.roleName || 'VIEWER',
    joinedAt: new Date().toISOString(),
    lastPing: new Date().toISOString(),
    activeWidgetId: null
  };

  if (!dashboardSessions.has(dashboardId)) {
    dashboardSessions.set(dashboardId, new Map());
  }
  dashboardSessions.get(dashboardId)!.set(clientId, presenceRecord);

  // 3. Register the stream connection + keep-alive ping
  if (!dashboardStreams.has(dashboardId)) {
    dashboardStreams.set(dashboardId, new Map());
  }

  const pingTimer = setInterval(() => {
    try {
      sink.write(': ping\n\n');
    } catch {
      clearInterval(pingTimer);
    }
  }, 15000);

  dashboardStreams.get(dashboardId)!.set(clientId, {
    clientId,
    userId: user.userId,
    sink,
    pingTimer
  });

  // 4. Send the initial state to the connecting client
  const versions = await listDashboardVersions(dashboardId);
  const currentVersionNumber = versions[0]?.versionNumber || 1;
  const currentActiveUsers = Array.from(dashboardSessions.get(dashboardId)!.values());

  sink.write(
    `data: ${JSON.stringify({
      type: 'INIT',
      clientId,
      currentVersionNumber,
      activeUsers: currentActiveUsers
    })}\n\n`
  );

  // 5. Broadcast the join event to the other clients
  broadcastDashboardEvent(
    dashboardId,
    {
      type: 'USER_JOINED',
      user: presenceRecord,
      activeUsers: currentActiveUsers
    },
    clientId
  );

  await logAuditEvent({
    userId: user.userId,
    organizationId: user.organizationId,
    workspaceId,
    action: 'DASHBOARD_COLLABORATION_SESSION_STARTED',
    resourceType: 'DASHBOARD',
    resourceId: dashboardId,
    metadata: { clientId, userEmail: user.email }
  });

  // 6. Disposal on socket close
  const dispose = (): void => {
    clearInterval(pingTimer);

    const streams = dashboardStreams.get(dashboardId);
    if (streams) {
      streams.delete(clientId);
      if (streams.size === 0) dashboardStreams.delete(dashboardId);
    }

    const sessions = dashboardSessions.get(dashboardId);
    if (sessions) {
      sessions.delete(clientId);
      const remainingUsers = Array.from(sessions.values());
      if (sessions.size === 0) dashboardSessions.delete(dashboardId);

      // Broadcast the leave event to the remaining clients
      broadcastDashboardEvent(dashboardId, {
        type: 'USER_LEFT',
        clientId,
        userId: user.userId,
        activeUsers: remainingUsers
      });
    }
  };

  return { clientId, dispose };
}

/**
 * POST /api/v1/dashboards/:id/collaboration/presence
 * Updates user presence status (e.g. active widget focus or heartbeat).
 */
export async function handlePresenceHeartbeat(
  user: AuthenticatedUser,
  dashboardId: string,
  body: { clientId?: string; activeWidgetId?: string | null } = {}
): Promise<{ status: string; timestamp: number; clientId: string }> {
  const { clientId = `client-${user.userId}-${Date.now()}`, activeWidgetId } = body ?? {};

  let sessions = dashboardSessions.get(dashboardId);
  if (!sessions) {
    sessions = new Map();
    dashboardSessions.set(dashboardId, sessions);
  }

  const existing = sessions.get(clientId);
  if (existing) {
    existing.lastPing = new Date().toISOString();
    existing.activeWidgetId = activeWidgetId ?? null;
  } else {
    sessions.set(clientId, {
      clientId,
      userId: user.userId,
      name: user.email ? user.email.split('@')[0] : 'Collaborator',
      email: user.email,
      role: user.roleName || 'VIEWER',
      joinedAt: new Date().toISOString(),
      lastPing: new Date().toISOString(),
      activeWidgetId: activeWidgetId ?? null
    });
  }

  broadcastDashboardEvent(
    dashboardId,
    {
      type: 'PRESENCE_UPDATE',
      clientId,
      userId: user.userId,
      activeWidgetId: activeWidgetId ?? null
    },
    clientId
  );

  return { status: 'OK', timestamp: Date.now(), clientId };
}

export const collaborativeUpdateSchema = z.object({
  baseVersionNumber: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  layoutConfig: z.record(z.unknown()).optional(),
  chartsSnapshot: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        chartType: z.string(),
        config: z.record(z.unknown()).optional().default({}),
        position: z.record(z.unknown()).optional().default({}),
        sortOrder: z.number().optional().default(0),
        datasetId: z.string().optional().nullable()
      })
    )
    .optional(),
  changeSummary: z.string().trim().max(500).optional(),
  clientId: z.string().optional()
});

export interface CollaborativeUpdateResult {
  dashboardId: string;
  versionNumber: number;
  name: string;
  layoutConfig: Record<string, unknown>;
  changeSummary: string;
}

/**
 * POST /api/v1/dashboards/:id/collaboration/update
 * Performs a conflict-safe collaborative dashboard update.
 * Enforces RBAC (rejects VIEWER), compares the base version against the current
 * version, and broadcasts the update event to all connected peers on success.
 */
export async function handleCollaborativeUpdate(
  user: AuthenticatedUser,
  dashboardId: string,
  input: z.infer<typeof collaborativeUpdateSchema>,
  audit: { ipAddress?: string; userAgent?: string } = {}
): Promise<CollaborativeUpdateResult> {
  const dashboard = await resolveCollaborationDashboard(dashboardId, user, 'WRITE');
  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  // Concurrency & conflict detection
  const versions = await listDashboardVersions(dashboardId);
  const currentVersionNumber = versions[0]?.versionNumber || 1;

  if (
    input.baseVersionNumber !== undefined &&
    input.baseVersionNumber < currentVersionNumber
  ) {
    throw new AppError(
      409,
      'DASHBOARD_VERSION_CONFLICT',
      `Conflict: Dashboard has been updated by another collaborator (current version: ${currentVersionNumber}, base: ${input.baseVersionNumber}). Please reload latest changes.`
    );
  }

  // Apply updates persistently
  const updatedLayout = input.layoutConfig ?? dashboard.layoutConfig ?? {};

  const updateData: Record<string, unknown> = { layoutConfig: updatedLayout };
  if (input.name) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;

  const dashboardObjectId = toObjectId(dashboardId);
  if (dashboardObjectId) {
    await DashboardModel.updateOne({ _id: dashboardObjectId }, { $set: updateData })
      .exec()
      .catch(() => null);
  }

  const updatedDashboard: Record<string, unknown> = {
    ...dashboard,
    ...(input.name ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    layoutConfig: updatedLayout
  };

  if (inMemoryDashboards.has(dashboardId)) {
    inMemoryDashboards.set(dashboardId, updatedDashboard);
    registerInMemoryVersionDashboard({ id: dashboardId, ...updatedDashboard });
  } else {
    registerInMemoryVersionDashboard({ id: dashboardId, ...updatedDashboard });
  }

  // Create a new version snapshot (N+1)
  const newVersion = await createDashboardVersionSnapshot(
    dashboardId,
    input.changeSummary || 'Collaborative update',
    user.userId,
    user.email,
    user.email ? user.email.split('@')[0] : 'Collaborator'
  );

  const versionNum = newVersion ? newVersion.versionNumber : currentVersionNumber + 1;
  const changeSum = newVersion?.changeSummary || input.changeSummary || 'Collaborative update';

  // Broadcast the update event to all connected collaborators
  broadcastDashboardEvent(
    dashboardId,
    {
      type: 'DASHBOARD_UPDATED',
      versionNumber: versionNum,
      updatedBy: {
        id: user.userId,
        name: user.email.split('@')[0] || 'Collaborator',
        email: user.email
      },
      changeSummary: changeSum,
      layoutConfig: updatedLayout,
      timestamp: new Date().toISOString()
    },
    input.clientId // optionally exclude the sending client
  );

  await logAuditEvent({
    userId: user.userId,
    organizationId: user.organizationId,
    workspaceId,
    action: 'DASHBOARD_COLLABORATIVE_EDIT',
    resourceType: 'Dashboard',
    resourceId: dashboardId,
    metadata: {
      versionNumber: versionNum,
      newVersionNumber: versionNum,
      baseVersionNumber: input.baseVersionNumber,
      changeSummary: changeSum
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent
  });

  return {
    dashboardId,
    versionNumber: versionNum,
    name: input.name || String(dashboard.name ?? ''),
    layoutConfig: updatedLayout,
    changeSummary: changeSum
  };
}

/**
 * GET /api/v1/dashboards/:id/collaboration/state
 * Returns the active collaborators and latest version info for a dashboard.
 */
export async function handleGetCollaborationState(
  user: AuthenticatedUser,
  dashboardId: string
): Promise<CollaborationStateResult> {
  await resolveCollaborationDashboard(dashboardId, user, 'READ');

  const versions = await listDashboardVersions(dashboardId);
  const currentVersionNumber = versions[0]?.versionNumber || 1;
  const activeUsers = getDashboardActiveCollaborators(dashboardId);

  return {
    dashboardId,
    currentVersionNumber,
    activeCollaborators: activeUsers,
    collaboratorCount: activeUsers.length
  };
}


/**
 * Issues a single-use 30-second ticket for authenticating the real-time presence WebSocket.
 * Requires user to have read access to the target dashboard.
 */
export async function handleCreateDashboardWsTicket(
  user: AuthenticatedUser,
  dashboardId: string
): Promise<WsTicketResponse> {
  const dashboard = await resolveCollaborationDashboard(dashboardId, user, 'READ');
  const workspaceId =
    getDashboardWorkspaceId(dashboard.layoutConfig) ||
    (user as any).workspaceId ||
    dashboard.organizationId;

  return createWsTicket({
    userId: user.userId,
    userName: (user as any).name || (user.email ? user.email.split('@')[0] : 'Collaborator'),
    userAvatar: (user as any).avatar,
    userRole: user.roleName,
    dashboardId,
    workspaceId
  });
}
