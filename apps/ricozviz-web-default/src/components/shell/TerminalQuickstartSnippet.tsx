"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check, Sparkles, Database, Code2 } from "lucide-react";

export type SnippetPreset = "NPX" | "PNPM" | "SQL" | "PYTHON";

interface QuickstartCommand {
  id: SnippetPreset;
  label: string;
  command: string;
  prefix: string;
  hint: string;
}

const SNIPPET_PRESETS: QuickstartCommand[] = [
  {
    id: "NPX",
    label: "npx",
    command: "npx @ricoz/viz init",
    prefix: "$",
    hint: "Zero-config in-memory CLI workspace",
  },
  {
    id: "SQL",
    label: "Direct SQL",
    command: "duckdb -c \"INSTALL ricoz; LOAD ricoz; ATTACH 'ricoz://demo.viz' AS analytics;\"",
    prefix: "sql>",
    hint: "Direct DuckDB WASM connection string",
  },
  {
    id: "PNPM",
    label: "pnpm",
    command: "pnpm dlx @ricoz/viz init",
    prefix: "$",
    hint: "Fastest pnpm runner execution",
  },
  {
    id: "PYTHON",
    label: "Python SDK",
    command: "pip install ricoz-viz && python -c \"import ricoz; ricoz.init()\"",
    prefix: "$",
    hint: "Pandas & Polars native connection",
  },
];

interface TerminalQuickstartSnippetProps {
  className?: string;
  defaultPreset?: SnippetPreset;
}

export function TerminalQuickstartSnippet({
  className = "",
  defaultPreset = "NPX",
}: TerminalQuickstartSnippetProps) {
  const [activePreset, setActivePreset] = useState<SnippetPreset>(defaultPreset);
  const [copied, setCopied] = useState(false);

  const current =
    SNIPPET_PRESETS.find((p) => p.id === activePreset) || SNIPPET_PRESETS[0];

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(current.command);
      } else {
        // Fallback for older browsers / testing environments
        const textArea = document.createElement("textarea");
        textArea.value = current.command;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Soft fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className={`group relative mx-auto w-full rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-[#11161F] shadow-sm hover:border-[#147D78]/50 dark:hover:border-[#4F9D8E]/50 transition-all duration-200 overflow-hidden ${className}`}
    >
      {/* Specular Hairline Top Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />

      {/* Preset Switcher Tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#222B38] bg-[#0E131A] text-[11px] font-mono">
        {/* Left: Terminal Icon + Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 text-[#4F9D8E] font-semibold pr-1.5 border-r border-[#222B38] shrink-0">
            <Terminal className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">
              Quickstart
            </span>
          </div>

          <div className="flex items-center gap-1">
            {SNIPPET_PRESETS.map((preset) => {
              const isActive = preset.id === activePreset;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setActivePreset(preset.id);
                    setCopied(false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[#1C2634] text-[#E5E7EB] font-semibold border border-[#374151]"
                      : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#151C26]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Hint Badge */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#4F9D8E]">
          <Sparkles className="h-3 w-3" />
          <span className="truncate max-w-[170px]">{current.hint}</span>
        </div>
      </div>

      {/* Command Display Row */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        {/* Command Body with Prefix */}
        <div className="flex items-center gap-2 min-w-0 font-mono text-xs overflow-x-auto no-scrollbar">
          <span className="text-[#4F9D8E] font-bold select-none shrink-0">
            {current.prefix}
          </span>
          <code className="text-[#E5E7EB] whitespace-nowrap font-medium select-all selection:bg-[#147D78] selection:text-white">
            {current.command}
          </code>
        </div>

        {/* Quick Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied command to clipboard" : "Copy command to clipboard"}
          title={copied ? "Copied!" : "Copy to clipboard"}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all duration-150 cursor-pointer border ${
            copied
              ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-2xs"
              : "bg-[#18212C] border-[#2E3B4C] hover:bg-[#202C3A] hover:border-[#4F9D8E]/50 text-[#E5E7EB]"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-[10.5px] font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-[#9CA3AF] group-hover:text-[#E5E7EB] transition-colors" />
              <span className="text-[10.5px] text-[#9CA3AF] group-hover:text-[#E5E7EB] transition-colors">
                Copy
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
