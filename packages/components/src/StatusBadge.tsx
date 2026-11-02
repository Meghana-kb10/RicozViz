import React from 'react';

export type StatusType =
  | 'ok'
  | 'success'
  | 'triggered'
  | 'error'
  | 'failed'
  | 'warning'
  | 'running'
  | 'skipped'
  | 'pending'
  | 'neutral';

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({
  status,
  label,
  className = '',
  size = 'sm',
}: StatusBadgeProps) {
  const normalized = status.toLowerCase() as StatusType;

  let colorClasses = 'bg-[#1e1e1e] text-[#898989] border-[#2e2e2e]';
  let dotColor = 'bg-[#898989]';

  switch (normalized) {
    case 'ok':
    case 'success':
      colorClasses = 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50';
      dotColor = 'bg-emerald-400';
      break;
    case 'triggered':
    case 'warning':
      colorClasses = 'bg-amber-950/50 text-amber-400 border-amber-800/50';
      dotColor = 'bg-amber-400';
      break;
    case 'error':
    case 'failed':
      colorClasses = 'bg-rose-950/50 text-rose-400 border-rose-800/50';
      dotColor = 'bg-rose-400';
      break;
    case 'running':
      colorClasses = 'bg-blue-950/50 text-blue-400 border-blue-800/50';
      dotColor = 'bg-blue-400 animate-pulse';
      break;
    case 'skipped':
    case 'pending':
      colorClasses = 'bg-[#181818] text-[#999999] border-[#303030]';
      dotColor = 'bg-[#666666]';
      break;
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono-code font-medium border ${colorClasses} ${paddingClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label || status.toUpperCase()}</span>
    </span>
  );
}
