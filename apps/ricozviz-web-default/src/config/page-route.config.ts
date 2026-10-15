/**
 * Canonical route table for the RicozViz web app.
 *
 * Mirrors the App Router directory layout under `src/app`. The legacy pages
 * still use literal strings (to keep their markup byte-identical); this map is
 * the single source of truth for anything new.
 */
export const PAGE_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  STATUS: '/status',
  SETTINGS: '/settings',
  WORKSPACE: '/workspace',
  DATA_SOURCES: '/data-sources',
  DATASETS: {
    ROOT: '/datasets',
    DEMO: '/datasets/demo',
    DETAIL: (id: string) => `/datasets/${id}`
  },
  DATA_QUALITY: '/data-quality',
  DASHBOARDS: {
    ROOT: '/dashboards',
    DETAIL: (id: string) => `/dashboards/${id}`,
    SHARED: (token: string) => `/dashboards/shared/${token}`,
    EMBED: (token: string) => `/dashboards/embed/${token}`
  },
  VISUALIZATIONS: {
    ROOT: '/visualizations',
    SHARED: (token: string) => `/visualizations/shared/${token}`
  },
  METRICS: '/metrics',
  ALERTS: '/alerts',
  EXPORTS: '/exports',
  TEMPLATES: '/templates',
  AUDIT: '/audit',
  DOCS: '/docs',
  OPENAPI: '/openapi',
  BENCHMARKS: '/benchmarks',
  WHITEPAPER: '/whitepaper'
} as const;

export type PageRoutes = typeof PAGE_ROUTES;