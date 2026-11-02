// ==============================================================================
// Platform Admin System Controller
// ==============================================================================
// Exposes system health, AI token usage and estimated costs per tenant, and
// centralized feature flag governance.
// ==============================================================================

import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { AiUsageModel, OrganizationModel, toObjectId } from '@repo/database';
import { getWorkerHealthStatus } from '../worker/worker-admin.service.js';
import { featureFlagService } from './feature-flag.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { logAuditEvent } from '../ricozviz/audit/audit.service.js';
import { validate } from '@repo/validation';
import { adminFeatureFlagUpsertSchema } from '@repo/validation';

export class AdminSystemController {
  /**
   * System health: MongoDB connection, background worker health, memory, uptime.
   */
  async health(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = mongoState === 1 ? 'CONNECTED' : mongoState === 2 ? 'CONNECTING' : 'DISCONNECTED';

    const workerHealth = await getWorkerHealthStatus();

    const mem = process.memoryUsage();

    sendSuccess(
      reply,
      {
        status: mongoStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
        database: {
          status: mongoStatus,
          readyState: mongoState
        },
        workerSubsystem: workerHealth,
        system: {
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          memoryMb: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024)
          }
        },
        timestamp: new Date().toISOString()
      },
      200
    );
  }

  /**
   * AI usage and estimated cost aggregated across all tenants and broken down by tenant.
   */
  async aiUsage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { tenantId?: string };

    const match: Record<string, unknown> = {};
    if (query.tenantId) {
      const orgId = toObjectId(query.tenantId);
      if (orgId) match.organizationId = orgId;
    }

    const aggregation = await AiUsageModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$organizationId',
          totalPrompts: { $sum: 1 },
          totalTokens: { $sum: '$totalTokens' },
          promptTokens: { $sum: '$promptTokens' },
          completionTokens: { $sum: '$completionTokens' },
          avgExecutionMs: { $avg: '$executionMs' },
          lastUsedAt: { $max: '$createdAt' }
        }
      },
      { $sort: { totalTokens: -1 } }
    ]);

    // Blended rate: $3/M input + $15/M output approx $0.000006 per token average
    const enriched = await Promise.all(
      aggregation.map(async (item) => {
        const org = await OrganizationModel.findById(item._id).select('name slug').lean();
        const estimatedCostUsd = Number(
          ((item.promptTokens * 3 + item.completionTokens * 15) / 1_000_000).toFixed(4)
        );

        return {
          tenantId: item._id?.toString(),
          tenantName: org?.name || 'Unknown Tenant',
          tenantSlug: org?.slug || 'unknown',
          totalPrompts: item.totalPrompts,
          totalTokens: item.totalTokens,
          promptTokens: item.promptTokens,
          completionTokens: item.completionTokens,
          estimatedCostUsd,
          avgExecutionMs: Math.round(item.avgExecutionMs || 0),
          lastUsedAt: item.lastUsedAt
        };
      })
    );

    const platformTotals = enriched.reduce(
      (acc, curr) => ({
        totalPrompts: acc.totalPrompts + curr.totalPrompts,
        totalTokens: acc.totalTokens + curr.totalTokens,
        totalCostUsd: Number((acc.totalCostUsd + curr.estimatedCostUsd).toFixed(4))
      }),
      { totalPrompts: 0, totalTokens: 0, totalCostUsd: 0 }
    );

    sendSuccess(reply, { summary: platformTotals, tenants: enriched }, 200);
  }

  /**
   * List all feature flags.
   */
  async listFlags(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const flags = await featureFlagService.listFeatureFlags();
    sendSuccess(reply, { flags }, 200);
  }

  /**
   * Upsert feature flag with global toggle and tenant overrides.
   */
  async upsertFlag(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = validate(adminFeatureFlagUpsertSchema, request.body);
    const updated = await featureFlagService.upsertFeatureFlag({
      ...body,
      updatedBy: request.adminUser!.email
    });

    await logAuditEvent({
      organizationId: 'platform',
      userId: request.adminUser!.userId,
      action: 'ADMIN_FEATURE_FLAG_UPSERTED',
      resourceType: 'FEATURE_FLAG',
      resourceId: updated.key,
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        key: updated.key,
        enabled: updated.enabled,
        overrideCount: updated.tenantOverrides?.length || 0
      }
    });

    sendSuccess(reply, { flag: updated, message: `Feature flag "${updated.key}" updated` }, 200);
  }

  /**
   * Delete feature flag.
   */
  async deleteFlag(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { key } = request.params as { key: string };
    if (!key) throw AppError.badRequest('Flag key is required');

    const deleted = await featureFlagService.deleteFeatureFlag(key);
    if (!deleted) throw AppError.notFound('Feature flag not found');

    await logAuditEvent({
      organizationId: 'platform',
      userId: request.adminUser!.userId,
      action: 'ADMIN_FEATURE_FLAG_DELETED',
      resourceType: 'FEATURE_FLAG',
      resourceId: key,
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        key
      }
    });

    sendSuccess(reply, { message: `Feature flag "${key}" deleted` }, 200);
  }
}

export const adminSystemController = new AdminSystemController();
