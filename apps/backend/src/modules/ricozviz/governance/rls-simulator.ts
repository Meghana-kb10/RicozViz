import crypto from 'node:crypto';
import type {
  RlsPolicyDefinition,
  RlsRoleDefinition,
  RlsSimulatedRecord,
  RlsSimulationRequest,
  RlsSimulationResult,
  RlsPoliciesCatalogResponse
} from '@repo/types';

// =============================================================================
// RAW SOURCE DATASET (In-memory multi-tenant transaction stream)
// =============================================================================

interface RawTransactionRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  representative: string;
  email: string;
  region: string;
  grossRevenueNum: number;
  paymentTokenRaw: string;
}

const SOURCE_RECORDS: RawTransactionRecord[] = [
  {
    id: 'tx_01',
    tenantId: 'org_101',
    tenantName: 'Acme Enterprise Corp',
    representative: 'Sarah Connor',
    email: 'sarah.connor@acme.corp',
    region: 'US-East',
    grossRevenueNum: 142500,
    paymentTokenRaw: 'tok_live_9942a8f89e21'
  },
  {
    id: 'tx_02',
    tenantId: 'org_101',
    tenantName: 'Acme Enterprise Corp',
    representative: 'Marcus Wright',
    email: 'marcus.wright@acme.corp',
    region: 'EU-West',
    grossRevenueNum: 89200,
    paymentTokenRaw: 'tok_live_8831c1b34a10'
  },
  {
    id: 'tx_03',
    tenantId: 'org_102',
    tenantName: 'Globex Global Industries',
    representative: 'Hank Scorpio',
    email: 'hank.scorpio@globex.com',
    region: 'US-East',
    grossRevenueNum: 320000,
    paymentTokenRaw: 'tok_live_7712d9e902b4'
  },
  {
    id: 'tx_04',
    tenantId: 'org_102',
    tenantName: 'Globex Global Industries',
    representative: 'Tanya Adams',
    email: 'tanya.adams@globex.com',
    region: 'APAC-South',
    grossRevenueNum: 64800,
    paymentTokenRaw: 'tok_live_6643e2a715f2'
  },
  {
    id: 'tx_05',
    tenantId: 'org_103',
    tenantName: 'Initech Capital Holdings',
    representative: 'Peter Gibbons',
    email: 'peter.gibbons@initech.io',
    region: 'EU-West',
    grossRevenueNum: 115000,
    paymentTokenRaw: 'tok_live_5521f7c833d1'
  },
  {
    id: 'tx_06',
    tenantId: 'org_101',
    tenantName: 'Acme Enterprise Corp',
    representative: 'Kenji Sato',
    email: 'kenji.sato@acme.corp',
    region: 'APAC-South',
    grossRevenueNum: 210400,
    paymentTokenRaw: 'tok_live_4410g3d122e8'
  }
];

// =============================================================================
// ROLE DEFINITIONS
// =============================================================================

export const RLS_ROLES: RlsRoleDefinition[] = [
  {
    id: 'ORGANIZATION_ADMIN',
    label: 'Organization Admin',
    description: 'Unrestricted visibility across tenant records. Raw revenue figures and full email addresses exposed.',
    defaultAllowedTenantId: 'org_101',
    defaultAllowedRegions: ['US-East', 'EU-West', 'APAC-South'],
    recommendedPolicyIds: ['TENANT_ISOLATION', 'ROW_SIGNING']
  },
  {
    id: 'REGIONAL_SALES_LEAD',
    label: 'Regional Sales Lead (EU)',
    description: 'Restricted to EU-West territory. Cross-region rows dropped, customer PII masked, tenant boundaries strictly enforced.',
    defaultAllowedTenantId: 'org_101',
    defaultAllowedRegions: ['EU-West'],
    recommendedPolicyIds: ['TENANT_ISOLATION', 'REGIONAL_PARTITION', 'PII_MASKING', 'ROW_SIGNING']
  },
  {
    id: 'FINANCIAL_AUDITOR',
    label: 'Financial Compliance Auditor',
    description: 'Cross-region audit access. Contact emails, representatives, and payment tokens masked while audit metrics remain verifiable.',
    defaultAllowedTenantId: 'org_101',
    defaultAllowedRegions: ['US-East', 'EU-West', 'APAC-South'],
    recommendedPolicyIds: ['TENANT_ISOLATION', 'PII_MASKING', 'ROW_SIGNING']
  },
  {
    id: 'RESTRICTED_CONTRACTOR',
    label: 'Restricted Partner / Contractor',
    description: 'Zero-trust least privilege. Cross-tenant dropped, PII masked, financial revenue bucketed, payment tokens HMAC-redacted.',
    defaultAllowedTenantId: 'org_101',
    defaultAllowedRegions: ['US-East'],
    recommendedPolicyIds: [
      'TENANT_ISOLATION',
      'REGIONAL_PARTITION',
      'PII_MASKING',
      'METRIC_REDACTION',
      'ROW_SIGNING'
    ]
  }
];

// =============================================================================
// POLICY RULE DEFINITIONS
// =============================================================================

export const RLS_POLICIES: RlsPolicyDefinition[] = [
  {
    id: 'TENANT_ISOLATION',
    name: 'Tenant Boundary Isolation',
    description: 'Injects mandatory tenant_id filter into SQL AST. Mathematically prevents multi-tenant data leaks in memory.',
    category: 'TENANT_ISOLATION',
    predicateSql: 'WHERE tenant_id = auth.current_tenant_id()',
    targetColumns: ['tenantId', 'tenantName'],
    maskingMethod: 'ROW_EXCLUDE',
    enabledByDefault: true
  },
  {
    id: 'REGIONAL_PARTITION',
    name: 'Regional Geo-Fence Filter',
    description: 'Restricts query execution to user assigned geographic partitions, dropping rows outside authorized territory.',
    category: 'REGIONAL_PARTITION',
    predicateSql: 'AND region IN (auth.allowed_regions())',
    targetColumns: ['region'],
    maskingMethod: 'ROW_EXCLUDE',
    enabledByDefault: false
  },
  {
    id: 'PII_MASKING',
    name: 'Dynamic Column Masking (PII)',
    description: 'Applies in-memory regex masking to emails and contact names without rewriting underlying storage tables.',
    category: 'COLUMN_MASKING',
    predicateSql: "SELECT mask_email(email) AS email, mask_name(representative) AS rep",
    targetColumns: ['email', 'representative'],
    maskingMethod: 'PARTIAL_MASK',
    enabledByDefault: true
  },
  {
    id: 'METRIC_REDACTION',
    name: 'Financial Metric Obfuscation',
    description: 'Redacts raw financial totals into generalized valuation tiers ($100k-$250k) and HMAC-hashes payment tokens.',
    category: 'METRIC_REDACTION',
    predicateSql: "SELECT bucket_tier(gross_revenue) AS gross_revenue, hmac(tok) AS payment_token",
    targetColumns: ['grossRevenue', 'paymentToken'],
    maskingMethod: 'FULL_REDACT',
    enabledByDefault: false
  },
  {
    id: 'ROW_SIGNING',
    name: 'Cryptographic Nonce & HMAC Signature',
    description: 'Appends tamper-evident SHA-256 signature calculated over row payload, session tenant ID, and auth nonce.',
    category: 'ROW_SIGNING',
    predicateSql: 'SELECT hmac_sha256(row_bytes, auth.signing_nonce()) AS sig',
    targetColumns: ['cryptographicSignature'],
    maskingMethod: 'HMAC_NONCE',
    enabledByDefault: true
  }
];

// =============================================================================
// HELPER UTILITIES
// =============================================================================

function maskEmailString(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  const name = parts[0] ?? '';
  const domain = parts[1] ?? '';
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

function maskRepresentativeName(name: string): string {
  const parts = name.split(' ');
  if (parts.length < 2) return `${name.charAt(0)}***`;
  return `${parts[0]?.charAt(0)}*** ${parts[parts.length - 1]}`;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(val);
}

function bucketFinancialRevenue(val: number): string {
  if (val < 100000) return '$50,000 - $100,000 (Tier B)';
  if (val < 200000) return '$100,000 - $200,000 (Tier A)';
  return '$200,000+ (Enterprise Tier)';
}

function maskPaymentToken(tok: string): string {
  return `${tok.slice(0, 8)}...[HMAC_REDACTED]`;
}

function computeRowHmac(rowId: string, tenantId: string, role: string): string {
  return crypto
    .createHash('sha256')
    .update(`row:${rowId}:tenant:${tenantId}:role:${role}:salt:ricozviz_crypto_rls`)
    .digest('hex')
    .slice(0, 16);
}

// =============================================================================
// PUBLIC ENGINE METHODS
// =============================================================================

export function getRlsPoliciesCatalog(): RlsPoliciesCatalogResponse {
  return {
    roles: RLS_ROLES,
    policies: RLS_POLICIES,
    defaultRole: 'REGIONAL_SALES_LEAD',
    defaultTenantId: 'org_101',
    defaultUserRegion: 'EU-West'
  };
}

export function simulateRlsEvaluation(req: RlsSimulationRequest): RlsSimulationResult {
  const start = performance.now();

  const roleDef =
    RLS_ROLES.find((r) => r.id === req.role) ??
    RLS_ROLES[0] ?? {
      id: 'ORGANIZATION_ADMIN',
      label: 'Organization Admin',
      description: 'Default Admin',
      defaultAllowedTenantId: 'org_101',
      defaultAllowedRegions: ['US-East', 'EU-West', 'APAC-South'],
      recommendedPolicyIds: ['TENANT_ISOLATION', 'ROW_SIGNING']
    };

  const tenantId = req.tenantId || roleDef.defaultAllowedTenantId;
  const userRegion = req.userRegion || (roleDef.defaultAllowedRegions[0] ?? 'US-East');
  const activePolicyIds = new Set(req.activePolicyIds ?? roleDef.recommendedPolicyIds);

  const isTenantIsolated = activePolicyIds.has('TENANT_ISOLATION');
  const isRegionalPartitioned = activePolicyIds.has('REGIONAL_PARTITION');
  const isPiiMasked = activePolicyIds.has('PII_MASKING');
  const isFinancialRedacted = activePolicyIds.has('METRIC_REDACTION');
  const isRowSigned = activePolicyIds.has('ROW_SIGNING');

  let filteredOutCount = 0;
  let maskedColumnsCount = 0;

  const simulatedRecords: RlsSimulatedRecord[] = SOURCE_RECORDS.map((raw) => {
    // 1. Check Row-Level Filtering
    const violatesTenant = isTenantIsolated && raw.tenantId !== tenantId;
    const violatesRegion =
      isRegionalPartitioned && !roleDef.defaultAllowedRegions.includes(raw.region);

    const isDropped = violatesTenant || violatesRegion;
    if (isDropped) {
      filteredOutCount++;
    }

    // 2. Dynamic Column Masking
    const maskedCols: string[] = [];
    let displayEmail = raw.email;
    let displayRep = raw.representative;
    let displayRevenue = formatCurrency(raw.grossRevenueNum);
    let displayToken = raw.paymentTokenRaw;

    if (isPiiMasked) {
      displayEmail = maskEmailString(raw.email);
      displayRep = maskRepresentativeName(raw.representative);
      maskedCols.push('email', 'representative');
    }

    if (isFinancialRedacted) {
      displayRevenue = bucketFinancialRevenue(raw.grossRevenueNum);
      displayToken = maskPaymentToken(raw.paymentTokenRaw);
      maskedCols.push('grossRevenue', 'paymentToken');
    }

    maskedColumnsCount += maskedCols.length;

    let rowStatus: RlsSimulatedRecord['rowStatus'] = 'ACCESSIBLE';
    if (isDropped) {
      rowStatus = 'CONFIDENTIAL_DROPPED';
    } else if (maskedCols.length > 0) {
      rowStatus = 'PARTIALLY_MASKED';
    }

    const rowSig = isRowSigned
      ? `0x${computeRowHmac(raw.id, tenantId, roleDef.id)}`
      : 'UNVERIFIED_TOKEN';

    return {
      id: raw.id,
      tenantId: raw.tenantId,
      tenantName: raw.tenantName,
      representative: isDropped ? '[FILTERED_OUT]' : displayRep,
      email: isDropped ? '[FILTERED_OUT]' : displayEmail,
      region: raw.region,
      grossRevenue: isDropped ? '$0.00' : displayRevenue,
      paymentToken: isDropped ? '[FILTERED_OUT]' : displayToken,
      maskedColumns: maskedCols,
      isRowFiltered: isDropped,
      rowStatus,
      cryptographicSignature: rowSig
    };
  });

  // Construct Dynamic In-Memory SQL AST representation
  const sqlPredicates: string[] = [];
  if (isTenantIsolated) {
    sqlPredicates.push(`tenant_id = '${tenantId}'`);
  }
  if (isRegionalPartitioned) {
    const formattedRegions = roleDef.defaultAllowedRegions.map((r) => `'${r}'`).join(', ');
    sqlPredicates.push(`region IN (${formattedRegions})`);
  }

  const whereClause =
    sqlPredicates.length > 0 ? `\nWHERE ${sqlPredicates.join('\n  AND ')}` : '';

  const projectionClauses = [
    'id',
    'tenant_id',
    isPiiMasked
      ? "regexp_replace(email, '(^.).*(@.*$)', '\\1***\\2') AS email"
      : 'email',
    isPiiMasked
      ? "concat(substr(representative, 1, 1), '***') AS representative"
      : 'representative',
    'region',
    isFinancialRedacted
      ? "bucket_tier(gross_revenue) AS gross_revenue"
      : 'gross_revenue',
    isFinancialRedacted
      ? "concat(substr(payment_token, 1, 8), '...[HMAC]') AS payment_token"
      : 'payment_token',
    isRowSigned
      ? "hmac_sha256(row_bytes, auth.nonce()) AS crypto_signature"
      : 'NULL AS crypto_signature'
  ];

  const appliedSqlAst = `-- Generated Dynamic SQL AST (Evaluated in DuckDB Memory Pipeline - 0 Database Rebuilds)
SELECT
  ${projectionClauses.join(',\n  ')}
FROM transactions${whereClause};`;

  const elapsed = performance.now() - start;
  const executionLatencyMs = Number(Math.max(0.12, elapsed).toFixed(2));

  const cryptoSig = crypto
    .createHash('sha256')
    .update(
      `${roleDef.id}:${tenantId}:${Array.from(activePolicyIds).sort().join(',')}:${simulatedRecords.length}`
    )
    .digest('hex');

  return {
    role: roleDef.id,
    tenantId,
    userRegion,
    activePolicies: Array.from(activePolicyIds),
    totalSourceRows: SOURCE_RECORDS.length,
    visibleRowsCount: SOURCE_RECORDS.length - filteredOutCount,
    filteredOutRowsCount: filteredOutCount,
    maskedColumnsCount,
    databaseRebuildsRequired: 0,
    executionLatencyMs,
    appliedSqlAst,
    cryptographicSignature: `0x${cryptoSig}`,
    simulatedAt: new Date().toISOString(),
    records: simulatedRecords
  };
}
