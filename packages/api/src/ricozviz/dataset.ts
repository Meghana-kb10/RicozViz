/**
 * Dataset endpoints.
 *
 * The single largest surface of the legacy client: CRUD + upload, preview,
 * CSV schema sniffing, source-table discovery/import, scheduled refresh,
 * demo catalog, blends, calculated fields, the query engine, profiling,
 * transformations, version history, lineage and row-level-security rules.
 *
 * Every function is mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts`.
 * Query strings are byte-identical: where the legacy code built
 * `URLSearchParams` with falsy-value guards (`if (params?.page)`) the inline
 * logic is preserved, because `toQueryString` keeps numeric `0`/`false` and
 * would therefore emit `page=0` where the legacy client emitted nothing.
 */

import { apiFetch, toQueryString } from './client.js';
import type {
  ApplyTransformationResponse,
  CalculatedFieldConfig,
  CreateCalculatedFieldRequest,
  CreateDatasetBlendRequest,
  CreateDatasetInput,
  CsvPreviewSchemaResult,
  DatasetBlendPreviewRequest,
  DatasetBlendPreviewResult,
  DatasetColumn,
  DatasetData,
  DatasetLineageResponse,
  DatasetPreviewResult,
  DatasetProfileResult,
  DatasetQueryParams,
  DatasetQueryResult,
  DatasetRefreshSchedule,
  DatasetVersionItem,
  DemoDatasetCatalogItem,
  ImportedDatasetData,
  PreviewCalculatedFieldRequest,
  PreviewCalculatedFieldResult,
  RlsOperator,
  RowLevelSecurityRule,
  SourceTable,
  TransformationPreviewResponse,
  TransformationStep,
  UpdateCalculatedFieldRequest,
  UpdateDatasetInput
} from '@repo/types';

// ---- CRUD ---------------------------------------------------------------------

export async function apiListDatasets(params?: {
  workspaceId?: string;
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<DatasetData[]> {
  const query = new URLSearchParams();
  if (params?.workspaceId) query.set("workspaceId", params.workspaceId);
  if (params?.search) query.set("search", params.search);
  if (params?.type) query.set("type", params.type);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiFetch<DatasetData[]>(`/api/v1/datasets${qs ? `?${qs}` : ""}`);
}

export async function apiGetDataset(id: string): Promise<DatasetData> {
  return apiFetch<DatasetData>(`/api/v1/datasets/${id}`);
}

export async function apiCreateDataset(input: CreateDatasetInput): Promise<DatasetData> {
  return apiFetch<DatasetData>("/api/v1/datasets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Multipart upload — the transport skips `Content-Type` for `FormData` bodies. */
export async function apiUploadDataset(formData: FormData): Promise<DatasetData> {
  return apiFetch<DatasetData>("/api/v1/datasets/upload", {
    method: "POST",
    body: formData,
  });
}

export async function apiUpdateDataset(
  id: string,
  input: UpdateDatasetInput
): Promise<DatasetData> {
  return apiFetch<DatasetData>(`/api/v1/datasets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteDataset(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/datasets/${id}`, {
    method: "DELETE",
  });
}

// ---- Preview ------------------------------------------------------------------

export async function apiPreviewDataset(
  id: string,
  limit = 25
): Promise<DatasetPreviewResult> {
  return apiFetch<DatasetPreviewResult>(`/api/v1/datasets/${id}/preview?limit=${limit}`);
}

export async function apiPreviewCsvSchema(
  csvText: string,
  delimiter = ","
): Promise<CsvPreviewSchemaResult> {
  return apiFetch<CsvPreviewSchemaResult>("/api/v1/datasets/csv/preview-schema", {
    method: "POST",
    body: JSON.stringify({ csvText, delimiter }),
  });
}

// ---- Source tables ------------------------------------------------------------

export async function apiListSourceTables(dataSourceId: string): Promise<SourceTable[]> {
  return apiFetch<SourceTable[]>(`/api/v1/datasets/source/${dataSourceId}/tables`);
}

export async function apiGetSourceTableSchema(
  dataSourceId: string,
  tableName: string
): Promise<{ tableName: string; columns: DatasetColumn[] }> {
  return apiFetch<{ tableName: string; columns: DatasetColumn[] }>(
    `/api/v1/datasets/source/${dataSourceId}/tables/${tableName}/schema`
  );
}

export async function apiImportSourceTable(
  dataSourceId: string,
  input: {
    tableName: string;
    name?: string;
    description?: string;
    workspaceId?: string;
  }
): Promise<DatasetData> {
  return apiFetch<DatasetData>(`/api/v1/datasets/source/${dataSourceId}/import`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- Scheduled refresh --------------------------------------------------------

export async function apiGetDatasetRefreshSchedule(
  datasetId: string
): Promise<DatasetRefreshSchedule> {
  return apiFetch<DatasetRefreshSchedule>(`/api/v1/datasets/${datasetId}/refresh-schedule`);
}

export async function apiSaveDatasetRefreshSchedule(
  datasetId: string,
  schedule: {
    enabled: boolean;
    frequency: string;
    intervalMinutes?: number;
  }
): Promise<DatasetRefreshSchedule> {
  return apiFetch<DatasetRefreshSchedule>(`/api/v1/datasets/${datasetId}/refresh-schedule`, {
    method: "POST",
    body: JSON.stringify(schedule),
  });
}

export async function apiDeleteDatasetRefreshSchedule(
  datasetId: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/datasets/${datasetId}/refresh-schedule`, {
    method: "DELETE",
  });
}

export async function apiTriggerDatasetRefresh(
  datasetId: string
): Promise<{ success: boolean; durationMs: number; rowCount?: number; message?: string }> {
  return apiFetch<{ success: boolean; durationMs: number; rowCount?: number; message?: string }>(
    `/api/v1/datasets/${datasetId}/refresh`,
    {
      method: "POST",
    }
  );
}

// ---- Demo catalog -------------------------------------------------------------

export async function apiGetDemoCatalog(params?: {
  category?: string;
  search?: string;
}): Promise<DemoDatasetCatalogItem[]> {
  // Byte-identical to the legacy `URLSearchParams` build for these two
  // optional string parameters.
  const qs = toQueryString({ category: params?.category, search: params?.search });
  return apiFetch<DemoDatasetCatalogItem[]>(`/api/v1/datasets/demo/catalog${qs}`);
}

export async function apiGetDemoDataset(demoId: string): Promise<DemoDatasetCatalogItem> {
  return apiFetch<DemoDatasetCatalogItem>(`/api/v1/datasets/demo/${demoId}`);
}

export async function apiImportDemoDataset(
  demoId: string,
  input?: { workspaceId?: string | null; customName?: string }
): Promise<ImportedDatasetData> {
  return apiFetch<ImportedDatasetData>(`/api/v1/datasets/demo/${demoId}/import`, {
    method: "POST",
    body: JSON.stringify(input || {}),
  });
}

// ---- Blends -------------------------------------------------------------------

export async function apiPreviewDatasetBlend(
  input: DatasetBlendPreviewRequest
): Promise<DatasetBlendPreviewResult> {
  return apiFetch<DatasetBlendPreviewResult>("/api/v1/datasets/blends/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiCreateDatasetBlend(
  input: CreateDatasetBlendRequest
): Promise<DatasetData> {
  return apiFetch<DatasetData>("/api/v1/datasets/blends", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiListDatasetBlends(params?: {
  workspaceId?: string;
}): Promise<DatasetData[]> {
  // Byte-identical to the legacy `URLSearchParams` build for this single
  // optional string parameter.
  const qs = toQueryString({ workspaceId: params?.workspaceId });
  return apiFetch<DatasetData[]>(`/api/v1/datasets/blends${qs}`);
}

export async function apiGetDatasetBlend(id: string): Promise<DatasetData> {
  return apiFetch<DatasetData>(`/api/v1/datasets/blends/${id}`);
}

export async function apiDeleteDatasetBlend(
  id: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/v1/datasets/blends/${id}`, {
    method: "DELETE",
  });
}

// ---- Calculated fields --------------------------------------------------------

export async function apiPreviewCalculatedField(
  datasetId: string,
  input: PreviewCalculatedFieldRequest
): Promise<PreviewCalculatedFieldResult> {
  return apiFetch<PreviewCalculatedFieldResult>(
    `/api/v1/datasets/${datasetId}/calculated-fields/preview`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function apiCreateCalculatedField(
  datasetId: string,
  input: CreateCalculatedFieldRequest
): Promise<{ field: CalculatedFieldConfig; dataset: DatasetData }> {
  return apiFetch<{ field: CalculatedFieldConfig; dataset: DatasetData }>(
    `/api/v1/datasets/${datasetId}/calculated-fields`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function apiListCalculatedFields(
  datasetId: string
): Promise<CalculatedFieldConfig[]> {
  return apiFetch<CalculatedFieldConfig[]>(
    `/api/v1/datasets/${datasetId}/calculated-fields`
  );
}

export async function apiUpdateCalculatedField(
  datasetId: string,
  fieldId: string,
  input: UpdateCalculatedFieldRequest
): Promise<{ field: CalculatedFieldConfig; dataset: DatasetData }> {
  return apiFetch<{ field: CalculatedFieldConfig; dataset: DatasetData }>(
    `/api/v1/datasets/${datasetId}/calculated-fields/${fieldId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function apiDeleteCalculatedField(
  datasetId: string,
  fieldId: string
): Promise<{ message: string; dataset: DatasetData }> {
  return apiFetch<{ message: string; dataset: DatasetData }>(
    `/api/v1/datasets/${datasetId}/calculated-fields/${fieldId}`,
    {
      method: "DELETE",
    }
  );
}

// ---- Query engine -------------------------------------------------------------

export async function apiQueryDataset(
  id: string,
  params: DatasetQueryParams
): Promise<DatasetQueryResult> {
  return apiFetch<DatasetQueryResult>(`/api/v1/datasets/${id}/query`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---- Data profiling -----------------------------------------------------------

export async function apiProfileDataset(
  datasetId: string,
  refresh = false
): Promise<DatasetProfileResult> {
  return apiFetch<DatasetProfileResult>(
    `/api/v1/datasets/${datasetId}/profile${refresh ? "?refresh=true" : ""}`
  );
}

// ---- Transformations ----------------------------------------------------------

export async function apiPreviewTransformations(
  datasetId: string,
  steps: TransformationStep[]
): Promise<TransformationPreviewResponse> {
  return apiFetch<TransformationPreviewResponse>(`/api/v1/datasets/${datasetId}/transform/preview`, {
    method: "POST",
    body: JSON.stringify({ steps }),
  });
}

export async function apiApplyTransformations(
  datasetId: string,
  payload: {
    steps: TransformationStep[];
    mode: "NEW_VERSION" | "DERIVED_DATASET" | "CREATE_NEW" | "SAVE_VERSION";
    newDatasetName?: string;
    changeSummary?: string;
    workspaceId?: string;
  }
): Promise<ApplyTransformationResponse> {
  return apiFetch<ApplyTransformationResponse>(`/api/v1/datasets/${datasetId}/transform/apply`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- Versioning & lineage -----------------------------------------------------

export async function apiListDatasetVersions(datasetId: string): Promise<DatasetVersionItem[]> {
  return apiFetch<DatasetVersionItem[]>(`/api/v1/datasets/${datasetId}/versions`);
}

export async function apiGetDatasetVersion(
  datasetId: string,
  versionNumber: number
): Promise<DatasetVersionItem> {
  return apiFetch<DatasetVersionItem>(`/api/v1/datasets/${datasetId}/versions/${versionNumber}`);
}

export async function apiRestoreDatasetVersion(
  datasetId: string,
  versionNumber: number
): Promise<{ message: string; dataset: Record<string, unknown>; restoredVersion: number; newVersion: number }> {
  return apiFetch<{ message: string; dataset: Record<string, unknown>; restoredVersion: number; newVersion: number }>(
    `/api/v1/datasets/${datasetId}/versions/${versionNumber}/restore`,
    {
      method: "POST",
    }
  );
}

export async function apiGetDatasetLineage(datasetId: string): Promise<DatasetLineageResponse> {
  return apiFetch<DatasetLineageResponse>(`/api/v1/datasets/${datasetId}/lineage`);
}

// ---- Row-level security -------------------------------------------------------

export async function apiListDatasetRlsRules(
  datasetId: string
): Promise<RowLevelSecurityRule[]> {
  return apiFetch<RowLevelSecurityRule[]>(`/api/v1/datasets/${datasetId}/rls`);
}

export async function apiCreateRlsRule(
  datasetId: string,
  rule: {
    name: string;
    description?: string;
    columnName: string;
    operator: RlsOperator;
    ruleValue: unknown;
    roleName?: string;
    userId?: string;
    isEnabled?: boolean;
  }
): Promise<RowLevelSecurityRule> {
  return apiFetch<RowLevelSecurityRule>(`/api/v1/datasets/${datasetId}/rls`, {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export async function apiUpdateRlsRule(
  datasetId: string,
  ruleId: string,
  rule: Partial<{
    name: string;
    description: string;
    columnName: string;
    operator: RlsOperator;
    ruleValue: unknown;
    roleName: string;
    userId: string;
    isEnabled: boolean;
  }>
): Promise<RowLevelSecurityRule> {
  return apiFetch<RowLevelSecurityRule>(`/api/v1/datasets/${datasetId}/rls/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(rule),
  });
}

export async function apiDeleteRlsRule(
  datasetId: string,
  ruleId: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/datasets/${datasetId}/rls/${ruleId}`, {
    method: "DELETE",
  });
}
