import mongoose, { Schema, Document, Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel } from './model.util';
import { USER_STATUS } from '@repo/types';

/**
 * Single `users` collection shared by the template demo auth flow and the
 * RicozViz domain.
 *
 * - `password` / `role` back the original template session auth.
 * - `passwordHash` / `status` / `avatarUrl` / `tokenVersion` back RicozViz's
 *   JWT auth, RBAC memberships and profile rendering.
 *
 * Two Mongoose models must never target the same collection, hence the single
 * schema instead of a parallel `ricozviz-user.model.ts`.
 */
export interface IUserDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user' | 'guest' | 'PLATFORM_ADMIN';
  passwordHash?: string | null;
  avatarUrl?: string | null;
  status?: string;
  tokenVersion?: number;
  failedLoginAttempts?: number;
  lockUntil?: Date | null;
  twoFactorSecretEncrypted?: string | null;
  twoFactorSecretKeyVersion?: number | null;
  twoFactorSecretIv?: string | null;
  twoFactorSecretAuthTag?: string | null;
  twoFactorBackupCodesHashed?: string[];
  twoFactorEnabled?: boolean;
  twoFactorVerifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String,
      required: false,
      select: true
    },
    passwordHash: {
      type: String,
      required: false,
      default: null,
      select: false
    },
    avatarUrl: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true
    },
    tokenVersion: {
      type: Number,
      default: 0
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    twoFactorSecretEncrypted: {
      type: String,
      default: null,
      select: false
    },
    twoFactorSecretKeyVersion: {
      type: Number,
      default: null,
      select: false
    },
    twoFactorSecretIv: {
      type: String,
      default: null,
      select: false
    },
    twoFactorSecretAuthTag: {
      type: String,
      default: null,
      select: false
    },
    twoFactorBackupCodesHashed: {
      type: [String],
      default: [],
      select: false
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
      index: true
    },
    twoFactorVerifiedAt: {
      type: Date,
      default: null
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'guest', 'PLATFORM_ADMIN'],
      default: 'user',
      index: true
    }
  },
  {
    collection: COLLECTIONS.USERS,
    timestamps: true,
    versionKey: false
  }
);

// Prevent re-compilation in development / watch mode
export const UserModel: Model<IUserDocument> =
  (mongoose.models.User as Model<IUserDocument>) ||
  mongoose.model<IUserDocument>('User', UserSchema);
