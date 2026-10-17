"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";

interface HeroBentoProps {
  selectedConnector: string;
  onSelectConnector: (name: string) => void;
  onOpenAuthModal: () => void;
}

const STREAM_TOPICS = [
  { cmd: "kafka://orders_eu --live" },
  { cmd: "s3://lake/events.parquet" },
  { cmd: "snowflake://prod.revenue" },
];

const CONNECTOR_NAMES = [
  "PostgreSQL",
  "Snowflake",
  "BigQuery",
  "ClickHouse",
  "Databricks",
  "Amazon Redshift",
  "S3 Parquet",
  "Apache Kafka",
  "MySQL",
];

type NavItem =
  | { id: string; label: string; hasMenu: true; href?: undefined }
  | { id: string; label: string; hasMenu?: false; href: string };

const NAV_ITEMS: NavItem[] = [
  { id: "product", label: "Platform", hasMenu: true },
  { id: "connectors", label: "Connectors", hasMenu: true },
  { id: "security", label: "Security & Trust", hasMenu: true },
  { id: "workbench", label: "Workbench", href: "#piece-workbench" },
  { id: "workflow", label: "Pipeline", href: "#workflow" },
  { id: "topology", label: "Topology", href: "#topology" },
  { id: "audit-trail", label: "Audit Trail", href: "#audit-trail" },
  { id: "docs", label: "Docs", href: "/docs" },
  { id: "benchmarks", label: "Benchmarks", href: "/benchmarks" },
];

export default function HeroBentoSection({
  selectedConnector,
  onSelectConnector,
  onOpenAuthModal,
}: HeroBentoProps) {
  const [starred, setStarred] = useState(false);
  const [starCount, setStarCount] = useState(34.8);
  const [activeNavMenu, setActiveNavMenu] = useState<string | null>(null);

  // Interactive Bento Card States
  const [olapPulse, setOlapPulse] = useState(false);
  const [rlsUnmasked, setRlsUnmasked] = useState(false);
  const [streamIdx, setStreamIdx] = useState(0);
  const [selectedTileIdx, setSelectedTileIdx] = useState<number>(0);
  const [collabPing, setCollabPing] = useState(false);
  const [activeRouteIdx, setActiveRouteIdx] = useState<number>(0);

  // Hero section cursor tracking for interactive background dots
  const [heroMousePos, setHeroMousePos] = useState<{ x: number; y: number } | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    setHeroMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleHeroMouseLeave = () => {
    setHeroMousePos(null);
  };

  const currentStream = STREAM_TOPICS[streamIdx];

  return (
    <div id="piece-hero-bento" className="w-full bg-[#121212]">
      {/* STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 h-[64px] w-full border-b border-[#2e2e2e] bg-[#121212]/95 backdrop-blur-xs">
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-[24px]">
          <div className="flex items-center gap-[32px]">
            <Link href="/" className="flex items-center gap-[9px]">
              <img className="size-6" src="images/logo.png" alt="RicozViz Logo" />
              <span className="text-[18px] font-medium tracking-[-0.02em] text-[#fafafa]">
                ricozviz
              </span>
            </Link>

            <nav className="hidden items-center gap-[20px] lg:flex">
              {NAV_ITEMS.map((item) =>
                item.hasMenu ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setActiveNavMenu((prev) =>
                        prev === item.id ? null : item.id
                      )
                    }
                    className="inline-flex items-center gap-[4px] text-[13px] font-normal text-[#b4b4b4] transition-colors hover:text-[#fafafa] cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`h-[12px] w-[12px] transition-transform ${
                        activeNavMenu === item.id ? "rotate-180 text-[#fafafa]" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                ) : (
                  <a
                    key={item.id}
                    href={item.href}
                    className="text-[13px] font-normal text-[#b4b4b4] transition-colors hover:text-[#fafafa]"
                  >
                    {item.label}
                  </a>
                )
              )}
            </nav>
          </div>

          <div className="flex items-center gap-[10px]">
            <Link
              href="/login"
              className="rounded-full border border-[#393939] bg-[#1c1c1c] px-[14px] py-[6px] text-[12px] font-medium text-[#fafafa] transition-colors hover:border-[#4d4d4d] hover:bg-[#242424] cursor-pointer"
            >
              Sign In
            </Link>

            <Link
              href="/register"
              className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[14px] py-[6px] text-[12px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c]"
            >
              Launch Workspace
            </Link>
          </div>
        </div>

        {activeNavMenu && (
          <div className="border-b border-[#2e2e2e] bg-[#171717] py-[14px]">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-[16px] px-[24px]">
              {activeNavMenu === "product" && (
                <div className="flex flex-wrap gap-[24px] text-[13px] text-[#b4b4b4]">
                  <a href="#products" onClick={() => setActiveNavMenu(null)} className="text-[#fafafa] hover:text-[#ff6b35]">
                    DuckDB Wasm OLAP
                  </a>
                  <a href="#piece-workbench" onClick={() => setActiveNavMenu(null)} className="hover:text-[#fafafa]">
                    Multi-Canvas Dashboards
                  </a>
                  <a href="#workflow" onClick={() => setActiveNavMenu(null)} className="hover:text-[#fafafa]">
                    Data Pipeline &amp; Vectorizer
                  </a>
                  <a href="#topology" onClick={() => setActiveNavMenu(null)} className="hover:text-[#fafafa]">
                    Infrastructure Topology
                  </a>
                </div>
              )}
              {activeNavMenu === "connectors" && (
                <div className="flex flex-wrap items-center gap-[8px]">
                  <span className="text-[12px] text-[#898989]">Active Source:</span>
                  {CONNECTOR_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onSelectConnector(name);
                        setActiveNavMenu(null);
                      }}
                      className={`rounded-full border px-[10px] py-[3px] text-[12px] cursor-pointer ${
                        selectedConnector === name
                          ? "border-[#fafafa] bg-[#242424] text-[#fafafa]"
                          : "border-[#2e2e2e] text-[#b4b4b4] hover:text-[#fafafa]"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {activeNavMenu === "security" && (
                <div className="flex flex-wrap items-center gap-[20px] text-[12px] text-[#b4b4b4]">
                  <a href="#governance" onClick={() => setActiveNavMenu(null)} className="text-[#fafafa] hover:text-[#ff6b35]">
                    ✓ SOC 2 &amp; HIPAA Controls
                  </a>
                  <a href="#audit-trail" onClick={() => setActiveNavMenu(null)} className="hover:text-[#fafafa]">
                    ✓ SHA-256 Audit Ledger
                  </a>
                  <a href="#audit-trail" onClick={() => setActiveNavMenu(null)} className="hover:text-[#fafafa]">
                    ✓ Cryptographic Kill-Switch
                  </a>
                  <a href="#governance" onClick={() => setActiveNavMenu(null)} className="hover:text-[#fafafa]">
                    ✓ Row-Level Security (RLS)
                  </a>
                  <Link href="/whitepaper" onClick={() => setActiveNavMenu(null)} className="text-[#ff6b35] hover:underline">
                    Security Whitepaper →
                  </Link>
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveNavMenu(null)}
                className="text-[12px] text-[#898989] hover:text-[#fafafa] cursor-pointer"
              >
                Close ✕
              </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION WITH INTERACTIVE BACKGROUND FADED DOTS */}
      <div
        ref={heroRef}
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        className="relative w-full overflow-hidden border-b border-[#2e2e2e]/40 mb-4"
      >
        {/* Layer 1: Base Faded Dots Matrix (Subtle charcoal dots) */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle, #333333 1.25px, transparent 1.25px)",
            backgroundSize: "24px 24px",
            maskImage:
              "radial-gradient(ellipse 90% 85% at 50% 50%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 85% at 50% 50%, black 40%, transparent 100%)",
          }}
        />

        {/* Layer 2: Interactive Lightened Dots on Cursor Hover */}
        <div
          className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ${heroMousePos ? "opacity-100" : "opacity-0"
            }`}
          style={{
            backgroundImage:
              "radial-gradient(circle, #ff6b35 1.75px, transparent 1.75px)",
            backgroundSize: "24px 24px",
            maskImage: heroMousePos
              ? `radial-gradient(220px circle at ${heroMousePos.x}px ${heroMousePos.y}px, black 15%, transparent 100%)`
              : "none",
            WebkitMaskImage: heroMousePos
              ? `radial-gradient(220px circle at ${heroMousePos.x}px ${heroMousePos.y}px, black 15%, transparent 100%)`
              : "none",
          }}
        />

        {/* Layer 3: Soft Coral Ambient Spotlight Glow */}
        <div
          className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ${heroMousePos ? "opacity-100" : "opacity-0"
            }`}
          style={{
            background: heroMousePos
              ? `radial-gradient(260px circle at ${heroMousePos.x}px ${heroMousePos.y}px, rgba(255, 107, 53, 0.12), transparent 75%)`
              : "none",
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-[1200px] px-[24px] pt-[56px] pb-[44px] md:pt-[76px] md:pb-[52px]">
          <div className="flex flex-col gap-[26px]">
            <div className="grid grid-cols-1 items-end gap-[24px] lg:grid-cols-2">
              <h1
                style={{ animationDelay: "60ms" }}
                className="animate-fade-in-up text-[38px] font-normal leading-[1.06] tracking-[-0.02em] text-[#fafafa] sm:text-[48px] lg:text-[52px] lg:whitespace-nowrap"
              >
                <span className="block">Query in milliseconds</span>
                <span className="block text-[#ff6b35]">Scale to every row</span>
              </h1>
              <p
                style={{ animationDelay: "140ms" }}
                className="animate-fade-in-up max-w-[500px] text-[16px] font-normal leading-[1.55] text-[#898989] lg:pb-[2px]"
              >
                Start your workspace with an in-memory DuckDB OLAP engine. Add
                Enterprise Connectors, Interactive Dashboards, Real-Time Kafka
                Streams, Row-Level Security, and PII Masking.
              </p>
            </div>

            <div
              style={{ animationDelay: "220ms" }}
              className="animate-fade-in-up flex flex-wrap items-center gap-[10px]"
            >
              <a
                href="#provision"
                className="inline-flex h-[38px] items-center justify-center rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[18px] text-[14px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c]"
              >
                Start your project
              </a>
              <a
                href="#piece-workbench"
                className="inline-flex h-[38px] items-center justify-center rounded-full border border-[#393939] bg-[#1c1c1c] px-[18px] text-[14px] font-normal text-[#fafafa] transition-colors hover:border-[#4d4d4d] hover:bg-[#242424]"
              >
                Request a demo
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 12-COLUMN ASYMMETRICAL PRODUCT BENTO GRID (6+3+3 Top Row, 3+3+3+3 Bottom Row) */}
      <section
        id="products"
        className="mx-auto max-w-[1200px] px-[24px] pb-[56px]"
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-12">
          {/* CARD 1 (6 Cols): DuckDB Wasm OLAP — Clean 3 Checkmarks Left + Large Multi-Layer Wireframe Right */}
          <div
            onClick={() => setOlapPulse((p) => !p)}
            style={{ animationDelay: "300ms" }}
            className="animate-fade-in-up group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] transition-colors hover:border-[#393939] md:col-span-12 lg:col-span-6 lg:flex-row cursor-pointer"
          >
            <div className="relative z-10 flex h-full w-full flex-col justify-between lg:max-w-[240px]">
              <div>
                <div className="flex items-center gap-[8px] text-[#fafafa]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <ellipse cx="12" cy="5" rx="8" ry="3" />
                    <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
                    <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
                  </svg>
                  <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa]">
                    DuckDB Wasm Engine
                  </h2>
                </div>
                <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                  Every workspace is{" "}
                  <strong className="font-normal text-[#fafafa]">
                    a full in-memory OLAP engine
                  </strong>
                  , unifying 9 enterprise databases, lakes, and streams.
                </p>
              </div>

              <ul className="space-y-[6px] text-[13px] text-[#fafafa]">
                <li className="flex items-center gap-[8px]">
                  <span className="text-[#898989]">✓</span>
                  <span>100% in-browser Wasm</span>
                </li>
                <li className="flex items-center gap-[8px]">
                  <span className="text-[#898989]">✓</span>
                  <span>Built-in RLS with SQLi guard</span>
                </li>
                <li className="flex items-center gap-[8px]">
                  <span className="text-[#898989]">✓</span>
                  <span>9 zero-ETL connectors</span>
                </li>
              </ul>
            </div>

            {/* Right Multi-Layer Wireframe Emblem */}
            <div className="relative flex flex-1 items-center justify-center">
              <svg
                viewBox="0 0 260 260"
                className="h-[235px] w-[235px] select-none"
              >
                <rect
                  x="28"
                  y="28"
                  width="204"
                  height="204"
                  rx="36"
                  fill="none"
                  stroke="#222222"
                  strokeWidth="1"
                />
                <rect
                  x="42"
                  y="42"
                  width="176"
                  height="176"
                  rx="28"
                  fill="none"
                  stroke="#2a2a2a"
                  strokeWidth="1"
                />
                <line
                  x1="28"
                  y1="130"
                  x2="232"
                  y2="130"
                  stroke="#222222"
                  strokeWidth="1"
                />
                <line
                  x1="130"
                  y1="28"
                  x2="130"
                  y2="232"
                  stroke="#222222"
                  strokeWidth="1"
                />

                {/* Layered Isometric OLAP Contours */}
                <polygon
                  points="130,48 202,90 202,170 130,212 58,170 58,90"
                  fill="none"
                  stroke="#2e2e2e"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <polygon
                  points="130,62 190,97 190,163 130,198 70,163 70,97"
                  fill="none"
                  stroke="#393939"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <polygon
                  points="130,76 178,104 178,156 130,184 82,156 82,104"
                  fill="#141414"
                  stroke="#4d4d4d"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <polyline
                  points="82,104 130,132 178,104"
                  fill="none"
                  stroke="#4d4d4d"
                  strokeWidth="2"
                />
                <line
                  x1="130"
                  y1="132"
                  x2="130"
                  y2="184"
                  stroke="#4d4d4d"
                  strokeWidth="2"
                />
                <circle
                  cx={olapPulse ? "154" : "148"}
                  cy="108"
                  r="3.5"
                  fill="#4d4d4d"
                />
              </svg>
            </div>
          </div>

          {/* CARD 2 (3 Cols): Row-Level Security & PII Masking — Single-line title, 2x3 blurred/cleartext grid */}
          <div
            onClick={() => setRlsUnmasked((v) => !v)}
            style={{ animationDelay: "380ms" }}
            className="animate-fade-in-up group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] transition-colors hover:border-[#393939] md:col-span-6 lg:col-span-3 cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-[8px] text-[#fafafa]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 018 0v4" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa]">
                  Row-Level Security
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                <strong className="font-normal text-[#fafafa]">
                  Isolate tenants and mask PII
                </strong>
                , securing every dataset with role and regional policies.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-[8px] pt-[16px]">
              {[
                { text: "vp.data@acme.io", clear: true },
                { text: "cfo.eu@acme.io", clear: true },
                { text: "ssn: 940-28-1940", clear: false },
                { text: "arr: $1,420,000", clear: false },
                { text: "ops.apac@acme.io", clear: true },
                { text: "tax: DE-8192041", clear: false },
              ].map((cell, idx) => {
                const isVisible = cell.clear || rlsUnmasked;
                return (
                  <div
                    key={idx}
                    className="flex h-[52px] items-center justify-center rounded-[8px] border border-[#2e2e2e] bg-[#121212] px-[10px] font-mono-code text-[11px] text-[#898989]"
                  >
                    <span
                      className={`truncate transition-all duration-300 ${isVisible
                        ? "blur-none text-[#898989]"
                        : "blur-[4px] select-none text-[#4d4d4d] group-hover:blur-none"
                        }`}
                    >
                      {cell.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 3 (3 Cols): Real-Time Streaming — Single-line title, terminal pill + wireframe globe */}
          <div
            onClick={() =>
              setStreamIdx((i) => (i + 1) % STREAM_TOPICS.length)
            }
            style={{ animationDelay: "460ms" }}
            className="animate-fade-in-up group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] transition-colors hover:border-[#393939] md:col-span-6 lg:col-span-3 cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-[8px] text-[#fafafa]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3.6 9h16.8M3.6 15h16.8" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa]">
                  Real-Time Streaming
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                Ingest continuous event streams{" "}
                <strong className="font-normal text-[#fafafa]">
                  without deploying or scaling batch pipelines.
                </strong>
              </p>
            </div>

            <div className="relative flex flex-col items-center pt-[16px]">
              <div className="z-10 flex items-center gap-[6px] rounded-full border border-[#2e2e2e] bg-[#121212] px-[14px] py-[6px] font-mono-code text-[11px]">
                <span className="text-[#898989]">$ viz</span>
                <span className="text-[#ff6b35]">{currentStream.cmd}</span>
              </div>

              <svg
                viewBox="0 0 260 155"
                className="-mt-[8px] w-full overflow-visible"
              >
                <path
                  d="M 10 150 A 125 110 0 0 1 250 150"
                  fill="none"
                  stroke="#242424"
                  strokeWidth="1"
                />
                <path
                  d="M 35 150 A 95 85 0 0 1 225 150"
                  fill="none"
                  stroke="#2a2a2a"
                  strokeWidth="1"
                />
                <path
                  d="M 65 150 A 65 60 0 0 1 195 150"
                  fill="none"
                  stroke="#333333"
                  strokeWidth="1"
                />
                <line
                  x1="130"
                  y1="8"
                  x2="130"
                  y2="92"
                  stroke="#4d4d4d"
                  strokeWidth="1"
                />
                <path d="M 130 92 L 196 134" stroke="#4d4d4d" strokeWidth="1" />
                <path d="M 130 92 L 58 124" stroke="#4d4d4d" strokeWidth="1" />
                <circle cx="130" cy="92" r="2.5" fill="#fafafa" />
                <circle cx="196" cy="134" r="2.5" fill="#fafafa" />
                <circle cx="58" cy="124" r="2" fill="#fafafa" />
              </svg>
            </div>
          </div>

          {/* CARD 4 (3 Cols): Dashboard Builder — Single-line title, clean 3x4 icon-only tile grid */}
          <div
            style={{ animationDelay: "540ms" }}
            className="animate-fade-in-up group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] transition-colors hover:border-[#393939] md:col-span-6 lg:col-span-3"
          >
            <div>
              <div className="flex items-center gap-[8px] text-[#fafafa]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa]">
                  Dashboard Builder
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                <strong className="font-normal text-[#fafafa]">
                  Build multi-canvas KPI dashboards
                </strong>{" "}
                with area, bar, heatmap, and donut visualizations.
              </p>
            </div>

            {/* Clean 3x4 Icon-Only Grid (Matches Supabase Storage card 1:1) */}
            <div className="grid grid-cols-4 gap-[8px] pt-[12px]">
              {Array.from({ length: 12 }).map((_, i) => {
                const active = selectedTileIdx === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedTileIdx(i)}
                    className={`flex h-[50px] items-center justify-center rounded-[8px] border transition-colors cursor-pointer ${active
                      ? "border-[#4d4d4d] bg-[#1c1c1c] text-[#fafafa]"
                      : "border-[#242424] bg-[#121212] text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                      }`}
                  >
                    {i < 4 ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <polyline points="7,15 11,11 14,14 18,9" />
                      </svg>
                    ) : i < 8 ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <circle cx="12" cy="12" r="8" />
                        <path d="M12 4v8l5.5 3" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CARD 5 (3 Cols): Realtime Collaboration — Wireframe grid + cursors + pill */}
          <div
            onClick={() => setCollabPing((p) => !p)}
            style={{ animationDelay: "620ms" }}
            className="animate-fade-in-up group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] transition-colors hover:border-[#393939] md:col-span-6 lg:col-span-3 cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-[8px] text-[#fafafa]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="m4 4 7.07 17 2.51-7.39L21 11.07z" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa]">
                  Realtime
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                <strong className="font-normal text-[#fafafa]">
                  Build multiplayer experiences
                </strong>{" "}
                with real-time workspace synchronization.
              </p>
            </div>

            <div className="relative flex h-[210px] w-full items-center justify-center overflow-hidden rounded-[11px] bg-[#141414]">
              <svg
                viewBox="0 0 240 190"
                className="absolute inset-0 h-full w-full"
              >
                {[24, 48, 72, 96, 120, 144, 168, 192, 216].map((x) => (
                  <line
                    key={`vx-${x}`}
                    x1={x}
                    y1="0"
                    x2={x}
                    y2="190"
                    stroke="#1c1c1c"
                    strokeWidth="1"
                  />
                ))}
                {[24, 48, 72, 96, 120, 144, 168].map((y) => (
                  <line
                    key={`hy-${y}`}
                    x1="0"
                    y1={y}
                    x2="240"
                    y2={y}
                    stroke="#1c1c1c"
                    strokeWidth="1"
                  />
                ))}

                <g
                  transform={
                    collabPing ? "translate(62, 102)" : "translate(48, 92)"
                  }
                >
                  <path
                    d="M0 0 L0 22 L6 17 L13 20 Z"
                    fill="#121212"
                    stroke="#898989"
                    strokeWidth="1.25"
                  />
                </g>

                <g
                  transform={
                    collabPing ? "translate(148, 128)" : "translate(160, 142)"
                  }
                >
                  <path
                    d="M0 0 L0 16 L4.5 12.5 L10 14.5 Z"
                    fill="#121212"
                    stroke="#898989"
                    strokeWidth="1.25"
                  />
                </g>
              </svg>

              <div className="relative z-10 flex items-center gap-[5px] rounded-full border border-[#4d4d4d] bg-[#242424] px-[16px] py-[8px]">
                <span className="h-[4px] w-[4px] rounded-full bg-[#b4b4b4]" />
                <span className="h-[4px] w-[4px] rounded-full bg-[#b4b4b4]" />
                <span className="h-[4px] w-[4px] rounded-full bg-[#b4b4b4]" />
              </div>
            </div>
          </div>

          {/* CARD 6 (3 Cols): Lineage & Governance — Isometric cube + accent vertices + bottom labels */}
          <div
            style={{ animationDelay: "700ms" }}
            className="animate-fade-in-up group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] transition-colors hover:border-[#393939] md:col-span-6 lg:col-span-3"
          >
            <div>
              <div className="flex items-center gap-[8px] text-[#fafafa]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa]">
                  Lineage &amp; Audit
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                Integrate enterprise governance to{" "}
                <strong className="font-normal text-[#fafafa]">
                  trace lineage, audit SQL, and sync SAML/SCIM.
                </strong>
              </p>
            </div>

            <div className="relative flex flex-col justify-end pt-[8px]">
              <svg viewBox="0 0 240 150" className="h-[150px] w-full">
                <polygon
                  points="120,22 174,53 174,115 120,146 66,115 66,53"
                  fill="none"
                  stroke="#4d4d4d"
                  strokeWidth="1"
                />
                <polyline
                  points="66,53 120,84 174,53"
                  fill="none"
                  stroke="#4d4d4d"
                  strokeWidth="1"
                />
                <line
                  x1="120"
                  y1="84"
                  x2="120"
                  y2="146"
                  stroke="#4d4d4d"
                  strokeWidth="1"
                />
                <circle cx="142" cy="48" r="2.5" fill="#ff6b35" />
                <circle cx="96" cy="96" r="2.5" fill="#ff6b35" />
                <circle cx="152" cy="92" r="2.5" fill="#ff6b35" />
                <circle cx="135" cy="60" r="2" fill="#ff6b35" />
                <circle cx="198" cy="36" r="2" fill="#fafafa" />
              </svg>

              <div className="mt-[4px] flex flex-col gap-[6px] text-[12px] text-[#fafafa]">
                <div className="flex items-center gap-[8px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#b4b4b4]" />
                  <span>Okta SAML 2.0</span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#898989]" />
                  <span>SHA-256 Ledger</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 7 (3 Cols): Embedded SDK & Alerts — Compact 5-row dashed table-to-route pills without clipping */}
          <div
            style={{ animationDelay: "780ms" }}
            className="animate-fade-in-up group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] transition-colors hover:border-[#393939] md:col-span-6 lg:col-span-3"
          >
            <div>
              <div className="flex items-center gap-[8px] text-[#fafafa]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="6" height="6" rx="1" />
                  <rect x="15" y="3" width="6" height="6" rx="1" />
                  <rect x="15" y="15" width="6" height="6" rx="1" />
                  <path d="M9 6h6M6 9v6a3 3 0 0 0 3 3h6" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa]">
                  Data APIs &amp; Embeds
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                Instant ready-to-use{" "}
                <strong className="font-normal text-[#fafafa]">
                  signed iframe embeds and alert webhooks.
                </strong>
              </p>
            </div>

            <div className="flex flex-col gap-[10px] pt-[12px]">
              {[
                { table: "revenues", slug: "revenues" },
                { table: "cohorts", slug: "cohorts" },
                { table: "streams", slug: "streams" },
                { table: "tenants", slug: "tenants" },
                { table: "anomalies", slug: "anomalies" },
              ].map((row, idx) => {
                const isSelected = activeRouteIdx === idx;
                return (
                  <button
                    key={row.table}
                    type="button"
                    onClick={() => setActiveRouteIdx(idx)}
                    className="flex w-full items-center justify-between gap-[6px] cursor-pointer"
                  >
                    <span className="shrink-0 rounded-[5px] border border-[#2e2e2e] bg-[#141414] px-[7px] py-[3px] font-mono-code text-[10px] text-[#898989]">
                      ⊞ {row.table}
                    </span>
                    <span className="flex-1 border-b border-dashed border-[#2e2e2e]" />
                    <span
                      className={`shrink-0 rounded-full border px-[9px] py-[3px] font-mono-code text-[10px] transition-colors ${isSelected
                        ? "border-[#393939] bg-[#242424] text-[#898989]"
                        : "border-[#2e2e2e] bg-[#1a1a1a] text-[#898989]"
                        }`}
                    >
                      .../v1/<strong className="font-normal text-[#fafafa]">{row.slug}</strong>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Single-Baseline Two-Tone Summary Tagline (Matches supabase-products.png 1:1) */}
        <div
          style={{ animationDelay: "860ms" }}
          className="animate-fade-in-up mt-[24px] text-[20px] font-normal tracking-[-0.015em] sm:text-[22px]"
        >
          <span className="text-[#fafafa]">Use one or all.</span>{" "}
          <span className="text-[#898989]">
            Best of breed analytics. Integrated as a platform.
          </span>
        </div>
      </section>
    </div>
  );
}
