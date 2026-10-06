"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowLeft,
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
} from "lucide-react";
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
          // Check URL query param ?datasetId=...
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link
                href="/workspace"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Back to Workspace"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
                Data Quality & Profiling
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Automated data intelligence: structural profiling, completeness, duplicate detection, type integrity, and statistical anomaly scores.
            </p>
          </div>

          {/* Dataset Selector and Refresh */}
          <div className="flex items-center gap-3">
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              disabled={loadingDatasets || profiling}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 min-w-[240px]"
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
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-medium rounded-lg text-sm transition-colors shadow-lg shadow-emerald-950/40"
            >
              <RefreshCw className={`w-4 h-4 ${profiling ? "animate-spin" : ""}`} />
              {profiling ? "Profiling..." : "Refresh Profile"}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {profiling && !profile && (
          <div className="py-24 text-center space-y-4">
            <div className="inline-block p-4 rounded-full bg-slate-900 animate-pulse border border-slate-800">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
            <p className="text-slate-400 text-sm">Analyzing schema distributions and outlier metrics...</p>
          </div>
        )}

        {profile && (
          <>
            {/* Overall Dataset Quality View (5 Primary Pillars) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. Data Quality Score */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>DATA QUALITY SCORE</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      grade === "EXCELLENT"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : grade === "GOOD"
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : grade === "FAIR"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {grade}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold ${
                      qualityScore >= 80
                        ? "text-emerald-400"
                        : qualityScore >= 60
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {qualityScore}
                  </span>
                  <span className="text-xs text-slate-500">/ 100</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
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
                <div className="text-[11px] text-slate-500">
                  {profile.totalRows.toLocaleString()} rows · {profile.totalColumns} cols
                </div>
              </div>

              {/* 2. Missing Data */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>MISSING DATA</span>
                  <Percent className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {summary ? `${summary.missingDataPercentage}%` : "0%"}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({summary?.missingDataCount.toLocaleString() ?? 0} nulls)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${Math.min(summary?.missingDataPercentage ?? 0, 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  {(summary?.missingDataPercentage ?? 0) === 0 ? "Complete data records" : "Sparse cells detected"}
                </div>
              </div>

              {/* 3. Duplicates */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>DUPLICATES</span>
                  <Copy className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold ${
                      profile.duplicateRowsCount > 0 ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {profile.duplicateRowsCount}
                  </span>
                  {profile.totalRows > 0 && (
                    <span className="text-xs text-slate-500">
                      ({summary ? summary.duplicateRowsPercentage : Math.round((profile.duplicateRowsCount / profile.totalRows) * 100)}%)
                    </span>
                  )}
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-500"
                    style={{ width: `${Math.min((summary?.duplicateRowsPercentage ?? 0) * 5, 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  {profile.duplicateRowsCount === 0 ? "Zero redundant records" : "Identical rows detected"}
                </div>
              </div>

              {/* 4. Type Issues */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>TYPE ISSUES</span>
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold ${
                      (summary?.typeIssuesCount ?? 0) > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {summary?.typeIssuesCount ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">invalid values</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${Math.min((summary?.typeIssuesCount ?? 0) * 10, 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  {(summary?.typeIssuesCount ?? 0) === 0 ? "All types strictly valid" : "Type mismatch detected"}
                </div>
              </div>

              {/* 5. Potential Outliers */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>POTENTIAL OUTLIERS</span>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-indigo-300">
                    {summary?.potentialOutliersCount ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">records</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.min((summary?.potentialOutliersCount ?? 0) * 5, 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500">1.5x IQR statistical fence rule</div>
              </div>
            </div>

            {/* Quality Warnings Section */}
            {profile.warnings.length > 0 && (
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Quality Warnings & Integrity Alerts ({profile.warnings.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                        w.severity === "HIGH"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          : w.severity === "MEDIUM"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          : "bg-slate-800/60 border-slate-700 text-slate-300"
                      }`}
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase font-bold text-[10px] tracking-wide ${
                          w.severity === "HIGH"
                            ? "bg-rose-500 text-white"
                            : w.severity === "MEDIUM"
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {w.severity}
                      </span>
                      <div className="space-y-0.5">
                        {w.column && (
                          <span className="font-semibold underline mr-1">{w.column}:</span>
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
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  Column-Level Profiling & Statistics ({filteredColumns.length})
                </h2>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search column..."
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Column Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Missing / Nulls</th>
                        <th className="py-3 px-4">Unique Values</th>
                        <th className="py-3 px-4">Statistics (Min / Max / Mean / Median)</th>
                        <th className="py-3 px-4">Invalid Values</th>
                        <th className="py-3 px-4">Outliers</th>
                        <th className="py-3 px-4">Sample Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {filteredColumns.map((col) => (
                        <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-200">
                            {col.name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-medium">
                              {col.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-sans">
                                <span className={col.nullCount > 0 ? "text-amber-400 font-medium" : "text-slate-400"}>
                                  {col.nullCount} nulls
                                </span>
                                <span className="text-slate-500">{col.nullPercentage}%</span>
                              </div>
                              <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
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
                            <span className="text-slate-300">{col.uniqueCount} distinct</span>
                            <span className="text-slate-500 text-[10px] ml-1.5">
                              ({col.uniquePercentage}%)
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {col.min !== undefined && col.min !== null ? (
                              <div className="text-[11px] space-y-0.5 font-sans">
                                <div>
                                  <span className="text-slate-500">Min:</span> {col.min}{" "}
                                  <span className="text-slate-500 ml-1">Max:</span> {col.max}
                                </div>
                                <div>
                                  <span className="text-slate-500">Mean:</span> {col.avg}{" "}
                                  <span className="text-slate-500 ml-1">Med:</span> {col.median}
                                </div>
                              </div>
                            ) : col.minDate ? (
                              <div className="text-[11px] space-y-0.5 font-sans">
                                <div className="truncate max-w-[150px]">
                                  <span className="text-slate-500">Min:</span> {col.minDate.slice(0, 10)}
                                </div>
                                <div className="truncate max-w-[150px]">
                                  <span className="text-slate-500">Max:</span> {col.maxDate?.slice(0, 10)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px] font-sans">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {col.invalidCount !== undefined && col.invalidCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40 text-[10px]">
                                {col.invalidCount} invalid ({col.invalidPercentage}%)
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px] font-sans">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {col.outliersCount !== undefined && col.outliersCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 text-[10px]">
                                {col.outliersCount} outliers
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px] font-sans">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {col.sampleValues.slice(0, 3).map((val, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 truncate max-w-[90px]"
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
    </div>
  );
}
