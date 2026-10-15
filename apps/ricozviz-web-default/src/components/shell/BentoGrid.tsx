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
    "bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] hover:border-[#147D78]/50 dark:hover:border-[#4F9D8E]/50 rounded-xl group flex flex-col justify-between p-6 sm:p-7 relative overflow-hidden transition-all duration-200 shadow-xs dark:shadow-md";

  return (
    <div
      className={`${cardBaseClass} ${spanClasses} ${className}`}
    >
      {/* Header if title or badge provided */}
      {(title || badge || subtitle) && (
        <div className="mb-4 flex items-start justify-between gap-3 relative z-10">
          <div>
            {badge && (
              <span className="inline-block text-[10px] font-mono font-semibold uppercase tracking-wider mb-1 px-2 py-0.5 rounded text-[#147D78] bg-[#147D78]/10 border border-[#147D78]/20 dark:text-[#4F9D8E] dark:bg-[#4F9D8E]/10 dark:border-[#4F9D8E]/20">
                {badge}
              </span>
            )}
            {title && (
              <h3 className="text-base font-semibold tracking-tight font-heading text-[#172B3A] dark:text-[#E5E7EB]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-xs leading-relaxed text-[#596775] dark:text-[#9CA3AF]">
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
