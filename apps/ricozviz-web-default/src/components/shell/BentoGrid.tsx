"use client";

import { type ReactNode } from "react";

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  span?: "1x1" | "2x1" | "1x2" | "2x2" | "3x1" | "full";
  badge?: string;
  title?: string;
  subtitle?: string;
  glow?: boolean;
  glowColor?: "indigo" | "emerald" | "cyan";
  variant?: "default" | "technical";
}

export function BentoGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 sm:gap-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function BentoCard({
  children,
  className = "",
  span = "1x1",
  badge,
  title,
  subtitle,
  glow = false,
  glowColor = "indigo",
  variant = "default",
}: BentoCardProps) {
  const spanClasses = {
    "1x1": "col-span-1 row-span-1",
    "2x1": "col-span-1 md:col-span-2 row-span-1",
    "1x2": "col-span-1 row-span-1 md:row-span-2",
    "2x2": "col-span-1 md:col-span-2 row-span-1 md:row-span-2",
    "3x1": "col-span-1 md:col-span-2 lg:col-span-3 row-span-1",
    full: "col-span-full",
  }[span];

  const cardBaseClass =
    variant === "technical"
      ? "bento-card-technical rounded-2xl group flex flex-col justify-between p-6 sm:p-7 relative overflow-hidden transition-all duration-300"
      : "bento-card group flex flex-col justify-between p-6 sm:p-7 relative";

  const glowBgClass = {
    indigo: "bg-indigo-500/15",
    emerald: "bg-emerald-500/15",
    cyan: "bg-cyan-500/15",
  }[glowColor];

  return (
    <div
      className={`${cardBaseClass} ${spanClasses} ${
        glow ? "ring-1 ring-indigo-500/30" : ""
      } ${className}`}
    >
      {/* Optional ambient corner glow */}
      {glow && (
        <div
          className={`absolute -top-12 -right-12 h-40 w-40 rounded-full ${glowBgClass} blur-2xl pointer-events-none`}
          aria-hidden="true"
        />
      )}

      {/* Header if title or badge provided */}
      {(title || badge || subtitle) && (
        <div className="mb-4 flex items-start justify-between gap-3 relative z-10">
          <div>
            {badge && (
              <span className={`inline-block text-[10px] font-mono font-bold uppercase tracking-widest mb-1 ${
                variant === "technical"
                  ? glowColor === "emerald"
                    ? "text-emerald-400"
                    : "text-indigo-400"
                  : "text-indigo-600 dark:text-indigo-400"
              }`}>
                {badge}
              </span>
            )}
            {title && (
              <h3 className={`text-base font-bold tracking-tight ${
                variant === "technical"
                  ? "text-white"
                  : "text-[hsl(var(--foreground))]"
              }`}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={`mt-1 text-xs leading-relaxed ${
                variant === "technical"
                  ? "text-slate-400"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}
