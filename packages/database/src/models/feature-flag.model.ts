import mongoose, { Schema, Document, Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';

export interface IFeatureFlagTenantOverride {
  tenantId: string;
  enabled: boolean;
}

export interface IFeatureFlagDocument extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  description?: string;
  enabled: boolean;
  tenantOverrides: IFeatureFlagTenantOverride[];
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlagDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      default: ''
    },
    enabled: {
      type: Boolean,
      default: false,
      index: true
    },
    tenantOverrides: [
      {
        _id: false,
        tenantId: { type: String, required: true },
        enabled: { type: Boolean, required: true }
      }
    ],
    updatedBy: {
      type: String,
      default: null
    }
  },
  {
    collection: COLLECTIONS.FEATURE_FLAGS,
    timestamps: true,
    versionKey: false
  }
);

export const FeatureFlagModel: Model<IFeatureFlagDocument> =
  (mongoose.models.FeatureFlag as Model<IFeatureFlagDocument>) ||
  mongoose.model<IFeatureFlagDocument>('FeatureFlag', FeatureFlagSchema);
