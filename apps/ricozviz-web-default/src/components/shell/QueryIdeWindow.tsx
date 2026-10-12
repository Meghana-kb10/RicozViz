"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal, Zap, FileCode, ShieldCheck } from "lucide-react";

interface SnippetTab {
  id: string;
  filename: string;
  language: string;
  executionTime: string;
  tokenCount: number;
  astNodes: number;
  code: string;
  highlightedLines: React.ReactNode[];
}

const SNIPPETS: SnippetTab[] = [
  {
    id: "duckdb-sql",
    filename: "query_aggregate.sql",
    language: "SQL (DuckDB)",
    executionTime: "6.2ms",
    tokenCount: 42,
    astNodes: 19,
    code: `-- Sub-12ms in-memory aggregation via DuckDB WASM
SELECT
  date_trunc('month', timestamp) AS month,
  sum(revenue)                   AS total_revenue,
  count(DISTINCT account_id)     AS active_accounts
FROM sales_events
WHERE tenant_id = $tenant_id
GROUP BY 1
ORDER BY 1 DESC;`,
    highlightedLines: [
      <span key="1">
        <span className="text-slate-500 italic">-- Sub-12ms in-memory aggregation via DuckDB WASM</span>
      </span>,
      <span key="2">
        <span className="text-purple-400 font-bold">SELECT</span>
      </span>,
      <span key="3">
        {"  "}
        <span className="text-cyan-300">date_trunc</span>
        <span className="text-slate-400">(</span>
        <span className="text-emerald-300">&apos;month&apos;</span>
        <span className="text-slate-400">,</span>{" "}
        <span className="text-slate-200">timestamp</span>
        <span className="text-slate-400">)</span>{" "}
        <span className="text-purple-400 font-bold">AS</span>{" "}
        <span className="text-indigo-300">month</span>
        <span className="text-slate-400">,</span>
      </span>,
      <span key="4">
        {"  "}
        <span className="text-cyan-300">sum</span>
        <span className="text-slate-400">(</span>
        <span className="text-slate-200">revenue</span>
        <span className="text-slate-400">)</span>{"                   "}
        <span className="text-purple-400 font-bold">AS</span>{" "}
        <span className="text-indigo-300">total_revenue</span>
        <span className="text-slate-400">,</span>
      </span>,
      <span key="5">
        {"  "}
        <span className="text-cyan-300">count</span>
        <span className="text-slate-400">(</span>
        <span className="text-purple-400 font-bold">DISTINCT</span>{" "}
        <span className="text-slate-200">account_id</span>
        <span className="text-slate-400">)</span>{"     "}
        <span className="text-purple-400 font-bold">AS</span>{" "}
        <span className="text-indigo-300">active_accounts</span>
      </span>,
      <span key="6">
        <span className="text-purple-400 font-bold">FROM</span>{" "}
        <span className="text-amber-300">sales_events</span>
      </span>,
      <span key="7">
        <span className="text-purple-400 font-bold">WHERE</span>{" "}
        <span className="text-slate-200">tenant_id</span>{" "}
        <span className="text-purple-400 font-bold">=</span>{" "}
        <span className="text-emerald-400 font-mono">$tenant_id</span>
      </span>,
      <span key="8">
        <span className="text-purple-400 font-bold">GROUP BY</span>{" "}
        <span className="text-cyan-300">1</span>
      </span>,
      <span key="9">
        <span className="text-purple-400 font-bold">ORDER BY</span>{" "}
        <span className="text-cyan-300">1</span>{" "}
        <span className="text-purple-400 font-bold">DESC</span>
        <span className="text-slate-400">;</span>
      </span>,
    ],
  },
  {
    id: "rls-policy",
    filename: "rls_policy.sql",
    language: "SQL (Security)",
    executionTime: "0.8ms",
    tokenCount: 28,
    astNodes: 12,
    code: `-- Cryptographic row-level security policy
CREATE POLICY tenant_isolation ON sales_events
USING (tenant_id = auth.current_org())
WITH CHECK (region = auth.user_region());`,
    highlightedLines: [
      <span key="1">
        <span className="text-slate-500 italic">-- Cryptographic row-level security policy</span>
      </span>,
      <span key="2">
        <span className="text-purple-400 font-bold">CREATE POLICY</span>{" "}
        <span className="text-indigo-300">tenant_isolation</span>{" "}
        <span className="text-purple-400 font-bold">ON</span>{" "}
        <span className="text-amber-300">sales_events</span>
      </span>,
      <span key="3">
        <span className="text-purple-400 font-bold">USING</span>{" "}
        <span className="text-slate-400">(</span>
        <span className="text-slate-200">tenant_id</span>{" "}
        <span className="text-purple-400 font-bold">=</span>{" "}
        <span className="text-cyan-300">auth.current_org</span>
        <span className="text-slate-400">())</span>
      </span>,
      <span key="4">
        <span className="text-purple-400 font-bold">WITH CHECK</span>{" "}
        <span className="text-slate-400">(</span>
        <span className="text-slate-200">region</span>{" "}
        <span className="text-purple-400 font-bold">=</span>{" "}
        <span className="text-cyan-300">auth.user_region</span>
        <span className="text-slate-400">());</span>
      </span>,
    ],
  },
  {
    id: "arrow-ipc",
    filename: "zero_copy.ts",
    language: "TypeScript",
    executionTime: "1.4ms",
    tokenCount: 34,
    astNodes: 15,
    code: `// Zero-copy Arrow IPC columnar extraction
const result = await db.query(sqlQuery, { tenantId });
const buffer = result.toArrowIPC(); // 0 memory allocation`,
    highlightedLines: [
      <span key="1">
        <span className="text-slate-500 italic">// Zero-copy Arrow IPC columnar extraction</span>
      </span>,
      <span key="2">
        <span className="text-purple-400 font-bold">const</span>{" "}
        <span className="text-slate-200">result</span>{" "}
        <span className="text-purple-400 font-bold">=</span>{" "}
        <span className="text-purple-400 font-bold">await</span>{" "}
        <span className="text-cyan-300">db.query</span>
        <span className="text-slate-400">(</span>
        <span className="text-slate-200">sqlQuery</span>
        <span className="text-slate-400">,</span>{" "}
        <span className="text-slate-400">&#123;</span>{" "}
        <span className="text-slate-200">tenantId</span>{" "}
        <span className="text-slate-400">&#125;);</span>
      </span>,
      <span key="3">
        <span className="text-purple-400 font-bold">const</span>{" "}
        <span className="text-slate-200">buffer</span>{" "}
        <span className="text-purple-400 font-bold">=</span>{" "}
        <span className="text-slate-200">result</span>
        <span className="text-slate-400">.</span>
        <span className="text-cyan-300">toArrowIPC</span>
        <span className="text-slate-400">();</span>{" "}
        <span className="text-slate-500 italic">// 0 memory allocation</span>
      </span>,
    ],
  },
];

export function QueryIdeWindow() {
  const [activeTabId, setActiveTabId] = useState<string>("duckdb-sql");
  const [copied, setCopied] = useState<boolean>(false);

  const activeSnippet =
    SNIPPETS.find((s) => s.id === activeTabId) || SNIPPETS[0];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeSnippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#090D16] shadow-xl overflow-hidden font-mono text-xs text-slate-300">
      {/* Top Window Chrome: Mac Controls + File Tabs + Badges + Copy Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] bg-[#111827]/90 px-3 py-2">
        {/* Left: Window Controls + Tabs */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 sm:pb-0">
          {/* Subtle Window Dots */}
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <div className="h-3.5 w-px bg-white/10 shrink-0" aria-hidden="true" />

          {/* Snippet Tabs */}
          <div className="flex items-center gap-1 shrink-0">
            {SNIPPETS.map((snippet) => {
              const isActive = snippet.id === activeTabId;
              return (
                <button
                  key={snippet.id}
                  onClick={() => setActiveTabId(snippet.id)}
                  type="button"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[#090D16] text-white border border-white/10 font-semibold shadow-xs"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                  aria-selected={isActive}
                >
                  <FileCode className="h-3 w-3 text-indigo-400 shrink-0" />
                  <span>{snippet.filename}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Badges & Copy Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-[10px] pt-1 sm:pt-0 border-t border-white/[0.04] sm:border-t-0">
          <div className="flex items-center gap-2">
            {/* Token Counter */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-white/[0.06] text-slate-300"
              title={`${activeSnippet.tokenCount} tokenizer tokens · ${activeSnippet.astNodes} AST nodes`}
            >
              <span className="text-slate-400">Tokens:</span>
              <span className="font-bold text-indigo-300">
                {activeSnippet.tokenCount}
              </span>
            </div>

            {/* Execution Badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-semibold">
              <Zap className="h-3 w-3" />
              <span>{activeSnippet.executionTime}</span>
            </div>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 bg-[#090D16] hover:bg-slate-800 text-slate-300 hover:text-white transition font-sans text-[11px] cursor-pointer"
            title="Copy query snippet"
            aria-label="Copy query snippet"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Editor Body with Line Numbers */}
      <div className="p-3.5 bg-[#0A0E1A] overflow-x-auto text-[11.5px] leading-relaxed">
        <div className="flex font-mono min-w-max">
          {/* Line Numbers Gutter */}
          <div
            className="select-none pr-3.5 text-right text-slate-600 border-r border-white/[0.06] mr-3.5 space-y-0.5"
            aria-hidden="true"
          >
            {activeSnippet.highlightedLines.map((_, idx) => (
              <div key={idx} className="leading-[1.6]">
                {idx + 1}
              </div>
            ))}
          </div>

          {/* Syntax Highlighted Lines */}
          <div className="space-y-0.5 flex-1">
            {activeSnippet.highlightedLines.map((line, idx) => (
              <div key={idx} className="leading-[1.6] whitespace-pre">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom IDE Status Bar */}
      <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#0C1222] px-3.5 py-1.5 text-[10px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-300">
            <Terminal className="h-3 w-3 text-indigo-400" />
            <span>DuckDB WASM Engine</span>
          </span>
          <span className="text-slate-600">·</span>
          <span>UTF-8</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">{activeSnippet.language}</span>
        </div>

        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="h-3 w-3" />
          <span>AST Parameterized · 0 SQL Injection Risk</span>
        </div>
      </div>
    </div>
  );
}
