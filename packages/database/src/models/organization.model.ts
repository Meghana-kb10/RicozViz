import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';
import { MEMBERSHIP_STATUS, ORGANIZATION_STATUS, USER_STATUS } from '@repo/types';

export interface IOrganizationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganizationDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    logoUrl: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(ORGANIZATION_STATUS),
      default: ORGANIZATION_STATUS.ACTIVE,
      index: true
    }
  },
  { collection: COLLECTIONS.ORGANIZATIONS, timestamps: true, versionKey: false }
);

export const OrganizationModel: Model<IOrganizationDocument> = defineModel<IOrganizationDocument>(
  'Organization',
  OrganizationSchema
);

export interface IRoleDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRoleDocument>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String, default: null },
    isSystem: { type: Boolean, default: false }
  },
  { collection: COLLECTIONS.ROLES, timestamps: true, versionKey: false }
);

export const RoleModel: Model<IRoleDocument> = defineModel<IRoleDocument>('Role', RoleSchema);

export interface IPermissionDocument extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<IPermissionDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String, default: null }
  },
  { collection: COLLECTIONS.PERMISSIONS, timestamps: true, versionKey: false }
);

export const PermissionModel: Model<IPermissionDocument> = defineModel<IPermissionDocument>(
  'Permission',
  PermissionSchema
);

export interface IRolePermissionDocument extends Document {
  _id: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  permissionId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RolePermissionSchema = new Schema<IRolePermissionDocument>(
  {
    roleId: objectIdRef('Role', true),
    permissionId: objectIdRef('Permission', true)
  },
  { collection: COLLECTIONS.ROLE_PERMISSIONS, timestamps: true, versionKey: false }
);
RolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });

export const RolePermissionModel: Model<IRolePermissionDocument> =
  defineModel<IRolePermissionDocument>('RolePermission', RolePermissionSchema);

export interface IOrganizationMemberDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  status: string;
  joinedAt: Date;
  updatedAt: Date;
}

const OrganizationMemberSchema = new Schema<IOrganizationMemberDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    userId: objectIdRef('User', true),
    roleId: objectIdRef('Role', true),
    status: {
      type: String,
      enum: Object.values(MEMBERSHIP_STATUS),
      default: MEMBERSHIP_STATUS.ACTIVE
    },
    joinedAt: { type: Date, default: Date.now }
  },
  { collection: COLLECTIONS.ORGANIZATION_MEMBERS, timestamps: true, versionKey: false }
);
OrganizationMemberSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const OrganizationMemberModel: Model<IOrganizationMemberDocument> =
  defineModel<IOrganizationMemberDocument>('OrganizationMember', OrganizationMemberSchema);