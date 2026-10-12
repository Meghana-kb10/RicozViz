import * as React from 'react';
import { TouchRipple } from './ripple';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'contained' | 'outlined' | 'text' | 'tonal' | 'danger' | 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  disableRipple?: boolean;
}

export function Button({
  children,
  variant = 'contained',
  size = 'medium',
  isLoading = false,
  startIcon,
  endIcon,
  disableRipple = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Normalize size names
  const normalizedSize = size === 'sm' || size === 'small' ? 'small' : size === 'lg' || size === 'large' ? 'large' : 'medium';

  // Normalize variant names
  const normalizedVariant =
    variant === 'primary' || variant === 'contained'
      ? 'contained'
      : variant === 'secondary'
        ? 'tonal'
        : variant;

  const baseStyles =
    'relative inline-flex items-center justify-center font-medium tracking-[0.025em] rounded-lg transition-all duration-200 select-none overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

  const variants = {
    contained:
      'bg-indigo-600 hover:bg-indigo-500 text-white mui-elevation-1 hover:mui-elevation-3 active:mui-elevation-1 border border-indigo-500/20',
    outlined:
      'bg-transparent hover:bg-indigo-500/10 text-indigo-300 border border-indigo-500/50 hover:border-indigo-400',
    text:
      'bg-transparent hover:bg-slate-800/80 text-slate-300 hover:text-white',
    tonal:
      'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/60 mui-elevation-1',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white mui-elevation-1 hover:mui-elevation-3 border border-rose-500/20'
  };

  const sizes = {
    small: 'text-xs px-3 py-1.5 min-h-[32px] gap-1.5 uppercase font-semibold tracking-wider',
    medium: 'text-sm px-4 py-2 min-h-[40px] gap-2',
    large: 'text-base px-6 py-2.5 min-h-[48px] gap-2.5'
  };

  const rippleColor =
    normalizedVariant === 'outlined' || normalizedVariant === 'text'
      ? 'rgba(99, 102, 241, 0.25)'
      : 'rgba(255, 255, 255, 0.3)';

  return (
    <button
      className={`${baseStyles} ${variants[normalizedVariant]} ${sizes[normalizedSize]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {!disableRipple && !disabled && !isLoading && <TouchRipple color={rippleColor} />}
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        startIcon && <span className="inline-flex shrink-0">{startIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && endIcon && <span className="inline-flex shrink-0">{endIcon}</span>}
    </button>
  );
}
