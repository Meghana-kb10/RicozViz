"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import { AppShell } from "../../components/shell/AppShell";
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
import {
  Bell,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Edit2,
  Eye,
  Play,
  Pause,
  Layers,
  Activity,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

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
        apiListMetrics(undefined, currentWorkspace?.id),
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
      setTimeout(() => setSuccessMsg(null), 4000);
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
      setTimeout(() => setSuccessMsg(null), 4000);
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
      setTimeout(() => setSuccessMsg(null), 4000);
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
      setTimeout(() => setSuccessMsg(null), 4000);
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
      setTimeout(() => setSuccessMsg(null), 4000);
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
      setTimeout(() => setSuccessMsg(null), 4000);
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
    INCREASE_PERCENT: "↑",
    DECREASE_PERCENT: "↓",
    INCREASE_PCT: "↑",
    DECREASE_PCT: "↓",
  };

  const filteredAlerts = alerts.filter((alert) => {
    const isAlertEnabled = alert.enabled ?? alert.isEnabled ?? true;
    const matchesSearch =
      alert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alert.description && alert.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (alert.metric?.name && alert.metric.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === "ALL" ||
      (filterStatus === "TRIGGERED" && alert.status === "TRIGGERED" && isAlertEnabled) ||
      (filterStatus === "OK" && alert.status === "OK" && isAlertEnabled) ||
      (filterStatus === "DISABLED" && !isAlertEnabled);

    return matchesSearch && matchesStatus;
  });

  const activeCount = alerts.filter((a) => (a.enabled ?? a.isEnabled ?? true)).length;
  const triggeredCount = alerts.filter((a) => a.status === "TRIGGERED" && (a.enabled ?? a.isEnabled ?? true)).length;
  const monitoredMetricsCount = new Set(alerts.map((a) => a.metricId)).size;

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono-code text-[#898989]">Evaluating threshold conditions...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="Smart Alerts & Monitoring"
      subtitle="Configure automated threshold monitors, anomaly triggers, and live telemetry dispatches."
      breadcrumbs={[
        { label: "Data Studio", href: "/datasets" },
        { label: "Alerts & Triggers" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleEvaluateAll()}
            disabled={evaluatingAll || alerts.length === 0}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs font-mono-code text-[#fafafa] hover:bg-[#202020] disabled:opacity-50 transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${evaluatingAll ? "animate-spin text-[#ff6b35]" : ""}`} />
            <span>{evaluatingAll ? "Scanning..." : "Evaluate All"}</span>
          </button>

          {canCreate && (
            <button
              onClick={openCreateModal}
              id="create-alert-btn"
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Create Alert</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Alerts */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs font-mono-code text-red-300 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
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

        {/* 4-KPI Mesh Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>CONFIGURED RULES</span>
              <Bell className="h-4 w-4 text-[#ff6b35]" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{alerts.length}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Monitored criteria</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>ACTIVE MONITORS</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-emerald-400">{activeCount}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Automated evaluation</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>TRIGGERED ANOMALIES</span>
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-rose-400">{triggeredCount}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Requiring attention</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>MONITORED KPIS</span>
              <Layers className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{monitoredMetricsCount}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Linked semantic metrics</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 border-b border-[#242424] pb-4">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#898989] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search alerts by name, description, or monitored metric..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[#242424] bg-[#141414] pl-9 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-[#242424] bg-[#141414] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
          >
            <option value="ALL">All Statuses ({alerts.length})</option>
            <option value="TRIGGERED">Triggered Anomalies</option>
            <option value="OK">Normal (OK)</option>
            <option value="DISABLED">Paused</option>
          </select>
        </div>

        {/* Alerts Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono-code text-[#898989]">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent mb-3" />
            <p>Scanning trigger evaluation matrix...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2e2e2e] bg-[#141414]/50 p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff6b35]/10 text-[#ff6b35] text-2xl mb-4 border border-[#ff6b35]/20">
              <Bell className="h-7 w-7" />
            </div>
            <h3 className="text-base font-medium text-[#fafafa]">No Alerts Configured</h3>
            <p className="mt-1 text-xs text-[#898989] font-mono-code max-w-md mx-auto">
              {metrics.length === 0
                ? "You need at least one business metric before setting up alerts. Create a metric first."
                : "Keep your team informed by setting threshold triggers when metrics exceed or fall below critical values."}
            </p>
            {metrics.length === 0 ? (
              <Link
                href="/metrics"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
              >
                Go to Metrics & KPIs →
              </Link>
            ) : canCreate ? (
              <button
                onClick={openCreateModal}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create First Alert</span>
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
                  className={`rounded-xl border p-5 shadow-sm transition flex flex-col justify-between group ${
                    !isAlertEnabled
                      ? "border-[#242424] bg-[#141414]/60 opacity-60"
                      : alert.status === "TRIGGERED"
                      ? "border-rose-500/40 bg-rose-950/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                      : "border-[#242424] bg-[#141414] hover:border-[#ff6b35]/40"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-[#fafafa] text-base leading-snug group-hover:text-[#ff6b35] transition-colors truncate">
                        {alert.name}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isAlertEnabled ? (
                          <span className="inline-flex items-center rounded-md bg-[#181818] border border-[#2e2e2e] px-2 py-0.5 text-[10px] font-mono-code font-bold text-[#898989] uppercase">
                            Paused
                          </span>
                        ) : alert.status === "TRIGGERED" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 text-[10px] font-mono-code font-bold text-rose-300 uppercase animate-pulse">
                            <span>●</span> Triggered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono-code font-bold text-emerald-300 uppercase">
                            <span>●</span> OK
                          </span>
                        )}
                      </div>
                    </div>

                    {alert.description ? (
                      <p className="text-xs text-[#898989] mb-3 line-clamp-2">{alert.description}</p>
                    ) : (
                      <p className="text-xs text-[#666666] italic mb-3">No description provided</p>
                    )}

                    {/* Condition Box */}
                    <div className="rounded-lg bg-[#181818] border border-[#262626] p-3 mb-4 space-y-1.5 text-xs text-[#898989] font-mono-code">
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Target Metric:</span>
                        <span className="font-semibold text-[#fafafa] truncate max-w-[150px]">
                          {alert.metric?.name || "Metric"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">Trigger Rule:</span>
                        <span className="font-semibold text-[#ff6b35]">
                          {conditionSymbols[alert.condition]} {Number(alert.threshold).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#666666]">Last Checked:</span>
                        <span className="text-[#898989]">
                          {alert.lastEvaluatedAt
                            ? new Date(alert.lastEvaluatedAt).toLocaleTimeString()
                            : "Never"}
                        </span>
                      </div>
                      {alert.lastValue !== undefined && alert.lastValue !== null && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#666666]">Last Evaluated:</span>
                          <span className="font-bold text-[#fafafa]">
                            {Number(alert.lastValue).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="border-t border-[#242424] pt-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleEvaluate(alert.id)}
                        disabled={isEvaluating}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#181818] px-2.5 py-1.5 text-xs font-mono-code text-[#fafafa] hover:bg-[#222222] disabled:opacity-50 transition cursor-pointer"
                        title="Evaluate condition immediately"
                      >
                        <RefreshCw className={`h-3 w-3 ${isEvaluating ? "animate-spin text-[#ff6b35]" : ""}`} />
                        <span>{isEvaluating ? "..." : "Check"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryAlert(alert)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#181818] px-2 py-1.5 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#222222] transition cursor-pointer"
                        title="View evaluation logs"
                      >
                        <Eye className="h-3 w-3" />
                        <span>{historyCount}</span>
                      </button>

                      {alert.status === "TRIGGERED" && (
                        <button
                          type="button"
                          onClick={() => void handleClearAlert(alert.id)}
                          className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-2 py-1.5 text-[10px] font-mono-code font-bold text-rose-300 hover:bg-rose-900/50 transition cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleToggleEnable(alert)}
                        className={`rounded-lg p-1.5 text-xs font-mono-code transition cursor-pointer ${
                          isAlertEnabled
                            ? "text-emerald-400 hover:bg-emerald-950/40"
                            : "text-[#898989] hover:bg-[#222222]"
                        }`}
                        title={isAlertEnabled ? "Pause monitor" : "Activate monitor"}
                      >
                        {isAlertEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditModal(alert)}
                          className="rounded-lg p-1.5 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#1f1f1f] transition cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(alert)}
                          className="rounded-lg p-1.5 text-xs font-mono-code text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-[#fafafa]">
            <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
              <div>
                <h2 className="text-lg font-bold text-[#fafafa]">
                  {editingAlert ? "Edit Alert Condition" : "Create New Smart Alert"}
                </h2>
                <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                  Automated telemetry checks run on metric updates.
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

            <form onSubmit={(e) => void handleFormSubmit(e)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Alert Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Revenue Drop Alert, Customer Churn Warning"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain when this alert triggers and what action to take..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Monitored KPI / Metric *
                </label>
                <select
                  disabled={!!editingAlert}
                  value={formMetricId}
                  onChange={(e) => setFormMetricId(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code disabled:opacity-50"
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
                  <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                    Trigger Condition *
                  </label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as AlertCondition)}
                    className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
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
                  <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                    Threshold Value *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 100000"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="enable-toggle"
                  checked={formIsEnabled}
                  onChange={(e) => setFormIsEnabled(e.target.checked)}
                  className="rounded border-[#2e2e2e] bg-[#181818] text-[#ff6b35] focus:ring-[#ff6b35] accent-[#ff6b35]"
                />
                <label htmlFor="enable-toggle" className="text-xs font-mono-code text-[#898989] cursor-pointer">
                  Activate alert immediately upon creation
                </label>
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
                  {submitting ? "Saving..." : editingAlert ? "Update Alert" : "Create Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALERT HISTORY MODAL */}
      {historyAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[85vh] flex flex-col text-[#fafafa]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
              <div>
                <h3 className="text-base font-bold text-[#fafafa]">
                  Execution History: {historyAlert.name}
                </h3>
                <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                  Logged evaluations and trigger snapshots
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAlert(null)}
                className="text-[#898989] hover:text-[#fafafa] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-auto py-4">
              {!historyAlert.history || historyAlert.history.length === 0 ? (
                <div className="p-8 text-center text-[#898989] font-mono-code text-xs">
                  No evaluations recorded yet for this alert. Click &quot;Check&quot; on the alert card to run an evaluation.
                </div>
              ) : (
                <table className="min-w-[500px] w-full text-left text-xs">
                  <thead className="bg-[#181818] text-[#898989] font-mono-code border-b border-[#242424]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Timestamp</th>
                      <th className="px-3 py-2 font-semibold">Evaluated Value</th>
                      <th className="px-3 py-2 font-semibold">Threshold</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Notification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242424]">
                    {historyAlert.history.map((h: AlertHistoryData) => (
                      <tr key={h.id} className="hover:bg-[#181818]/60 transition-colors">
                        <td className="px-3 py-2 text-[#898989] font-mono-code whitespace-nowrap">
                          {new Date(h.evaluatedAt || h.triggeredAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono-code font-bold text-[#fafafa]">
                          {Number(h.metricValue).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono-code text-[#ff6b35]">
                          {conditionSymbols[historyAlert.condition]} {Number(h.threshold).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {h.triggered ? (
                            <span className="inline-flex rounded-full bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 text-[10px] font-mono-code font-bold text-rose-300">
                              TRIGGERED
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono-code font-bold text-emerald-300">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[#898989] font-mono-code text-[11px] truncate max-w-[160px]">
                          {h.message || (h.notified ? "Recorded in log" : "Normal")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-[#242424] flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryAlert(null)}
                className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-2 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
