import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';
import { AppError } from '../../../utils/errors.js';
import { GrantAccessSchema } from '../collaboration/collaboration.service.js';
import {
  createDashboardSchema,
  updateDashboardSchema,
  listDashboardsQuerySchema,
  createDashboard,
  listDashboards,
  getDashboardById,
  updateDashboard,
  deleteDashboard,
  createShareLink,
  getShareLinkStatus,
  disableShareLink,
  getSharedDashboard,
  getSharedChartData,
  type DashboardRequestContext
} from './dashboard.service.js';
import {
  createEmbedConfigSchema,
  createOrUpdateDashboardEmbed,
  getDashboardEmbedStatus,
  revokeDashboardEmbed,
  getPublicEmbedDashboard,
  getPublicEmbedChartData,
  type EmbedRequestHeaders
} from './dashboard-embed.service.js';
import {
  listDashboardVersions,
  getDashboardVersion,
  compareDashboardVersions,
  restoreDashboardVersion,
  resolveDashboardForVersioning
} from './dashboard-version.service.js';
import {
  listDashboardCollaborators,
  grantDashboardCollaborator,
  revokeDashboardCollaborator
} from '../collaboration/collaboration.service.js';

interface DashboardIdParams {
  id: string;
}

interface ShareTokenParams {
  shareToken: string;
}

interface ShareChartParams {
  shareToken: string;
  chartId: string;
}

interface EmbedTokenParams {
  embedToken: string;
}

interface EmbedChartParams {
  embedToken: string;
  chartId: string;
}

interface CollaboratorAccessParams {
  id: string;
  accessId: string;
}

interface VersionParams {
  id: string;
  versionNumber: string;
}

interface VersionCompareQuery {
  v1?: string;
  baseVersion?: string;
  v2?: string;
  targetVersion?: string;
}

export class DashboardController {
  // ============================================================
  // CONTEXT HELPERS
  // ============================================================

  /** Principal + transport metadata for audit-aware service calls. */
  private context(request: FastifyRequest): DashboardRequestContext {
    const principal = getPrincipal(request);
    return {
      ...principal,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    };
  }

  /** Anonymous context for the public share/embed endpoints. */
  private anonymousContext(request: FastifyRequest): DashboardRequestContext {
    return {
      userId: '',
      email: '',
      organizationId: '',
      roleId: '',
      roleName: '',
      permissions: [],
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    };
  }

  private embedHeaders(request: FastifyRequest): EmbedRequestHeaders {
    return {
      origin: request.headers.origin,
      referer: request.headers.referer,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip
    };
  }

  // ============================================================
  // PUBLIC SHARED & EMBEDDED DASHBOARDS (no authentication)
  // ============================================================

  /** GET /api/v1/dashboards/shared/:shareToken */
  async getSharedDashboard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { shareToken } = request.params as ShareTokenParams;
    const result = await getSharedDashboard(this.anonymousContext(request), shareToken);
    sendSuccess(reply, result);
  }

  /** POST /api/v1/dashboards/shared/:shareToken/charts/:chartId/data */
  async getSharedChartData(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { shareToken, chartId } = request.params as ShareChartParams;
    const body = (request.body ?? {}) as { filters?: unknown };
    const result = await getSharedChartData(
      this.anonymousContext(request),
      shareToken,
      chartId,
      body
    );
    sendSuccess(reply, result);
  }

  /** GET /api/v1/dashboards/embed/:embedToken */
  async getPublicEmbedDashboard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { embedToken } = request.params as EmbedTokenParams;
    const result = await getPublicEmbedDashboard(embedToken, this.embedHeaders(request));
    sendSuccess(reply, result);
  }

  /** POST /api/v1/dashboards/embed/:embedToken/charts/:chartId/data */
  async getPublicEmbedChartData(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { embedToken, chartId } = request.params as EmbedChartParams;
    const body = (request.body ?? {}) as { filters?: unknown };
    const result = await getPublicEmbedChartData(
      embedToken,
      chartId,
      body,
      this.embedHeaders(request)
    );
    sendSuccess(reply, result);
  }

  // ============================================================
  // DASHBOARD CRUD
  // ============================================================

  /** POST /api/v1/dashboards */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createDashboardSchema.parse(request.body ?? {});
    const result = await createDashboard(this.context(request), input);
    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/dashboards */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = listDashboardsQuerySchema.parse(request.query ?? {});
    const result = await listDashboards(this.context(request), query);
    sendSuccess(reply, result);
  }

  /** GET /api/v1/dashboards/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await getDashboardById(this.context(request), id);
    sendSuccess(reply, result);
  }

  /** PATCH /api/v1/dashboards/:id */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const input = updateDashboardSchema.parse(request.body ?? {});
    const result = await updateDashboard(this.context(request), id, input);
    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/dashboards/:id */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await deleteDashboard(this.context(request), id);
    sendSuccess(reply, result);
  }

  // ============================================================
  // SHARE LINKS
  // ============================================================

  /** POST /api/v1/dashboards/:id/share */
  async createShareLink(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const body = (request.body ?? {}) as { expiresAt?: unknown };
    const result = await createShareLink(this.context(request), id, body);
    sendSuccess(reply, result);
  }

  /** GET /api/v1/dashboards/:id/share */
  async getShareLinkStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await getShareLinkStatus(this.context(request), id);
    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/dashboards/:id/share */
  async disableShareLink(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await disableShareLink(this.context(request), id);
    sendSuccess(reply, result);
  }

  // ============================================================
  // EMBEDDED ANALYTICS
  // ============================================================

  /** POST /api/v1/dashboards/:id/embed */
  async createEmbed(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const input = createEmbedConfigSchema.parse(request.body ?? {});
    const result = await createOrUpdateDashboardEmbed(
      getPrincipal(request),
      id,
      input,
      this.embedHeaders(request)
    );
    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/dashboards/:id/embed */
  async getEmbed(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await getDashboardEmbedStatus(
      getPrincipal(request),
      id,
      this.embedHeaders(request)
    );
    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/dashboards/:id/embed */
  async revokeEmbed(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as DashboardIdParams;
    const result = await revokeDashboardEmbed(
      getPrincipal(request),
      id,
      this.embedHeaders(request)
    );
    sendSuccess(reply, result);
  }

  // ============================================================
  // COLLABORATORS
  // ============================================================

  /** GET /api/v1/dashboards/:id/collaborators */
  async listCollaborators(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as DashboardIdParams;
    const result = await listDashboardCollaborators(id, principal);
    sendSuccess(reply, result, 200);
  }

  /** POST /api/v1/dashboards/:id/collaborators */
  async grantCollaborator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as DashboardIdParams;
    const parsed = GrantAccessSchema.parse(request.body ?? {});
    const result = await grantDashboardCollaborator(id, parsed, principal);
    sendSuccess(reply, result, 201);
  }

  /** DELETE /api/v1/dashboards/:id/collaborators/:accessId */
  async revokeCollaborator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id, accessId } = request.params as CollaboratorAccessParams;
    const result = await revokeDashboardCollaborator(id, accessId, principal);
    sendSuccess(reply, result, 200);
  }

  // ============================================================
  // VERSION HISTORY
  // ============================================================

  /** GET /api/v1/dashboards/:id/versions */
  async listVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as DashboardIdParams;
    await resolveDashboardForVersioning(id, principal, 'READ');
    const versions = await listDashboardVersions(id);
    sendSuccess(reply, versions, 200);
  }

  /** GET /api/v1/dashboards/:id/versions/compare */
  async compareVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id } = request.params as DashboardIdParams;
    await resolveDashboardForVersioning(id, principal, 'READ');

    const query = (request.query ?? {}) as VersionCompareQuery;
    const v1 = parseInt(String(query.v1 ?? query.baseVersion ?? ''), 10);
    const v2 = parseInt(String(query.v2 ?? query.targetVersion ?? ''), 10);

    if (Number.isNaN(v1) || Number.isNaN(v2)) {
      throw AppError.badRequest(
        'Query parameters v1 (baseVersion) and v2 (targetVersion) are required numbers'
      );
    }

    const comparison = await compareDashboardVersions(id, v1, v2);
    sendSuccess(reply, comparison, 200);
  }

  /** GET /api/v1/dashboards/:id/versions/:versionNumber */
  async getVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id, versionNumber } = request.params as VersionParams;
    await resolveDashboardForVersioning(id, principal, 'READ');

    const versionNum = parseInt(versionNumber, 10);
    if (Number.isNaN(versionNum)) {
      throw AppError.badRequest('Invalid version number');
    }

    const version = await getDashboardVersion(id, versionNum);
    sendSuccess(reply, version, 200);
  }

  /**
   * POST /api/v1/dashboards/:id/versions/:versionNumber/restore
   * RESTORE SEMANTICS: Creates a new current state (version N+1) rather than
   * destroying history.
   */
  async restoreVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const { id, versionNumber } = request.params as VersionParams;
    await resolveDashboardForVersioning(id, principal, 'WRITE');

    const versionNum = parseInt(versionNumber, 10);
    if (Number.isNaN(versionNum)) {
      throw AppError.badRequest('Invalid version number');
    }

    const result = await restoreDashboardVersion(id, versionNum, principal);
    sendSuccess(reply, result, 200);
  }
}

export const dashboardController = new DashboardController();
