/**
 * Workspace endpoints (workspaces, membership and member roles).
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts`. The member-role
 * PATCH lived at the bottom of the legacy file under "PHASE 5" but belongs to
 * this resource, so it is grouped with the rest of the workspace surface here.
 *
 * `WorkspaceData` and `WorkspaceMemberData` are owned by `@repo/types`.
 */

import { apiFetch } from './client.js';
import type { WorkspaceData, WorkspaceMemberData, WorkspaceRole } from '@repo/types';

export async function apiListWorkspaces(): Promise<WorkspaceData[]> {
  return apiFetch<WorkspaceData[]>("/api/v1/workspaces");
}

export async function apiGetWorkspace(id: string): Promise<WorkspaceData> {
  return apiFetch<WorkspaceData>(`/api/v1/workspaces/${id}`);
}

export async function apiCreateWorkspace(input: {
  name: string;
  description?: string;
}): Promise<WorkspaceData> {
  return apiFetch<WorkspaceData>("/api/v1/workspaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateWorkspace(
  id: string,
  input: { name?: string; description?: string | null }
): Promise<WorkspaceData> {
  return apiFetch<WorkspaceData>(`/api/v1/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteWorkspace(id: string): Promise<{ message: string; id: string }> {
  return apiFetch<{ message: string; id: string }>(`/api/v1/workspaces/${id}`, {
    method: "DELETE",
  });
}

export async function apiListWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberData[]> {
  return apiFetch<WorkspaceMemberData[]>(`/api/v1/workspaces/${workspaceId}/members`);
}

export async function apiAddWorkspaceMember(
  workspaceId: string,
  input: { userId: string; role?: "ADMIN" | "MEMBER" }
): Promise<WorkspaceMemberData> {
  return apiFetch<WorkspaceMemberData>(`/api/v1/workspaces/${workspaceId}/members`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiRemoveWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<{ message: string; workspaceId: string; userId: string }> {
  return apiFetch<{ message: string; workspaceId: string; userId: string }>(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    {
      method: "DELETE",
    }
  );
}

export async function apiUpdateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
): Promise<{
  id: string;
  workspaceId: string;
  role: string;
  user: { id: string; name: string; email: string };
}> {
  return apiFetch<{
    id: string;
    workspaceId: string;
    role: string;
    user: { id: string; name: string; email: string };
  }>(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}
