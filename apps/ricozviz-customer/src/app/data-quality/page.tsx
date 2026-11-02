"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  Layers,
  Percent,
  Copy,
  Hash,
  Database,
  Calendar,
  AlertOctagon,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { AppShell } from "../../components/shell/AppShell";
import {
  apiListDatasets,
  apiProfileDataset,
  type DatasetData,
  type DatasetProfileResult,
  type ColumnProfile,
} from "../../lib/api";

export default function DataQualityPage() {
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [profile, setProfile] = useState<DatasetProfileResult | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [profiling, setProfiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnSearch, setColumnSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    async function loadDatasets() {
      try {
        setLoadingDatasets(true);
        const data = await apiListDatasets();
        setDatasets(data);
        if (data.length > 0) {
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const queryDsId = params.get("datasetId");
            if (queryDsId && data.some((d) => d.id === queryDsId)) {
              setSelectedDatasetId(queryDsId);
              return;
            }
          }
          setSelectedDatasetId(data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load datasets");
      } finally {
        setLoadingDatasets(false);
      }
    }
    loadDatasets();
  }, []);

  useEffect(() => {
    if (selectedDatasetId) {
      runProfiling(selectedDatasetId, false);
    }
  }, [selectedDatasetId]);

  async function runProfiling(datasetId: string, force = false) {
    try {
      setProfiling(true);
      setError(null);
      const res = await apiProfileDataset(datasetId, force);
      setProfile(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to profile dataset");
      setProfile(null);
    } finally {
      setProfiling(false);
    }
  }

  const filteredColumns = (profile?.columns || []).filter((col) => {
    const matchesSearch = col.name.toLowerCase().includes(columnSearch.toLowerCase());
    const matchesType = typeFilter === "ALL" || col.type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  const summary = profile?.summary;
  const qualityScore = profile?.qualityScore ?? summary?.dataQualityScore ?? 100;
  const grade = summary?.grade ?? (qualityScore >= 90 ? "EXCELLENT" : qualityScore >= 75 ? "GOOD" : qualityScore >= 50 ? "FAIR" : "POOR");

  return (
    <AppShell
      title="Data Quality & Structural Intelligence"
      subtitle="Automated data intelligence: structural profiling, completeness, duplicate detection, type integrity, and statistical anomaly scores."
      breadcrumbs={[
        { label: "Data Studio", href: "/datasets" },
        { label: "Data Quality" },
      ]}
      actions={
        <div className="flex items-center gap-2.5">
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            disabled={loadingDatasets || profiling}
            className="rounded-lg border border-[#2e2e2e] bg-[#141414] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code disabled:opacity-50 min-w-[200px]"
          >
            {datasets.length === 0 ? (
              <option value="">No datasets found</option>
            ) : (
              datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.rowCount ?? 0} rows)
                </option>
              ))
            )}
          </select>

          <button
            onClick={() => selectedDatasetId && runProfiling(selectedDatasetId, true)}
            disabled={!selectedDatasetId || profiling}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] disabled:opacity-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${profiling ? "animate-spin" : ""}`} />
            <span>{profiling ? "Profiling..." : "Refresh Profile"}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs font-mono-code text-red-300 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {profiling && !profile && (
          <div className="py-24 text-center space-y-3 font-mono-code text-xs text-[#898989]">
            <div className="inline-block p-4 rounded-2xl bg-[#141414] border border-[#242424] animate-pulse">
              <RefreshCw className="w-6 h-6 text-[#ff6b35] animate-spin" />
            </div>
            <p>Analyzing schema distributions and outlier metrics in DuckDB WASM...</p>
          </div>
        )}

        {profile && (
          <>
            {/* Overall Dataset Quality View (5 Primary Pillars) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. Data Quality Score */}
              <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#898989] font-mono-code">
                  <span>QUALITY SCORE</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-code font-bold uppercase ${
                      grade === "EXCELLENT"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : grade === "GOOD"
                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                        : grade === "FAIR"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {grade}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-bold font-mono-code ${
                      qualityScore >= 80
                        ? "text-emerald-400"
                        : qualityScore >= 60
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {qualityScore}
                  </span>
                  <span className="text-xs text-[#898989] font-mono-code">/ 100</span>
                </div>
                <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      qualityScore >= 80
                        ? "bg-emerald-500"
                        : qualityScore >= 60
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${qualityScore}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#898989] font-mono-code">
                  {profile.totalRows.toLocaleString()} rows · {profile.totalColumns} cols
                </div>
              </div>

              {/* 2. Completeness / Missing Data */}
              <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#898989] font-mono-code">
                  <span>COMPLETENESS</span>
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono-code text-[#fafafa]">
                    {profile.completenessPercentage !== undefined ? `${profile.completenessPercentage}%` : `${100 - (summary?.missingDataPercentage ?? 0)}%`}
                  </span>
                  <span className="text-xs text-[#898989] font-mono-code">
                    ({summary?.missingDataCount.toLocaleString() ?? 0} nulls)
                  </span>
                </div>
                <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${profile.completenessPercentage ?? (100 - (summary?.missingDataPercentage ?? 0))}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#898989] font-mono-code">
                  {(summary?.missingDataCount ?? 0) === 0 ? "Complete data records" : `${summary?.missingDataPercentage ?? 0}% missing cells`}
                </div>
              </div>

              {/* 3. Duplicates */}
              <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#898989] font-mono-code">
                  <span>DUPLICATES</span>
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-bold font-mono-code ${
                      profile.duplicateRowsCount > 0 ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {profile.duplicateRowsCount}
                  </span>
                  {profile.totalRows > 0 && (
                    <span className="text-xs text-[#898989] font-mono-code">
                      ({summary ? summary.duplicateRowsPercentage : Math.round((profile.duplicateRowsCount / profile.totalRows) * 100)}%)
                    </span>
                  )}
                </div>
                <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-500"
                    style={{ width: `${Math.min((summary?.duplicateRowsPercentage ?? 0) * 5, 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#898989] font-mono-code">
                  {profile.duplicateRowsCount === 0 ? "Zero redundant records" : "Identical rows detected"}
                </div>
              </div>

              {/* 4. Type & Validity Issues */}
              <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#898989] font-mono-code">
                  <span>TYPE ISSUES</span>
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-bold font-mono-code ${
                      (summary?.typeIssuesCount ?? 0) > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {summary?.typeIssuesCount ?? 0}
                  </span>
                  <span className="text-xs text-[#898989] font-mono-code">invalid values</span>
                </div>
                <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${Math.min((summary?.typeIssuesCount ?? 0) * 10, 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#898989] font-mono-code">
                  {(summary?.typeIssuesCount ?? 0) === 0 ? "All types strictly valid" : "Type mismatch detected"}
                </div>
              </div>

              {/* 5. Potential Outliers */}
              <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#898989] font-mono-code">
                  <span>OUTLIERS</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#ff6b35]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono-code text-[#ff6b35]">
                    {summary?.potentialOutliersCount ?? 0}
                  </span>
                  <span className="text-xs text-[#898989] font-mono-code">records</span>
                </div>
                <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ff6b35] transition-all duration-500"
                    style={{ width: `${Math.min((summary?.potentialOutliersCount ?? 0) * 5, 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#898989] font-mono-code">1.5x IQR statistical fence rule</div>
              </div>
            </div>

            {/* Score Breakdown & Type Distribution Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Score Breakdown (Deterministic 4 Pillars) */}
              <div className="lg:col-span-2 p-5 rounded-xl border border-[#242424] bg-[#141414] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono-code font-semibold uppercase text-[#fafafa] tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Deterministic Score Breakdown (4 Pillars)
                  </span>
                  <span className="text-[11px] font-mono-code text-[#898989]">
                    Formula: (C×0.35) + (V×0.25) + (U×0.20) + (S×0.20)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-[#181818] border border-[#262626] space-y-1">
                    <div className="text-[11px] text-[#898989] font-mono-code flex justify-between">
                      <span>Completeness</span>
                      <span className="text-[#666666]">35%</span>
                    </div>
                    <div className="text-lg font-bold font-mono-code text-emerald-400">
                      {profile.scoreBreakdown?.completeness ?? 100}%
                    </div>
                    <div className="text-[10px] text-[#898989] font-mono-code">Non-null values</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#181818] border border-[#262626] space-y-1">
                    <div className="text-[11px] text-[#898989] font-mono-code flex justify-between">
                      <span>Validity</span>
                      <span className="text-[#666666]">25%</span>
                    </div>
                    <div className="text-lg font-bold font-mono-code text-cyan-400">
                      {profile.scoreBreakdown?.validity ?? 100}%
                    </div>
                    <div className="text-[10px] text-[#898989] font-mono-code">Type & format match</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#181818] border border-[#262626] space-y-1">
                    <div className="text-[11px] text-[#898989] font-mono-code flex justify-between">
                      <span>Uniqueness</span>
                      <span className="text-[#666666]">20%</span>
                    </div>
                    <div className="text-lg font-bold font-mono-code text-[#ff6b35]">
                      {profile.scoreBreakdown?.uniqueness ?? 100}%
                    </div>
                    <div className="text-[10px] text-[#898989] font-mono-code">Non-duplicate rows</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#181818] border border-[#262626] space-y-1">
                    <div className="text-[11px] text-[#898989] font-mono-code flex justify-between">
                      <span>Consistency</span>
                      <span className="text-[#666666]">20%</span>
                    </div>
                    <div className="text-lg font-bold font-mono-code text-amber-400">
                      {profile.scoreBreakdown?.consistency ?? 100}%
                    </div>
                    <div className="text-[10px] text-[#898989] font-mono-code">No casing / range conflicts</div>
                  </div>
                </div>
              </div>

              {/* Data Type Distribution */}
              <div className="p-5 rounded-xl border border-[#242424] bg-[#141414] space-y-3">
                <span className="text-xs font-mono-code font-semibold uppercase text-[#fafafa] tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#ff6b35]" />
                  Data-Type Distribution
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {profile.dataTypeDistribution && Object.keys(profile.dataTypeDistribution).length > 0 ? (
                    Object.entries(profile.dataTypeDistribution).map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181818] border border-[#262626] text-xs font-mono-code"
                      >
                        <span className="uppercase text-[#898989]">{type}:</span>
                        <span className="font-bold text-[#fafafa]">{count} cols</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-[#898989] font-mono-code">No type metrics available</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quality Warnings Section */}
            {profile.warnings.length > 0 && (
              <div className="p-5 rounded-xl border border-[#242424] bg-[#141414] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#fafafa]">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Quality Warnings & Integrity Alerts ({profile.warnings.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs font-mono-code flex items-start gap-2.5 ${
                        w.severity === "HIGH"
                          ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                          : w.severity === "MEDIUM"
                          ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                          : "bg-[#181818] border-[#262626] text-[#fafafa]"
                      }`}
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase font-bold text-[10px] tracking-wide ${
                          w.severity === "HIGH"
                            ? "bg-rose-500 text-white"
                            : w.severity === "MEDIUM"
                            ? "bg-amber-500 text-black"
                            : "bg-[#262626] text-[#898989]"
                        }`}
                      >
                        {w.severity}
                      </span>
                      <div className="space-y-0.5">
                        {w.column && (
                          <span className="font-semibold underline mr-1 text-[#ff6b35]">{w.column}:</span>
                        )}
                        <span>{w.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Column Profiles Filter & Search */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-base font-bold text-[#fafafa] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#ff6b35]" />
                  <span>Column-Level Profiling & Statistics ({filteredColumns.length})</span>
                </h2>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#898989] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search column..."
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      className="bg-[#141414] border border-[#242424] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                    />
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-[#141414] border border-[#242424] rounded-lg px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  >
                    <option value="ALL">All Types</option>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="date">Date / Time</option>
                  </select>
                </div>
              </div>

              {/* Column Table */}
              <div className="rounded-xl border border-[#242424] bg-[#141414] overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#181818] border-b border-[#242424] text-[#898989] font-mono-code uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 font-semibold">Column Name</th>
                        <th className="py-3 px-4 font-semibold">Type</th>
                        <th className="py-3 px-4 font-semibold">Missing / Nulls</th>
                        <th className="py-3 px-4 font-semibold">Unique Values</th>
                        <th className="py-3 px-4 font-semibold">Statistics (Min / Max / Mean / Med)</th>
                        <th className="py-3 px-4 font-semibold">Top Frequencies</th>
                        <th className="py-3 px-4 font-semibold">Invalid</th>
                        <th className="py-3 px-4 font-semibold">Outliers</th>
                        <th className="py-3 px-4 font-semibold">Samples</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242424] font-mono-code text-xs">
                      {filteredColumns.map((col) => (
                        <tr key={col.name} className="hover:bg-[#181818]/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#fafafa]">
                            {col.name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-[#181818] border border-[#2e2e2e] text-[#ff6b35] font-semibold text-[10px]">
                              {col.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className={col.nullCount > 0 ? "text-amber-400 font-semibold" : "text-[#898989]"}>
                                  {col.nullCount} nulls
                                </span>
                                <span className="text-[#666666]">{col.nullPercentage}%</span>
                              </div>
                              <div className="w-24 bg-[#242424] h-1 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    col.nullPercentage > 40
                                      ? "bg-rose-500"
                                      : col.nullPercentage > 10
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(col.nullPercentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[#fafafa]">{col.uniqueCount} distinct</span>
                            <span className="text-[#898989] text-[10px] ml-1.5">
                              ({col.uniquePercentage}%)
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {col.min !== undefined && col.min !== null ? (
                              <div className="text-[11px] space-y-0.5">
                                <div>
                                  <span className="text-[#666666]">Min:</span> {col.min}{" "}
                                  <span className="text-[#666666] ml-1">Max:</span> {col.max}
                                </div>
                                <div>
                                  <span className="text-[#666666]">Mean:</span> {col.avg}{" "}
                                  <span className="text-[#666666] ml-1">Med:</span> {col.median}
                                </div>
                                {col.stdDev !== undefined && (
                                  <div>
                                    <span className="text-[#666666]">StdDev:</span> {col.stdDev}
                                  </div>
                                )}
                              </div>
                            ) : col.minDate ? (
                              <div className="text-[11px] space-y-0.5">
                                <div className="truncate max-w-[150px]">
                                  <span className="text-[#666666]">Min:</span> {col.minDate.slice(0, 10)}
                                </div>
                                <div className="truncate max-w-[150px]">
                                  <span className="text-[#666666]">Max:</span> {col.maxDate?.slice(0, 10)}
                                </div>
                                {col.invalidDates !== undefined && col.invalidDates > 0 && (
                                  <div className="text-rose-400 text-[10px]">
                                    Invalid dates: {col.invalidDates}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#666666] text-[11px]">—</span>
                            )}
                          </td>
                          {/* Categorical Distribution / Top Values */}
                          <td className="py-3 px-4">
                            {col.topValues && col.topValues.length > 0 ? (
                              <div className="space-y-1 max-w-[200px]">
                                {col.topValues.slice(0, 3).map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[11px]">
                                    <span className="text-[#fafafa] truncate max-w-[110px]" title={item.value}>
                                      {item.value}
                                    </span>
                                    <span className="text-[#898989] text-[10px]">
                                      {item.count} ({item.percentage}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#666666] text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {col.invalidCount !== undefined && col.invalidCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 font-semibold border border-rose-500/40 text-[10px]">
                                {col.invalidCount} invalid ({col.invalidPercentage}%)
                              </span>
                            ) : (
                              <span className="text-[#666666] text-[11px]">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {col.outliersCount !== undefined && col.outliersCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 font-semibold border border-amber-500/40 text-[10px]">
                                {col.outliersCount} outliers
                              </span>
                            ) : (
                              <span className="text-[#666666] text-[11px]">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {col.sampleValues.slice(0, 3).map((val, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-[#181818] border border-[#2e2e2e] text-[10px] text-[#fafafa] truncate max-w-[80px]"
                                  title={String(val)}
                                >
                                  {String(val)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
