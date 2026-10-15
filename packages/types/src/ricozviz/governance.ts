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

// ---- Cryptographic RLS & RBAC Policy Simulation -----------------------------

export const RLS_SIMULATION_ROLE = {
  ORGANIZATION_ADMIN: 'ORGANIZATION_ADMIN',
  REGIONAL_SALES_LEAD: 'REGIONAL_SALES_LEAD',
  FINANCIAL_AUDITOR: 'FINANCIAL_AUDITOR',
  RESTRICTED_CONTRACTOR: 'RESTRICTED_CONTRACTOR'
} as const;
export type RlsSimulationRole =
  (typeof RLS_SIMULATION_ROLE)[keyof typeof RLS_SIMULATION_ROLE];

export const RLS_POLICY_CATEGORY = {
  TENANT_ISOLATION: 'TENANT_ISOLATION',
  REGIONAL_PARTITION: 'REGIONAL_PARTITION',
  COLUMN_MASKING: 'COLUMN_MASKING',
  METRIC_REDACTION: 'METRIC_REDACTION',
  ROW_SIGNING: 'ROW_SIGNING'
} as const;
export type RlsPolicyCategory =
  (typeof RLS_POLICY_CATEGORY)[keyof typeof RLS_POLICY_CATEGORY];

export interface RlsPolicyDefinition {
  id: string;
  name: string;
  description: string;
  category: RlsPolicyCategory;
  predicateSql: string;
  targetColumns: string[];
  maskingMethod: 'NONE' | 'PARTIAL_MASK' | 'FULL_REDACT' | 'ROW_EXCLUDE' | 'HMAC_NONCE';
  enabledByDefault: boolean;
}

export interface RlsRoleDefinition {
  id: RlsSimulationRole;
  label: string;
  description: string;
  defaultAllowedTenantId: string;
  defaultAllowedRegions: string[];
  recommendedPolicyIds: string[];
}

export interface RlsSimulatedRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  representative: string;
  email: string;
  region: string;
  grossRevenue: string;
  paymentToken: string;
  maskedColumns: string[];
  isRowFiltered: boolean;
  rowStatus: 'ACCESSIBLE' | 'PARTIALLY_MASKED' | 'CONFIDENTIAL_DROPPED';
  cryptographicSignature: string;
}

export interface RlsSimulationRequest {
  role: RlsSimulationRole | string;
  activePolicyIds: string[];
  tenantId?: string;
  userRegion?: string;
}

export interface RlsSimulationResult {
  role: string;
  tenantId: string;
  userRegion: string;
  activePolicies: string[];
  totalSourceRows: number;
  visibleRowsCount: number;
  filteredOutRowsCount: number;
  maskedColumnsCount: number;
  databaseRebuildsRequired: number;
  executionLatencyMs: number;
  appliedSqlAst: string;
  cryptographicSignature: string;
  simulatedAt: string;
  records: RlsSimulatedRecord[];
}

export interface RlsPoliciesCatalogResponse {
  roles: RlsRoleDefinition[];
  policies: RlsPolicyDefinition[];
  defaultRole: RlsSimulationRole;
  defaultTenantId: string;
  defaultUserRegion: string;
}

// ---- Enterprise Security Accreditations & CISO Trust Pack ------------------

export interface CisoAccreditationItem {
  id: string;
  title: string;
  badgeLabel: string;
  category: 'COMPLIANCE' | 'INFRASTRUCTURE' | 'IDENTITY' | 'ENCRYPTION';
  authority: string;
  standard: string;
  status: 'VERIFIED' | 'READY' | 'ENFORCED';
  evidenceDigest: string;
  cisoSummary: string;
  keyGuarantees: string[];
  auditReportId: string;
  iconName: string;
}

export interface CisoTrustOverview {
  soc2Certified: boolean;
  hipaaReady: boolean;
  zeroEgressEnforced: boolean;
  scimSamlEnabled: boolean;
  totalAccreditations: number;
  complianceScore: number;
  lastAttestationDate: string;
  auditorFirms: string[];
  accreditations: CisoAccreditationItem[];
}

export interface CisoAttestationDossier {
  tenantId: string;
  generatedAt: string;
  cryptographicSignature: string;
  complianceManifestHash: string;
  zeroEgressMode: 'ENFORCED_VPC_AIRGAP';
  ssoFederationStatus: 'SAML_2_0_SCIM_V2_ACTIVE';
  trustOverview: CisoTrustOverview;
}

// ---- Multi-Tenant Audit Trail Preview & Cryptographic Ledger ----------------

export interface ImmutableQueryLog {
  id: string;
  blockHeight: number;
  tenantId: string;
  tenantName: string;
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  userRole: string;
  userAvatar?: string;
  queryText: string;
  queryEngine: 'DUCKDB_WASM' | 'SNOWFLAKE_PUSHDOWN' | 'POSTGRES_CDC' | 'CLICKHOUSE_OLAP';
  durationMs: number;
  rowsAffected: number;
  status: 'SUCCESS_VERIFIED' | 'GUARDRAIL_BLOCKED' | 'ANOMALOUS_FLAGGED';
  prevBlockHash: string;
  blockHash: string;
  cryptographicProof: string;
  timestamp: string;
}

export interface UserSessionPresence {
  sessionId: string;
  tenantId: string;
  tenantName: string;
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  avatar: string;
  ipAddress: string;
  region: string;
  deviceInfo: string;
  activeResource: string;
  connectionStatus: 'ACTIVE' | 'IDLE' | 'QUERYING' | 'REVOKED';
  lastHeartbeatAt: string;
  tokenFingerprint: string;
  ephemeralTokenExpiresAt: string;
}

export interface CryptographicTokenRevocation {
  tokenId: string;
  tokenType: 'EPHEMERAL_QUERY_BEARER' | 'EXPORT_STREAM_NONCE' | 'SESSION_OAUTH_TOKEN';
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  issuedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  revocationReceiptSignature?: string;
  zeroReuseGuaranteed: boolean;
}

export interface LedgerIntegritySummary {
  chainHeight: number;
  tamperEvident: boolean;
  genesisHash: string;
  latestBlockHash: string;
  wormChainingAlgorithm: string;
  totalQueriesAudited: number;
  activeTenantsCount: number;
  activeSessionsCount: number;
  revokedTokensCount: number;
  zeroLeakageEnforced: boolean;
}

export interface AuditTrailPreviewData {
  immutableLogs: ImmutableQueryLog[];
  activeSessions: UserSessionPresence[];
  revokedTokens: CryptographicTokenRevocation[];
  ledgerIntegrity: LedgerIntegritySummary;
}

export interface RevokeTokenPayload {
  tokenId: string;
  reason: string;
  revokedBy?: string;
}

export interface RevokeTokenResult {
  success: boolean;
  tokenId: string;
  revocationReceiptSignature: string;
  revokedAt: string;
  reason: string;
  invalidatedSessionId?: string;
  message: string;
}



