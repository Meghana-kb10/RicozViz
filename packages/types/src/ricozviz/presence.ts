// ============================================================
// Real-Time Presence & WebSocket Domain Types
// ============================================================

export interface WsTicket {
  ticket: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userColor?: string;
  userRole?: string;
  dashboardId: string;
  workspaceId: string;
  expiresAt: string | Date;
}

export interface WsTicketResponse {
  ticket: string;
  expiresInSeconds: number;
}

export type WsClientMessageType = 'JOIN' | 'LEAVE' | 'HEARTBEAT' | 'CURSOR_MOVE' | 'WIDGET_FOCUS';

export interface WsClientMessage {
  type: WsClientMessageType;
  cursor?: { x: number; y: number };
  widgetId?: string | null;
  timestamp?: number;
}

export type WsServerMessageType =
  | 'PRESENCE_STATE'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'CURSOR_MOVED'
  | 'WIDGET_FOCUSED'
  | 'DASHBOARD_UPDATED'
  | 'PONG'
  | 'ERROR';

export interface WsCollaboratorPresence {
  userId: string;
  name: string;
  email?: string;
  color?: string;
  avatar?: string;
  role?: string;
  cursor?: { x: number; y: number };
  activeWidgetId?: string | null;
  lastSeen?: string;
}

export interface WsServerMessage {
  type: WsServerMessageType;
  userId?: string;
  user?: WsCollaboratorPresence;
  collaborators?: WsCollaboratorPresence[];
  cursor?: { x: number; y: number };
  widgetId?: string | null;
  data?: Record<string, unknown>;
  error?: string;
  timestamp?: number;
}
