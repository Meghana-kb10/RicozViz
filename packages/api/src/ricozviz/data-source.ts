/**
 * Data source endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts`.
 *
 * Note on `type`: the legacy `DataSourceType` used by this endpoint
 * (`POSTGRESQL | MYSQL | SQLITE | CSV | REST_API | XLSX | JSON`) is the
 * *upload/connect* vocabulary of the web forms. It is intentionally kept inline
 * here rather than replaced with the `@repo/types` `DataSourceType`, which
 * describes the persisted Prisma enum and has a different member set.
 * Swapping them would silently narrow callers.
 */

import { apiFetch, toQueryString } from './client.js';
import type { ConnectionTestResult, DataSourceData, DataSourceConnectorType, DataSourceType } from '@repo/types';

export async function apiListDataSources(params?: { workspaceId?: string }): Promise<DataSourceData[]> {
  // Byte-identical to the legacy `URLSearchParams` build for this single
  // optional string parameter.
  const qs = toQueryString({ workspaceId: params?.workspaceId });
  return apiFetch<DataSourceData[]>(`/api/v1/data-sources${qs}`);
}

export async function apiGetDataSource(id: string): Promise<DataSourceData> {
  return apiFetch<DataSourceData>(`/api/v1/data-sources/${id}`);
}

export async function apiCreateDataSource(input: {
  workspaceId?: string | null;
  name: string;
  description?: string;
  type: DataSourceConnectorType | DataSourceType;
  connection: Record<string, unknown>;
}): Promise<DataSourceData> {
  return apiFetch<DataSourceData>("/api/v1/data-sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateDataSource(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    connection?: Record<string, unknown>;
    status?: string;
  }
): Promise<DataSourceData> {
  return apiFetch<DataSourceData>(`/api/v1/data-sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteDataSource(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/data-sources/${id}`, {
    method: "DELETE",
  });
}

export async function apiTestDataSourceConnection(
  id: string
): Promise<ConnectionTestResult> {
  return apiFetch<ConnectionTestResult>(
    `/api/v1/data-sources/${id}/test-connection`,
    {
      method: "POST",
    }
  );
}

/**
 * Test a connection payload *before* the data source has been persisted.
 *
 * Lives at the collection level (`/test-connection`) rather than under an id,
 * which is why it is a separate endpoint from `apiTestDataSourceConnection`.
 */
export async function apiTestRawConnection(payload: {
  type: string;
  connection: Record<string, unknown>;
}): Promise<{ success: boolean; status: string; message: string; details?: Record<string, unknown> }> {
  return apiFetch("/api/v1/data-sources/test-connection", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
