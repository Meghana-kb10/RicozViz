/**
 * Authentication and identity payloads for the RicozViz domain.
 */

import type { UserProfile, OrganizationProfile } from './entities';

export interface RicozVizAuthResponse {
  user: UserProfile;
  organization: OrganizationProfile;
  role: string;
  permissions: string[];
  accessToken: string;
}

export interface RicozVizMeResponse {
  user: UserProfile;
  organization: OrganizationProfile;
  role: string;
  permissions: string[];
}

export interface RicozVizRefreshResponse {
  accessToken: string;
  permissions: string[];
}

export interface RicozVizRegisterInput {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface RicozVizLoginInput {
  email: string;
  password: string;
}

/** Decoded JWT access-token payload. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  organizationId?: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  role?: string;
  aud?: string;
  systemRole?: string;
  twoFactorVerified?: boolean;
  imp?: boolean;
  impersonator?: string;
  iat?: number;
  exp?: number;
}

/** Admin JWT access-token payload */
export interface AdminAccessTokenPayload {
  sub: string;
  email: string;
  role: 'PLATFORM_ADMIN';
  aud: 'admin';
  twoFactorVerified: boolean;
  type: 'access' | '2fa-pending';
  jti?: string;
  iat?: number;
  exp?: number;
}

/** Request-scoped principal attached by the `requireAuth` Fastify preHandler. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  role?: string;
  aud?: string;
  systemRole?: string;
  isImpersonated?: boolean;
  impersonator?: string;
}
