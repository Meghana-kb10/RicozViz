"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`h-9 w-9 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] opacity-60 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={`Current: ${resolvedTheme} mode. Click to toggle.`}
      className={`relative h-9 w-9 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#172B3A] dark:text-[#E5E7EB] hover:bg-[#F4F1EA] dark:hover:bg-[#283548] flex items-center justify-center transition-all duration-150 shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#147D78] dark:focus-visible:ring-[#4F9D8E] ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-[#147D78] transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}
