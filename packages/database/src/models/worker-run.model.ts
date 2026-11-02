import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel } from './model.util';
import type { WorkerRunStatus } from '@repo/types';

export interface IWorkerRunDocument extends Document {
  _id: mongoose.Types.ObjectId;
  jobName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: WorkerRunStatus;
  attempt: number;
  itemsProcessed: number;
  error: string | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerRunSchema = new Schema<IWorkerRunDocument>(
  {
    jobName: {
      type: String,
      required: true,
      index: true
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      // 30 days retention policy
      index: { expires: 30 * 24 * 60 * 60 }
    },
    finishedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED'],
      default: 'RUNNING',
      index: true
    },
    attempt: {
      type: Number,
      required: true,
      default: 1
    },
    itemsProcessed: {
      type: Number,
      required: true,
      default: 0
    },
    error: {
      type: String,
      default: null
    },
    durationMs: {
      type: Number,
      default: null
    }
  },
  {
    collection: COLLECTIONS.WORKER_RUNS,
    timestamps: true,
    versionKey: false
  }
);

WorkerRunSchema.index({ jobName: 1, startedAt: -1 });

export const WorkerRunModel: Model<IWorkerRunDocument> =
  defineModel<IWorkerRunDocument>('WorkerRun', WorkerRunSchema);
