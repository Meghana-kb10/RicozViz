import * as React from 'react';
import { cn } from '@repo/utils';

export interface HeaderProps {
  appName: string;
  tagline?: string;
  className?: string;
  actions?: React.ReactNode;
}

export const Header = ({ appName, tagline, className, actions }: HeaderProps) => {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-xl mb-6 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
          ⚡
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
            {appName}
          </h1>
          {tagline && (
            <p className="text-xs text-slate-500 leading-tight mt-0.5">{tagline}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
};
