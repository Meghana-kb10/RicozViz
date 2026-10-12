import mongoose, { Schema, Document, Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';

export interface ISessionDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revoked: {
      type: Boolean,
      default: false
    }
  },
  {
    collection: COLLECTIONS.SESSIONS,
    timestamps: true,
    versionKey: false
  }
);

export const SessionModel: Model<ISessionDocument> =
  (mongoose.models.Session as Model<ISessionDocument>) ||
  mongoose.model<ISessionDocument>('Session', SessionSchema);
