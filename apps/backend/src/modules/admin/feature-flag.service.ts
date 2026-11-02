// ==============================================================================
// Feature Flag Subsystem
// ==============================================================================
// Provides dynamic feature toggles with global defaults and per-tenant overrides.
// Used by both Platform Admin and Customer APIs.
// ==============================================================================

import { FeatureFlagModel, type IFeatureFlagDocument, type IFeatureFlagTenantOverride } from '@repo/database';
import { logger } from '../../utils/logger.js';

export interface UpsertFeatureFlagInput {
  key: string;
  description?: string;
  enabled: boolean;
  tenantOverrides?: IFeatureFlagTenantOverride[];
  updatedBy?: string;
}

export class FeatureFlagService {
  /**
   * Resolves whether a feature is enabled for a given tenant or globally.
   */
  async isFeatureEnabled(key: string, tenantId?: string): Promise<boolean> {
    const cleanKey = key.trim().toLowerCase();
    try {
      const flag = await FeatureFlagModel.findOne({ key: cleanKey }).lean();
      if (!flag) return false;

      if (tenantId && flag.tenantOverrides && flag.tenantOverrides.length > 0) {
        const override = flag.tenantOverrides.find((o) => o.tenantId === tenantId);
        if (override !== undefined) {
          return override.enabled;
        }
      }

      return flag.enabled;
    } catch (err) {
      logger.warn(`[FeatureFlag] Failed to query flag "${cleanKey}"`, { error: err });
      return false;
    }
  }

  /**
   * Lists all registered feature flags.
   */
  async listFeatureFlags(): Promise<IFeatureFlagDocument[]> {
    return FeatureFlagModel.find({}).sort({ key: 1 }).exec();
  }

  /**
   * Retrieves a single feature flag by key.
   */
  async getFeatureFlag(key: string): Promise<IFeatureFlagDocument | null> {
    const cleanKey = key.trim().toLowerCase();
    return FeatureFlagModel.findOne({ key: cleanKey }).exec();
  }

  /**
   * Creates or updates a feature flag with tenant overrides.
   */
  async upsertFeatureFlag(input: UpsertFeatureFlagInput): Promise<IFeatureFlagDocument> {
    const cleanKey = input.key.trim().toLowerCase();
    const doc = await FeatureFlagModel.findOneAndUpdate(
      { key: cleanKey },
      {
        $set: {
          key: cleanKey,
          description: input.description ?? '',
          enabled: input.enabled,
          tenantOverrides: input.tenantOverrides ?? [],
          updatedBy: input.updatedBy ?? null
        }
      },
      { upsert: true, new: true, runValidators: true }
    ).exec();

    return doc!;
  }

  /**
   * Deletes a feature flag by key.
   */
  async deleteFeatureFlag(key: string): Promise<boolean> {
    const cleanKey = key.trim().toLowerCase();
    const res = await FeatureFlagModel.deleteOne({ key: cleanKey }).exec();
    return res.deletedCount > 0;
  }
}

export const featureFlagService = new FeatureFlagService();
