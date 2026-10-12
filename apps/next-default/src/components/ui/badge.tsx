'use client';

import * as React from 'react';
import { TouchRipple } from './ripple';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  styleVariant?: 'filled' | 'outlined';
  icon?: React.ReactNode;
  onClick?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  styleVariant = 'filled',
  icon,
  onClick,
  onDelete,
  className = ''
}: BadgeProps) {
  const isFilled = styleVariant === 'filled';

  const filledStyles = {
    default: 'bg-slate-800 text-slate-300 border-slate-700/60',
    primary: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    error: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
  };

  const outlinedStyles = {
    default: 'bg-transparent text-slate-300 border-slate-700',
    primary: 'bg-transparent text-indigo-400 border-indigo-500/60',
    success: 'bg-transparent text-emerald-400 border-emerald-500/60',
    warning: 'bg-transparent text-amber-400 border-amber-500/60',
    error: 'bg-transparent text-rose-400 border-rose-500/60',
    info: 'bg-transparent text-sky-400 border-sky-500/60',
    purple: 'bg-transparent text-purple-400 border-purple-500/60'
  };

  const styles = isFilled ? filledStyles[variant] : outlinedStyles[variant];

  return (
    <span
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border tracking-wide transition-all ${
        onClick ? 'cursor-pointer hover:opacity-80 overflow-hidden' : ''
      } ${styles} ${className}`}
    >
      {onClick && <TouchRipple color="rgba(255,255,255,0.2)" />}
      {icon && <span className="shrink-0 -ml-0.5">{icon}</span>}
      <span>{children}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-slate-700/60 text-current transition-colors"
          aria-label="Remove"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </span>
  );
}

export const Chip = Badge;
