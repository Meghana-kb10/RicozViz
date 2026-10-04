"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedMetrics, fetchedDatasets] = await Promise.all([
        apiListMetrics(currentWorkspace?.id),
        apiListDatasets({ workspaceId: currentWorkspace?.id }),
      ]);
      setMetrics(fetchedMetrics);
      setDatasets(fetchedDatasets);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth) {
      void loadData();
    }
  }, [auth, currentWorkspace?.id]);

  const handleCalculate = async (metricId: string) => {
    setCalculatingMap((prev) => ({ ...prev, [metricId]: true }));
    try {
      const res = await apiCalculateMetric(metricId);
      setCalcResults((prev) => ({ ...prev, [metricId]: res }));
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to calculate metric");
    } finally {
      setCalculatingMap((prev) => ({ ...prev, [metricId]: false }));
    }
  };

  const openCreateModal = () => {
    setEditingMetric(null);
    setFormName("");
    setFormDescription("");
    const initialDataset = datasets[0]?.id || "";
    setFormDatasetId(initialDataset);
    const ds = datasets.find((d) => d.id === initialDataset);
    setFormColumn(ds?.columns?.[0]?.name || "");
    setFormAggregation("SUM");
    setFormFormat("NUMBER");
    setFormTargetValue("");
    setIsModalOpen(true);
  };

  const openEditModal = (metric: MetricData) => {
    setEditingMetric(metric);
    setFormName(metric.name);
    setFormDescription(metric.description || "");
    setFormDatasetId(metric.datasetId);
    setFormColumn(metric.column || metric.field);
    setFormAggregation(metric.aggregation || metric.calculation);
    setFormFormat(metric.format);
    setFormTargetValue(metric.targetValue !== undefined && metric.targetValue !== null ? String(metric.targetValue) : "");
    setIsModalOpen(true);
  };

  const handleDelete = async (metric: MetricData) => {
    if (!confirm(`Are you sure you want to delete the metric "${metric.name}"?`)) return;
    try {
      await apiDeleteMetric(metric.id);
      setSuccessMsg(`Metric "${metric.name}" deleted successfully.`);
      setMetrics((prev) => prev.filter((m) => m.id !== metric.id));
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete metric");
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg("Metric name is required");
      return;
    }
    if (!formDatasetId) {
      setErrorMsg("Please select a dataset");
      return;
    }
    if (!formColumn) {
      setErrorMsg("Please select a column");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const targetVal = formTargetValue.trim() !== "" ? parseFloat(formTargetValue.trim()) : undefined;

    try {
      if (editingMetric) {
        const updated = await apiUpdateMetric(editingMetric.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          aggregation: formAggregation,
          calculation: formAggregation,
          column: formColumn,
          field: formColumn,
          format: formFormat,
          targetValue: targetVal,
        });
        setSuccessMsg(`Metric "${updated.name}" updated successfully.`);
        setMetrics((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await apiCreateMetric({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          datasetId: formDatasetId,
          aggregation: formAggregation,
          calculation: formAggregation,
          column: formColumn,
          field: formColumn,
          format: formFormat,
          targetValue: targetVal,
          workspaceId: currentWorkspace?.id || "",
        });
        setSuccessMsg(`Metric "${created.name}" created successfully.`);
        setMetrics((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save metric");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDatasetObj = datasets.find((d) => d.id === formDatasetId);
  const availableColumns = selectedDatasetObj?.columns || [];

  const filteredMetrics = metrics.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.column || m.field).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDataset = filterDataset === "ALL" || m.datasetId === filterDataset;
    return matchesSearch && matchesDataset;
  });

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-30 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/workspace" className="flex items-center gap-2 font-bold text-gray-900 text-lg hover:text-indigo-600 transition">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-extrabold text-sm shadow-xs">
                R
              </span>
              <span>RicozViz</span>
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-900">
              Workspace
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">Metrics & KPIs</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/alerts" className="text-xs font-medium text-gray-600 hover:text-indigo-600 transition hidden sm:inline">
              Alerts →
            </Link>
            <Link href="/dashboards" className="text-xs font-medium text-gray-600 hover:text-indigo-600 transition hidden sm:inline">
              Dashboards →
            </Link>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{auth.user.name}</p>
              <p className="text-xs text-gray-500">
                {auth.role} · {auth.organization.name}
              </p>
            </div>
            <button
              onClick={() => {
                void logout();
                router.replace("/login");
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 flex-1">
        {/* Alerts */}
        {errorMsg && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800 text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-800 text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">KPI & Metrics Layer</h1>
            <p className="text-sm text-gray-500 mt-1">
              Define reusable business metrics, aggregations, targets, and KPI calculations across your workspace.
            </p>
          </div>

          {canCreate && (
            <button
              onClick={openCreateModal}
              id="create-metric-btn"
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <span>+ Create Metric</span>
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search metrics by name, description, or column..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:outline-none shadow-2xs"
          />
          <select
            value={filterDataset}
            onChange={(e) => setFilterDataset(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
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
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500">Loading metrics...</p>
          </div>
        ) : filteredMetrics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <span className="text-4xl mb-3 block">📈</span>
            <h3 className="text-base font-bold text-gray-800">No Metrics Found</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              {metrics.length === 0
                ? "Start building your semantic metrics layer by defining reusable calculations such as Revenue, Profit, or Customer Count."
                : "No metrics match your search criteria."}
            </p>
            {canCreate && metrics.length === 0 && (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                + Define First Metric
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
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-base leading-snug">{metric.name}</h3>
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
                        {metric.format}
                      </span>
                    </div>

                    {metric.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{metric.description}</p>
                    )}

                    <div className="rounded-xl bg-gray-50/80 border border-gray-100 p-3 mb-4 space-y-1.5 text-xs text-gray-600 font-mono">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Dataset:</span>
                        <span className="font-semibold text-gray-800 truncate max-w-[160px]">
                          {ds?.name || metric.dataset?.name || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Calculation:</span>
                        <span className="font-semibold text-indigo-700">
                          {metric.aggregation || metric.calculation}({metric.column || metric.field})
                        </span>
                      </div>
                      {metric.targetValue !== undefined && metric.targetValue !== null && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Target:</span>
                          <span className="font-semibold text-gray-800">
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
                      <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
                          Evaluated Value
                        </span>
                        <span className="text-2xl font-extrabold text-gray-900 block font-mono">
                          {calc.formattedValue}
                        </span>
                        {calc.progressPercent !== null && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>Target Progress</span>
                              <span className="font-bold">{calc.progressPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-indigo-200 overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full transition-all"
                                style={{ width: `${Math.min(calc.progressPercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCalculate(metric.id)}
                      disabled={isCalculating}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                    >
                      {isCalculating ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                          <span>Computing...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>{calc ? "Re-calculate" : "Calculate"}</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditModal(metric)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(metric)}
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingMetric ? "Edit Business Metric" : "Define New Business Metric"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Metric Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Total Revenue, Customer Churn Rate, Average Order Value"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the business logic or rationale for this KPI..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
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
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none disabled:bg-gray-100"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Measure Column *
                  </label>
                  <select
                    value={formColumn}
                    onChange={(e) => setFormColumn(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Aggregation *
                  </label>
                  <select
                    value={formAggregation}
                    onChange={(e) => setFormAggregation(e.target.value as MetricAggregation)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Format *
                  </label>
                  <select
                    value={formFormat}
                    onChange={(e) => setFormFormat(e.target.value as MetricFormat)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="NUMBER">Number (1,234.56)</option>
                    <option value="CURRENCY">Currency ($1,234.56)</option>
                    <option value="PERCENT">Percentage (12.3%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Target / Threshold (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 500000"
                  value={formTargetValue}
                  onChange={(e) => setFormTargetValue(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Optional goal value to compute percentage completion and trigger progress bars.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingMetric ? "Update Metric" : "Create Metric"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
