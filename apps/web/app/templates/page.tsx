"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate,
  ArrowLeft,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Layers,
  Sparkles,
  ExternalLink,
  X,
  Database,
} from "lucide-react";
import {
  apiListTemplates,
  apiInstantiateDashboardFromTemplate,
  apiListDatasets,
  type DashboardTemplateData,
  type DatasetData,
} from "../../lib/api";

const CATEGORIES = ["All", "Sales", "Marketing", "Finance", "Operations", "Executive"];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<DashboardTemplateData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview Modal
  const [previewTemplate, setPreviewTemplate] = useState<DashboardTemplateData | null>(null);

  // Instantiate Modal
  const [instantiateTemplate, setInstantiateTemplate] = useState<DashboardTemplateData | null>(null);
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardDesc, setDashboardDesc] = useState("");
  const [targetDatasetId, setTargetDatasetId] = useState("");
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [instantiating, setInstantiating] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiListTemplates(selectedCategory);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard templates");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadTemplates();
    apiListDatasets()
      .then((ds) => {
        setDatasets(ds);
        if (ds.length > 0) setTargetDatasetId(ds[0].id);
      })
      .catch(() => {});
  }, [loadTemplates]);

  function handleOpenInstantiate(template: DashboardTemplateData) {
    setInstantiateTemplate(template);
    setDashboardName(`${template.name} Copy`);
    setDashboardDesc(template.description || "");
  }

  async function handleInstantiateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instantiateTemplate || !dashboardName.trim()) return;

    try {
      setInstantiating(true);
      setError(null);
      const newDashboard = await apiInstantiateDashboardFromTemplate(instantiateTemplate.id, {
        name: dashboardName.trim(),
        description: dashboardDesc.trim() || undefined,
        targetDatasetId: targetDatasetId || undefined,
      });

      router.push(`/dashboards/${newDashboard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to instantiate dashboard from template");
      setInstantiating(false);
    }
  }

  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tpl.description && tpl.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
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
                <LayoutTemplate className="w-8 h-8 text-indigo-400" />
                Dashboard Templates Gallery
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Accelerate analytics with curated enterprise templates. Create independent cloned dashboards with a single click.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter bar & search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full md:w-64"
            />
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Loading template gallery...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm">No templates found in this category.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-all overflow-hidden flex flex-col group shadow-lg shadow-black/40"
              >
                {/* Visual Header / Banner */}
                <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800/60 to-indigo-950/40 border-b border-slate-800/80 relative">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {template.category}
                    </span>
                    {template.isSystem && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        System Certified
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {template.description}
                  </p>
                </div>

                {/* Widget summary & Actions */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                      {template.chartsConfig?.length || 0} Built-in Charts
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      Responsive 12-Col Grid
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleOpenInstantiate(template)}
                      className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-950/50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Use Template
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Template Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {previewTemplate.category} Template
                  </span>
                  <h2 className="text-xl font-bold text-white">{previewTemplate.name}</h2>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {previewTemplate.description}
              </p>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Configured Visualization Widgets ({previewTemplate.chartsConfig?.length || 0})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {previewTemplate.chartsConfig?.map((chart, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-200">{chart.title}</div>
                        {chart.description && (
                          <div className="text-[11px] text-slate-500">{chart.description}</div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-indigo-300 font-mono text-[10px] uppercase">
                        {chart.chartType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const t = previewTemplate;
                    setPreviewTemplate(null);
                    handleOpenInstantiate(t);
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-950/40"
                >
                  Instantiate This Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instantiate Modal */}
        {instantiateTemplate && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Create Dashboard from Template</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cloning from: <span className="text-indigo-400">{instantiateTemplate.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setInstantiateTemplate(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInstantiateSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Dashboard Name</label>
                  <input
                    type="text"
                    required
                    value={dashboardName}
                    onChange={(e) => setDashboardName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={dashboardDesc}
                    onChange={(e) => setDashboardDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Connect Initial Dataset (Optional)
                  </label>
                  <select
                    value={targetDatasetId}
                    onChange={(e) => setTargetDatasetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None (Configure charts manually)</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.rowCount ?? 0} rows)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-400" />
                  <span>
                    This creates an independent workspace dashboard. Any customizations or additions will NOT modify the underlying template.
                  </span>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInstantiateTemplate(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={instantiating || !dashboardName.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-950/50 flex items-center gap-2"
                  >
                    {instantiating ? "Creating Dashboard..." : "Create Independent Dashboard"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
