import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef } from './model.util';

export interface IWsTicketDocument extends Document {
  _id: mongoose.Types.ObjectId;
  ticket: string;
  userId: mongoose.Types.ObjectId;
  userName: string;
  userAvatar?: string | null;
  userColor?: string | null;
  userRole?: string | null;
  dashboardId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WsTicketSchema = new Schema<IWsTicketDocument>(
  {
    ticket: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: objectIdRef('User', true),
    userName: {
      type: String,
      required: true
    },
    userAvatar: {
      type: String,
      default: null
    },
    userColor: {
      type: String,
      default: null
    },
    userRole: {
      type: String,
      default: null
    },
    dashboardId: objectIdRef('Dashboard', true),
    workspaceId: objectIdRef('Workspace', true),
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    }
  },
  {
    collection: COLLECTIONS.WS_TICKETS,
    timestamps: true,
    versionKey: false
  }
);

export const WsTicketModel: Model<IWsTicketDocument> =
  defineModel<IWsTicketDocument>('WsTicket', WsTicketSchema);
