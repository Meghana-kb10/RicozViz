"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";

interface HeroBentoProps {
  selectedConnector: string;
  onSelectConnector: (name: string) => void;
  onOpenAuthModal?: () => void;
}

const STREAM_TOPICS = [
  { cmd: "ai: 'Plot monthly ARR growth by acquisition channel'" },
  { cmd: "sql: SELECT date_trunc('week', created_at), sum(amount) FROM orders GROUP BY 1" },
  { cmd: "alert: notify webhook when failed_transactions > 15" },
];

const CONNECTOR_NAMES = [
  "PostgreSQL",
  "MySQL",
  "SQLite",
  "Snowflake",
  "BigQuery",
  "ClickHouse",
  "Amazon Redshift",
  "REST API",
  "CSV & Excel",
];

interface NavItem {
  id: string;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "products", label: "Overview", href: "#products" },
  { id: "workbench", label: "Studio", href: "#piece-workbench" },
  { id: "capabilities", label: "Capabilities", href: "#capabilities" },
  { id: "workflow", label: "Pipeline", href: "#workflow" },
  { id: "benchmarks", label: "Benchmarks", href: "/benchmarks" },
];

interface BentoSpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: string;
  onClick?: () => void;
}

function BentoSpotlightCard({
  children,
  className = "",
  delay,
  onClick,
}: BentoSpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ animationDelay: delay }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#262626] bg-[#141414] p-[24px] transition-all duration-300 hover:border-[#383838] animate-fade-in-up ${className}`}
    >
      {/* 1. Large Circular Blur Blob Illuminating Area Near Cursor Pointer */}
      <div
        className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ${mousePos ? "opacity-100" : "opacity-0"
          }`}
        style={{
          background: mousePos
            ? `radial-gradient(280px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 107, 53, 0.18), transparent 75%)`
            : "none",
        }}
      />

      {/* 2. Concentrated Intense Circular Blur Blob Directly Under Cursor Pointer */}
      <div
        className={`pointer-events-none absolute z-0 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff6b35]/25 blur-[38px] transition-opacity duration-200 ${mousePos ? "opacity-100" : "opacity-0"
          }`}
        style={{
          left: mousePos ? `${mousePos.x}px` : "50%",
          top: mousePos ? `${mousePos.y}px` : "50%",
        }}
      />

      {/* 3. Illuminating Border Highlighter Follows Cursor */}
      <div
        className={`pointer-events-none absolute inset-0 z-0 rounded-[16px] transition-opacity duration-300 ${mousePos ? "opacity-100" : "opacity-0"
          }`}
        style={{
          border: "1px solid transparent",
          background: mousePos
            ? `radial-gradient(190px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 120, 60, 0.65), transparent 70%) border-box`
            : "none",
          WebkitMask:
            "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {children}
    </div>
  );
}

export default function HeroBentoSection({
  selectedConnector,
  onSelectConnector,
  onOpenAuthModal,
}: HeroBentoProps) {
  // Interactive Bento Card States
  const [olapPulse, setOlapPulse] = useState(false);
  const [aiPromptExpanded, setAiPromptExpanded] = useState(false);
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
              <img className="size-6 rounded-md object-contain" src="/images/logo.png" alt="RicozViz Logo" />
              <span className="text-[18px] font-medium tracking-[-0.02em] text-[#fafafa]">
                ricozviz
              </span>
            </Link>

            <nav className="hidden items-center gap-[22px] lg:flex">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="text-[13px] font-normal text-[#b4b4b4] transition-colors hover:text-[#fafafa]"
                >
                  {item.label}
                </a>
              ))}
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
                <span className="block text-[#ff6b35]">Visualize without limits</span>
              </h1>
              <p
                style={{ animationDelay: "140ms" }}
                className="animate-fade-in-up max-w-[500px] text-[16px] font-normal leading-[1.55] text-[#898989] lg:pb-[2px]"
              >
                Connect PostgreSQL, MySQL, Snowflake, BigQuery, REST APIs, and
                spreadsheets. Build real-time interactive dashboards, generate
                charts using natural language AI, and monitor automated alerts.
              </p>
            </div>

            <div
              style={{ animationDelay: "220ms" }}
              className="animate-fade-in-up flex flex-wrap items-center gap-[10px]"
            >
              <a
                href="/register"
                className="inline-flex h-[38px] items-center justify-center rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[18px] text-[14px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c]"
              >
                Launch Workspace
              </a>
              <a
                href="/login"
                className="inline-flex h-[38px] items-center justify-center rounded-full border border-[#393939] bg-[#1c1c1c] px-[18px] text-[14px] font-normal text-[#fafafa] transition-colors hover:border-[#4d4d4d] hover:bg-[#242424]"
              >
                Sign In
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
          {/* CARD 1 (6 Cols): Universal Multi-Source SQL Engine */}
          <BentoSpotlightCard
            onClick={() => setOlapPulse((p) => !p)}
            delay="300ms"
            className="md:col-span-12 lg:col-span-6 lg:flex-row h-[400px]"
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
                    className="group-hover:text-[#ff6b35] transition-colors"
                  >
                    <ellipse cx="12" cy="5" rx="8" ry="3" />
                    <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
                    <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
                  </svg>
                  <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                    Universal Data Engine
                  </h2>
                </div>
                <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                  Every workspace directly unifies{" "}
                  <strong className="font-normal text-[#fafafa]">
                    9+ databases and warehouses
                  </strong>
                  , cloud storage, REST APIs, and spreadsheets.
                </p>
              </div>

              <ul className="space-y-[6px] text-[13px] text-[#fafafa]">
                <li className="flex items-center gap-[8px]">
                  <span className="text-[#ff6b35]">✓</span>
                  <span>PostgreSQL, MySQL, Snowflake, BigQuery</span>
                </li>
                <li className="flex items-center gap-[8px]">
                  <span className="text-[#ff6b35]">✓</span>
                  <span>Automated schema discovery &amp; profiling</span>
                </li>
                <li className="flex items-center gap-[8px]">
                  <span className="text-[#ff6b35]">✓</span>
                  <span>Zero-ETL multi-source SQL queries</span>
                </li>
              </ul>
            </div>

            {/* Right Multi-Layer Wireframe Emblem with Alive Hover Animation */}
            <div className="relative flex flex-1 items-center justify-center">
              <div className="relative flex items-center justify-center transition-all duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-1">
                {/* Rotating coral aura on hover */}
                <div className="absolute h-[200px] w-[200px] rounded-full bg-[#ff6b35]/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <svg
                  viewBox="0 0 260 260"
                  className="h-[235px] w-[235px] select-none transition-transform duration-700 ease-out group-hover:rotate-1"
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
                    className="group-hover:stroke-[#333333] transition-colors"
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
                    className="group-hover:stroke-[#393939] transition-colors"
                  />
                  <line
                    x1="28"
                    y1="130"
                    x2="232"
                    y2="130"
                    stroke="#222222"
                    strokeWidth="1"
                    className="group-hover:stroke-[#ff6b35]/30 transition-colors"
                  />
                  <line
                    x1="130"
                    y1="28"
                    x2="130"
                    y2="232"
                    stroke="#222222"
                    strokeWidth="1"
                    className="group-hover:stroke-[#ff6b35]/30 transition-colors"
                  />

                  {/* Concentric Layered Isometric OLAP Contours */}
                  <polygon
                    points="130,48 202,90 202,170 130,212 58,170 58,90"
                    fill="none"
                    stroke="#2e2e2e"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    className="group-hover:stroke-[#444444] transition-colors"
                  />
                  {/* Alive animated flowing dashed stream on hover */}
                  <polygon
                    points="130,48 202,90 202,170 130,212 58,170 58,90"
                    fill="none"
                    stroke="#ff6b35"
                    strokeWidth="1.5"
                    strokeDasharray="6 8"
                    className="opacity-0 group-hover:opacity-90 animate-dash-flow transition-opacity duration-500"
                  />

                  <polygon
                    points="130,62 190,97 190,163 130,198 70,163 70,97"
                    fill="none"
                    stroke="#393939"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    className="group-hover:stroke-[#ff6b35]/60 transition-all duration-500"
                  />
                  <polygon
                    points="130,76 178,104 178,156 130,184 82,156 82,104"
                    fill="#141414"
                    stroke="#4d4d4d"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    className="group-hover:stroke-[#ff6b35] group-hover:drop-shadow-[0_0_16px_rgba(255,107,53,0.7)] transition-all duration-500"
                  />
                  <polyline
                    points="82,104 130,132 178,104"
                    fill="none"
                    stroke="#4d4d4d"
                    strokeWidth="2"
                    className="group-hover:stroke-[#ff6b35]/80 transition-colors"
                  />
                  <line
                    x1="130"
                    y1="132"
                    x2="130"
                    y2="184"
                    stroke="#4d4d4d"
                    strokeWidth="2"
                    className="group-hover:stroke-[#ff6b35]/80 transition-colors"
                  />

                  {/* Concentric radar ripples expanding on hover */}
                  <circle
                    cx="130"
                    cy="132"
                    r="22"
                    fill="none"
                    stroke="#ff6b35"
                    strokeWidth="1"
                    className="opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                  />
                  <circle
                    cx="130"
                    cy="132"
                    r="44"
                    fill="none"
                    stroke="#ff6b35"
                    strokeWidth="0.75"
                    strokeDasharray="3 3"
                    className="opacity-0 group-hover:opacity-50 animate-dash-flow transition-opacity duration-500"
                  />

                  {/* Glowing vertices that animate on hover */}
                  <circle
                    cx="130"
                    cy="76"
                    r="3.5"
                    className="fill-[#4d4d4d] group-hover:fill-[#ff6b35] group-hover:r-[4.5] group-hover:drop-shadow-[0_0_8px_#ff6b35] transition-all duration-300"
                  />
                  <circle
                    cx="178"
                    cy="104"
                    r="3.5"
                    className="fill-[#4d4d4d] group-hover:fill-[#ff6b35] group-hover:r-[4.5] group-hover:drop-shadow-[0_0_8px_#ff6b35] transition-all duration-300"
                  />
                  <circle
                    cx="82"
                    cy="104"
                    r="3.5"
                    className="fill-[#4d4d4d] group-hover:fill-[#ff6b35] group-hover:r-[4.5] group-hover:drop-shadow-[0_0_8px_#ff6b35] transition-all duration-300"
                  />
                  <circle
                    cx="130"
                    cy="132"
                    r="5"
                    className="fill-[#ff6b35] group-hover:drop-shadow-[0_0_14px_#ff6b35] group-hover:scale-125 transition-all duration-300"
                  />
                  <circle
                    cx={olapPulse ? "154" : "148"}
                    cy="108"
                    r="3.5"
                    className="fill-[#ff6b35] group-hover:animate-ping"
                  />
                </svg>

                {/* Floating query execution throughput tag */}
                <div className="absolute -bottom-2 right-0 rounded-full border border-[#2e2e2e] bg-[#121212]/95 backdrop-blur-xs px-[10px] py-[3px] text-[10px] font-mono-code text-[#898989] group-hover:border-[#ff6b35]/60 group-hover:text-[#fafafa] transition-colors flex items-center gap-[6px]">
                  <span className="h-[5px] w-[5px] rounded-full bg-emerald-400 animate-pulse" />
                  <span>Sub-Second Query Pushdown</span>
                </div>
              </div>
            </div>
          </BentoSpotlightCard>

          {/* CARD 2 (3 Cols): AI Natural Language to Chart */}
          <BentoSpotlightCard
            onClick={() => setAiPromptExpanded((v) => !v)}
            delay="380ms"
            className="md:col-span-6 lg:col-span-3 h-[400px]"
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
                  className="group-hover:text-[#ff6b35] group-hover:rotate-6 transition-all duration-300"
                >
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                  Natural Language AI
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                <strong className="font-normal text-[#fafafa]">
                  Ask questions in plain English
                </strong>
                . RicozViz auto-generates SQL and renders optimal visuals.
              </p>
            </div>

            {/* Dynamic data cells with cybernetic laser scanner sweep */}
            <div className="relative grid grid-cols-2 gap-[8px] pt-[14px] overflow-hidden">
              {/* Laser sweep line on hover */}
              <div className="pointer-events-none absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff6b35] to-transparent opacity-0 group-hover:opacity-100 animate-laser-sweep shadow-[0_0_12px_#ff6b35] z-20" />

              {[
                { text: "plot monthly ARR growth", clear: true, tag: "SQL" },
                { text: "cohort churn rate", clear: true, tag: "CHART" },
                { text: "top 10 customer LTV", clear: true, tag: "VISUAL" },
                { text: "q3 margin breakdown", clear: false, tag: "AI" },
                { text: "orders by country", clear: true, tag: "BAR" },
                { text: "conversion funnel drop", clear: false, tag: "AUTO" },
              ].map((cell, idx) => {
                const isVisible = cell.clear || aiPromptExpanded;
                return (
                  <div
                    key={idx}
                    className="relative flex h-[50px] flex-col items-center justify-center rounded-[8px] border border-[#2e2e2e] bg-[#121212] px-[8px] font-mono-code text-[11px] text-[#898989] group-hover:border-[#393939] transition-all duration-300 hover:border-[#ff6b35]/60 hover:bg-[#181818]"
                  >
                    <span
                      className={`truncate transition-all duration-300 ${isVisible
                        ? "blur-none text-[#fafafa]"
                        : "blur-[4px] select-none text-[#4d4d4d] group-hover:blur-none group-hover:text-[#ff8252]"
                        }`}
                    >
                      {cell.text}
                    </span>
                    <span className="text-[9px] text-[#555555] group-hover:text-[#ff6b35]/70 transition-colors">
                      {isVisible ? `[READY ${cell.tag}]` : `[SYNTH ${cell.tag}]`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Assistant Active Telemetry Footer */}
            <div className="mt-[10px] flex items-center justify-between border-t border-[#222222] pt-[8px] text-[11px] font-mono-code text-[#898989]">
              <span className="flex items-center gap-[5px]">
                <span className="h-[5px] w-[5px] rounded-full bg-[#ff6b35] group-hover:animate-ping" />
                <span className="group-hover:text-[#fafafa] transition-colors">NL-to-Chart AI</span>
              </span>
              <span className="rounded bg-[#1c1c1c] px-[7px] py-[2px] text-[10px] text-[#ff6b35] border border-[#2e2e2e] group-hover:border-[#ff6b35]/40 transition-colors">
                Auto-SQL
              </span>
            </div>
          </BentoSpotlightCard>

          {/* CARD 3 (3 Cols): Automated Metric Alerts */}
          <BentoSpotlightCard
            onClick={() => setStreamIdx((i) => (i + 1) % STREAM_TOPICS.length)}
            delay="460ms"
            className="md:col-span-6 lg:col-span-3 h-[400px]"
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
                  className="group-hover:text-[#ff6b35] transition-colors"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                  Automated Metric Alerts
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                Trigger automated notifications{" "}
                <strong className="font-normal text-[#fafafa]">
                  when KPIs cross critical thresholds.
                </strong>
              </p>
            </div>

            <div className="relative flex flex-col items-center pt-[12px]">
              {/* Terminal command pill with live beacon */}
              <div className="z-10 flex items-center gap-[8px] rounded-full border border-[#2e2e2e] bg-[#121212] px-[14px] py-[6px] font-mono-code text-[11px] group-hover:border-[#ff6b35]/60 group-hover:shadow-[0_0_16px_rgba(255,107,53,0.3)] transition-all">
                <span className="h-[6px] w-[6px] rounded-full bg-[#ff6b35] group-hover:animate-ping" />
                <span className="text-[#898989]">$ alert</span>
                <span className="text-[#ff6b35] font-semibold truncate max-w-[170px]">{currentStream.cmd}</span>
              </div>

              {/* Wireframe globe with alive hover glow and streaming packet flow */}
              <svg
                viewBox="0 0 260 155"
                className="-mt-[8px] w-full overflow-visible transition-transform duration-700 ease-out group-hover:scale-108"
              >
                <path
                  d="M 10 150 A 125 110 0 0 1 250 150"
                  fill="none"
                  stroke="#242424"
                  strokeWidth="1"
                  className="group-hover:stroke-[#333333] transition-colors"
                />
                <path
                  d="M 35 150 A 95 85 0 0 1 225 150"
                  fill="none"
                  stroke="#2a2a2a"
                  strokeWidth="1"
                  className="group-hover:stroke-[#ff6b35]/40 transition-colors"
                />
                {/* Streaming dash flow on hover */}
                <path
                  d="M 35 150 A 95 85 0 0 1 225 150"
                  fill="none"
                  stroke="#ff6b35"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                  className="opacity-0 group-hover:opacity-90 animate-dash-flow transition-opacity duration-500"
                />

                <path
                  d="M 65 150 A 65 60 0 0 1 195 150"
                  fill="none"
                  stroke="#333333"
                  strokeWidth="1"
                  className="group-hover:stroke-[#ff6b35]/70 transition-colors"
                />
                <path
                  d="M 65 150 A 65 60 0 0 1 195 150"
                  fill="none"
                  stroke="#ff6b35"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="opacity-0 group-hover:opacity-75 animate-dash-flow transition-opacity duration-500"
                />

                <line
                  x1="130"
                  y1="8"
                  x2="130"
                  y2="92"
                  stroke="#4d4d4d"
                  strokeWidth="1"
                  className="group-hover:stroke-[#ff6b35] transition-colors"
                />
                <path
                  d="M 130 92 L 196 134"
                  stroke="#4d4d4d"
                  strokeWidth="1"
                  className="group-hover:stroke-[#ff6b35] transition-colors"
                />
                <path
                  d="M 130 92 L 58 124"
                  stroke="#4d4d4d"
                  strokeWidth="1"
                  className="group-hover:stroke-[#ff6b35] transition-colors"
                />

                {/* Radar ripples on center node */}
                <circle
                  cx="130"
                  cy="92"
                  r="14"
                  fill="none"
                  stroke="#ff6b35"
                  strokeWidth="1"
                  className="opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                />

                <circle
                  cx="130"
                  cy="92"
                  r="3.5"
                  className="fill-[#fafafa] group-hover:fill-[#ff6b35] group-hover:drop-shadow-[0_0_10px_#ff6b35] transition-all"
                />
                <circle
                  cx="196"
                  cy="134"
                  r="3.5"
                  className="fill-[#fafafa] group-hover:fill-[#ff6b35] group-hover:drop-shadow-[0_0_10px_#ff6b35] transition-all"
                />
                <circle
                  cx="58"
                  cy="124"
                  r="3"
                  className="fill-[#fafafa] group-hover:fill-[#ff6b35] group-hover:drop-shadow-[0_0_10px_#ff6b35] transition-all"
                />
              </svg>
            </div>

            {/* Alert status telemetry footer */}
            <div className="mt-auto flex w-full items-center justify-between border-t border-[#222222] pt-[8px] text-[11px] font-mono-code text-[#898989]">
              <span className="flex items-center gap-[6px] text-emerald-400">
                <span className="h-[6px] w-[6px] rounded-full bg-emerald-400 animate-ping" />
                <span>Webhooks &amp; Email</span>
              </span>
              <span className="group-hover:text-[#fafafa] transition-colors">Scheduled Monitors Active</span>
            </div>
          </BentoSpotlightCard>

          {/* CARD 4 (3 Cols): Dashboard Builder */}
          <BentoSpotlightCard
            delay="540ms"
            className="md:col-span-6 lg:col-span-3 h-[400px]"
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
                  className="group-hover:text-[#ff6b35] transition-colors"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
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

            {/* Interactive 3x4 Animated Micro-Visualization Grid */}
            <div className="grid grid-cols-4 gap-[8px] pt-[10px]">
              {[
                { type: "bar", label: "Bar" },
                { type: "sparkline", label: "Area" },
                { type: "donut", label: "Ring" },
                { type: "kpi", label: "KPI" },
                { type: "cluster", label: "Cluster" },
                { type: "radar", label: "Radar" },
                { type: "matrix", label: "Heat" },
                { type: "step", label: "Step" },
                { type: "gauge", label: "Gauge" },
                { type: "funnel", label: "Funnel" },
                { type: "scatter", label: "Scatter" },
                { type: "table", label: "Grid" },
              ].map((item, i) => {
                const active = selectedTileIdx === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedTileIdx(i)}
                    className={`flex h-[48px] flex-col items-center justify-center rounded-[8px] border transition-all duration-300 cursor-pointer overflow-hidden p-[4px] ${active
                      ? "border-[#ff6b35] bg-[#ff6b35]/20 text-[#ff6b35] shadow-[0_0_12px_rgba(255,107,53,0.35)] scale-[1.05]"
                      : "border-[#242424] bg-[#121212] text-[#898989] hover:border-[#ff6b35]/60 hover:bg-[#1c1c1c] hover:text-[#fafafa] hover:scale-105"
                      }`}
                  >
                    {item.type === "bar" && (
                      <div className="flex h-full w-full items-end justify-center gap-[3px] px-[2px] pb-[4px]">
                        <span className="w-[4px] rounded-t-[1px] bg-[#ff6b35] h-[45%] group-hover:h-[80%] transition-all duration-500" />
                        <span className="w-[4px] rounded-t-[1px] bg-[#fafafa] h-[75%] group-hover:h-[100%] transition-all duration-500 delay-75" />
                        <span className="w-[4px] rounded-t-[1px] bg-[#898989] h-[55%] group-hover:h-[85%] transition-all duration-500 delay-150" />
                      </div>
                    )}
                    {item.type === "sparkline" && (
                      <svg viewBox="0 0 32 20" className="h-[20px] w-full overflow-visible">
                        <path
                          d="M2 16 Q 10 4, 18 10 T 30 4"
                          fill="none"
                          stroke={active ? "#ff6b35" : "#898989"}
                          strokeWidth="1.5"
                          className="group-hover:stroke-[#ff6b35] transition-colors"
                        />
                        <circle cx="30" cy="4" r="2" fill="#ff6b35" className="group-hover:animate-ping" />
                      </svg>
                    )}
                    {item.type === "donut" && (
                      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]">
                        <circle cx="12" cy="12" r="8" fill="none" stroke="#242424" strokeWidth="3" />
                        <circle
                          cx="12"
                          cy="12"
                          r="8"
                          fill="none"
                          stroke="#ff6b35"
                          strokeWidth="3"
                          strokeDasharray="36 50"
                          strokeLinecap="round"
                          className="transition-all duration-500 group-hover:stroke-dasharray-[44_50]"
                        />
                      </svg>
                    )}
                    {item.type === "kpi" && (
                      <div className="flex flex-col items-center justify-center font-mono-code leading-none">
                        <span className="text-[11px] font-bold text-emerald-400 group-hover:scale-110 transition-transform">+42%</span>
                        <span className="text-[8px] text-[#898989]">ARR</span>
                      </div>
                    )}
                    {item.type === "cluster" && (
                      <div className="flex h-full w-full items-end justify-center gap-[2px] px-[2px] pb-[4px]">
                        <span className="w-[3px] bg-[#ff6b35] h-[60%] group-hover:h-[90%] transition-all" />
                        <span className="w-[3px] bg-emerald-400 h-[80%] group-hover:h-[60%] transition-all" />
                        <span className="w-[3px] bg-[#3b82f6] h-[40%] group-hover:h-[75%] transition-all" />
                      </div>
                    )}
                    {item.type === "radar" && (
                      <svg viewBox="0 0 24 24" className="h-[20px] w-[20px] group-hover:rotate-45 transition-transform duration-700">
                        <polygon points="12,2 22,18 2,18" fill="none" stroke="#898989" strokeWidth="1" className="group-hover:stroke-[#ff6b35]" />
                        <polygon points="12,6 18,16 6,16" fill="rgba(255,107,53,0.2)" stroke="#ff6b35" strokeWidth="1" />
                      </svg>
                    )}
                    {item.type === "matrix" && (
                      <div className="grid grid-cols-2 gap-[2px]">
                        <span className="h-[5px] w-[5px] rounded-[1px] bg-[#ff6b35]" />
                        <span className="h-[5px] w-[5px] rounded-[1px] bg-[#333333] group-hover:bg-[#ff6b35]/60 transition-colors" />
                        <span className="h-[5px] w-[5px] rounded-[1px] bg-[#333333] group-hover:bg-[#ff6b35]/40 transition-colors" />
                        <span className="h-[5px] w-[5px] rounded-[1px] bg-[#ff6b35]" />
                      </div>
                    )}
                    {item.type === "step" && (
                      <svg viewBox="0 0 28 16" className="h-[18px] w-full">
                        <polyline points="2,14 10,14 10,8 18,8 18,2 26,2" fill="none" stroke="#898989" strokeWidth="1.5" className="group-hover:stroke-[#ff6b35] transition-colors" />
                      </svg>
                    )}
                    {item.type === "gauge" && (
                      <svg viewBox="0 0 24 16" className="h-[18px] w-[24px]">
                        <path d="M 3 14 A 9 9 0 0 1 21 14" fill="none" stroke="#2a2a2a" strokeWidth="2.5" />
                        <path d="M 3 14 A 9 9 0 0 1 18 6" fill="none" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" className="group-hover:stroke-emerald-400 transition-colors" />
                      </svg>
                    )}
                    {item.type === "funnel" && (
                      <div className="flex flex-col items-center gap-[2px] w-full px-1">
                        <span className="h-[3px] w-[20px] rounded-full bg-[#ff6b35]" />
                        <span className="h-[3px] w-[14px] rounded-full bg-[#fafafa]" />
                        <span className="h-[3px] w-[8px] rounded-full bg-[#898989]" />
                      </div>
                    )}
                    {item.type === "scatter" && (
                      <div className="relative h-[20px] w-[24px]">
                        <span className="absolute left-[4px] top-[12px] h-[3px] w-[3px] rounded-full bg-[#ff6b35]" />
                        <span className="absolute left-[12px] top-[4px] h-[3.5px] w-[3.5px] rounded-full bg-[#fafafa] group-hover:animate-ping" />
                        <span className="absolute left-[18px] top-[10px] h-[3px] w-[3px] rounded-full bg-[#898989]" />
                      </div>
                    )}
                    {item.type === "table" && (
                      <div className="flex flex-col gap-[2px] w-[20px]">
                        <span className="h-[2px] w-full bg-[#ff6b35]" />
                        <span className="h-[2px] w-full bg-[#333333] group-hover:bg-[#444444]" />
                        <span className="h-[2px] w-full bg-[#333333] group-hover:bg-[#444444]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Micro-Studio Status Footer */}
            <div className="mt-auto flex items-center justify-between border-t border-[#222222] pt-[8px] text-[11px] font-mono-code text-[#898989]">
              <span className="group-hover:text-[#fafafa] transition-colors">10+ Recharts Visualizers</span>
              <span className="text-[#ff6b35]">Interactive Studio</span>
            </div>
          </BentoSpotlightCard>

          {/* CARD 5 (3 Cols): Workspace & RBAC Isolation */}
          <BentoSpotlightCard
            onClick={() => setCollabPing((p) => !p)}
            delay="620ms"
            className="md:col-span-6 lg:col-span-3 h-[400px]"
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
                  className="group-hover:text-[#ff6b35] transition-colors"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                  Workspace &amp; RBAC
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                <strong className="font-normal text-[#fafafa]">
                  Multi-tenant workspace isolation
                </strong>{" "}
                with member invitations and role permissions.
              </p>
            </div>

            {/* Live Multiplayer Grid with Glide Animations & Named Avatars */}
            <div className="relative flex h-[195px] w-full items-center justify-center overflow-hidden rounded-[11px] bg-[#141414] border border-[#242424] group-hover:border-[#333333] transition-colors">
              <svg
                viewBox="0 0 240 180"
                className="absolute inset-0 h-full w-full"
              >
                {[24, 48, 72, 96, 120, 144, 168, 192, 216].map((x) => (
                  <line
                    key={`vx-${x}`}
                    x1={x}
                    y1="0"
                    x2={x}
                    y2="180"
                    stroke="#1c1c1c"
                    strokeWidth="1"
                    className="group-hover:stroke-[#262626] transition-colors"
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
                    className="group-hover:stroke-[#262626] transition-colors"
                  />
                ))}

                {/* Collaborative selection marquee box that animates on hover */}
                <rect
                  x="72"
                  y="48"
                  width="78"
                  height="48"
                  rx="4"
                  fill="rgba(255, 107, 53, 0.08)"
                  stroke="#ff6b35"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  className="opacity-0 group-hover:opacity-100 animate-dash-flow transition-opacity duration-500"
                />

                {/* Cursor 1: Sarah (Coral) with name badge & hover glide */}
                <g
                  className="transition-transform duration-700 ease-out group-hover:translate-x-8 group-hover:-translate-y-5"
                  transform={collabPing ? "translate(62, 96)" : "translate(48, 86)"}
                >
                  <path
                    d="M0 0 L0 18 L4.5 14 L10 16 Z"
                    fill="#121212"
                    stroke="#ff6b35"
                    strokeWidth="1.5"
                  />
                  <rect x="12" y="8" width="54" height="18" rx="4" fill="#ff6b35" />
                  <text x="16" y="21" fill="#121212" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                    @Admin
                  </text>
                  <circle cx="0" cy="0" r="10" fill="none" stroke="#ff6b35" strokeWidth="1" className="opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
                </g>

                {/* Cursor 2: David (Purple) with name badge & hover glide */}
                <g
                  className="transition-transform duration-700 ease-out group-hover:-translate-x-8 group-hover:-translate-y-6"
                  transform={collabPing ? "translate(148, 120)" : "translate(156, 134)"}
                >
                  <path
                    d="M0 0 L0 16 L4 12.5 L9 14.5 Z"
                    fill="#121212"
                    stroke="#c084fc"
                    strokeWidth="1.5"
                  />
                  <rect x="11" y="7" width="58" height="18" rx="4" fill="#c084fc" />
                  <text x="15" y="20" fill="#121212" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                    @Member
                  </text>
                </g>
              </svg>

              {/* Live Presence Pill with Radar Ping */}
              <div className="relative z-10 flex items-center gap-[6px] rounded-full border border-[#4d4d4d] bg-[#242424]/90 backdrop-blur-xs px-[14px] py-[6px] group-hover:border-[#ff6b35]/60 group-hover:shadow-[0_0_16px_rgba(255,107,53,0.3)] transition-all">
                <span className="h-[5px] w-[5px] rounded-full bg-[#ff6b35] animate-ping" />
                <span className="text-[11px] font-mono-code text-[#fafafa]">
                  Org Isolated
                </span>
                <span className="text-[10px] text-[#ff6b35] font-mono-code font-semibold">(RBAC Enforced)</span>
              </div>
            </div>

            {/* Realtime collaboration footer */}
            <div className="mt-auto flex items-center justify-between border-t border-[#222222] pt-[8px] text-[11px] font-mono-code text-[#898989]">
              <span className="flex items-center gap-[5px]">
                <span className="h-[5px] w-[5px] rounded-full bg-emerald-400" />
                <span className="group-hover:text-[#fafafa] transition-colors">Multi-Tenant Workspaces</span>
              </span>
              <span className="text-[#898989]">Admin &amp; Member Roles</span>
            </div>
          </BentoSpotlightCard>

          {/* CARD 6 (3 Cols): Data Quality & Audit Ledger */}
          <BentoSpotlightCard
            delay="700ms"
            className="md:col-span-6 lg:col-span-3 h-[400px]"
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
                  className="group-hover:text-[#ff6b35] transition-colors"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                  Data Quality &amp; Audit
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                Automate schema health audits to{" "}
                <strong className="font-normal text-[#fafafa]">
                  detect null anomalies and log query activity.
                </strong>
              </p>
            </div>

            {/* Isometric Cube with Alive Floating & Vertices */}
            <div className="relative flex flex-col justify-end pt-[8px]">
              <div className="transition-transform duration-700 ease-out group-hover:scale-110 group-hover:-translate-y-2">
                <svg viewBox="0 0 240 150" className="h-[145px] w-full">
                  <polygon
                    points="120,22 174,53 174,115 120,146 66,115 66,53"
                    fill="none"
                    stroke="#4d4d4d"
                    strokeWidth="1"
                    className="group-hover:stroke-[#ff6b35]/80 transition-colors duration-500"
                  />
                  {/* Alive lineage data flow paths */}
                  <line
                    x1="120"
                    y1="22"
                    x2="174"
                    y2="53"
                    stroke="#ff6b35"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    className="opacity-0 group-hover:opacity-90 animate-dash-flow transition-opacity duration-500"
                  />
                  <line
                    x1="174"
                    y1="53"
                    x2="120"
                    y2="84"
                    stroke="#ff6b35"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    className="opacity-0 group-hover:opacity-90 animate-dash-flow transition-opacity duration-500"
                  />
                  <line
                    x1="120"
                    y1="84"
                    x2="120"
                    y2="146"
                    stroke="#ff6b35"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    className="opacity-0 group-hover:opacity-90 animate-dash-flow transition-opacity duration-500"
                  />

                  <polyline
                    points="66,53 120,84 174,53"
                    fill="none"
                    stroke="#4d4d4d"
                    strokeWidth="1"
                    className="group-hover:stroke-[#ff6b35]/80 transition-colors duration-500"
                  />
                  <line
                    x1="120"
                    y1="84"
                    x2="120"
                    y2="146"
                    stroke="#4d4d4d"
                    strokeWidth="1"
                    className="group-hover:stroke-[#ff6b35]/80 transition-colors duration-500"
                  />

                  {/* Glowing vertices with radar pings */}
                  <circle
                    cx="142"
                    cy="48"
                    r="3.5"
                    className="fill-[#ff6b35] group-hover:drop-shadow-[0_0_10px_#ff6b35] group-hover:animate-ping"
                  />
                  <circle cx="96" cy="96" r="3.5" className="fill-[#ff6b35]" />
                  <circle cx="152" cy="92" r="3.5" className="fill-[#ff6b35]" />
                  <circle cx="135" cy="60" r="3" className="fill-[#ff6b35]" />
                  <circle cx="198" cy="36" r="3" className="fill-[#fafafa] group-hover:fill-[#ff6b35] transition-colors" />
                </svg>
              </div>

              <div className="mt-[4px] flex flex-col gap-[6px] text-[12px] text-[#fafafa]">
                <div className="flex items-center gap-[8px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
                  <span>Schema Profiling Active</span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#ff6b35]" />
                  <span>Activity Audit Logged</span>
                </div>
              </div>
            </div>
          </BentoSpotlightCard>

          {/* CARD 7 (3 Cols): Signed Embeds & REST APIs */}
          <BentoSpotlightCard
            delay="780ms"
            className="md:col-span-6 lg:col-span-3 h-[400px]"
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
                  className="group-hover:text-[#ff6b35] transition-colors"
                >
                  <rect x="3" y="3" width="6" height="6" rx="1" />
                  <rect x="15" y="3" width="6" height="6" rx="1" />
                  <rect x="15" y="15" width="6" height="6" rx="1" />
                  <path d="M9 6h6M6 9v6a3 3 0 0 0 3 3h6" />
                </svg>
                <h2 className="text-[15px] font-medium whitespace-nowrap text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                  Signed Embeds &amp; APIs
                </h2>
              </div>
              <p className="mt-[12px] text-[14px] font-normal leading-[1.5] text-[#898989]">
                Instant ready-to-use{" "}
                <strong className="font-normal text-[#fafafa]">
                  signed iframe tokens and REST API endpoints.
                </strong>
              </p>
            </div>

            {/* Interactive API route rows with alive hover & latency ping */}
            <div className="flex flex-col gap-[10px] pt-[12px]">
              {[
                { table: "ai-nl-to-chart", slug: "ai/nl-to-chart", latency: "0.8s" },
                { table: "datasets", slug: "datasets/query", latency: "14ms" },
                { table: "embed-token", slug: "dashboards/embed", latency: "5ms" },
                { table: "alerts", slug: "alerts/dispatch", latency: "12ms" },
                { table: "audit", slug: "audit/activity", latency: "6ms" },
              ].map((row, idx) => {
                const isSelected = activeRouteIdx === idx;
                return (
                  <button
                    key={row.table}
                    type="button"
                    onClick={() => setActiveRouteIdx(idx)}
                    className="flex w-full items-center justify-between gap-[6px] cursor-pointer group/row transition-all duration-200"
                  >
                    <span className="shrink-0 rounded-[5px] border border-[#2e2e2e] bg-[#141414] px-[7px] py-[3px] font-mono-code text-[10px] text-[#898989] group-hover/row:border-[#ff6b35]/60 group-hover/row:text-[#fafafa] transition-colors">
                      ⊞ {row.table}
                    </span>
                    <span className="flex-1 border-b border-dashed border-[#2e2e2e] group-hover/row:border-[#ff6b35]/50 group-hover/row:border-solid transition-all" />
                    <span
                      className={`shrink-0 rounded-full border px-[8px] py-[2px] font-mono-code text-[10px] transition-colors flex items-center gap-[4px] ${isSelected
                        ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35] font-semibold"
                        : "border-[#2e2e2e] bg-[#1a1a1a] text-[#898989] group-hover/row:text-[#fafafa] group-hover/row:border-[#ff6b35]/40"
                        }`}
                    >
                      <span>.../v1/<strong className="font-normal text-[#fafafa]">{row.slug}</strong></span>
                      <span className="rounded bg-[#121212] px-[4px] py-[1px] text-[8px] text-emerald-400">{row.latency}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Embedded SDK & Uptime Footer */}
            <div className="mt-auto flex items-center justify-between border-t border-[#222222] pt-[8px] text-[11px] font-mono-code text-[#898989]">
              <span className="text-[#fafafa]">Signed Iframe Tokens</span>
              <span className="text-emerald-400 font-semibold">REST API Ready</span>
            </div>
          </BentoSpotlightCard>
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
