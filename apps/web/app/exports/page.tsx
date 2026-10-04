"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  Image as ImageIcon,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Layers,
  Database,
  LayoutDashboard,
  Filter,
} from "lucide-react";
import {
  apiListDatasets,
  apiListDashboards,
  apiExportResource,
  apiListExportHistory,
  type DatasetData,
  type DashboardData,
  type ExportFormat,
  type ExportResourceType,
  type ExportJobData,
} from "../../lib/api";
import { downloadCsv } from "../../lib/export-csv";

export default function ExportCenterPage() {
  const [resourceType, setResourceType] = useState<ExportResourceType>("DATASET");
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("CSV");
  const [rowLimit, setRowLimit] = useState<number>(5000);
  const [exporting, setExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<ExportJobData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [dsData, dashRes] = await Promise.all([
          apiListDatasets().catch(() => []),
          apiListDashboards().catch(() => ({ dashboards: [] })),
        ]);
        const dashList = Array.isArray(dashRes) ? dashRes : (dashRes?.dashboards || []);
        setDatasets(dsData);
        setDashboards(dashList);

        if (resourceType === "DATASET" && dsData.length > 0) {
          setSelectedResourceId(dsData[0].id);
        } else if (resourceType === "DASHBOARD" && dashList.length > 0) {
          setSelectedResourceId(dashList[0].id);
        }
      } catch (err) {
        setErrorMessage("Failed to load export resources");
      }
    }
    loadData();
    loadExportHistory();
  }, []);

  useEffect(() => {
    if (resourceType === "DATASET" && datasets.length > 0) {
      setSelectedResourceId(datasets[0].id);
    } else if (resourceType === "DASHBOARD" && dashboards.length > 0) {
      setSelectedResourceId(dashboards[0].id);
    }
  }, [resourceType, datasets, dashboards]);

  async function loadExportHistory() {
    try {
      setLoadingHistory(true);
      const res = await apiListExportHistory();
      setHistory(res);
    } catch {
      // non-fatal
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleExport() {
    if (!selectedResourceId) {
      setErrorMessage("Please select a resource to export");
      return;
    }

    try {
      setExporting(true);
      setErrorMessage(null);
      setStatusMessage("Generating export file...");

      const res = await apiExportResource({
        resourceType,
        resourceId: selectedResourceId,
        format,
        options: {
          rowLimit,
          includeHeaders: true,
        },
      });

      // Browser trigger download
      if (format === "CSV" && res.textContent) {
        downloadCsv(res.filename, res.textContent);
      } else if (format === "EXCEL" && res.dataBase64) {
        const byteCharacters = atob(res.dataBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: res.contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if ((format === "PDF" || format === "PNG") && res.dataBase64) {
        const byteCharacters = atob(res.dataBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: res.contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setStatusMessage(`Successfully generated ${res.filename} (${(res.fileSizeBytes / 1024).toFixed(1)} KB)`);
      loadExportHistory();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
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
                <Download className="w-8 h-8 text-cyan-400" />
                Advanced Export Center
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Centralized export engine for Datasets, Visualizations, and Dashboards in CSV, Excel, PDF, and PNG formats.
            </p>
          </div>
        </div>

        {/* Feedback messages */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Export Configuration Card */}
        <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-400" />
            Export Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Resource Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                1. Resource Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResourceType("DATASET")}
                  className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    resourceType === "DATASET"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/50"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <Database className="w-4 h-4" />
                  Dataset
                </button>
                <button
                  type="button"
                  onClick={() => setResourceType("DASHBOARD")}
                  className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    resourceType === "DASHBOARD"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/50"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
              </div>
            </div>

            {/* Target Resource Dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                2. Select Target Item
              </label>
              <select
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {resourceType === "DATASET" ? (
                  datasets.length === 0 ? (
                    <option value="">No datasets available</option>
                  ) : (
                    datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.rowCount ?? 0} rows)
                      </option>
                    ))
                  )
                ) : dashboards.length === 0 ? (
                  <option value="">No dashboards available</option>
                ) : (
                  dashboards.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Row Limit */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Row Limit Safeguard
              </label>
              <select
                value={rowLimit}
                onChange={(e) => setRowLimit(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value={1000}>1,000 rows (Fast)</option>
                <option value={5000}>5,000 rows (Standard)</option>
                <option value={15000}>15,000 rows (Comprehensive)</option>
                <option value={25000}>25,000 rows (Max Limit)</option>
              </select>
            </div>
          </div>

          {/* Export Format Selector */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              3. Select Export Format
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: "CSV" as ExportFormat, label: "CSV (.csv)", icon: FileCode, desc: "Standard RFC 4180 format" },
                { key: "EXCEL" as ExportFormat, label: "Excel (.xlsx)", icon: FileSpreadsheet, desc: "Formatted workbook sheets" },
                { key: "PDF" as ExportFormat, label: "PDF Document", icon: FileText, desc: "Formatted report snapshot" },
                { key: "PNG" as ExportFormat, label: "PNG Image", icon: ImageIcon, desc: "Visual graphics export" },
              ].map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = format === fmt.key;
                return (
                  <div
                    key={fmt.key}
                    onClick={() => setFormat(fmt.key)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-cyan-500/10 border-cyan-500 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-cyan-500 text-slate-950 font-bold" : "bg-slate-800"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-100">{fmt.label}</div>
                        <div className="text-[11px] text-slate-500">{fmt.desc}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Trigger */}
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleExport}
              disabled={exporting || !selectedResourceId}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-cyan-950/50"
            >
              <Download className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />
              {exporting ? "Generating Export..." : `Export ${format} Now`}
            </button>
          </div>
        </div>

        {/* Export History Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Recent Export Activity & Downloads
            </h2>
            <button
              onClick={loadExportHistory}
              disabled={loadingHistory}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 p-1.5 rounded hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              Refresh History
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No exports have been recorded yet in this workspace.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Resource</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4">Rows</th>
                      <th className="py-3 px-4">File Size</th>
                      <th className="py-3 px-4">Triggered By</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {history.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-200">
                          {job.resourceName}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                            {job.resourceType}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {job.format}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          {job.rowCount !== undefined ? job.rowCount.toLocaleString() : "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {job.fileSize ? `${(job.fileSize / 1024).toFixed(1)} KB` : "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {job.user?.name || job.user?.email || "User"}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              job.status === "COMPLETED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : job.status === "PROCESSING"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
