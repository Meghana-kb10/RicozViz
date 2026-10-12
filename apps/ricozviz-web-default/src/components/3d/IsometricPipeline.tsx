"use client";

import React, { useState } from "react";
import {
  Database,
  Layers,
  Filter,
  BarChart3,
  LayoutDashboard,
  TrendingUp,
  Check,
} from "lucide-react";

interface PipelineStage {
  step: string;
  name: string;
  tagline: string;
  details: string[];
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const STAGES: PipelineStage[] = [
  {
    step: "01",
    name: "Data Sources",
    tagline: "Secure Ingestion & Pooling",
    details: ["PostgreSQL SSL connection", "CSV streaming parser", "Encrypted credentials"],
    icon: Database,
    accentColor: "indigo",
  },
  {
    step: "02",
    name: "Datasets",
    tagline: "Automated Schema Discovery",
    details: ["Type inference & mapping", "Column nullability check", "Preview sampling"],
    icon: Layers,
    accentColor: "cyan",
  },
  {
    step: "03",
    name: "Exploration",
    tagline: "Safe Analytical Engine",
    details: ["Parameterized filters", "Allow-listed aggregations", "Sub-15ms response"],
    icon: Filter,
    accentColor: "emerald",
  },
  {
    step: "04",
    name: "Visualizations",
    tagline: "Interactive Studio Studio",
    details: ["8 core chart renderers", "Dimension/Measure mapping", "Live query preview"],
    icon: BarChart3,
    accentColor: "blue",
  },
  {
    step: "05",
    name: "Dashboards",
    tagline: "Multi-Canvas Assembly",
    details: ["Responsive grid layout", "Tenant-scoped visibility", "Draft/Publish workflow"],
    icon: LayoutDashboard,
    accentColor: "purple",
  },
  {
    step: "06",
    name: "Decisions",
    tagline: "Governed Intelligence",
    details: ["Role-based access matrix", "Immutable audit trail", "Cross-team alignment"],
    icon: TrendingUp,
    accentColor: "emerald",
  },
];

export function IsometricPipeline() {
  const [selectedStage, setSelectedStage] = useState<number>(2);

  return (
    <div className="relative">
      {/* Horizontal Connected Conduit on Desktop */}
      <div className="hidden lg:block absolute top-[52px] left-[6%] right-[6%] h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 opacity-40 shadow-[0_0_12px_rgba(99,102,241,0.5)] -z-0" />

      {/* 6 Isometric Stage Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 relative z-10">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isSelected = selectedStage === idx;

          return (
            <div
              key={stage.step}
              onClick={() => setSelectedStage(idx)}
              className={`rounded-2xl p-4 transition-all duration-300 cursor-pointer border flex flex-col justify-between ${
                isSelected
                  ? "bg-[#131B2E] border-indigo-500 shadow-xl shadow-indigo-500/15 ring-1 ring-indigo-500/30 -translate-y-1"
                  : "bg-[#0F172A]/90 border-white/[0.08] hover:border-indigo-500/40 hover:bg-[#131B2E] hover:shadow-lg hover:shadow-indigo-950/40"
              }`}
            >
              <div>
                {/* 3D Isometric Platform Icon Header */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition shadow-xs ${
                      isSelected
                        ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-800/80 text-indigo-400 border border-white/5"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {stage.step}
                  </span>
                </div>

                {/* Stage Info */}
                <h4 className="text-sm font-bold text-white leading-tight">
                  {stage.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 font-medium leading-snug">
                  {stage.tagline}
                </p>
              </div>

              {/* Stage Bullet Details */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5">
                {stage.details.map((item, dIdx) => (
                  <div key={dIdx} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                    <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
