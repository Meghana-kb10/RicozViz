import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';
import {
  createChartSchema,
  updateChartSchema,
  createChart,
  listCharts,
  getChart,
  updateChart,
  deleteChart
} from './chart.service.js';

/** Chart routes are nested under `/dashboards/:id/charts`. */
interface ChartParams {
  id: string;
  chartId?: string;
}

export class ChartController {
  private audit(request: FastifyRequest): { ipAddress?: string; userAgent?: string } {
    return { ipAddress: request.ip, userAgent: request.headers['user-agent'] };
  }

  /** POST /api/v1/dashboards/:id/charts */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as ChartParams;
    const input = createChartSchema.parse(request.body ?? {});
    const result = await createChart(principal, id, input, this.audit(request));
    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/dashboards/:id/charts */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as ChartParams;
    const result = await listCharts(principal, id);
    sendSuccess(reply, result);
  }

  /** GET /api/v1/dashboards/:id/charts/:chartId */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id, chartId } = request.params as ChartParams;
    const result = await getChart(principal, id, String(chartId), this.audit(request));
    sendSuccess(reply, result);
  }

  /** PATCH /api/v1/dashboards/:id/charts/:chartId */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id, chartId } = request.params as ChartParams;
    const input = updateChartSchema.parse(request.body ?? {});
    const result = await updateChart(principal, id, String(chartId), input, this.audit(request));
    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/dashboards/:id/charts/:chartId */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id, chartId } = request.params as ChartParams;
    const result = await deleteChart(principal, id, String(chartId), this.audit(request));
    sendSuccess(reply, result);
  }
}

export const chartController = new ChartController();
