
function safeObjectId(val: string): mongoose.Types.ObjectId {
  return toObjectId(val) ?? new mongoose.Types.ObjectId();
}
// ============================================================
// WebSocket Handshake Ticket Service
// ============================================================
// Generates single-use, cryptographically secure 30-second tickets
// for WebSocket authentication to avoid leaking tokens in query URLs.
// ============================================================

import crypto from 'crypto';
import mongoose from 'mongoose';
import { WsTicketModel, toObjectId } from '@repo/database';
import type { WsTicket, WsTicketResponse } from '@repo/types';
import { logger } from '../../../utils/logger.js';

interface InMemoryTicket {
  ticket: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  userColor?: string | null;
  userRole?: string | null;
  dashboardId: string;
  workspaceId: string;
  expiresAt: number;
}

const inMemoryTickets = new Map<string, InMemoryTicket>();

export function clearInMemoryTickets(): void {
  inMemoryTickets.clear();
}

/**
 * Creates a single-use 30-second ticket for authenticating a dashboard WebSocket.
 */
export async function createWsTicket(params: {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  userColor?: string | null;
  userRole?: string | null;
  dashboardId: string;
  workspaceId: string;
}): Promise<WsTicketResponse> {
  const ticket = `wst_${crypto.randomBytes(24).toString('hex')}`;
  const expiresInSeconds = 30;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  if (mongoose.connection.readyState !== 1) {
    inMemoryTickets.set(ticket, {
      ticket,
      userId: params.userId,
      userName: params.userName,
      userAvatar: params.userAvatar,
      userColor: params.userColor,
      userRole: params.userRole,
      dashboardId: params.dashboardId,
      workspaceId: params.workspaceId,
      expiresAt: expiresAt.getTime()
    });
    return { ticket, expiresInSeconds };
  }

  try {
    await WsTicketModel.create({
      ticket,
      userId: safeObjectId(params.userId),
      userName: params.userName,
      userAvatar: params.userAvatar || null,
      userColor: params.userColor || null,
      userRole: params.userRole || null,
      dashboardId: safeObjectId(params.dashboardId),
      workspaceId: safeObjectId(params.workspaceId),
      expiresAt
    });
  } catch (err) {
    logger.warn('Failed to persist WsTicket to MongoDB, storing in-memory fallback', {
      error: err instanceof Error ? err.message : String(err)
    });
    inMemoryTickets.set(ticket, {
      ticket,
      userId: params.userId,
      userName: params.userName,
      userAvatar: params.userAvatar,
      userColor: params.userColor,
      userRole: params.userRole,
      dashboardId: params.dashboardId,
      workspaceId: params.workspaceId,
      expiresAt: expiresAt.getTime()
    });
  }

  return { ticket, expiresInSeconds };
}

/**
 * Atomically consumes and validates a WebSocket ticket.
 * Single-use: once retrieved, the ticket is immediately deleted.
 * Returns null if ticket is missing, expired, or mismatching.
 */
export async function consumeWsTicket(
  ticket: string,
  dashboardId: string
): Promise<WsTicket | null> {
  if (!ticket) return null;

  const now = Date.now();

  // Check in-memory first
  const mem = inMemoryTickets.get(ticket);
  if (mem) {
    inMemoryTickets.delete(ticket);
    if (mem.expiresAt < now) {
      return null;
    }
    if (mem.dashboardId !== dashboardId) {
      return null;
    }
    return {
      ticket: mem.ticket,
      userId: mem.userId,
      userName: mem.userName,
      userAvatar: mem.userAvatar || undefined,
      userColor: mem.userColor || undefined,
      userRole: mem.userRole || undefined,
      dashboardId: mem.dashboardId,
      workspaceId: mem.workspaceId,
      expiresAt: new Date(mem.expiresAt)
    };
  }

  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    const doc = await WsTicketModel.findOneAndDelete({
      ticket,
      expiresAt: { $gt: new Date() }
    }).lean();

    if (!doc) {
      return null;
    }

    if (doc.dashboardId.toString() !== dashboardId) {
      return null;
    }

    return {
      ticket: doc.ticket,
      userId: doc.userId.toString(),
      userName: doc.userName,
      userAvatar: doc.userAvatar || undefined,
      userColor: doc.userColor || undefined,
      userRole: doc.userRole || undefined,
      dashboardId: doc.dashboardId.toString(),
      workspaceId: doc.workspaceId.toString(),
      expiresAt: doc.expiresAt
    };
  } catch (err) {
    logger.error('Error validating WsTicket from MongoDB', {
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}
