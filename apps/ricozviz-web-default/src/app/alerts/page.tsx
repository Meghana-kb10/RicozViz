"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import { BrandLogo } from "@/components/shell/BrandLogo";
import {
  apiListAlerts,
  apiCreateAlert,
  apiUpdateAlert,
  apiDeleteAlert,
  apiClearAlert,
  apiEvaluateAlert,
  apiEvaluateAllWorkspaceAlerts,
  apiListMetrics,
  type AlertData,
  type AlertHistoryData,
  type MetricData,
  type AlertCondition,
  type AlertStatus,
  ApiError,
} from "../../lib/api";

export default function AlertsPage() {
  const { auth, isLoading, logout, hasPermission } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Evaluating states
  const [evaluatingMap, setEvaluatingMap] = useState<Record<string, boolean>>({});
  const [evaluatingAll, setEvaluatingAll] = useState(false);

  // History Modal State
  const [historyAlert, setHistoryAlert] = useState<AlertData | null>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMetricId, setFormMetricId] = useState("");
  const [formCondition, setFormCondition] = useState<AlertCondition>("GREATER_THAN");
  const [formThreshold, setFormThreshold] = useState<string>("");
  const [formIsEnabled, setFormIsEnabled] = useState(true);

  const canCreate = hasPermission("ALERT_CREATE") || auth?.role === "ADMIN" || auth?.role === "ANALYST";
  const canEdit = hasPermission("ALERT_EDIT") || auth?.role === "ADMIN" || auth?.role === "ANALYST";
  const canDelete = hasPermission("ALERT_DELETE") || auth?.role === "ADMIN" || auth?.role === "ANALYST";

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedAlerts, fetchedMetrics] = await Promise.all([
        apiListAlerts(currentWorkspace?.id),
        apiListMetrics(currentWorkspace?.id),
      ]);
      setAlerts(fetchedAlerts);
      setMetrics(fetchedMetrics);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth) {
      void loadData();
    }
  }, [auth, currentWorkspace?.id]);

  const handleEvaluate = async (alertId: string) => {
    setEvaluatingMap((prev) => ({ ...prev, [alertId]: true }));
    try {
      const res = await apiEvaluateAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === res.alertId
            ? { ...a, lastEvaluatedAt: res.lastEvaluatedAt, status: res.status, lastValue: res.currentValue }
            : a
        )
      );
      setSuccessMsg(
        `Alert "${res.alertName}" evaluated: Value=${res.currentValue}, Threshold=${res.threshold}. Condition ${
          res.isTriggered ? "TRIGGERED" : "NORMAL"
        }.`
      );
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to evaluate alert");
    } finally {
      setEvaluatingMap((prev) => ({ ...prev, [alertId]: false }));
    }
  };

  const handleEvaluateAll = async () => {
    if (!currentWorkspace?.id) return;
    setEvaluatingAll(true);
    try {
      const res = await apiEvaluateAllWorkspaceAlerts(currentWorkspace.id);
      setSuccessMsg(`Evaluated ${res.totalEvaluated} workspace alerts. Triggered: ${res.triggeredCount}.`);
      void loadData();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to evaluate alerts");
    } finally {
      setEvaluatingAll(false);
    }
  };

  const handleClearAlert = async (alertId: string) => {
    try {
      const res = await apiClearAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === res.id ? { ...a, ...res, status: "OK", lastTriggeredAt: null } : a))
      );
      setSuccessMsg("Alert notification cleared and status reset to OK.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to clear alert");
    }
  };

  const handleToggleEnable = async (alert: AlertData) => {
    try {
      const isCurrentlyEnabled = alert.enabled ?? alert.isEnabled ?? true;
      const updated = await apiUpdateAlert(alert.id, {
        enabled: !isCurrentlyEnabled,
        isEnabled: !isCurrentlyEnabled,
      });
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSuccessMsg(
        `Alert "${updated.name}" is now ${
          (updated.enabled ?? updated.isEnabled) ? "active" : "paused"
        }.`
      );
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update alert state");
    }
  };

  const openCreateModal = () => {
    setEditingAlert(null);
    setFormName("");
    setFormDescription("");
    setFormMetricId(metrics[0]?.id || "");
    setFormCondition("GREATER_THAN");
    setFormThreshold("100000");
    setFormIsEnabled(true);
    setIsModalOpen(true);
  };

  const openEditModal = (alert: AlertData) => {
    setEditingAlert(alert);
    setFormName(alert.name);
    setFormDescription(alert.description || "");
    setFormMetricId(alert.metricId);
    setFormCondition(alert.condition);
    setFormThreshold(String(alert.threshold));
    setFormIsEnabled(alert.enabled ?? alert.isEnabled ?? true);
    setIsModalOpen(true);
  };

  const handleDelete = async (alert: AlertData) => {
    if (!confirm(`Are you sure you want to delete the alert "${alert.name}"?`)) return;
    try {
      await apiDeleteAlert(alert.id);
      setSuccessMsg(`Alert "${alert.name}" deleted successfully.`);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete alert");
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg("Alert name is required");
      return;
    }
    if (!formMetricId) {
      setErrorMsg("Please select a KPI/Metric to monitor");
      return;
    }
    const parsedThreshold = parseFloat(formThreshold.trim());
    if (isNaN(parsedThreshold)) {
      setErrorMsg("Please enter a valid numeric threshold");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingAlert) {
        const updated = await apiUpdateAlert(editingAlert.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          condition: formCondition,
          threshold: parsedThreshold,
          enabled: formIsEnabled,
          isEnabled: formIsEnabled,
        });
        setSuccessMsg(`Alert "${updated.name}" updated successfully.`);
        setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await apiCreateAlert({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          metricId: formMetricId,
          condition: formCondition,
          threshold: parsedThreshold,
          enabled: formIsEnabled,
          isEnabled: formIsEnabled,
          workspaceId: currentWorkspace?.id || "",
        });
        setSuccessMsg(`Alert "${created.name}" created successfully.`);
        setAlerts((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save alert");
    } finally {
      setSubmitting(false);
    }
  };

  const conditionLabels: Record<AlertCondition, string> = {
    GREATER_THAN: "> (Greater Than)",
    LESS_THAN: "< (Less Than)",
    GREATER_THAN_OR_EQUAL: "≥ (Greater Than or Equal)",
    LESS_THAN_OR_EQUAL: "≤ (Less Than or Equal)",
    EQUALS: "= (Equals)",
    INCREASE_PERCENT: "increase % (> +X%)",
    DECREASE_PERCENT: "decrease % (> -X%)",
    INCREASE_PCT: "increase %",
    DECREASE_PCT: "decrease %",
  };

  const conditionSymbols: Record<AlertCondition, string> = {
    GREATER_THAN: ">",
    LESS_THAN: "<",
    GREATER_THAN_OR_EQUAL: "≥",
    LESS_THAN_OR_EQUAL: "≤",
    EQUALS: "=",
    INCREASE_PERCENT: "↑ %",
    DECREASE_PERCENT: "↓ %",
    INCREASE_PCT: "↑ %",
    DECREASE_PCT: "↓ %",
  };

  const filteredAlerts = alerts.filter((a) => {
    const isEnabled = a.enabled ?? a.isEnabled ?? true;
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.metric?.name && a.metric.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      filterStatus === "ALL" ||
      (filterStatus === "TRIGGERED" && a.status === "TRIGGERED") ||
      (filterStatus === "OK" && a.status === "OK") ||
      (filterStatus === "DISABLED" && !isEnabled);
    return matchesSearch && matchesStatus;
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
              <BrandLogo size={32} />
              <span>RicozViz</span>
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-900">
              Workspace
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">Smart Alerts</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/metrics" className="text-xs font-medium text-gray-600 hover:text-indigo-600 transition hidden sm:inline">
              Metrics & KPIs →
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
        {/* Info Banner on Notification Delivery */}
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
          <span className="text-lg">ℹ️</span>
          <div>
            <p className="font-bold">Real-Time Metric Evaluation & Log Engine Active</p>
            <p className="text-blue-700 mt-0.5">
              Alert conditions evaluate live against your dataset query engine and record execution logs in internal notification history. External SMTP email delivery requires configuring your organization email provider credentials.
            </p>
          </div>
        </div>

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
            <h1 className="text-2xl font-bold text-gray-900">Smart Data Alerts</h1>
            <p className="text-sm text-gray-500 mt-1">
              Automated anomaly & threshold monitoring for mission-critical business KPIs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => void handleEvaluateAll()}
                disabled={evaluatingAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 shadow-2xs transition disabled:opacity-50"
              >
                {evaluatingAll ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <span>Evaluating All...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Evaluate All Alerts</span>
                  </>
                )}
              </button>
            )}

            {canCreate && (
              <button
                onClick={openCreateModal}
                id="create-alert-btn"
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <span>+ Create Alert</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search alerts by name, description, or monitored metric..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:outline-none shadow-2xs"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
          >
            <option value="ALL">All Statuses ({alerts.length})</option>
            <option value="TRIGGERED">Triggered Anomalies</option>
            <option value="OK">Normal (OK)</option>
            <option value="DISABLED">Paused</option>
          </select>
        </div>

        {/* Alerts Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500">Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <span className="text-4xl mb-3 block">🔔</span>
            <h3 className="text-base font-bold text-gray-800">No Alerts Configured</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              {metrics.length === 0
                ? "You need at least one business metric before setting up alerts. Create a metric first."
                : "Keep your team informed by setting threshold triggers when metrics exceed or fall below critical values."}
            </p>
            {metrics.length === 0 ? (
              <Link
                href="/metrics"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                Go to Metrics & KPIs →
              </Link>
            ) : canCreate ? (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                + Create First Alert
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAlerts.map((alert) => {
              const isEvaluating = !!evaluatingMap[alert.id];
              const historyCount = alert.history?.length || 0;

              const isAlertEnabled = alert.enabled ?? alert.isEnabled ?? true;
              return (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-5 shadow-xs transition flex flex-col justify-between ${
                    !isAlertEnabled
                      ? "border-gray-200 bg-gray-50/50 opacity-80"
                      : alert.status === "TRIGGERED"
                      ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-200"
                      : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-base leading-snug">{alert.name}</h3>
                      <div className="flex items-center gap-1.5">
                        {!isAlertEnabled ? (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 uppercase">
                            Paused
                          </span>
                        ) : alert.status === "TRIGGERED" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 uppercase animate-pulse">
                            <span>●</span> Triggered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                            <span>●</span> OK
                          </span>
                        )}
                      </div>
                    </div>

                    {alert.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{alert.description}</p>
                    )}

                    {/* Condition Box */}
                    <div className="rounded-xl bg-gray-50/90 border border-gray-100 p-3 mb-4 space-y-1.5 text-xs text-gray-700 font-mono">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Target Metric:</span>
                        <span className="font-bold text-gray-900 truncate max-w-[150px]">
                          {alert.metric?.name || "Metric"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Trigger Rule:</span>
                        <span className="font-bold text-indigo-700">
                          {conditionSymbols[alert.condition]} {Number(alert.threshold).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-400">Last Checked:</span>
                        <span className="text-gray-500">
                          {alert.lastEvaluatedAt ? new Date(alert.lastEvaluatedAt).toLocaleTimeString() : "Never"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleEvaluate(alert.id)}
                        disabled={isEvaluating || !isAlertEnabled}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                      >
                        {isEvaluating ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                            <span>Checking...</span>
                          </>
                        ) : (
                          <>
                            <span>⚡</span>
                            <span>Check</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryAlert(alert)}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                      >
                        History ({historyCount})
                      </button>

                      {alert.status === "TRIGGERED" && (
                        <button
                          type="button"
                          onClick={() => void handleClearAlert(alert.id)}
                          className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          title="Acknowledge and reset alert"
                        >
                          ✓ Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => void handleToggleEnable(alert)}
                          className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                            isAlertEnabled
                              ? "text-amber-700 hover:bg-amber-50 border border-amber-200"
                              : "text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                          }`}
                        >
                          {isAlertEnabled ? "Pause" : "Enable"}
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditModal(alert)}
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(alert)}
                          className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                        >
                          ✕
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
                {editingAlert ? "Edit Alert Configuration" : "Configure Smart Alert"}
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
                  Alert Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Revenue Drop Alert, Customer Churn Warning"
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
                  placeholder="Explain when this alert triggers and what action to take..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Monitored KPI / Metric *
                </label>
                <select
                  disabled={!!editingAlert}
                  value={formMetricId}
                  onChange={(e) => setFormMetricId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none disabled:bg-gray-100"
                >
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.aggregation || m.calculation} on {m.column || m.field})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Trigger Condition *
                  </label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as AlertCondition)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="GREATER_THAN">{conditionLabels.GREATER_THAN}</option>
                    <option value="LESS_THAN">{conditionLabels.LESS_THAN}</option>
                    <option value="GREATER_THAN_OR_EQUAL">{conditionLabels.GREATER_THAN_OR_EQUAL}</option>
                    <option value="LESS_THAN_OR_EQUAL">{conditionLabels.LESS_THAN_OR_EQUAL}</option>
                    <option value="EQUALS">{conditionLabels.EQUALS}</option>
                    <option value="INCREASE_PERCENT">{conditionLabels.INCREASE_PERCENT}</option>
                    <option value="DECREASE_PERCENT">{conditionLabels.DECREASE_PERCENT}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Threshold Value *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 100000"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="enable-toggle"
                  checked={formIsEnabled}
                  onChange={(e) => setFormIsEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="enable-toggle" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Activate alert immediately upon creation
                </label>
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
                  {submitting ? "Saving..." : editingAlert ? "Update Alert" : "Create Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALERT HISTORY MODAL */}
      {historyAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-gray-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Execution History: {historyAlert.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Logged evaluations and trigger snapshots
                </p>
              </div>
              <button
                onClick={() => setHistoryAlert(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {!historyAlert.history || historyAlert.history.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No evaluations recorded yet for this alert. Click &quot;Check&quot; on the alert card to run an evaluation.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Evaluated Value</th>
                      <th className="px-3 py-2">Threshold</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Notification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyAlert.history.map((h: AlertHistoryData) => (
                      <tr key={h.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {new Date(h.evaluatedAt || h.triggeredAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">
                          {Number(h.metricValue).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {conditionSymbols[historyAlert.condition]} {Number(h.threshold).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {h.triggered ? (
                            <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              TRIGGERED
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-[11px] truncate max-w-[160px]">
                          {h.message || (h.notified ? "Recorded in log" : "Normal")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryAlert(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
