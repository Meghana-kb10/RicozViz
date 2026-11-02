import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel } from './model.util';

export interface IWorkerLockDocument extends Document {
  _id: mongoose.Types.ObjectId;
  jobName: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
  lastHeartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerLockSchema = new Schema<IWorkerLockDocument>(
  {
    jobName: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    owner: {
      type: String,
      required: true,
      index: true
    },
    acquiredAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: COLLECTIONS.WORKER_LOCKS,
    timestamps: true,
    versionKey: false
  }
);

export const WorkerLockModel: Model<IWorkerLockDocument> =
  defineModel<IWorkerLockDocument>('WorkerLock', WorkerLockSchema);
