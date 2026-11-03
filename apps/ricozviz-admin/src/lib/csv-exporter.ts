/**
 * Client-side CSV generator and downloader for audit ledger entries.
 */

export interface ExportableAuditEntry {
  sequenceNumber?: number;
  timestamp: string | Date;
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  status?: string;
  details?: any;
}

export function downloadAuditCsv(entries: ExportableAuditEntry[], filenamePrefix = 'ricozviz-audit-ledger'): void {
  if (typeof window === 'undefined') return;

  const headers = [
    'Sequence',
    'Timestamp',
    'Tenant ID',
    'Actor User ID',
    'Action',
    'Resource Type',
    'Resource ID',
    'IP Address',
    'Status',
    'Details'
  ];

  const rows = entries.map((e) => [
    e.sequenceNumber ?? '',
    typeof e.timestamp === 'string' ? e.timestamp : e.timestamp.toISOString(),
    e.tenantId || 'GLOBAL',
    e.actorUserId || 'SYSTEM',
    e.action,
    e.resourceType,
    e.resourceId || '',
    e.ipAddress || '',
    e.status || 'SUCCESS',
    `"${JSON.stringify(e.details || {}).replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `${filenamePrefix}-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
