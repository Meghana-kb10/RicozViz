"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate,
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
  ArrowRight,
} from "lucide-react";
import { AppShell } from "../../components/shell/AppShell";
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
  }, [loadTemplates]);

  useEffect(() => {
    apiListDatasets()
      .then(setDatasets)
      .catch(() => {});
  }, []);

  function handleOpenInstantiate(template: DashboardTemplateData) {
    setInstantiateTemplate(template);
    setDashboardName(`${template.name} (Production)`);
    setDashboardDesc(template.description || "");
    setTargetDatasetId(datasets[0]?.id || "");
  }

  async function handleInstantiateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instantiateTemplate || !dashboardName.trim()) return;

    try {
      setInstantiating(true);
      const newDash = await apiInstantiateDashboardFromTemplate(instantiateTemplate.id, {
        name: dashboardName.trim(),
        description: dashboardDesc.trim() || undefined,
        targetDatasetId: targetDatasetId || undefined,
      });
      router.push(`/dashboards/${newDash.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to instantiate template");
      setInstantiating(false);
    }
  }

  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
  });

  return (
    <AppShell
      title="Dashboard Templates Gallery"
      subtitle="Accelerate analytics with curated enterprise templates. Create independent cloned dashboards with a single click."
      breadcrumbs={[
        { label: "Data Studio", href: "/datasets" },
        { label: "Templates" },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 flex items-center gap-3 text-xs font-mono-code">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter bar & search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242424] pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#ff6b35] text-white shadow-sm font-semibold"
                    : "bg-[#141414] text-[#898989] hover:bg-[#1a1a1a] hover:text-[#fafafa] border border-[#242424]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#898989] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#141414] border border-[#242424] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code w-full md:w-64"
            />
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="py-20 text-center text-[#898989] text-xs font-mono-code">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent mb-3" />
            <p>Loading enterprise template catalog...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-20 text-center text-[#898989] text-xs font-mono-code">
            No templates found matching category &quot;{selectedCategory}&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="rounded-2xl border border-[#242424] bg-[#141414] hover:border-[#ff6b35]/40 transition-all overflow-hidden flex flex-col group shadow-xl"
              >
                {/* Visual Header / Banner */}
                <div className="p-6 bg-[#181818] border-b border-[#242424] relative">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-code font-bold tracking-wide uppercase bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30">
                      {template.category}
                    </span>
                    {template.isSystem && (
                      <span className="flex items-center gap-1 text-[11px] font-mono-code text-amber-400 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        Enterprise Standard
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-xs text-[#898989] mt-2 line-clamp-2 leading-relaxed">
                    {template.description}
                  </p>
                </div>

                {/* Widget summary & Actions */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono-code text-[#898989]">
                    <span className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-[#ff6b35]" />
                      <span>{template.chartsConfig?.length || 0} Built-in Charts</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>12-Col Responsive</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#242424]">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="px-3.5 py-2 rounded-lg border border-[#2e2e2e] bg-[#181818] hover:bg-[#222222] text-xs font-mono-code font-semibold text-[#fafafa] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#898989]" />
                      <span>Preview</span>
                    </button>
                    <button
                      onClick={() => handleOpenInstantiate(template)}
                      className="px-3.5 py-2 rounded-lg bg-[#ff6b35] hover:bg-[#c2410c] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer font-mono-code"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Use Template</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Template Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl text-[#fafafa]">
              <div className="flex items-center justify-between border-b border-[#242424] pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-[#ff6b35]">
                    {previewTemplate.category} Template
                  </span>
                  <h2 className="text-xl font-bold text-[#fafafa]">{previewTemplate.name}</h2>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-1.5 rounded-lg text-[#898989] hover:text-[#fafafa] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[#898989] leading-relaxed">
                {previewTemplate.description}
              </p>

              <div className="space-y-3">
                <h4 className="text-xs font-mono-code font-bold text-[#898989] uppercase tracking-wider">
                  Configured Visualization Widgets ({previewTemplate.chartsConfig?.length || 0})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {previewTemplate.chartsConfig?.map((chart, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#181818] border border-[#262626] flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-[#fafafa]">{chart.title}</div>
                        {chart.description && (
                          <div className="text-[11px] text-[#898989]">{chart.description}</div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#141414] border border-[#2e2e2e] text-[#ff6b35] font-mono-code text-[10px] uppercase font-bold">
                        {chart.chartType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#242424]">
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="px-4 py-2 text-xs font-mono-code font-semibold text-[#898989] hover:text-[#fafafa] cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const t = previewTemplate;
                    setPreviewTemplate(null);
                    handleOpenInstantiate(t);
                  }}
                  className="px-5 py-2 bg-[#ff6b35] hover:bg-[#c2410c] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer font-mono-code"
                >
                  Instantiate This Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instantiate Modal */}
        {instantiateTemplate && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl text-[#fafafa]">
              <div className="flex items-center justify-between border-b border-[#242424] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#fafafa]">Create Dashboard from Template</h2>
                  <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                    Cloning from: <span className="text-[#ff6b35]">{instantiateTemplate.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setInstantiateTemplate(null)}
                  className="p-1.5 rounded-lg text-[#898989] hover:text-[#fafafa] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInstantiateSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono-code uppercase tracking-wider text-[#898989]">Dashboard Name</label>
                  <input
                    type="text"
                    required
                    value={dashboardName}
                    onChange={(e) => setDashboardName(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-lg p-2.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono-code uppercase tracking-wider text-[#898989]">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={dashboardDesc}
                    onChange={(e) => setDashboardDesc(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-lg p-2.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono-code uppercase tracking-wider text-[#898989]">
                    Connect Initial Dataset (Optional)
                  </label>
                  <select
                    value={targetDatasetId}
                    onChange={(e) => setTargetDatasetId(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-lg p-2.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  >
                    <option value="">None (Configure charts manually)</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.rowCount ?? 0} rows)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-lg bg-[#ff6b35]/10 border border-[#ff6b35]/30 text-[#ff6b35] text-xs font-mono-code flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#ff6b35]" />
                  <span className="leading-relaxed">
                    This creates an independent workspace dashboard. Any customizations or additions will NOT modify the underlying template.
                  </span>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#242424]">
                  <button
                    type="button"
                    onClick={() => setInstantiateTemplate(null)}
                    className="px-4 py-2 text-xs font-mono-code font-semibold text-[#898989] hover:text-[#fafafa] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={instantiating || !dashboardName.trim()}
                    className="px-5 py-2.5 bg-[#ff6b35] hover:bg-[#c2410c] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm font-mono-code flex items-center gap-2 cursor-pointer"
                  >
                    {instantiating ? "Creating Dashboard..." : "Create Independent Dashboard"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
