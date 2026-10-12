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
        <span className="text-[#9CA3AF] italic">-- Sub-12ms in-memory aggregation via DuckDB WASM</span>
      </span>,
      <span key="2">
        <span className="text-[#4F9D8E] font-semibold">SELECT</span>
      </span>,
      <span key="3">
        {"  "}
        <span className="text-[#E5E7EB]">date_trunc</span>
        <span className="text-[#9CA3AF]">(</span>
        <span className="text-[#D9A441]">&apos;month&apos;</span>
        <span className="text-[#9CA3AF]">,</span>{" "}
        <span className="text-[#E5E7EB]">timestamp</span>
        <span className="text-[#9CA3AF]">)</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">AS</span>{" "}
        <span className="text-[#E5E7EB]">month</span>
        <span className="text-[#9CA3AF]">,</span>
      </span>,
      <span key="4">
        {"  "}
        <span className="text-[#E5E7EB]">sum</span>
        <span className="text-[#9CA3AF]">(</span>
        <span className="text-[#E5E7EB]">revenue</span>
        <span className="text-[#9CA3AF]">)</span>{"                   "}
        <span className="text-[#4F9D8E] font-semibold">AS</span>{" "}
        <span className="text-[#E5E7EB]">total_revenue</span>
        <span className="text-[#9CA3AF]">,</span>
      </span>,
      <span key="5">
        {"  "}
        <span className="text-[#E5E7EB]">count</span>
        <span className="text-[#9CA3AF]">(</span>
        <span className="text-[#4F9D8E] font-semibold">DISTINCT</span>{" "}
        <span className="text-[#E5E7EB]">account_id</span>
        <span className="text-[#9CA3AF]">)</span>{"     "}
        <span className="text-[#4F9D8E] font-semibold">AS</span>{" "}
        <span className="text-[#E5E7EB]">active_accounts</span>
      </span>,
      <span key="6">
        <span className="text-[#4F9D8E] font-semibold">FROM</span>{" "}
        <span className="text-[#D9A441]">sales_events</span>
      </span>,
      <span key="7">
        <span className="text-[#4F9D8E] font-semibold">WHERE</span>{" "}
        <span className="text-[#E5E7EB]">tenant_id</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">=</span>{" "}
        <span className="text-[#D9A441] font-mono">$tenant_id</span>
      </span>,
      <span key="8">
        <span className="text-[#4F9D8E] font-semibold">GROUP BY</span>{" "}
        <span className="text-[#4F9D8E]">1</span>
      </span>,
      <span key="9">
        <span className="text-[#4F9D8E] font-semibold">ORDER BY</span>{" "}
        <span className="text-[#4F9D8E]">1</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">DESC</span>
        <span className="text-[#9CA3AF]">;</span>
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
        <span className="text-[#9CA3AF] italic">-- Cryptographic row-level security policy</span>
      </span>,
      <span key="2">
        <span className="text-[#4F9D8E] font-semibold">CREATE POLICY</span>{" "}
        <span className="text-[#E5E7EB]">tenant_isolation</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">ON</span>{" "}
        <span className="text-[#D9A441]">sales_events</span>
      </span>,
      <span key="3">
        <span className="text-[#4F9D8E] font-semibold">USING</span>{" "}
        <span className="text-[#9CA3AF]">(</span>
        <span className="text-[#E5E7EB]">tenant_id</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">=</span>{" "}
        <span className="text-[#E5E7EB]">auth.current_org</span>
        <span className="text-[#9CA3AF]">())</span>
      </span>,
      <span key="4">
        <span className="text-[#4F9D8E] font-semibold">WITH CHECK</span>{" "}
        <span className="text-[#9CA3AF]">(</span>
        <span className="text-[#E5E7EB]">region</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">=</span>{" "}
        <span className="text-[#E5E7EB]">auth.user_region</span>
        <span className="text-[#9CA3AF]">());</span>
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
        <span className="text-[#9CA3AF] italic">// Zero-copy Arrow IPC columnar extraction</span>
      </span>,
      <span key="2">
        <span className="text-[#4F9D8E] font-semibold">const</span>{" "}
        <span className="text-[#E5E7EB]">result</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">=</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">await</span>{" "}
        <span className="text-[#E5E7EB]">db.query</span>
        <span className="text-[#9CA3AF]">(</span>
        <span className="text-[#E5E7EB]">sqlQuery</span>
        <span className="text-[#9CA3AF]">,</span>{" "}
        <span className="text-[#9CA3AF]">&#123;</span>{" "}
        <span className="text-[#E5E7EB]">tenantId</span>{" "}
        <span className="text-[#9CA3AF]">&#125;);</span>
      </span>,
      <span key="3">
        <span className="text-[#4F9D8E] font-semibold">const</span>{" "}
        <span className="text-[#E5E7EB]">buffer</span>{" "}
        <span className="text-[#4F9D8E] font-semibold">=</span>{" "}
        <span className="text-[#E5E7EB]">result</span>
        <span className="text-[#9CA3AF]">.</span>
        <span className="text-[#E5E7EB]">toArrowIPC</span>
        <span className="text-[#9CA3AF]">();</span>{" "}
        <span className="text-[#9CA3AF] italic">// 0 memory allocation</span>
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
    <div className="rounded-xl border border-[#374151] bg-[#111827] shadow-lg overflow-hidden font-mono text-xs text-[#E5E7EB]">
      {/* Top Window Chrome: Mac Controls + File Tabs + Badges + Copy Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#374151] bg-[#1F2937] px-3 py-2">
        {/* Left: Window Controls + Tabs */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 sm:pb-0">
          {/* Subtle Window Dots */}
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <div className="h-3.5 w-px bg-[#374151] shrink-0" aria-hidden="true" />

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
                      ? "bg-[#111827] text-[#E5E7EB] border border-[#374151] font-semibold shadow-xs"
                      : "text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#111827]/50"
                  }`}
                  aria-selected={isActive}
                >
                  <FileCode className="h-3 w-3 text-[#4F9D8E] shrink-0" />
                  <span>{snippet.filename}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Badges & Copy Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-[10px] pt-1 sm:pt-0 border-t border-[#374151] sm:border-t-0">
          <div className="flex items-center gap-2">
            {/* Token Counter */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#111827] border border-[#374151] text-[#9CA3AF]"
              title={`${activeSnippet.tokenCount} tokenizer tokens · ${activeSnippet.astNodes} AST nodes`}
            >
              <span className="text-[#9CA3AF]">Tokens:</span>
              <span className="font-bold text-[#4F9D8E]">
                {activeSnippet.tokenCount}
              </span>
            </div>

            {/* Execution Badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#4F9D8E]/10 border border-[#4F9D8E]/30 text-[#4F9D8E] font-semibold">
              <Zap className="h-3 w-3" />
              <span>{activeSnippet.executionTime}</span>
            </div>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#374151] bg-[#111827] hover:bg-[#1F2937] text-[#9CA3AF] hover:text-[#E5E7EB] transition font-sans text-[11px] cursor-pointer"
            title="Copy query snippet"
            aria-label="Copy query snippet"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[#4F9D8E]" />
                <span className="text-[#4F9D8E] font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-[#9CA3AF]" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Editor Body with Line Numbers */}
      <div className="p-3.5 bg-[#111827] overflow-x-auto text-[11.5px] leading-relaxed">
        <div className="flex font-mono min-w-max">
          {/* Line Numbers Gutter */}
          <div
            className="select-none pr-3.5 text-right text-[#9CA3AF]/50 border-r border-[#374151] mr-3.5 space-y-0.5"
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
      <div className="flex items-center justify-between border-t border-[#374151] bg-[#1F2937] px-3.5 py-1.5 text-[10px] text-[#9CA3AF]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#E5E7EB]">
            <Terminal className="h-3 w-3 text-[#4F9D8E]" />
            <span>DuckDB WASM Engine</span>
          </span>
          <span className="text-[#9CA3AF]/60">·</span>
          <span>UTF-8</span>
          <span className="text-[#9CA3AF]/60">·</span>
          <span className="text-[#9CA3AF]">{activeSnippet.language}</span>
        </div>

        <div className="flex items-center gap-2 text-[#4F9D8E]">
          <ShieldCheck className="h-3 w-3" />
          <span>AST Parameterized · 0 SQL Injection Risk</span>
        </div>
      </div>
    </div>
  );
}
