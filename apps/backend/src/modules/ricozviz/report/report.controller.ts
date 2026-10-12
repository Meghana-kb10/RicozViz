import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';
import type { DashboardRequestContext } from '../dashboard/dashboard.service.js';
import {
  getDashboardSchedule,
  upsertDashboardSchedule,
  deleteDashboardSchedule,
  generateDashboardReport,
  createDashboardReport,
  runDashboardReport,
  getDashboardReportHistory
} from './report.service.js';

interface DashboardIdParams {
  id: string;
}

interface ReportRunParams {
  id: string;
  reportId: string;
}

export class ReportController {
  private context(request: FastifyRequest): DashboardRequestContext {
    const principal = getPrincipal(request);
    return {
      ...principal,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    };
  }

  // ============================================================
  // SCHEDULE
  // ============================================================

  /** GET /api/v1/dashboards/:id/schedule */
  async getSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await getDashboardSchedule(this.context(request), id);
    sendSuccess(reply, result);
  }

  /** POST /api/v1/dashboards/:id/schedule */
  async upsertSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = await upsertDashboardSchedule(this.context(request), id, body);
    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/dashboards/:id/schedule */
  async deleteSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await deleteDashboardSchedule(this.context(request), id);
    sendSuccess(reply, result);
  }

  // ============================================================
  // REPORTS
  // ============================================================

  /** POST /api/v1/dashboards/:id/reports/generate */
  async generate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const body = (request.body ?? {}) as {
      filters?: Array<Record<string, unknown>>;
      dashboardFilters?: Array<Record<string, unknown>>;
      format?: string;
    };
    const result = await generateDashboardReport(this.context(request), id, body);
    sendSuccess(reply, result);
  }

  /** POST /api/v1/dashboards/:id/reports */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = await createDashboardReport(this.context(request), id, body);
    sendSuccess(reply, result, 201);
  }

  /** POST /api/v1/dashboards/:id/reports/:reportId/run */
  async run(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id, reportId } = request.params as ReportRunParams;
    const result = await runDashboardReport(this.context(request), id, reportId);
    sendSuccess(reply, result);
  }

  /** GET /api/v1/dashboards/:id/reports/history */
  async history(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await getDashboardReportHistory(this.context(request), id);
    sendSuccess(reply, result);
  }
}

export const reportController = new ReportController();
