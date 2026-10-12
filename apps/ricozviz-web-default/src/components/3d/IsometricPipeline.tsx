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
      <div className="hidden lg:block absolute top-[52px] left-[6%] right-[6%] h-px bg-[#DADFD9] dark:bg-[#374151] -z-0" />

      {/* 6 Stage Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 relative z-10">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isSelected = selectedStage === idx;

          return (
            <div
              key={stage.step}
              onClick={() => setSelectedStage(idx)}
              className={`rounded-xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between ${
                isSelected
                  ? "bg-white dark:bg-[#1F2937] border-[#147D78] dark:border-[#4F9D8E] shadow-md ring-1 ring-[#147D78]/20 dark:ring-[#4F9D8E]/30 -translate-y-1"
                  : "bg-white dark:bg-[#1F2937] border-[#DADFD9] dark:border-[#374151] hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/50 hover:shadow-xs"
              }`}
            >
              <div>
                {/* Platform Icon Header */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                      isSelected
                        ? "bg-[#147D78] dark:bg-[#4F9D8E] text-white shadow-xs"
                        : "bg-[#F4F1EA] dark:bg-[#111827] text-[#147D78] dark:text-[#4F9D8E] border border-[#DADFD9] dark:border-[#374151]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#596775] dark:text-[#9CA3AF]">
                    {stage.step}
                  </span>
                </div>

                {/* Stage Info */}
                <h4 className="text-sm font-heading font-semibold text-[#172B3A] dark:text-[#E5E7EB] leading-tight">
                  {stage.name}
                </h4>
                <p className="text-[11px] text-[#596775] dark:text-[#9CA3AF] mt-1 font-normal leading-snug">
                  {stage.tagline}
                </p>
              </div>

              {/* Stage Bullet Details */}
              <div className="mt-4 pt-3 border-t border-[#DADFD9] dark:border-[#374151] space-y-1.5">
                {stage.details.map((item, dIdx) => (
                  <div key={dIdx} className="flex items-center gap-1.5 text-[11px] text-[#596775] dark:text-[#9CA3AF]">
                    <Check className="h-3 w-3 text-[#147D78] dark:text-[#4F9D8E] shrink-0" />
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
