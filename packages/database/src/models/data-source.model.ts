import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';
import { DATA_SOURCE_STATUS, DATA_SOURCE_TYPE } from '@repo/types';

export interface IDataSourceDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId | null;
  name: string;
  description: string | null;
  type: string;
  status: string;
  /** Non-secret connection metadata (host, port, dbname, schema, ssl). */
  connectionMeta: Schema.Types.Mixed;
  /** Opaque reference to the credentials held in an external secrets store. */
  credentialRef: string | null;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DataSourceSchema = new Schema<IDataSourceDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRefOptional('Workspace'),
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    type: {
      type: String,
      enum: Object.values(DATA_SOURCE_TYPE),
      required: true
    },
    status: {
      type: String,
      enum: Object.values(DATA_SOURCE_STATUS),
      default: DATA_SOURCE_STATUS.PENDING
    },
    // Function default so each document receives its own object.
    connectionMeta: { type: Schema.Types.Mixed, default: () => ({}) },
    credentialRef: { type: String, default: null },
    createdById: objectIdRef('User', true)
  },
  { collection: COLLECTIONS.DATA_SOURCES, timestamps: true, versionKey: false }
);

export const DataSourceModel: Model<IDataSourceDocument> = defineModel<IDataSourceDocument>(
  'DataSource',
  DataSourceSchema
);