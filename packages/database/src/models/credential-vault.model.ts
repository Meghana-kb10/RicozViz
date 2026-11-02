import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';

export interface ICredentialVaultDocument extends Document {
  _id: mongoose.Types.ObjectId;
  reference: string;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId | null;
  encryptedData: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  algorithm: string;
  createdAt: Date;
  updatedAt: Date;
}

const CredentialVaultSchema = new Schema<ICredentialVaultDocument>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRefOptional('Workspace'),
    encryptedData: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    },
    authTag: {
      type: String,
      required: true
    },
    keyVersion: {
      type: Number,
      required: true,
      default: 1
    },
    algorithm: {
      type: String,
      required: true,
      default: 'aes-256-gcm'
    }
  },
  {
    collection: COLLECTIONS.CREDENTIAL_VAULT,
    timestamps: true,
    versionKey: false
  }
);

export const CredentialVaultModel: Model<ICredentialVaultDocument> =
  defineModel<ICredentialVaultDocument>('CredentialVault', CredentialVaultSchema);
