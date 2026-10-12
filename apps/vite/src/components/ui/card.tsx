import * as React from 'react';
import { TouchRipple } from './ripple';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined';
  className?: string;
}

export function Card({ children, variant = 'elevated', className = '' }: CardProps) {
  const variantStyles =
    variant === 'elevated'
      ? 'mui-elevation-1 hover:mui-elevation-3 transition-shadow duration-300 bg-slate-900/90 border border-slate-800/80'
      : 'bg-slate-900/70 border border-slate-800';

  return (
    <div className={`rounded-2xl overflow-hidden backdrop-blur-sm ${variantStyles} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  avatar,
  title,
  subheader,
  action,
  children,
  className = ''
}: {
  avatar?: React.ReactNode;
  title?: React.ReactNode;
  subheader?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  if (children) {
    return <div className={`p-5 sm:p-6 pb-2 ${className}`}>{children}</div>;
  }

  return (
    <div className={`p-5 sm:p-6 pb-3 flex items-start justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {avatar && <div className="shrink-0">{avatar}</div>}
        <div className="min-w-0 flex flex-col">
          {title && typeof title === 'string' ? <CardTitle>{title}</CardTitle> : title}
          {subheader && typeof subheader === 'string' ? (
            <CardDescription>{subheader}</CardDescription>
          ) : (
            subheader
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-medium tracking-tight text-slate-100 ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-slate-400 mt-0.5 tracking-normal ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-5 sm:p-6 pt-2 flex flex-col gap-4 ${className}`}>{children}</div>;
}

export function CardActions({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-5 sm:px-6 py-3 border-t border-slate-800/60 flex items-center justify-end gap-2.5 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <CardActions className={className}>{children}</CardActions>;
}

export function CardActionArea({
  children,
  onClick,
  className = ''
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden cursor-pointer hover:bg-slate-800/30 transition-colors ${className}`}
    >
      <TouchRipple color="rgba(99, 102, 241, 0.2)" />
      {children}
    </div>
  );
}
