import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/index.js';
import { userRoutes } from './user/index.js';
import { productRoutes } from './product/index.js';
import { healthRoutes } from './health/index.js';

// ---- Migrated RicozViz domain ------------------------------------------------
// Namespaced under `/ricozviz` because the template already owns `auth`, `user`,
// `product` and `health`. Every prefix below matches the legacy Express mount
// points so the migrated web client keeps hitting the same URLs.
import { authRoutes as ricozvizAuthRoutes } from './ricozviz/auth/index.js';
import { ricozvizHealthRoutes } from './ricozviz/health/index.js';
import { workspaceRoutes } from './ricozviz/workspace/index.js';
import { dataSourceRoutes } from './ricozviz/data-source/index.js';
import { datasetRoutes, advancedDatasetRoutes } from './ricozviz/dataset/index.js';
import { dashboardRoutes } from './ricozviz/dashboard/index.js';
import { chartRoutes } from './ricozviz/chart/index.js';
import { collaborationRoutes } from './ricozviz/collaboration/index.js';
import { reportRoutes, reportScheduleRoutes } from './ricozviz/report/index.js';
import { visualizationRoutes } from './ricozviz/visualization/index.js';
import { metricRoutes } from './ricozviz/metric/index.js';
import { alertRoutes } from './ricozviz/alert/index.js';
import { exportRoutes } from './ricozviz/export/index.js';
import { templateRoutes } from './ricozviz/template/index.js';
import { auditRoutes } from './ricozviz/audit/index.js';
import { aiRoutes } from './ricozviz/ai/index.js';

/** Canonical list of migrated endpoints, served from the versioned index route. */
const RICOZVIZ_V1_ENDPOINTS = [
  '/api/v1/health',
  '/api/v1/auth',
  '/api/v1/workspaces',
  '/api/v1/data-sources',
  '/api/v1/datasets',
  '/api/v1/dashboards',
  '/api/v1/visualizations',
  '/api/v1/metrics',
  '/api/v1/alerts',
  '/api/v1/exports',
  '/api/v1/templates',
  '/api/v1/audit-logs',
  '/api/v1/ai/ask',
  '/api/v1/ai/nl-to-chart',
  '/api/v1/ai/insights',
  '/api/v1/ai/dashboard-summary'
] as const;

export async function registerModules(app: FastifyInstance): Promise<void> {
  // ---- Template demo modules (unversioned) ----
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(healthRoutes, { prefix: '/api/health' });

  // ---- RicozViz v1 surface (mounted exactly where the legacy Express app did) ----
  // Root redirects to the versioned RicozViz index. The template health route
  // continues to own `/api/health`; RicozViz health is served at `/api/v1/health`.
  app.get('/', async (_request, reply) => reply.redirect('/api/v1'));

  await app.register(ricozvizHealthRoutes, { prefix: '/api/v1/health' });
  await app.register(ricozvizAuthRoutes, { prefix: '/api/v1/auth' });
  await app.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
  await app.register(dataSourceRoutes, { prefix: '/api/v1/data-sources' });
  await app.register(datasetRoutes, { prefix: '/api/v1/datasets' });
  await app.register(advancedDatasetRoutes, { prefix: '/api/v1/datasets' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboards' });
  await app.register(chartRoutes, { prefix: '/api/v1/charts' });
  await app.register(collaborationRoutes, { prefix: '/api/v1/collaboration' });
  await app.register(reportScheduleRoutes, { prefix: '/api/v1/reports' });
  await app.register(reportRoutes, { prefix: '/api/v1/report-jobs' });
  await app.register(visualizationRoutes, { prefix: '/api/v1/visualizations' });
  await app.register(metricRoutes, { prefix: '/api/v1/metrics' });
  await app.register(alertRoutes, { prefix: '/api/v1/alerts' });
  await app.register(exportRoutes, { prefix: '/api/v1/exports' });
  await app.register(templateRoutes, { prefix: '/api/v1/templates' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit-logs' });
  await app.register(aiRoutes, { prefix: '/api/v1/ai' });

  // ---- Versioned index ----
  app.get('/api/v1', async (_request, reply) =>
    reply.send({ success: true, data: { version: 'v1', endpoints: RICOZVIZ_V1_ENDPOINTS } })
  );
}

export { RICOZVIZ_V1_ENDPOINTS };