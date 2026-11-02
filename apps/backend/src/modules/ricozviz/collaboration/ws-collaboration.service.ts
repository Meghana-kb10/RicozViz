// ============================================================
// Real-Time WebSocket Collaboration & Presence Room Engine
// ============================================================
// Multi-user dashboard presence and cursor synchronization with:
// - Tenant and dashboard room isolation (${workspaceId}:${dashboardId})
// - Ephemeral cursor coordinates and active-widget lock broadcast
// - Server-side dead connection cleanup (45s TTL)
// - Per-connection message rate limiting (max 50 msgs/s)
// ============================================================

import type * as WebSocket from 'ws';
import type {
  WsClientMessage,
  WsServerMessage,
  WsCollaboratorPresence,
  WsTicket
} from '@repo/types';
import { logger } from '../../../utils/logger.js';

interface CollaboratorSocketSession {
  socket: WebSocket.WebSocket;
  userId: string;
  name: string;
  email?: string;
  color?: string;
  avatar?: string;
  role?: string;
  workspaceId: string;
  dashboardId: string;
  cursor?: { x: number; y: number };
  activeWidgetId?: string | null;
  lastSeen: number;
  messageCount: number;
  windowStartTime: number;
}

// Room key: `${workspaceId}:${dashboardId}`
const rooms = new Map<string, Map<string, CollaboratorSocketSession>>();

// Palette for assigning colors to collaborators if not set
const COLLABORATOR_COLORS = [
  '#ff6b35', // Ricoz coral
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16'  // Lime
];

function getRoomKey(workspaceId: string, dashboardId: string): string {
  return `${workspaceId}:${dashboardId}`;
}

function safeSend(socket: WebSocket.WebSocket, message: WsServerMessage): void {
  if (socket.readyState === 1 /* OPEN */) {
    try {
      socket.send(JSON.stringify(message));
    } catch (err) {
      logger.debug('Failed to send WebSocket message', { error: String(err) });
    }
  }
}

function broadcastToRoom(
  roomKey: string,
  message: WsServerMessage,
  excludeUserId?: string
): void {
  const room = rooms.get(roomKey);
  if (!room) return;

  for (const [userId, session] of room.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    safeSend(session.socket, message);
  }
}

/**
 * Handle a newly admitted, authenticated WebSocket connection.
 */
export function handleWsConnection(
  socket: WebSocket.WebSocket,
  ticket: WsTicket
): void {
  const roomKey = getRoomKey(ticket.workspaceId, ticket.dashboardId);
  const now = Date.now();

  let room = rooms.get(roomKey);
  if (!room) {
    room = new Map();
    rooms.set(roomKey, room);
  }

  const assignedColor =
    ticket.userColor ||
    COLLABORATOR_COLORS[room.size % COLLABORATOR_COLORS.length] ||
    '#ff6b35';

  const session: CollaboratorSocketSession = {
    socket,
    userId: ticket.userId,
    name: ticket.userName,
    color: assignedColor,
    avatar: ticket.userAvatar,
    role: ticket.userRole,
    workspaceId: ticket.workspaceId,
    dashboardId: ticket.dashboardId,
    lastSeen: now,
    messageCount: 0,
    windowStartTime: now
  };

  room.set(ticket.userId, session);

  // 1. Send initial PRESENCE_STATE with all current collaborators in this room
  const currentCollaborators: WsCollaboratorPresence[] = Array.from(
    room.values()
  ).map((c) => ({
    userId: c.userId,
    name: c.name,
    color: c.color,
    avatar: c.avatar,
    role: c.role,
    cursor: c.cursor,
    activeWidgetId: c.activeWidgetId,
    lastSeen: new Date(c.lastSeen).toISOString()
  }));

  safeSend(socket, {
    type: 'PRESENCE_STATE',
    collaborators: currentCollaborators,
    timestamp: now
  });

  // 2. Broadcast USER_JOINED to existing peers in the room
  broadcastToRoom(
    roomKey,
    {
      type: 'USER_JOINED',
      userId: ticket.userId,
      user: {
        userId: session.userId,
        name: session.name,
        color: session.color,
        avatar: session.avatar,
        role: session.role
      },
      timestamp: now
    },
    ticket.userId
  );

  // 3. Handle incoming client frames
  socket.on('message', (raw: Buffer | string) => {
    const receiveTime = Date.now();

    // Per-connection rate limiting (max 50 messages per 1-second rolling window)
    if (receiveTime - session.windowStartTime > 1000) {
      session.windowStartTime = receiveTime;
      session.messageCount = 0;
    }
    session.messageCount++;
    if (session.messageCount > 50) {
      // Exceeded 50 msgs/sec — drop frame to protect server
      return;
    }

    session.lastSeen = receiveTime;

    let parsed: WsClientMessage;
    try {
      parsed = JSON.parse(raw.toString()) as WsClientMessage;
    } catch {
      return; // Discard invalid JSON
    }

    switch (parsed.type) {
      case 'HEARTBEAT':
        safeSend(socket, {
          type: 'PONG',
          timestamp: receiveTime
        });
        break;

      case 'CURSOR_MOVE':
        if (parsed.cursor && typeof parsed.cursor.x === 'number' && typeof parsed.cursor.y === 'number') {
          session.cursor = { x: parsed.cursor.x, y: parsed.cursor.y };
          broadcastToRoom(
            roomKey,
            {
              type: 'CURSOR_MOVED',
              userId: session.userId,
              cursor: session.cursor,
              timestamp: receiveTime
            },
            session.userId
          );
        }
        break;

      case 'WIDGET_FOCUS':
        session.activeWidgetId = parsed.widgetId ?? null;
        broadcastToRoom(
          roomKey,
          {
            type: 'WIDGET_FOCUSED',
            userId: session.userId,
            widgetId: session.activeWidgetId,
            timestamp: receiveTime
          },
          session.userId
        );
        break;

      case 'LEAVE':
        cleanupCollaborator(roomKey, session.userId);
        try {
          socket.close(1000, 'User left collaboration room');
        } catch {
          // Ignore
        }
        break;

      default:
        break;
    }
  });

  // 4. Handle client disconnect
  socket.on('close', () => {
    cleanupCollaborator(roomKey, session.userId);
  });

  socket.on('error', (err: unknown) => {
    logger.debug('Collaborator WebSocket error', {
      userId: session.userId,
      error: String(err)
    });
    cleanupCollaborator(roomKey, session.userId);
  });
}

function cleanupCollaborator(roomKey: string, userId: string): void {
  const room = rooms.get(roomKey);
  if (!room) return;

  if (room.has(userId)) {
    room.delete(userId);
    broadcastToRoom(roomKey, {
      type: 'USER_LEFT',
      userId,
      timestamp: Date.now()
    });
  }

  if (room.size === 0) {
    rooms.delete(roomKey);
  }
}

/**
 * Broadcasts a layout or chart change to all collaborators in a dashboard room.
 */
export function broadcastWsDashboardUpdate(
  workspaceId: string,
  dashboardId: string,
  payload: Record<string, unknown>
): void {
  const roomKey = getRoomKey(workspaceId, dashboardId);
  broadcastToRoom(roomKey, {
    type: 'DASHBOARD_UPDATED',
    data: payload,
    timestamp: Date.now()
  });
}

/**
 * Get active collaborators count for a specific room.
 */
export function getRoomCollaboratorsCount(
  workspaceId: string,
  dashboardId: string
): number {
  const roomKey = getRoomKey(workspaceId, dashboardId);
  return rooms.get(roomKey)?.size ?? 0;
}

/**
 * Periodic reaper: terminates sockets that haven't sent a frame/heartbeat in 45s.
 */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [roomKey, room] of rooms.entries()) {
    for (const [userId, session] of room.entries()) {
      if (now - session.lastSeen > 45_000) {
        try {
          session.socket.terminate();
        } catch {
          // Ignore
        }
        cleanupCollaborator(roomKey, userId);
      }
    }
  }
}, 10_000);

if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

/**
 * Resets all rooms for test cleanup.
 */
export function clearAllWsRooms(): void {
  for (const room of rooms.values()) {
    for (const session of room.values()) {
      try {
        session.socket.terminate();
      } catch {
        // Ignore
      }
    }
  }
  rooms.clear();
}
