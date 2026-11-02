// ==============================================================================
// Platform Admin Workers Controller
// ==============================================================================
// Orchestrates background worker daemons: run history, health inspection, and
// manual on-demand execution with audit trail logging.
// ==============================================================================

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  listWorkerRuns,
  getWorkerHealthStatus,
  triggerJob
} from '../worker/worker-admin.service.js';
import { sendSuccess } from '../../utils/response.js';
import { logAuditEvent } from '../ricozviz/audit/audit.service.js';
import type { WorkerRunStatus } from '@repo/types';
import { validate } from '@repo/validation';
import { adminWorkerTriggerSchema } from '@repo/validation';

export class AdminWorkersController {
  /**
   * List historical and active worker runs.
   */
  async runs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { jobName?: string; status?: string; limit?: string; offset?: string };
    const result = await listWorkerRuns({
      jobName: query.jobName,
      status: query.status as WorkerRunStatus | undefined,
      limit: query.limit ? Number(query.limit) : 50,
      skip: query.offset ? Number(query.offset) : 0
    });

    sendSuccess(reply, { runs: result.runs, total: result.total }, 200);
  }

  /**
   * Inspect background worker subsystem health and active leases.
   */
  async health(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const health = await getWorkerHealthStatus();
    sendSuccess(reply, health, 200);
  }

  /**
   * Manually trigger a registered background worker job.
   */
  async trigger(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = validate(adminWorkerTriggerSchema, request.body);
    const result = await triggerJob(body.jobName);

    await logAuditEvent({
      organizationId: 'platform',
      userId: request.adminUser!.userId,
      action: 'ADMIN_WORKER_TRIGGERED',
      resourceType: 'WORKER_JOB',
      resourceId: body.jobName,
      ipAddress: request.ip,
      metadata: {
        adminEmail: request.adminUser!.email,
        jobName: body.jobName,
        status: result.status,
        durationMs: result.durationMs,
        error: result.error
      }
    });

    sendSuccess(reply, result, 200);
  }
}

export const adminWorkersController = new AdminWorkersController();
