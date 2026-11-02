import React, { type ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  trend,
  className = '',
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border border-[#242424] bg-[#141414] hover:border-[#333333] transition-all duration-200 space-y-1 ${
        onClick ? 'cursor-pointer hover:bg-[#181818]' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#898989] font-mono-code tracking-wider uppercase">{label}</span>
        {icon && <div className="text-[#898989]">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2 pt-1">
        <div className="text-2xl font-bold font-mono-code text-[#fafafa] tracking-tight">{value}</div>
        {trend && (
          <span
            className={`text-[11px] font-mono-code font-semibold px-1.5 py-0.5 rounded ${
              trend.isPositive
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtext && <div className="text-[11px] text-[#666666] font-mono-code">{subtext}</div>}
    </div>
  );
}
