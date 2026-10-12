import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef } from './model.util';
import { WORKSPACE_ROLE } from '@repo/types';

export interface IWorkspaceDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string | null;
  organizationId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspaceDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    organizationId: objectIdRef('Organization', true)
  },
  { collection: COLLECTIONS.WORKSPACES, timestamps: true, versionKey: false }
);
WorkspaceSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

export const WorkspaceModel: Model<IWorkspaceDocument> = defineModel<IWorkspaceDocument>(
  'Workspace',
  WorkspaceSchema
);

export interface IWorkspaceMemberDocument extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMemberDocument>(
  {
    workspaceId: objectIdRef('Workspace', true),
    userId: objectIdRef('User', true),
    role: {
      type: String,
      enum: Object.values(WORKSPACE_ROLE),
      default: WORKSPACE_ROLE.MEMBER
    }
  },
  { collection: COLLECTIONS.WORKSPACE_MEMBERS, timestamps: true, versionKey: false }
);
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMemberModel: Model<IWorkspaceMemberDocument> =
  defineModel<IWorkspaceMemberDocument>('WorkspaceMember', WorkspaceMemberSchema);