"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import { AppShell } from "../../components/shell/AppShell";
import {
  apiListMetrics,
  apiCreateMetric,
  apiUpdateMetric,
  apiDeleteMetric,
  apiCalculateMetric,
  apiListDatasets,
  type MetricData,
  type MetricCalculationResult,
  type DatasetData,
  type MetricFormat,
  type MetricAggregation,
  ApiError,
} from "../../lib/api";
import {
  TrendingUp,
  Plus,
  RefreshCw,
  Search,
  Layers,
  Calculator,
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  Trash2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function MetricsPage() {
  const { auth, isLoading, logout, hasPermission } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDataset, setFilterDataset] = useState<string>("ALL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live calculation results cache { [metricId]: MetricCalculationResult }
  const [calcResults, setCalcResults] = useState<Record<string, MetricCalculationResult>>({});
  const [calculatingMap, setCalculatingMap] = useState<Record<string, boolean>>({});

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDatasetId, setFormDatasetId] = useState("");
  const [formColumn, setFormColumn] = useState("");
  const [formAggregation, setFormAggregation] = useState<MetricAggregation>("SUM");
  const [formFormat, setFormFormat] = useState<MetricFormat>("NUMBER");
  const [formTargetValue, setFormTargetValue] = useState<string>("");

  const canCreate = hasPermission("METRIC_CREATE") || auth?.role === "ADMIN" || auth?.role === "ANALYST";
  const canEdit = hasPermission("METRIC_EDIT") || auth?.role === "ADMIN" || auth?.role === "ANALYST";
  const canDelete = hasPermission("METRIC_DELETE") || auth?.role === "ADMIN" || auth?.role === "ANALYST";

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  useEffect(() => {
    if (auth) {
      loadInitialData();
    }
  }, [auth, currentWorkspace?.id]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [metricsList, datasetsList] = await Promise.all([
        apiListMetrics(undefined, currentWorkspace?.id),
        apiListDatasets({ workspaceId: currentWorkspace?.id }),
      ]);
      setMetrics(metricsList);
      setDatasets(datasetsList);
      if (datasetsList.length > 0 && !formDatasetId) {
        setFormDatasetId(datasetsList[0].id);
        setFormColumn(datasetsList[0].columns?.[0]?.name || "");
      }
      setErrorMsg(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to load metrics data.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Pre-calculate all metrics automatically on load
  useEffect(() => {
    if (metrics.length > 0) {
      metrics.forEach((m) => {
        void handleCalculate(m.id);
      });
    }
  }, [metrics]);

  async function handleCalculate(metricId: string) {
    setCalculatingMap((prev) => ({ ...prev, [metricId]: true }));
    try {
      const res = await apiCalculateMetric(metricId);
      setCalcResults((prev) => ({ ...prev, [metricId]: res }));
    } catch {
      // Ignored for graceful rendering
    } finally {
      setCalculatingMap((prev) => ({ ...prev, [metricId]: false }));
    }
  }

  function openCreateModal() {
    setEditingMetric(null);
    setFormName("");
    setFormDescription("");
    const firstDs = datasets[0];
    setFormDatasetId(firstDs?.id || "");
    setFormColumn(firstDs?.columns?.[0]?.name || "");
    setFormAggregation("SUM");
    setFormFormat("NUMBER");
    setFormTargetValue("");
    setErrorMsg(null);
    setIsModalOpen(true);
  }

  function openEditModal(m: MetricData) {
    setEditingMetric(m);
    setFormName(m.name);
    setFormDescription(m.description || "");
    setFormDatasetId(m.datasetId);
    setFormColumn(m.column || m.field || "");
    setFormAggregation((m.aggregation || m.calculation) as MetricAggregation);
    setFormFormat(m.format);
    setFormTargetValue(m.targetValue !== undefined && m.targetValue !== null ? String(m.targetValue) : "");
    setErrorMsg(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formDatasetId || !formColumn) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      datasetId: formDatasetId,
      column: formColumn,
      field: formColumn,
      aggregation: formAggregation,
      calculation: formAggregation,
      format: formFormat,
      targetValue: formTargetValue ? Number(formTargetValue) : undefined,
      workspaceId: currentWorkspace?.id,
    };

    try {
      if (editingMetric) {
        const updated = await apiUpdateMetric(editingMetric.id, payload);
        setMetrics((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setSuccessMsg(`Metric "${updated.name}" updated successfully.`);
        void handleCalculate(updated.id);
      } else {
        const created = await apiCreateMetric(payload);
        setMetrics((prev) => [created, ...prev]);
        setSuccessMsg(`Metric "${created.name}" created successfully.`);
        void handleCalculate(created.id);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to save metric.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete metric "${name}"?`)) return;
    try {
      await apiDeleteMetric(id);
      setMetrics((prev) => prev.filter((m) => m.id !== id));
      setSuccessMsg(`Metric "${name}" deleted.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to delete metric.");
      }
    }
  }

  const selectedDataset = datasets.find((d) => d.id === formDatasetId);
  const availableColumns = selectedDataset?.columns || [];

  const filteredMetrics = metrics.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.column || m.field).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDataset = filterDataset === "ALL" || m.datasetId === filterDataset;
    return matchesSearch && matchesDataset;
  });

  const targetCount = metrics.filter((m) => m.targetValue !== undefined && m.targetValue !== null).length;
  const datasetsCovered = new Set(metrics.map((m) => m.datasetId)).size;

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono-code text-[#898989]">Evaluating semantic metric layer...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="Metrics & Semantic Layer"
      subtitle="Define governed business KPIs with automated aggregations, target progress tracking, and OLAP query acceleration."
      breadcrumbs={[
        { label: "Data Studio", href: "/datasets" },
        { label: "Metrics & KPIs" },
      ]}
      actions={
        canCreate ? (
          <button
            onClick={openCreateModal}
            id="create-metric-btn"
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Metric</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Alerts */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs font-mono-code text-red-300 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200 text-xs font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs font-mono-code text-emerald-300 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 text-xs font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* 4-KPI Metric Mesh Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>GOVERNED METRICS</span>
              <TrendingUp className="h-4 w-4 text-[#ff6b35]" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{metrics.length}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Semantic calculations</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>EVALUATED VALUES</span>
              <Calculator className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-emerald-400">{Object.keys(calcResults).length}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Live compiled in DuckDB</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>TARGET MONITORS</span>
              <Target className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{targetCount}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Goal threshold tracking</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>DATASETS COVERED</span>
              <Layers className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{datasetsCovered}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Linked data models</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 border-b border-[#242424] pb-4">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#898989] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search metrics by name, description, or column..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[#242424] bg-[#141414] pl-9 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
            />
          </div>
          <select
            value={filterDataset}
            onChange={(e) => setFilterDataset(e.target.value)}
            className="rounded-lg border border-[#242424] bg-[#141414] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
          >
            <option value="ALL">All Datasets ({datasets.length})</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Metrics Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono-code text-[#898989]">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent mb-3" />
            <p>Compiling semantic metrics in DuckDB WASM...</p>
          </div>
        ) : filteredMetrics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2e2e2e] bg-[#141414]/50 p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff6b35]/10 text-[#ff6b35] text-2xl mb-4 border border-[#ff6b35]/20">
              <TrendingUp className="h-7 w-7" />
            </div>
            <h3 className="text-base font-medium text-[#fafafa]">No Metrics Found</h3>
            <p className="mt-1 text-xs text-[#898989] font-mono-code max-w-md mx-auto">
              {metrics.length === 0
                ? "Start building your semantic metrics layer by defining reusable calculations such as Revenue, Profit, or Customer Count."
                : "No metrics match your search criteria."}
            </p>
            {canCreate && metrics.length === 0 && (
              <button
                onClick={openCreateModal}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Define First Metric</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMetrics.map((metric) => {
              const calc = calcResults[metric.id];
              const isCalculating = !!calculatingMap[metric.id];
              const ds = datasets.find((d) => d.id === metric.datasetId);

              return (
                <div
                  key={metric.id}
                  className="rounded-xl border border-[#242424] bg-[#141414] p-5 shadow-sm hover:border-[#ff6b35]/40 transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-[#fafafa] text-base leading-snug group-hover:text-[#ff6b35] transition-colors truncate">
                        {metric.name}
                      </h3>
                      <span className="inline-flex items-center rounded-md bg-[#181818] border border-[#2e2e2e] px-2 py-0.5 text-[10px] font-mono-code text-[#ff6b35] uppercase font-bold tracking-wide">
                        {metric.format}
                      </span>
                    </div>

                    {metric.description ? (
                      <p className="text-xs text-[#898989] mb-3 line-clamp-2">{metric.description}</p>
                    ) : (
                      <p className="text-xs text-[#666666] italic mb-3">No description provided</p>
                    )}

                    {/* Metadata specs */}
                    <div className="rounded-lg bg-[#181818] border border-[#262626] p-3 mb-4 space-y-1.5 text-xs text-[#898989] font-mono-code">
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Dataset:</span>
                        <span className="font-semibold text-[#fafafa] truncate max-w-[160px]">
                          {ds?.name || metric.dataset?.name || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Calculation:</span>
                        <span className="font-semibold text-[#ff6b35]">
                          {metric.aggregation || metric.calculation}({metric.column || metric.field})
                        </span>
                      </div>
                      {metric.targetValue !== undefined && metric.targetValue !== null && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Target:</span>
                          <span className="font-semibold text-[#fafafa]">
                            {metric.format === "CURRENCY"
                              ? `$${Number(metric.targetValue).toLocaleString()}`
                              : metric.format === "PERCENT"
                              ? `${metric.targetValue}%`
                              : Number(metric.targetValue).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Calculated Value Preview */}
                    {calc ? (
                      <div className="mb-4 rounded-xl border border-[#242424] bg-[#121212] p-3.5 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#898989] font-mono-code block mb-1">
                          Evaluated Value
                        </span>
                        <span className="text-2xl font-bold text-[#fafafa] block font-mono-code">
                          {calc.formattedValue}
                        </span>
                        {calc.progressPercent !== null && (
                          <div className="mt-2.5">
                            <div className="flex justify-between text-[10px] font-mono-code text-[#898989] mb-1">
                              <span>Target Progress</span>
                              <span className="font-bold text-[#ff6b35]">{calc.progressPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#242424] overflow-hidden">
                              <div
                                className="h-full bg-[#ff6b35] rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(calc.progressPercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="border-t border-[#242424] pt-3.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCalculate(metric.id)}
                      disabled={isCalculating}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] px-2.5 py-1.5 text-xs font-mono-code text-[#fafafa] hover:bg-[#222222] disabled:opacity-50 transition cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isCalculating ? "animate-spin text-[#ff6b35]" : ""}`} />
                      <span>{isCalculating ? "Evaluating..." : "Recalculate"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditModal(metric)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#1f1f1f] transition cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(metric.id, metric.name)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-[#fafafa]">
            <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
              <div>
                <h2 className="text-lg font-bold text-[#fafafa]">
                  {editingMetric ? "Edit Metric Definition" : "Create New Governed Metric"}
                </h2>
                <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                  Semantic formulas compile to optimized OLAP aggregations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#898989] hover:text-[#fafafa] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Metric Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Recurring Revenue"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Business Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the business logic or rationale for this KPI..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                    Dataset *
                  </label>
                  <select
                    disabled={!!editingMetric}
                    value={formDatasetId}
                    onChange={(e) => {
                      const newDsId = e.target.value;
                      setFormDatasetId(newDsId);
                      const d = datasets.find((x) => x.id === newDsId);
                      setFormColumn(d?.columns?.[0]?.name || "");
                    }}
                    className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code disabled:opacity-50"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                    Measure Column *
                  </label>
                  <select
                    value={formColumn}
                    onChange={(e) => setFormColumn(e.target.value)}
                    className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  >
                    {availableColumns.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                    Aggregation *
                  </label>
                  <select
                    value={formAggregation}
                    onChange={(e) => setFormAggregation(e.target.value as MetricAggregation)}
                    className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  >
                    <option value="SUM">SUM</option>
                    <option value="AVG">AVG</option>
                    <option value="COUNT">COUNT</option>
                    <option value="COUNT_DISTINCT">COUNT DISTINCT</option>
                    <option value="MIN">MIN</option>
                    <option value="MAX">MAX</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                    Format *
                  </label>
                  <select
                    value={formFormat}
                    onChange={(e) => setFormFormat(e.target.value as MetricFormat)}
                    className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  >
                    <option value="NUMBER">Number (1,234.56)</option>
                    <option value="CURRENCY">Currency ($1,234.56)</option>
                    <option value="PERCENT">Percentage (12.3%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Target / Goal (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 500000"
                  value={formTargetValue}
                  onChange={(e) => setFormTargetValue(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                />
                <p className="text-[11px] text-[#898989] font-mono-code mt-1">
                  Optional goal value to compute percentage completion and trigger progress bars.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#242424]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-2 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#ff6b35] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving..." : editingMetric ? "Update Metric" : "Create Metric"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
