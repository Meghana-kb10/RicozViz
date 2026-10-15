import * as React from 'react';
import { cn } from '@repo/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  primary: 'bg-[#147D78] hover:bg-[#106963] text-white shadow-xs focus-visible:ring-[#147D78]',
  secondary: 'bg-slate-900 hover:bg-slate-800 text-slate-50 shadow-xs focus-visible:ring-slate-500',
  outline: 'border border-[#DADFD9] bg-transparent hover:bg-[#F4F1EA] text-[#172B3A] focus-visible:ring-[#147D78]',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-xs focus-visible:ring-red-500',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-700'
};

const sizeStyles: Record<string, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
