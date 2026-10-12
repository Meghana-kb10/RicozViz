import * as React from 'react';
import { cn } from '@repo/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export const Card = ({
  title,
  subtitle,
  children,
  footer,
  className,
  ...props
}: CardProps) => {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-xl shadow-sm p-6 transition-all duration-200 hover:shadow-md',
        className
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {footer}
        </div>
      )}
    </div>
  );
};
