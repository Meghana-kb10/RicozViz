import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createFromDashboardSchema,
  createTemplateFromDashboard,
  getTemplateById,
  instantiateDashboardFromTemplate,
  instantiateSchema,
  listTemplates
} from './template.service.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';

interface TemplateListQuery {
  category?: string;
  workspaceId?: string;
}

export class TemplateController {
  /** GET /api/v1/templates */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const query = (request.query ?? {}) as TemplateListQuery;

    const category = typeof query.category === 'string' ? query.category : undefined;
    const workspaceId = typeof query.workspaceId === 'string' ? query.workspaceId : undefined;

    const templates = await listTemplates(
      principal.organizationId,
      workspaceId,
      category,
      principal.userId,
      principal.roleName
    );
    sendSuccess(reply, templates, 200);
  }

  /** GET /api/v1/templates/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as { id: string };

    const template = await getTemplateById(
      id,
      principal.organizationId,
      principal.userId,
      principal.roleName
    );
    sendSuccess(reply, template, 200);
  }

  /** POST /api/v1/templates/from-dashboard */
  async createFromDashboard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const parsed = createFromDashboardSchema.parse(request.body);

    const template = await createTemplateFromDashboard({
      dashboardId: parsed.dashboardId,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      userId: principal.userId,
      organizationId: principal.organizationId,
      workspaceId: parsed.workspaceId,
      userRoleName: principal.roleName
    });

    sendSuccess(reply, template, 201);
  }

  /** POST /api/v1/templates/:id/instantiate (and the legacy /:id/apply alias) */
  async instantiate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as { id: string };
    const parsed = instantiateSchema.parse(request.body);

    const dashboard = await instantiateDashboardFromTemplate({
      templateId: id,
      name: parsed.name,
      description: parsed.description,
      workspaceId: parsed.workspaceId,
      targetDatasetId: parsed.targetDatasetId,
      userId: principal.userId,
      organizationId: principal.organizationId,
      userRoleName: principal.roleName
    });

    sendSuccess(reply, dashboard, 201);
  }
}

export const templateController = new TemplateController();