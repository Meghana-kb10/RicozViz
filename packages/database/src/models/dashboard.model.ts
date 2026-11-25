import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';
import { DASHBOARD_ACCESS_LEVEL, DASHBOARD_STATUS, DASHBOARD_VISIBILITY } from '@repo/types';

/**
 * Dashboard definitions plus the supporting version history and the access
 * grants that back collaboration.
 *
 * `shareToken` is a sparse unique index so dashboards without a share link
 * never collide on `null`.
 */
export interface IDashboardDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  ownerId: mongoose.Types.ObjectId;
  layoutConfig: Record<string, unknown>;
  shareToken: string | null;
  shareTokenActive: boolean;
  sharedAt: Date | null;
  shareExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DashboardSchema = new Schema<IDashboardDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(DASHBOARD_STATUS),
      default: DASHBOARD_STATUS.DRAFT,
      index: true
    },
    visibility: {
      type: String,
      enum: Object.values(DASHBOARD_VISIBILITY),
      default: DASHBOARD_VISIBILITY.PRIVATE
    },
    ownerId: objectIdRef('User', true),
    layoutConfig: { type: Schema.Types.Mixed, default: () => ({}) },
    shareToken: { type: String, default: undefined },
    shareTokenActive: { type: Boolean, default: false },
    sharedAt: { type: Date, default: null },
    shareExpiresAt: { type: Date, default: null }
  },
  { collection: COLLECTIONS.DASHBOARDS, timestamps: true, versionKey: false }
);
DashboardSchema.index({ organizationId: 1, status: 1 });
DashboardSchema.index(
  { shareToken: 1 },
  { unique: true, partialFilterExpression: { shareToken: { $type: 'string' } } }
);

export const DashboardModel: Model<IDashboardDocument> =
  defineModel<IDashboardDocument>('Dashboard', DashboardSchema);

/**
 * Immutable point-in-time snapshot of a dashboard layout.
 *
 * The `(dashboardId, versionNumber)` unique index guarantees gap-free,
 * monotonically increasing version numbers per dashboard.
 */
export interface IDashboardVersionDocument extends Document {
  _id: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  versionNumber: number;
  name: string;
  description: string | null;
  layoutConfig: Record<string, unknown>;
  chartsSnapshot: unknown[];
  changeSummary: string | null;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DashboardVersionSchema = new Schema<IDashboardVersionDocument>(
  {
    dashboardId: objectIdRef('Dashboard', true),
    versionNumber: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    layoutConfig: { type: Schema.Types.Mixed, default: () => ({}) },
    chartsSnapshot: { type: Schema.Types.Mixed, default: () => ([]) },
    changeSummary: { type: String, default: null },
    createdById: objectIdRef('User', true)
  },
  { collection: COLLECTIONS.DASHBOARD_VERSIONS, timestamps: true, versionKey: false }
);
DashboardVersionSchema.index({ dashboardId: 1, versionNumber: 1 }, { unique: true });

export const DashboardVersionModel: Model<IDashboardVersionDocument> =
  defineModel<IDashboardVersionDocument>('DashboardVersion', DashboardVersionSchema);

/**
 * Sharing grants for a dashboard. A row targets either a single `userId`, a
 * `roleId` shared by everyone holding that role, or an entire `organizationId`.
 */
export interface IDashboardAccessDocument extends Document {
  _id: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  roleId: mongoose.Types.ObjectId | null;
  organizationId: mongoose.Types.ObjectId | null;
  accessLevel: string;
  grantedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DashboardAccessSchema = new Schema<IDashboardAccessDocument>(
  {
    dashboardId: objectIdRef('Dashboard', true),
    userId: objectIdRefOptional('User'),
    roleId: objectIdRefOptional('Role'),
    organizationId: objectIdRefOptional('Organization'),
    accessLevel: {
      type: String,
      enum: Object.values(DASHBOARD_ACCESS_LEVEL),
      default: DASHBOARD_ACCESS_LEVEL.VIEW
    },
    grantedAt: { type: Date, default: Date.now }
  },
  { collection: COLLECTIONS.DASHBOARD_ACCESS, timestamps: true, versionKey: false }
);

export const DashboardAccessModel: Model<IDashboardAccessDocument> =
  defineModel<IDashboardAccessDocument>('DashboardAccess', DashboardAccessSchema);