import * as React from 'react';
import { APP_CONFIG } from '@/config/app.config';

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.</p>
        <div className="flex items-center gap-4 text-slate-400">
          <span>v{APP_CONFIG.version}</span>
          <span>•</span>
          <span className="text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            API Connected
          </span>
        </div>
      </div>
    </footer>
  );
}
