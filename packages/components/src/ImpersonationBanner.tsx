'use client';

import React from 'react';

export interface ImpersonationBannerProps {
  targetEmail: string;
  targetName?: string;
  targetTenantName?: string;
  expiresInMinutes?: number;
  onExit: () => void;
  className?: string;
}

export function ImpersonationBanner({
  targetEmail,
  targetName,
  targetTenantName,
  expiresInMinutes = 15,
  onExit,
  className = ''
}: ImpersonationBannerProps) {
  const displayTarget = targetTenantName
    ? `${targetName ? `${targetName} (${targetEmail})` : targetEmail} (Tenant: ${targetTenantName})`
    : targetName
    ? `${targetName} (${targetEmail})`
    : targetEmail;

  return (
    <div
      role="alert"
      className={`w-full bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border-b border-rose-700/60 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-code shadow-lg ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-2 w-2 rounded-full bg-rose-400 animate-ping" />
        <span className="font-bold tracking-wider uppercase text-rose-300">
          READ-ONLY IMPERSONATION ACTIVE
        </span>
        <span className="text-rose-200/80">|</span>
        <span className="text-rose-100">
          Viewing workspace as <strong className="text-white underline decoration-rose-400">{displayTarget}</strong>
        </span>
        <span className="text-rose-300/70 text-[11px]">
          ({expiresInMinutes}m session • All mutations blocked)
        </span>
      </div>

      <button
        type="button"
        onClick={onExit}
        className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-950 font-bold rounded-md shadow-xs transition-colors shrink-0 text-xs"
      >
        Exit Impersonation
      </button>
    </div>
  );
}
