import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef } from './model.util';

export interface IDatasetVersionDocument extends Document {
  _id: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId;
  versionNumber: number;
  changeSummary: string | null;
  transformationConfig: mongoose.Schema.Types.Mixed;
  schemaSnapshot: mongoose.Schema.Types.Mixed;
  rowCount: number;
  columnCount: number;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DatasetVersionSchema = new Schema<IDatasetVersionDocument>(
  {
    datasetId: objectIdRef('Dataset', true),
    versionNumber: { type: Number, required: true },
    changeSummary: { type: String, default: null },
    transformationConfig: { type: Schema.Types.Mixed, default: () => ([]) },
    schemaSnapshot: { type: Schema.Types.Mixed, default: () => ({}) },
    rowCount: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    createdById: objectIdRef('User', true)
  },
  { collection: COLLECTIONS.DATASET_VERSIONS, timestamps: true, versionKey: false }
);
DatasetVersionSchema.index({ datasetId: 1, versionNumber: 1 }, { unique: true });

export const DatasetVersionModel: Model<IDatasetVersionDocument> =
  defineModel<IDatasetVersionDocument>('DatasetVersion', DatasetVersionSchema);