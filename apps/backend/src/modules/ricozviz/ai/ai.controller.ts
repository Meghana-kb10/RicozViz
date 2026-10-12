import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  askDataAnalyst,
  generateDashboardSummary,
  generateDatasetInsights,
  nlToChart,
  toDatasetQueryFilters
} from './ai-analytics.service.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';

// ------------------------------------------------------------
// Validation Schemas (messages are contractual)
// ------------------------------------------------------------

const filterSchema = z.object({
  column: z.string().min(1),
  operator: z.string().default('='),
  value: z.unknown()
});

const askAnalystSchema = z.object({
  datasetId: z.string().min(1, 'datasetId is required'),
  question: z.string().min(1, 'question is required'),
  filters: z.array(filterSchema).optional(),
  dashboardId: z.string().optional()
});

const nlToChartSchema = z.object({
  datasetId: z.string().min(1, 'datasetId is required'),
  prompt: z.string().min(1, 'prompt is required'),
  filters: z.array(filterSchema).optional()
});

const insightsSchema = z.object({
  datasetId: z.string().min(1, 'datasetId is required'),
  dimension: z.string().optional(),
  measure: z.string().optional(),
  filters: z.array(filterSchema).optional(),
  data: z.array(z.record(z.unknown())).optional()
});

const dashboardSummarySchema = z.object({
  dashboardId: z.string().min(1, 'dashboardId is required'),
  activeFilters: z.array(filterSchema).optional()
});

export class AiController {
  /** POST /api/v1/ai/ask — AI Data Analyst grounded Q&A */
  async ask(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const body = askAnalystSchema.parse(request.body);

    const result = await askDataAnalyst(
      principal.userId,
      principal.organizationId,
      principal.roleName,
      {
        datasetId: body.datasetId,
        question: body.question,
        filters: toDatasetQueryFilters(body.filters),
        dashboardId: body.dashboardId
      }
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/ai/nl-to-chart — Natural Language to Chart generation */
  async nlToChart(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const body = nlToChartSchema.parse(request.body);

    const result = await nlToChart(
      principal.userId,
      principal.organizationId,
      principal.roleName,
      {
        datasetId: body.datasetId,
        prompt: body.prompt,
        filters: toDatasetQueryFilters(body.filters)
      }
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/ai/insights — Automatic insights and anomaly detection */
  async insights(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const body = insightsSchema.parse(request.body);

    const result = await generateDatasetInsights(
      principal.userId,
      principal.organizationId,
      principal.roleName,
      {
        datasetId: body.datasetId,
        dimension: body.dimension,
        measure: body.measure,
        filters: toDatasetQueryFilters(body.filters),
        data: body.data
      }
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/ai/dashboard-summary — AI-powered dashboard summary */
  async dashboardSummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const body = dashboardSummarySchema.parse(request.body);

    const result = await generateDashboardSummary(
      principal.userId,
      principal.organizationId,
      principal.roleName,
      {
        dashboardId: body.dashboardId,
        activeFilters: toDatasetQueryFilters(body.activeFilters)
      }
    );

    sendSuccess(reply, result);
  }
}

export const aiController = new AiController();