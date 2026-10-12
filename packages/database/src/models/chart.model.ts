import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';

/**
 * A single visualisation belonging to a dashboard.
 *
 * `config` holds the chart-type specific options and `position` the grid
 * placement, both stored as `Mixed` so dashboards can evolve freely without a
 * migration.
 */
export interface IChartDocument extends Document {
  _id: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId | null;
  title: string;
  description: string | null;
  chartType: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  sortOrder: number;
  isPublic: boolean;
  shareToken: string | null;
  shareTokenActive: boolean;
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChartSchema = new Schema<IChartDocument>(
  {
    dashboardId: objectIdRef('Dashboard', true),
    datasetId: objectIdRefOptional('Dataset'),
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    chartType: { type: String, required: true, index: true },
    config: { type: Schema.Types.Mixed, default: () => ({}) },
    position: { type: Schema.Types.Mixed, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false },
    shareToken: { type: String, default: null, unique: true, sparse: true },
    shareTokenActive: { type: Boolean, default: true },
    sharedAt: { type: Date, default: null }
  },
  { collection: COLLECTIONS.CHARTS, timestamps: true, versionKey: false }
);

export const ChartModel: Model<IChartDocument> =
  defineModel<IChartDocument>('Chart', ChartSchema);