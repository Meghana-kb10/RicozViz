/**
 * Authentication endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts` — names, verbs,
 * paths, parameter order and return types are unchanged so the migrated auth
 * pages keep calling these by the same signature.
 *
 * The legacy file declared local `UserData` / `OrganizationData` /
 * `AuthResponse` / `MeResponse` / `RefreshResponse` shapes. Those are now owned
 * by `@repo/types` as `UserProfile`, `OrganizationProfile`,
 * `RicozVizAuthResponse`, `RicozVizMeResponse` and `RicozVizRefreshResponse`
 * (structurally identical). `RicozViz*` prefixes are required because
 * `@repo/types` also exports a boilerplate `AuthResponse` for the template's
 * own user domain.
 */

import { apiFetch } from './client.js';
import type {
  RicozVizAuthResponse,
  RicozVizLoginInput,
  RicozVizMeResponse,
  RicozVizRefreshResponse,
  RicozVizRegisterInput
} from '@repo/types';

export async function apiRegister(input: RicozVizRegisterInput): Promise<RicozVizAuthResponse> {
  return apiFetch<RicozVizAuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiLogin(input: RicozVizLoginInput): Promise<RicozVizAuthResponse> {
  return apiFetch<RicozVizAuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiMe(): Promise<RicozVizMeResponse> {
  return apiFetch<RicozVizMeResponse>("/api/v1/auth/me");
}

export async function apiRefresh(): Promise<RicozVizRefreshResponse> {
  return apiFetch<RicozVizRefreshResponse>(
    "/api/v1/auth/refresh",
    { method: "POST" },
    true // Skip auth header — refresh uses the cookie
  );
}

export async function apiLogout(): Promise<void> {
  await apiFetch<{ message: string }>("/api/v1/auth/logout", {
    method: "POST",
  });
}
