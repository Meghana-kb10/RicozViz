import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef } from './model.util';

export interface IRefreshTokenDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  familyId: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdByIp?: string | null;
  userAgent?: string | null;
  replacedByTokenHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    userId: objectIdRef('User', true),
    tokenHash: {
      type: String,
      required: true,
      index: true
    },
    familyId: {
      type: String,
      required: true,
      index: true
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    createdByIp: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    replacedByTokenHash: {
      type: String,
      default: null
    }
  },
  {
    collection: COLLECTIONS.REFRESH_TOKENS,
    timestamps: true,
    versionKey: false
  }
);

// TTL index to automatically purge expired refresh tokens from MongoDB
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel: Model<IRefreshTokenDocument> =
  defineModel<IRefreshTokenDocument>('RefreshToken', RefreshTokenSchema);
