import mongoose, { Schema, type Model, type HydratedDocument } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';

export type AiUsageStatus = 'SUCCESS' | 'FAILED' | 'RETRY_SUCCESS';

export interface IAiUsage {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  datasetId?: mongoose.Types.ObjectId | null;
  prompt: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  executionMs: number;
  status: AiUsageStatus;
  errorMessage?: string | null;
  sql?: string | null;
  chartType?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IAiUsageDocument = HydratedDocument<IAiUsage>;

const AiUsageSchema = new Schema<IAiUsage>(
  {
    organizationId: objectIdRef('Organization', true),
    userId: objectIdRef('User', true),
    datasetId: objectIdRefOptional('Dataset', true),
    prompt: { type: String, required: true },
    provider: { type: String, required: true, default: 'anthropic' },
    model: { type: String, required: true },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    executionMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'RETRY_SUCCESS'],
      default: 'SUCCESS'
    },
    errorMessage: { type: String, default: null },
    sql: { type: String, default: null },
    chartType: { type: String, default: null }
  },
  {
    collection: COLLECTIONS.AI_USAGE,
    timestamps: true,
    versionKey: false
  }
);

AiUsageSchema.index({ organizationId: 1, createdAt: -1 });
AiUsageSchema.index({ userId: 1, createdAt: -1 });

export const AiUsageModel: Model<IAiUsage> = defineModel<IAiUsage>(
  'AiUsage',
  AiUsageSchema
);
