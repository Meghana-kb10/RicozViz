import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';
import {
  DATASET_COLUMN_TYPE,
  DATASET_SOURCE_TYPE,
  DATASET_STATUS,
  DATASET_TYPE
} from '@repo/types';

export interface IDatasetDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId | null;
  dataSourceId: mongoose.Types.ObjectId | null;
  name: string;
  description: string | null;
  sourceType: string;
  fileName: string | null;
  fileSize: number | null;
  rowCount: number;
  columnCount: number;
  type: string;
  status: string;
  schemaMeta: mongoose.Schema.Types.Mixed;
  currentVersion: number;
  parentDatasetId: mongoose.Types.ObjectId | null;
  transformationSteps: mongoose.Schema.Types.Mixed;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DatasetSchema = new Schema<IDatasetDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRefOptional('Workspace'),
    // NULL for uploaded / file-based datasets that are not backed by a connector.
    dataSourceId: objectIdRefOptional('DataSource'),
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    sourceType: {
      type: String,
      enum: Object.values(DATASET_SOURCE_TYPE),
      default: DATASET_SOURCE_TYPE.CSV
    },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    rowCount: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    type: {
      type: String,
      enum: Object.values(DATASET_TYPE),
      default: DATASET_TYPE.UPLOADED,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(DATASET_STATUS),
      default: DATASET_STATUS.DRAFT,
      index: true
    },
    schemaMeta: { type: Schema.Types.Mixed, default: () => ({}) },
    currentVersion: { type: Number, default: 1 },
    // Self reference used to walk lineage back to the upstream dataset.
    parentDatasetId: objectIdRefOptional('Dataset'),
    transformationSteps: { type: Schema.Types.Mixed, default: () => ([]) },
    createdById: objectIdRef('User', true)
  },
  { collection: COLLECTIONS.DATASETS, timestamps: true, versionKey: false }
);

DatasetSchema.virtual('columns', {
  ref: 'DatasetColumn',
  localField: '_id',
  foreignField: 'datasetId'
});
DatasetSchema.virtual('versions', {
  ref: 'DatasetVersion',
  localField: '_id',
  foreignField: 'datasetId'
});
DatasetSchema.virtual('dataSource', {
  ref: 'DataSource',
  localField: 'dataSourceId',
  foreignField: '_id',
  justOne: true
});

export const DatasetModel: Model<IDatasetDocument> = defineModel<IDatasetDocument>(
  'Dataset',
  DatasetSchema
);

export interface IDatasetColumnDocument extends Document {
  _id: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId;
  name: string;
  dataType: string;
  nullable: boolean;
  ordinalPosition: number;
  createdAt: Date;
  updatedAt: Date;
}

const DatasetColumnSchema = new Schema<IDatasetColumnDocument>(
  {
    datasetId: objectIdRef('Dataset', true),
    name: { type: String, required: true, trim: true },
    dataType: {
      type: String,
      enum: Object.values(DATASET_COLUMN_TYPE),
      default: DATASET_COLUMN_TYPE.STRING
    },
    nullable: { type: Boolean, default: true },
    ordinalPosition: { type: Number, default: 0 }
  },
  { collection: COLLECTIONS.DATASET_COLUMNS, timestamps: true, versionKey: false }
);
DatasetColumnSchema.index({ datasetId: 1, ordinalPosition: 1 });

export const DatasetColumnModel: Model<IDatasetColumnDocument> =
  defineModel<IDatasetColumnDocument>('DatasetColumn', DatasetColumnSchema);

export interface IRowLevelSecurityRuleDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId | null;
  datasetId: mongoose.Types.ObjectId;
  name: string | null;
  userId: mongoose.Types.ObjectId | null;
  userEmail: string | null;
  roleId: mongoose.Types.ObjectId | null;
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
  createdById: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const RowLevelSecurityRuleSchema = new Schema<IRowLevelSecurityRuleDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRefOptional('Workspace'),
    datasetId: objectIdRef('Dataset', true),
    name: { type: String, default: null },
    userId: objectIdRefOptional('User'),
    userEmail: { type: String, default: null },
    roleId: objectIdRefOptional('Role'),
    column: { type: String, required: true },
    operator: { type: String, default: '=' },
    value: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    createdById: objectIdRefOptional('User')
  },
  { collection: COLLECTIONS.ROW_LEVEL_SECURITY_RULES, timestamps: true, versionKey: false }
);

export const RowLevelSecurityRuleModel: Model<IRowLevelSecurityRuleDocument> =
  defineModel<IRowLevelSecurityRuleDocument>('RowLevelSecurityRule', RowLevelSecurityRuleSchema);