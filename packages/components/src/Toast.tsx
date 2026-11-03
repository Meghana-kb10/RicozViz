'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ShowToastOptions {
  type?: ToastType;
  message: string;
  title?: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  showToast: (options: ShowToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const showToast = useCallback((options: ShowToastOptions) => {
    const fullMessage = options.title ? `${options.title}: ${options.message}` : options.message;
    addToast(fullMessage, options.type || 'info');
  }, [addToast]);

  const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg: string) => addToast(msg, 'error'), [addToast]);
  const warning = useCallback((msg: string) => addToast(msg, 'warning'), [addToast]);
  const info = useCallback((msg: string) => addToast(msg, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, showToast, success, error, warning, info }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none select-none">
        {toasts.map((t) => {
          let typeStyles = 'bg-[#181818] border-[#333333] text-[#fafafa]';
          let indicator = '●';
          let indicatorColor = 'text-[#898989]';

          if (t.type === 'success') {
            typeStyles = 'bg-[#101b13] border-emerald-800/60 text-emerald-200';
            indicator = '✓';
            indicatorColor = 'text-emerald-400';
          } else if (t.type === 'error') {
            typeStyles = 'bg-[#211012] border-rose-800/60 text-rose-200';
            indicator = '✕';
            indicatorColor = 'text-rose-400';
          } else if (t.type === 'warning') {
            typeStyles = 'bg-[#211a0c] border-amber-800/60 text-amber-200';
            indicator = '⚠';
            indicatorColor = 'text-amber-400';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start gap-2.5 text-xs font-mono-code animate-in slide-in-from-top-2 fade-in duration-200 ${typeStyles}`}
            >
              <span className={`font-bold shrink-0 ${indicatorColor}`}>{indicator}</span>
              <p className="flex-1 leading-snug break-words">{t.message}</p>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="opacity-60 hover:opacity-100 text-xs text-current transition-opacity shrink-0 ml-1"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
