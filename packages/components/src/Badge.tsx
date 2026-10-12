import * as React from 'react';
import { cn } from '@repo/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
}

const variantStyles: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  danger: 'bg-red-50 text-red-700 border-red-200'
};

export const Badge = ({
  children,
  variant = 'neutral',
  className,
  ...props
}: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
