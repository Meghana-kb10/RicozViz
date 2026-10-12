import type { ExportFormat, ExportResourceType, ExportStatus } from './enums';
import type { DashboardData } from './dashboard';
import type { UserSummary } from './common';

// ---- Export center -----------------------------------------------------------

export interface ExportRequestPayload {
  resourceType: ExportResourceType;
  resourceId: string;
  format: ExportFormat;
  workspaceId?: string;
  options?: {
    includeHeaders?: boolean;
    rowLimit?: number;
    title?: string;
  };
}

export interface ExportResult {
  jobId: string;
  resourceType: ExportResourceType;
  resourceId: string;
  resourceName: string;
  format: ExportFormat;
  contentType: string;
  filename: string;
  dataBase64?: string;
  textContent?: string;
  rowCount: number;
  fileSizeBytes: number;
  metadata?: Record<string, unknown>;
}

export interface ExportJobData {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  resourceType: ExportResourceType;
  resourceId: string;
  resourceName: string;
  format: ExportFormat;
  status: ExportStatus;
  rowCount?: number;
  fileSize?: number;
  downloadUrl?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  user?: { id: string; name: string; email: string };
}

// ---- Dashboard templates -----------------------------------------------------

export interface TemplateChartDef {
  title: string;
  chartType: string;
  description?: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface DashboardTemplateData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  layoutConfig: Record<string, unknown>;
  chartsConfig: TemplateChartDef[];
  isSystem: boolean;
  organizationId: string | null;
  workspaceId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateFromDashboardPayload {
  dashboardId: string;
  name: string;
  description?: string;
  category: string;
  workspaceId?: string;
}

export interface InstantiateDashboardPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  targetDatasetId?: string;
}

export type InstantiateDashboardResult = DashboardData;

export type { UserSummary };