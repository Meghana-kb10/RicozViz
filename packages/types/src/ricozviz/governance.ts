/**
 * Enterprise Security & Governance types.
 *
 * Models third-party certifications, cryptographic compliance controls,
 * row-level isolation guarantees, and audit attestation badges for RicozViz.
 */

export const SECURITY_BADGE_CATEGORY = {
  COMPLIANCE: 'COMPLIANCE',
  ENCRYPTION: 'ENCRYPTION',
  ACCESS_CONTROL: 'ACCESS_CONTROL',
  AUDIT_INTEGRITY: 'AUDIT_INTEGRITY'
} as const;
export type SecurityBadgeCategory =
  (typeof SECURITY_BADGE_CATEGORY)[keyof typeof SECURITY_BADGE_CATEGORY];

export const SECURITY_BADGE_STATUS = {
  VERIFIED: 'VERIFIED',
  COMPLIANT: 'COMPLIANT',
  ENFORCED: 'ENFORCED',
  ACTIVE: 'ACTIVE'
} as const;
export type SecurityBadgeStatus =
  (typeof SECURITY_BADGE_STATUS)[keyof typeof SECURITY_BADGE_STATUS];

export interface SecurityBadge {
  id: string;
  name: string;
  code: string;
  category: SecurityBadgeCategory;
  status: SecurityBadgeStatus;
  description: string;
  verificationStandard: string;
  attestationAuthority: string;
  lastVerifiedAt: string;
  nextAuditAt: string;
  evidenceHash: string;
  controlsEnforced: string[];
  auditReportId: string;
  icon: string;
}

export interface GovernancePosture {
  postureScore: number;
  overallStatus: 'HEALTHY_VERIFIED' | 'COMPLIANT' | 'NEEDS_REVIEW';
  tlsVersion: string;
  atRestCipher: string;
  auditIntegritySeal: string;
  tenantIsolation: string;
  zeroLeakageGuarantee: boolean;
  badges: SecurityBadge[];
  lastAssessmentDate: string;
}

export interface VerifyBadgeResult {
  valid: boolean;
  badgeId: string;
  evidenceHash: string;
  signatureVerified: boolean;
  verifiedAt: string;
  details?: Record<string, unknown>;
}
