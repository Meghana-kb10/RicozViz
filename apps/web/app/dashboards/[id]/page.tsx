"use client";

import { useEffect, useState, use, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import {
  apiGetDashboard,
  apiUpdateDashboard,
  apiDeleteDashboard,
  apiListCharts,
  apiCreateChart,
  apiUpdateChart,
  apiDeleteChart,
  apiListDatasets,
  apiQueryDataset,
  apiListVisualizations,
  apiCreateShareLink,
  apiGetShareLinkStatus,
  apiDisableShareLink,
  apiListDashboardCollaborators,
  apiGrantDashboardCollaborator,
  apiRevokeDashboardCollaborator,
  type DashboardCollaboratorData,
  apiGetDashboardSchedule,
  apiSaveDashboardSchedule,
  apiDeleteDashboardSchedule,
  apiGenerateDashboardReport,
  apiGetDashboardReportHistory,
  apiRunDashboardReport,
  type DashboardScheduleData,
  type DashboardReportSnapshot,
  type ReportFrequency,
  type ReportExecutionData,
  type DashboardData,
  type DashboardStatus,
  type DashboardVisibility,
  type ChartData,
  type ChartType,
  type VisualizationData,
  type DatasetData,
  type DatasetColumn,
  type DatasetQueryResult,
  type ShareLinkStatusResponse,
  ApiError,
} from "../../../lib/api";
import { buildChartQueryParams } from "../../../lib/chart-query-mapper";
import { ChartRenderer } from "../../../components/visualization/ChartRenderer";
import { VisualizationStudio } from "../../../components/visualization/VisualizationStudio";
import { DashboardFilterBar } from "../../../components/dashboard/DashboardFilterBar";
import {
  type DashboardFilter,
  type DrillDownState,
  isFilterApplicableToChart,
  mergeChartAndDashboardFilters,
  toggleCrossFilter,
  drillDownNext,
  drillDownPrev,
  encodeFiltersToUrl,
  parseFiltersFromUrl,
} from "../../../lib/dashboard-filters";
import { exportChartDataToCsv } from "../../../lib/export-csv";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  CircleDot,
  ScatterChart as ScatterIcon,
  Table as TableIcon,
  Hash,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  Sliders,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Save,
  Search,
  LayoutGrid,
  Maximize2,
  Minimize2,
  ExternalLink,
  Share2,
  Printer,
  Copy,
  Check,
  Globe,
  Lock,
  X,
  Download,
  Filter,
  Clock,
  Users,
  UserPlus,
  ShieldCheck,
} from "lucide-react";

const QUICK_CHART_TYPES: { value: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "BAR", label: "Bar Chart", icon: BarChart3 },
  { value: "LINE", label: "Line Chart", icon: LineChartIcon },
  { value: "AREA", label: "Area Chart", icon: LineChartIcon },
  { value: "PIE", label: "Pie Chart", icon: PieChartIcon },
  { value: "DONUT", label: "Donut Chart", icon: CircleDot },
  { value: "SCATTER", label: "Scatter Plot", icon: ScatterIcon },
  { value: "TABLE", label: "Data Table", icon: TableIcon },
  { value: "KPI", label: "KPI Metric", icon: Hash },
];

export default function DashboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { auth, isLoading, logout } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // View / Studio Toggle
  const [previewMode, setPreviewMode] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartData | null>(null);

  // Interactive Dashboard Filters & Cross-filtering
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilter[]>([]);
  // Drill-down state per chart
  const [drillDownStates, setDrillDownStates] = useState<Record<string, DrillDownState>>({});
  // Cache of query params to avoid duplicate requests
  const lastQueryParamsRef = useRef<Record<string, string>>({});

  // Query Results Cache for Canvas Charts: chartId -> query state
  const [chartQueryResults, setChartQueryResults] = useState<
    Record<string, { data: DatasetQueryResult | null; loading: boolean; error: string | null }>
  >({});

  // Deleting State
  const [deletingChartId, setDeletingChartId] = useState<string | null>(null);

  // Auto-Refresh & Last Updated State
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = Off, 30, 60, 300
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const [isRefreshingCharts, setIsRefreshingCharts] = useState(false);
  const isRefreshingRef = useRef(false);

  // Dashboard Meta Edit State
  const [isEditingDash, setIsEditingDash] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<DashboardStatus>("DRAFT");
  const [editVisibility, setEditVisibility] = useState<DashboardVisibility>("ORGANIZATION");
  const [savingDashEdit, setSavingDashEdit] = useState(false);
  const [showDeleteDashModal, setShowDeleteDashModal] = useState(false);

  // Saved Visualizations Library & Add Saved Modal State
  const [isAddSavedModalOpen, setIsAddSavedModalOpen] = useState(false);
  const [savedVisualizations, setSavedVisualizations] = useState<VisualizationData[]>([]);
  const [loadingSavedViz, setLoadingSavedViz] = useState(false);
  const [savedVizSearch, setSavedVizSearch] = useState("");
  const [addingVizId, setAddingVizId] = useState<string | null>(null);

  // Dashboard Save & Reload State
  const [savingDashboard, setSavingDashboard] = useState(false);
  const [reloadingDashboard, setReloadingDashboard] = useState(false);

  // Dashboard Share & Collaboration State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<"COLLABORATORS" | "PUBLIC_LINK">("COLLABORATORS");
  const [shareStatus, setShareStatus] = useState<ShareLinkStatusResponse | null>(null);
  const [loadingShareStatus, setLoadingShareStatus] = useState(false);
  const [updatingShare, setUpdatingShare] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [collaborators, setCollaborators] = useState<DashboardCollaboratorData[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<
    Array<{ userId: string; roleName: string; user: { id: string; name: string; email: string; avatarUrl: string | null } }>
  >([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<"VIEW" | "EDIT" | "ADMIN">("VIEW");
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [updatingCollaborator, setUpdatingCollaborator] = useState(false);

  // Dashboard Report Schedule & Snapshot State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState<DashboardScheduleData | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<ReportFrequency>("DAILY");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleRecipients, setScheduleRecipients] = useState("");
  const [scheduleWebhookUrl, setScheduleWebhookUrl] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [lastGeneratedReport, setLastGeneratedReport] = useState<DashboardReportSnapshot | null>(null);
  const [reportExecutions, setReportExecutions] = useState<ReportExecutionData[]>([]);
  const [reportFormat, setReportFormat] = useState<string>("PDF");
  const [scheduleModalTab, setScheduleModalTab] = useState<"CONFIG" | "HISTORY">("CONFIG");

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  // URL search params sync: Load initial filters from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = parseFiltersFromUrl(window.location.search);
    if (initial.length > 0) {
      setDashboardFilters(initial);
    }
  }, []);

  // URL search params sync: Update URL when dashboard filters change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = encodeFiltersToUrl(dashboardFilters);
    const currentPath = window.location.pathname;
    const targetUrl = q ? `${currentPath}?${q}` : currentPath;
    window.history.replaceState(null, "", targetUrl);
  }, [dashboardFilters]);

  // Load dashboard, charts, and datasets
  useEffect(() => {
    if (!auth || !id) return;
    let ignore = false;

      Promise.all([
        apiGetDashboard(id),
        apiListCharts(id),
        apiListDatasets().catch(() => [] as DatasetData[]),
        apiGetDashboardSchedule(id).catch(() => null),
      ])
        .then(([dashData, chartsData, datasetsData, scheduleRes]) => {
          if (!ignore) {
            setDashboard(dashData);
            setCharts(chartsData);
            setDatasets(datasetsData);
            setScheduleData(scheduleRes);
            if (scheduleRes) {
              setScheduleFrequency(scheduleRes.frequency);
              setScheduleEnabled(scheduleRes.enabled);
            }
            setEditName(dashData.name);
            setEditDescription(dashData.description || "");
            setEditStatus(dashData.status);
            setEditVisibility(dashData.visibility);
            setLoading(false);
          }
        })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dashboard");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, id]);

  // Execute query for a chart on the canvas with merged filters and drill-down
  const executeChartQuery = useCallback(
    async (
      chart: ChartData,
      activeFilters: DashboardFilter[],
      activeDrill?: DrillDownState | null,
      forceRefresh = false
    ) => {
      if (!chart.datasetId) {
        setChartQueryResults((prev) => ({
          ...prev,
          [chart.id]: { data: null, loading: false, error: null },
        }));
        return;
      }

      const dataset = datasets.find((d) => d.id === chart.datasetId);
      const datasetColumns = dataset?.columns;

      // Construct effective chart configuration with active drill dimension
      const effectiveConfig = JSON.parse(JSON.stringify(chart.config || {}));
      if (activeDrill && activeDrill.path && activeDrill.path.length > activeDrill.currentLevel) {
        const drillDim = activeDrill.path[activeDrill.currentLevel];
        effectiveConfig.dimensions = [drillDim];
      }

      // Merge chart-level filters with dashboard-level filters
      const mergedFilters = mergeChartAndDashboardFilters(
        chart,
        activeFilters,
        datasetColumns
      );

      // Append drill-down parent filters
      if (activeDrill && activeDrill.filters) {
        for (const df of activeDrill.filters) {
          mergedFilters.push({
            column: df.field,
            operator: "=",
            value: df.value,
          });
        }
      }

      effectiveConfig.filters = mergedFilters;
      const queryParams = buildChartQueryParams(effectiveConfig);

      // Query optimization: skip querying if params are identical and not forced
      const paramKey = JSON.stringify(queryParams);
      if (!forceRefresh && lastQueryParamsRef.current[chart.id] === paramKey) {
        return;
      }
      lastQueryParamsRef.current[chart.id] = paramKey;

      setChartQueryResults((prev) => ({
        ...prev,
        [chart.id]: { data: prev[chart.id]?.data ?? null, loading: true, error: null },
      }));

      try {
        const res = await apiQueryDataset(chart.datasetId, queryParams);
        setChartQueryResults((prev) => ({
          ...prev,
          [chart.id]: { data: res, loading: false, error: null },
        }));
      } catch (err) {
        setChartQueryResults((prev) => ({
          ...prev,
          [chart.id]: {
            data: null,
            loading: false,
            error: err instanceof ApiError ? err.message : "Query execution failed",
          },
        }));
      }
    },
    [datasets]
  );

  // Re-run queries for canvas charts when filters, drill levels, or charts list change
  useEffect(() => {
    if (loading || charts.length === 0) return;
    for (const chart of charts) {
      void executeChartQuery(chart, dashboardFilters, drillDownStates[chart.id] || null);
    }
  }, [charts, dashboardFilters, drillDownStates, executeChartQuery, loading]);

  // Handle data point interaction for cross-filtering or drill-down
  const handleChartDataPointClick = (chart: ChartData, field: string, value: unknown) => {
    // Check if chart has drillPath configured in config.options
    const drillPath = chart.config?.options?.drillPath as string[] | undefined;
    if (drillPath && drillPath.length > 1) {
      const currentDrill = drillDownStates[chart.id] || null;
      const nextDrill = drillDownNext(currentDrill, chart.id, drillPath, field, value);
      if (nextDrill && nextDrill !== currentDrill) {
        setDrillDownStates((prev) => ({ ...prev, [chart.id]: nextDrill }));
        return;
      }
    }

    // Standard cross-filter toggle
    setDashboardFilters((prev) =>
      toggleCrossFilter(prev, field, value, chart.id, chart.datasetId || undefined)
    );
  };

  // Revert drill-down to previous level
  const handleDrillBack = (chartId: string) => {
    setDrillDownStates((prev) => {
      const current = prev[chartId];
      if (!current) return prev;
      const reverted = drillDownPrev(current);
      if (!reverted) {
        const copy = { ...prev };
        delete copy[chartId];
        return copy;
      }
      return { ...prev, [chartId]: reverted };
    });
  };

  // Add dashboard filter
  const handleAddFilter = (filter: DashboardFilter) => {
    setDashboardFilters((prev) => [...prev, filter]);
  };

  // Remove dashboard filter
  const handleRemoveFilter = (filterId: string) => {
    setDashboardFilters((prev) => prev.filter((f) => f.id !== filterId));
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setDashboardFilters([]);
  };

  // Lightweight Refresh of All Visualizations without page reload
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshingCharts(true);
    try {
      await Promise.allSettled(
        charts.map((chart) =>
          executeChartQuery(chart, dashboardFilters, drillDownStates[chart.id] || null, true)
        )
      );
      setLastUpdatedAt(new Date());
    } catch {
      // Gracefully handle any query execution error
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshingCharts(false);
    }
  }, [charts, dashboardFilters, drillDownStates, executeChartQuery]);

  // Auto-refresh interval timer (stops polling when unmounted)
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const intervalId = setInterval(() => {
      void handleManualRefresh();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, handleManualRefresh]);

  // Distinct column values for multi-select category filter
  const columnValues = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const res of Object.values(chartQueryResults)) {
      if (res.data?.rows) {
        for (const row of res.data.rows) {
          for (const [key, val] of Object.entries(row)) {
            if (val !== null && val !== undefined) {
              if (!map[key]) map[key] = new Set<string>();
              if (map[key].size < 50) {
                map[key].add(String(val));
              }
            }
          }
        }
      }
    }
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(map)) {
      result[k] = Array.from(v);
    }
    return result;
  }, [chartQueryResults]);

  // Reset entire dashboard to default state
  const handleResetDashboard = () => {
    setDashboardFilters([]);
    setDrillDownStates({});
    lastQueryParamsRef.current = {};
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
    for (const chart of charts) {
      void executeChartQuery(chart, [], null, true);
    }
    setSuccessMsg("Dashboard filters and drill levels reset to default state.");
  };

  // Open Visualization Studio for New Chart
  const handleOpenNewStudio = (presetType?: ChartType) => {
    setEditingChart(
      presetType
        ? ({
            title: `New ${presetType} Chart`,
            chartType: presetType,
            config: {},
          } as ChartData)
        : null
    );
    setIsStudioOpen(true);
  };

  // Open Visualization Studio to Edit Existing Chart
  const handleOpenEditStudio = (chart: ChartData) => {
    setEditingChart(chart);
    setIsStudioOpen(true);
  };

  // Delete chart
  const handleDeleteChart = async (chartId: string) => {
    if (!dashboard) return;
    setErrorMsg(null);

    try {
      await apiDeleteChart(dashboard.id, chartId);
      setCharts((prev) => prev.filter((c) => c.id !== chartId));
      setSuccessMsg("Visualization deleted from dashboard.");
      setDeletingChartId(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete visualization");
      setDeletingChartId(null);
    }
  };

  // Save dashboard metadata
  const handleSaveDashEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboard) return;
    setSavingDashEdit(true);

    try {
      const updated = await apiUpdateDashboard(dashboard.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        visibility: editVisibility,
      });

      setDashboard(updated);
      setIsEditingDash(false);
      setSuccessMsg("Dashboard details updated.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update dashboard");
    } finally {
      setSavingDashEdit(false);
    }
  };

  // Delete dashboard entirely
  const handleDeleteDashboard = async () => {
    if (!dashboard) return;
    try {
      await apiDeleteDashboard(dashboard.id);
      void router.replace("/dashboards");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete dashboard");
      setShowDeleteDashModal(false);
    }
  };

  // Fetch saved visualizations from the library
  const loadSavedVisualizations = useCallback(async () => {
    setLoadingSavedViz(true);
    try {
      const vizs = await apiListVisualizations();
      setSavedVisualizations(vizs);
    } catch {
      // Non-blocking library load failure
    } finally {
      setLoadingSavedViz(false);
    }
  }, []);

  // Initial load of saved visualizations library
  useEffect(() => {
    if (!auth) return;
    void loadSavedVisualizations();
  }, [auth, loadSavedVisualizations]);

  // Open Add Saved Modal
  const handleOpenAddSavedModal = () => {
    setIsAddSavedModalOpen(true);
    void loadSavedVisualizations();
  };

  // Add saved visualization directly to this dashboard
  const handleAddSavedVisualization = async (viz: VisualizationData) => {
    if (!dashboard) return;
    setAddingVizId(viz.id);
    setErrorMsg(null);
    try {
      const nextOrder = charts.length;
      const newChart = await apiCreateChart(dashboard.id, {
        title: viz.title,
        description: viz.description || null,
        chartType: viz.chartType,
        datasetId: viz.datasetId,
        config: viz.config as any,
        position: {
          x: (nextOrder % 2) * 6,
          y: Math.floor(nextOrder / 2) * 4,
          w: 6,
          h: 4,
        },
        sortOrder: nextOrder,
      });

      setCharts((prev) => [...prev, newChart]);
      void executeChartQuery(newChart, dashboardFilters, null, true);
      setIsAddSavedModalOpen(false);
      setSuccessMsg(`Visualization "${viz.title}" added to dashboard.`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to add saved visualization");
    } finally {
      setAddingVizId(null);
    }
  };

  // Resize chart width on the grid (w: 4, 6, 12)
  const handleUpdateChartWidth = async (chartId: string, w: number) => {
    if (!dashboard) return;
    const chart = charts.find((c) => c.id === chartId);
    if (!chart) return;

    const newPos = { ...(chart.position || { x: 0, y: 0, w: 6, h: 4 }), w };
    setCharts((prev) =>
      prev.map((c) => (c.id === chartId ? { ...c, position: newPos } : c))
    );

    try {
      await apiUpdateChart(dashboard.id, chartId, { position: newPos });
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update layout");
    }
  };

  // Resize chart height on the grid (h: 4 = 250px, h: 6 = 380px)
  const handleUpdateChartHeight = async (chartId: string, h: number) => {
    if (!dashboard) return;
    const chart = charts.find((c) => c.id === chartId);
    if (!chart) return;

    const newPos = { ...(chart.position || { x: 0, y: 0, w: 6, h: 4 }), h };
    setCharts((prev) =>
      prev.map((c) => (c.id === chartId ? { ...c, position: newPos } : c))
    );

    try {
      await apiUpdateChart(dashboard.id, chartId, { position: newPos });
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update height");
    }
  };

  // Save Dashboard Layout & Chart Configurations
  const handleSaveDashboard = async () => {
    if (!dashboard) return;
    setSavingDashboard(true);
    setErrorMsg(null);
    try {
      const updated = await apiUpdateDashboard(dashboard.id, {
        layoutConfig: {
          chartCount: charts.length,
          chartOrder: charts.map((c) => c.id),
          lastSavedAt: new Date().toISOString(),
        },
      });
      setDashboard(updated);

      // Persist all charts' positions
      await Promise.all(
        charts.map((c) =>
          apiUpdateChart(dashboard.id, c.id, {
            position: c.position,
            sortOrder: c.sortOrder,
          }).catch(() => null)
        )
      );

      setSuccessMsg("Dashboard layout and visualizations saved successfully.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save dashboard");
    } finally {
      setSavingDashboard(false);
    }
  };

  // Reload Dashboard with Fresh Data from Database
  const handleReloadDashboard = async () => {
    if (!dashboard) return;
    setReloadingDashboard(true);
    setErrorMsg(null);
    lastQueryParamsRef.current = {};
    try {
      const [dashData, chartsData] = await Promise.all([
        apiGetDashboard(id),
        apiListCharts(id),
      ]);
      setDashboard(dashData);
      setCharts(chartsData);
      setEditName(dashData.name);
      setEditDescription(dashData.description || "");
      setEditStatus(dashData.status);
      setEditVisibility(dashData.visibility);

      for (const c of chartsData) {
        void executeChartQuery(c, dashboardFilters, null, true);
      }
      setSuccessMsg("Dashboard reloaded with latest database records.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to reload dashboard");
    } finally {
      setReloadingDashboard(false);
    }
  };

  // Share & Collaboration Management Handlers
  const handleOpenShareModal = async () => {
    setIsShareModalOpen(true);
    setLoadingShareStatus(true);
    setLoadingCollaborators(true);
    try {
      const [res, colRes] = await Promise.all([
        apiGetShareLinkStatus(id).catch(() => null),
        apiListDashboardCollaborators(id).catch(() => null),
      ]);
      if (res) setShareStatus(res);
      if (colRes) {
        setCollaborators(colRes.collaborators || []);
        setWorkspaceMembers(colRes.workspaceMembers || []);
        if (colRes.workspaceMembers && colRes.workspaceMembers.length > 0) {
          setSelectedMemberId(colRes.workspaceMembers[0].userId);
        }
      }
    } catch (err) {
      console.error("Failed to load share status or collaborators", err);
    } finally {
      setLoadingShareStatus(false);
      setLoadingCollaborators(false);
    }
  };

  const handleGrantCollaborator = async () => {
    if (!selectedMemberId) return;
    setUpdatingCollaborator(true);
    try {
      const res = await apiGrantDashboardCollaborator(id, {
        targetUserId: selectedMemberId,
        accessLevel: selectedAccessLevel,
      });
      setCollaborators((prev) => {
        const filtered = prev.filter((c) => c.userId !== res.collaborator.userId);
        return [res.collaborator, ...filtered];
      });
      setSuccessMsg("Collaborator access updated successfully!");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to grant collaborator access");
    } finally {
      setUpdatingCollaborator(false);
    }
  };

  const handleRevokeCollaborator = async (collaboratorUserId: string) => {
    setUpdatingCollaborator(true);
    try {
      await apiRevokeDashboardCollaborator(id, collaboratorUserId);
      setCollaborators((prev) => prev.filter((c) => c.userId !== collaboratorUserId));
      setSuccessMsg("Collaborator access revoked successfully!");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to revoke collaborator");
    } finally {
      setUpdatingCollaborator(false);
    }
  };

  const handleCreateShareLink = async () => {
    setUpdatingShare(true);
    try {
      const res = await apiCreateShareLink(id);
      setShareStatus(res);
      setSuccessMsg("Public share link created successfully!");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to create share link");
    } finally {
      setUpdatingShare(false);
    }
  };

  const handleDisableShareLink = async () => {
    setUpdatingShare(true);
    try {
      const res = await apiDisableShareLink(id);
      setShareStatus(res);
      setSuccessMsg("Share link disabled. Public access has been revoked.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to disable share link");
    } finally {
      setUpdatingShare(false);
    }
  };

  // Schedule Management Handlers
  const handleOpenScheduleModal = async () => {
    setIsScheduleModalOpen(true);
    setLoadingSchedule(true);
    setScheduleModalTab("CONFIG");
    try {
      const [res, historyRes] = await Promise.all([
        apiGetDashboardSchedule(id).catch(() => null),
        apiGetDashboardReportHistory(id).catch(() => []),
      ]);
      setScheduleData(res);
      setReportExecutions(historyRes);
      if (res) {
        setScheduleFrequency(res.frequency);
        setScheduleEnabled(res.enabled);
        setScheduleRecipients(res.recipients?.join(", ") || "");
        setScheduleWebhookUrl(res.webhookUrl || "");
      } else {
        setScheduleRecipients("");
        setScheduleWebhookUrl("");
      }
    } catch {
      // Gracefully handle error
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    setErrorMsg(null);
    try {
      const recipientsList = scheduleRecipients
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);

      const res = await apiSaveDashboardSchedule(id, {
        frequency: scheduleFrequency,
        enabled: scheduleEnabled,
        recipients: recipientsList.length > 0 ? recipientsList : undefined,
        webhookUrl: scheduleWebhookUrl.trim() || undefined,
        deliveryType:
          recipientsList.length > 0 && scheduleWebhookUrl.trim()
            ? "BOTH"
            : scheduleWebhookUrl.trim()
            ? "WEBHOOK"
            : "EMAIL",
      });
      setScheduleData(res);
      setSuccessMsg(`Report schedule saved (${scheduleFrequency}, ${scheduleEnabled ? "Active" : "Paused"}).`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save report schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async () => {
    setDeletingSchedule(true);
    setErrorMsg(null);
    try {
      await apiDeleteDashboardSchedule(id);
      setScheduleData(null);
      setSuccessMsg("Dashboard report schedule deleted.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete report schedule");
    } finally {
      setDeletingSchedule(false);
    }
  };

  const handleGenerateReportNow = async () => {
    setGeneratingReport(true);
    setErrorMsg(null);
    try {
      const runResult = await apiRunDashboardReport(id, reportFormat);
      setLastGeneratedReport(runResult.snapshot);
      setSuccessMsg(
        `Report generated successfully (${runResult.execution?.format || reportFormat}, ${runResult.snapshot.chartCount} charts).`
      );
      const historyRes = await apiGetDashboardReportHistory(id).catch(() => []);
      setReportExecutions(historyRes);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to generate report snapshot");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!shareStatus?.shareUrl) return;
    void navigator.clipboard.writeText(shareStatus.shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  // Export / Print Dashboard Handler
  const handlePrintDashboard = () => {
    window.print();
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Opening Dashboard Studio...</span>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-base font-semibold text-gray-900">Dashboard not found</p>
          <Link
            href="/dashboards"
            className="mt-4 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            ← Back to Dashboards
          </Link>
        </div>
      </div>
    );
  }

  // If Studio is open, render the full 3-panel Visualization Studio
  if (isStudioOpen) {
    return (
      <VisualizationStudio
        dashboardId={id}
        dashboardName={dashboard.name}
        initialChart={editingChart}
        datasets={datasets}
        onClose={() => {
          setIsStudioOpen(false);
          setEditingChart(null);
        }}
        onSaved={(savedChart) => {
          setCharts((prev) => {
            const exists = prev.some((c) => c.id === savedChart.id);
            if (exists) {
              return prev.map((c) => (c.id === savedChart.id ? savedChart : c));
            }
            return [...prev, savedChart];
          });
          void executeChartQuery(savedChart, dashboardFilters, null, true);
          setIsStudioOpen(false);
          setEditingChart(null);
          setSuccessMsg(`Visualization "${savedChart.title}" saved successfully.`);
        }}
      />
    );
  }

  const userInitials = auth?.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const canEdit = auth?.role === "ADMIN" || auth?.role === "ANALYST";

  const availableColumns: DatasetColumn[] = Array.from(
    new Map(
      datasets
        .flatMap((d) => d.columns || [])
        .map((c) => [c.name, c])
    ).values()
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col antialiased">
      {/* ============================================================ */}
      {/* 1. TOP BAR — Enterprise Dashboard Studio Header */}
      {/* ============================================================ */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-20 no-print">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
                R
              </span>
              <span className="text-sm tracking-tight">RicozViz</span>
            </Link>

            <span className="text-gray-300">/</span>
            <Link href="/dashboards" className="text-xs text-gray-500 hover:text-gray-900">
              Dashboards
            </Link>
            <span className="text-gray-300">/</span>

            {/* Dashboard Title & Badge */}
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-gray-900 line-clamp-1">
                {dashboard.name}
              </h1>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  dashboard.status === "PUBLISHED"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : dashboard.status === "ARCHIVED"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {dashboard.status}
              </span>
            </div>
          </div>

          {/* Right Controls: Mode Toggle, Add Visualization, Profile */}
          <div className="flex items-center gap-2.5">
            {/* View Mode Switch */}
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                className={`rounded-md px-2.5 py-1 transition ${
                  !previewMode
                    ? "bg-white text-gray-900 shadow-2xs font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Studio</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className={`rounded-md px-2.5 py-1 transition ${
                  previewMode
                    ? "bg-white text-gray-900 shadow-2xs font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Preview</span>
                </span>
              </button>
            </div>

            {/* Reload Dashboard Button */}
            <button
              type="button"
              onClick={handleReloadDashboard}
              disabled={reloadingDashboard}
              title="Reload Dashboard from Database"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reloadingDashboard ? "animate-spin text-indigo-600" : "text-gray-500"}`} />
              <span className="hidden sm:inline">{reloadingDashboard ? "Reloading..." : "Reload"}</span>
            </button>

            {/* Auto-Refresh & Manual Visualizations Refresh Controls */}
            <div className="flex items-center gap-1 bg-gray-100/90 border border-gray-200 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshingCharts}
                title="Refresh Visualizations Now"
                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshingCharts ? "animate-spin text-indigo-600" : "text-gray-500"}`} />
                <span className="hidden md:inline">Refresh</span>
              </button>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                title="Auto-refresh interval"
                className="bg-transparent text-[11px] font-medium text-gray-600 focus:outline-none cursor-pointer py-0.5"
              >
                <option value={0}>Auto: Off</option>
                <option value={30}>Auto: 30s</option>
                <option value={60}>Auto: 1m</option>
                <option value={300}>Auto: 5m</option>
              </select>
              <span className="text-[10px] text-gray-400 pl-1 border-l border-gray-300 hidden xl:inline" title="Last updated time">
                Updated {lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* Save Status Indicator */}
            <div className="hidden lg:flex items-center">
              {savingDashboard ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                  Saving...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Saved
                </span>
              )}
            </div>

            {/* Filter Count Badge */}
            {dashboardFilters.length > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                <Filter className="h-3 w-3" />
                {dashboardFilters.length} active
              </span>
            )}

            {/* Export / Print Dashboard Button */}
            <button
              type="button"
              onClick={handlePrintDashboard}
              title="Export / Print Dashboard as PDF"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <Printer className="h-3.5 w-3.5 text-gray-500" />
              <span className="hidden sm:inline">Export / Print</span>
            </button>

            {/* Share Dashboard Button */}
            <button
              type="button"
              onClick={handleOpenShareModal}
              title="Share Dashboard via Secure Link"
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
            >
              <Share2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Schedule Report Button */}
            <button
              type="button"
              onClick={handleOpenScheduleModal}
              title="Configure Automated Report Schedule"
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/60 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition shadow-2xs"
            >
              <Clock className="h-3.5 w-3.5 text-purple-600" />
              <span className="hidden sm:inline">Schedule</span>
            </button>

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleOpenAddSavedModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 transition"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Add Saved Chart</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenNewStudio()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Chart</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDashboard}
                  disabled={savingDashboard}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition disabled:opacity-70"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingDashboard ? "Saving..." : "Save Dashboard"}</span>
                </button>
              </>
            )}

            <div className="h-5 w-px bg-gray-200" />

            {/* Profile Avatar */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100">
                <span className="text-[11px] font-semibold text-indigo-700">{userInitials}</span>
              </div>
              <button
                onClick={() => {
                  void logout();
                  router.replace("/login");
                }}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Interactive Dashboard Filter Bar */}
      <DashboardFilterBar
        availableColumns={availableColumns}
        filters={dashboardFilters}
        onAddFilter={handleAddFilter}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
        onResetDashboard={handleResetDashboard}
        columnValues={columnValues}
      />

      {/* Global Alerts */}
      {errorMsg && (
        <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-700 border-b border-red-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-red-500">×</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 px-4 py-2 text-xs font-medium text-green-700 border-b border-green-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-green-500">×</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. DASHBOARD BODY */}
      {/* ============================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Quick Palette (Hidden in Preview Mode) */}
        {!previewMode && (
          <aside className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto hidden md:flex no-print">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Visualizations
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Select a chart type to configure
              </p>
            </div>

            {/* Quick Chart Type Buttons */}
            <div className="p-3 space-y-1">
              {QUICK_CHART_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleOpenNewStudio(type.value)}
                    className="w-full flex items-center justify-between rounded-lg p-2 text-left text-xs font-medium text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-gray-500 group-hover:text-indigo-600" />
                      <span>{type.label}</span>
                    </div>
                    <span className="text-gray-300 group-hover:text-indigo-500 text-xs font-bold">
                      +
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Saved Visualizations Library Section */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderPlus className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Saved Library</span>
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">
                  {savedVisualizations.length}
                </span>
              </div>
              <div className="space-y-1.5 mt-2 max-h-44 overflow-y-auto">
                {savedVisualizations.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">No saved charts.</p>
                ) : (
                  savedVisualizations.slice(0, 10).map((viz) => (
                    <div
                      key={viz.id}
                      onClick={() => void handleAddSavedVisualization(viz)}
                      className="rounded-lg border border-gray-100 p-2 hover:border-indigo-300 hover:bg-indigo-50/50 transition cursor-pointer text-xs flex items-center justify-between group"
                      title="Click to add to dashboard"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-gray-800 truncate">{viz.title}</p>
                        <span className="text-[10px] text-indigo-600 font-mono font-bold uppercase">{viz.chartType}</span>
                      </div>
                      <span className="text-indigo-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition">
                        +
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Available Datasets Section */}
            <div className="p-4 border-t border-gray-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Datasets</span>
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">
                  {datasets.length}
                </span>
              </div>
              <div className="space-y-1.5 mt-2">
                {datasets.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">No datasets found.</p>
                ) : (
                  datasets.map((ds) => (
                    <div
                      key={ds.id}
                      onClick={() => handleOpenNewStudio()}
                      className="rounded-lg border border-gray-100 p-2 hover:border-indigo-200 hover:bg-indigo-50/30 transition cursor-pointer text-xs"
                      title="Open in Visualization Studio"
                    >
                      <p className="font-semibold text-gray-800 line-clamp-1">{ds.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                        <span className="rounded bg-gray-100 px-1.5 py-0.2 uppercase font-mono">
                          {ds.type}
                        </span>
                        {ds.rowCount !== undefined && <span>{ds.rowCount} rows</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Charts Outline */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-indigo-500" />
                <span>Active Charts ({charts.length})</span>
              </span>
              <ul className="mt-2 space-y-1">
                {charts.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => handleOpenEditStudio(c)}
                    className="flex items-center justify-between text-xs text-gray-600 hover:text-indigo-600 cursor-pointer py-1 truncate"
                  >
                    <span className="truncate">📊 {c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        {/* Center Canvas */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col print:p-0 print:bg-white print:overflow-visible">
          {/* Printable Report Header (Visible only when printing) */}
          <div className="hidden print:block mb-6 border-b-2 border-gray-900 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
                {dashboard.description && (
                  <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
                )}
              </div>
              <div className="text-right text-xs text-gray-500">
                <p className="font-bold text-indigo-700 uppercase tracking-wider text-sm">RicozViz Report</p>
                <p className="mt-1">Generated: {new Date().toLocaleDateString()}</p>
                <p>Status: {dashboard.status}</p>
              </div>
            </div>
          </div>

          {/* Dashboard Meta Bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div>
              {isEditingDash ? (
                <form onSubmit={handleSaveDashEdit} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-bold text-gray-900"
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description"
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                  />
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as DashboardStatus)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <button
                    type="submit"
                    disabled={savingDashEdit}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDash(false)}
                    className="text-xs text-gray-500"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div>
                  <h2 className="text-base font-bold text-gray-900">{dashboard.name}</h2>
                  {dashboard.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{dashboard.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Dashboard Quick Meta Actions */}
            <div className="flex items-center gap-3 text-xs">
              {canEdit && !isEditingDash && (
                <button
                  type="button"
                  onClick={() => setIsEditingDash(true)}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 font-medium"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit Info</span>
                </button>
              )}
              {auth?.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setShowDeleteDashModal(true)}
                  className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {charts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center shadow-xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                No visualizations on this dashboard
              </h3>
              <p className="mt-1 text-xs text-gray-500 max-w-sm">
                Add an existing visualization from your saved library, or create a brand new chart from your datasets.
              </p>
              {canEdit && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                  <button
                    type="button"
                    onClick={handleOpenAddSavedModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 transition"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>Add Saved Visualization</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenNewStudio()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New Visualization</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Dashboard Grid Canvas — 12-Column Responsive Layout */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {charts.map((chart) => {
                const queryState = chartQueryResults[chart.id];
                const dims = chart.config?.dimensions || [];
                const measures = chart.config?.measures || [];
                const dataset = datasets.find((d) => d.id === chart.datasetId);
                const datasetColumns = dataset?.columns;

                const width = chart.position?.w || 6;
                const heightUnit = chart.position?.h || 4;
                const chartHeight = heightUnit === 6 ? 380 : 250;
                const colSpanClass =
                  width >= 12
                    ? "col-span-12"
                    : width <= 4
                      ? "col-span-12 md:col-span-6 xl:col-span-4"
                      : "col-span-12 md:col-span-6 xl:col-span-6";

                const applicableFilters = dashboardFilters.filter((df) => {
                  if (df.isCrossFilter && df.sourceChartId === chart.id) return false;
                  return isFilterApplicableToChart(df, chart, datasetColumns);
                });

                const isCrossFilterSource = dashboardFilters.some(
                  (df) => df.isCrossFilter && df.sourceChartId === chart.id
                );
                const activeSourceFilter = dashboardFilters.find(
                  (df) => df.isCrossFilter && df.sourceChartId === chart.id
                );
                const activeDrill = drillDownStates[chart.id];

                return (
                  <div
                    key={chart.id}
                    className={`rounded-xl border border-gray-200 bg-white shadow-xs flex flex-col justify-between overflow-hidden group hover:shadow-md transition ${colSpanClass} break-inside-avoid print:shadow-none print:border-gray-300 print:mb-6`}
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                            {chart.title}
                          </h4>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-[10px] font-bold text-indigo-700 shrink-0">
                            {chart.chartType}
                          </span>
                        </div>
                        {chart.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                            {chart.description}
                          </p>
                        )}
                      </div>

                      {/* Card Actions: Width, Height, Refresh, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0 no-print">
                        {canEdit && (
                          <div className="hidden sm:flex items-center gap-0.5 bg-gray-100 rounded p-0.5 text-[10px] mr-1">
                            <button
                              type="button"
                              onClick={() => void handleUpdateChartWidth(chart.id, 6)}
                              title="Half Width (6 columns)"
                              className={`px-1.5 py-0.5 rounded font-mono transition ${width === 6 ? "bg-white font-bold text-indigo-700 shadow-2xs" : "text-gray-500 hover:text-gray-900"}`}
                            >
                              1/2
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleUpdateChartWidth(chart.id, 12)}
                              title="Full Width (12 columns)"
                              className={`px-1.5 py-0.5 rounded font-mono transition ${width >= 12 ? "bg-white font-bold text-indigo-700 shadow-2xs" : "text-gray-500 hover:text-gray-900"}`}
                            >
                              Full
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleUpdateChartHeight(chart.id, heightUnit === 6 ? 4 : 6)}
                              title={heightUnit === 6 ? "Make Compact Height" : "Make Tall Height"}
                              className={`px-1.5 py-0.5 rounded font-mono transition ${heightUnit === 6 ? "bg-white font-bold text-indigo-700 shadow-2xs" : "text-gray-500 hover:text-gray-900"}`}
                            >
                              {heightUnit === 6 ? "Tall" : "Def"}
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const ok = exportChartDataToCsv(chart.title, queryState?.data);
                            if (!ok) {
                              setErrorMsg("No query data available to export for this chart.");
                            } else {
                              setSuccessMsg(`Exported data for "${chart.title}" as CSV.`);
                            }
                          }}
                          title="Export Current Chart Data (CSV)"
                          disabled={!queryState?.data?.rows || queryState?.data?.rows.length === 0}
                          className="rounded p-1 text-gray-400 hover:text-emerald-600 hover:bg-gray-100 text-xs transition disabled:opacity-30 disabled:hover:text-gray-400"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void executeChartQuery(chart, dashboardFilters, activeDrill, true)}
                          title="Refresh Query"
                          disabled={queryState?.loading}
                          className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 text-xs transition"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${queryState?.loading ? "animate-spin text-indigo-600" : ""}`} />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditStudio(chart)}
                              title="Edit in Visualization Studio"
                              className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xs transition"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingChartId(chart.id)}
                              title="Delete Visualization"
                              className="rounded p-1 text-red-400 hover:text-red-700 hover:bg-red-50 text-xs transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Filter / Drill-down Indicators */}
                    {(applicableFilters.length > 0 || isCrossFilterSource || activeDrill) && (
                      <div className="px-4 py-1.5 bg-indigo-50/40 border-b border-indigo-100 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {isCrossFilterSource && activeSourceFilter && (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 shadow-2xs">
                            <span>⚡ Cross-filtering: {activeSourceFilter.field} = {String(activeSourceFilter.value)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFilter(activeSourceFilter.id)}
                              className="hover:text-indigo-950 font-bold ml-1"
                              title="Clear cross-filter"
                            >
                              ×
                            </button>
                          </span>
                        )}
                        {applicableFilters.map((af) => (
                          <span
                            key={af.id}
                            className="inline-flex items-center gap-1 rounded bg-white text-gray-700 border border-indigo-200 px-2 py-0.5 shadow-2xs font-medium"
                          >
                            <span>Filtered by: <strong className="font-semibold text-gray-900">{af.field}</strong> {af.operator} {String(af.value)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFilter(af.id)}
                              className="text-gray-400 hover:text-gray-700 font-bold ml-1"
                              title="Remove this filter"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {activeDrill && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 font-medium shadow-2xs">
                            <span>Drill level: <strong>{activeDrill.path[activeDrill.currentLevel]}</strong></span>
                            <button
                              type="button"
                              onClick={() => handleDrillBack(chart.id)}
                              className="text-indigo-600 hover:text-indigo-800 underline font-semibold ml-1 cursor-pointer"
                            >
                              ← Back
                            </button>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card Visualization Body */}
                    <div className="p-4 flex-1 flex flex-col justify-center" style={{ minHeight: chartHeight + 20 }}>
                      <ChartRenderer
                        chartType={chart.chartType}
                        config={chart.config}
                        queryResult={queryState?.data || null}
                        isLoading={queryState?.loading || false}
                        error={queryState?.error || null}
                        height={chartHeight}
                        onDataPointClick={(field, value) => handleChartDataPointClick(chart, field, value)}
                        selectedFilterValue={
                          dashboardFilters.find(
                            (f) => f.isCrossFilter && f.sourceChartId === chart.id
                          )?.value
                        }
                        onClearFilter={() => {
                          setDashboardFilters((prev) =>
                            prev.filter((f) => !isFilterApplicableToChart(f, chart, datasetColumns))
                          );
                        }}
                        drillDown={
                          chart.config?.options?.drillPath
                            ? {
                                path: chart.config.options.drillPath as string[],
                                currentLevel: drillDownStates[chart.id]?.currentLevel ?? 0,
                                onDrillBack: () => handleDrillBack(chart.id),
                              }
                            : null
                        }
                      />
                    </div>

                    {/* Card Metadata Footer */}
                    <div className="px-4 py-2 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span className="truncate max-w-[140px] flex items-center gap-1">
                        <Database className="h-3 w-3 text-gray-400 shrink-0" />
                        <span>{chart.datasetName || "Dataset"}</span>
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        {dims.length > 0 && <span>Dim: {dims[0]}</span>}
                        {measures.length > 0 && (
                          <span>
                            {measures[0].aggregation}({measures[0].column})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Delete Chart Confirmation Modal */}
      {deletingChartId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Delete Visualization?</h3>
            <p className="mt-1 text-xs text-gray-500">
              Are you sure you want to remove this chart from the dashboard? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingChartId(null)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteChart(deletingChartId)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dashboard Confirmation Modal */}
      {showDeleteDashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Delete Dashboard?</h3>
            <p className="mt-1 text-xs text-gray-500">
              This will permanently delete this dashboard and all associated visualization configurations.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteDashModal(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteDashboard()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Delete Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Saved Visualization Modal */}
      {isAddSavedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Add Saved Visualization</h3>
                  <p className="text-xs text-gray-500">
                    Select a visualization from your library to add to this dashboard.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSavedModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter saved visualizations by title, chart type, or dataset..."
                  value={savedVizSearch}
                  onChange={(e) => setSavedVizSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>
            </div>

            {/* Visualizations List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5 bg-gray-50/30">
              {loadingSavedViz ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-gray-500">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  <span>Loading saved visualizations library...</span>
                </div>
              ) : savedVisualizations.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mx-auto mb-3">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">No saved visualizations yet</h4>
                  <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
                    Create and save charts in the Visualization Studio first, then add them to your dashboards.
                  </p>
                  <Link
                    href="/visualizations"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
                  >
                    <span>Open Visualization Studio</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                (() => {
                  const filtered = savedVisualizations.filter((viz) => {
                    if (!savedVizSearch.trim()) return true;
                    const q = savedVizSearch.toLowerCase();
                    return (
                      viz.title.toLowerCase().includes(q) ||
                      viz.chartType.toLowerCase().includes(q) ||
                      (viz.datasetName && viz.datasetName.toLowerCase().includes(q))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center text-xs text-gray-500">
                        No saved visualizations matching &quot;{savedVizSearch}&quot;.
                      </div>
                    );
                  }

                  return filtered.map((viz) => {
                    const isAdding = addingVizId === viz.id;
                    const catField = viz.config?.category || viz.config?.xAxis || (viz.config?.dimensions && viz.config.dimensions[0]);
                    const valField = viz.config?.value || viz.config?.yAxis || (viz.config?.measures && viz.config.measures[0]?.column);
                    const agg = viz.config?.aggregation || (viz.config?.measures && viz.config.measures[0]?.aggregation) || "SUM";

                    return (
                      <div
                        key={viz.id}
                        className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-gray-900 truncate">{viz.title}</h4>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-[10px] font-bold text-indigo-700 uppercase">
                              {viz.chartType}
                            </span>
                          </div>
                          {viz.description && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{viz.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-gray-500 font-mono">
                            {viz.datasetName && (
                              <span className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5">
                                <Database className="h-2.5 w-2.5 text-gray-400" />
                                <span>{viz.datasetName}</span>
                              </span>
                            )}
                            {catField && (
                              <span className="bg-gray-100 rounded px-1.5 py-0.5">
                                X: {String(catField)}
                              </span>
                            )}
                            {valField && (
                              <span className="bg-gray-100 rounded px-1.5 py-0.5">
                                Y: {agg}({String(valField)})
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isAdding}
                          onClick={() => void handleAddSavedVisualization(viz)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 transition disabled:opacity-70 shrink-0"
                        >
                          {isAdding ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Adding...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              <span>Add to Dashboard</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
              <span className="text-gray-400 text-[11px]">
                {savedVisualizations.length} saved visualization{savedVisualizations.length === 1 ? "" : "s"} available
              </span>
              <button
                type="button"
                onClick={() => setIsAddSavedModalOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. SHARE & COLLABORATION MODAL */}
      {/* ============================================================ */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-5 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Share & Collaborate</h3>
                  <p className="text-xs text-gray-500">
                    Manage workspace collaborator permissions and external sharing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-gray-100 px-6 pt-3 gap-6 bg-gray-50/30 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShareModalTab("COLLABORATORS")}
                className={`pb-3 inline-flex items-center gap-2 border-b-2 transition ${
                  shareModalTab === "COLLABORATORS"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Workspace Collaborators</span>
                {collaborators.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700 font-bold">
                    {collaborators.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShareModalTab("PUBLIC_LINK")}
                className={`pb-3 inline-flex items-center gap-2 border-b-2 transition ${
                  shareModalTab === "PUBLIC_LINK"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>Public Share Link</span>
                {shareStatus?.active && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 font-bold">
                    Active
                  </span>
                )}
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
              {shareModalTab === "COLLABORATORS" ? (
                <div className="space-y-5">
                  {/* Add collaborator control */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                      <UserPlus className="h-4 w-4 text-indigo-600" />
                      <span>Grant Workspace Member Access</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <select
                          value={selectedMemberId}
                          onChange={(e) => setSelectedMemberId(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          {workspaceMembers.length === 0 ? (
                            <option value="">No other workspace members</option>
                          ) : (
                            workspaceMembers.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.user?.name || m.user?.email || m.userId} ({m.roleName})
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <select
                          value={selectedAccessLevel}
                          onChange={(e) => setSelectedAccessLevel(e.target.value as "VIEW" | "EDIT" | "ADMIN")}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="VIEW">VIEW (Viewer)</option>
                          <option value="EDIT">EDIT (Editor)</option>
                          <option value="ADMIN">ADMIN (Full Access)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <button
                          type="button"
                          disabled={!selectedMemberId || updatingCollaborator}
                          onClick={handleGrantCollaborator}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                        >
                          {updatingCollaborator ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          <span>Save Access</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collaborators List */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2.5">Current Collaborators</h4>
                    {loadingCollaborators ? (
                      <div className="flex items-center justify-center py-6 text-xs text-gray-500 gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                        <span>Loading collaborators...</span>
                      </div>
                    ) : collaborators.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
                        No direct collaborator overrides configured. All workspace members have permissions matching their workspace role.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
                        {collaborators.map((c) => (
                          <div key={c.id} className="p-3.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {c.user?.name || c.user?.email || c.userId}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate">{c.user?.email}</p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  c.accessLevel === "ADMIN"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : c.accessLevel === "EDIT"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {c.accessLevel}
                              </span>

                              <button
                                type="button"
                                disabled={updatingCollaborator}
                                onClick={() => handleRevokeCollaborator(c.userId)}
                                className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Revoke collaborator access"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3 text-[11px] text-gray-500 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Workspace isolation enforced: only authenticated accounts belonging to this workspace organization can be added as collaborators.
                    </span>
                  </div>
                </div>
              ) : (
                /* PUBLIC LINK TAB */
                <div>
                  {loadingShareStatus ? (
                    <div className="flex items-center justify-center py-8 text-xs text-gray-500 gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                      <span>Loading sharing status...</span>
                    </div>
                  ) : shareStatus?.active && shareStatus.shareUrl ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-900 space-y-1">
                          <p className="font-semibold">Public Link is Active</p>
                          <p className="text-emerald-700 text-[11px]">
                            Anyone with this link can view this dashboard in read-only mode without logging in. Your private workspace data and credentials remain strictly isolated.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Share Link
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={shareStatus.shareUrl}
                            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800 focus:outline-none select-all"
                          />
                          <button
                            type="button"
                            onClick={handleCopyShareLink}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 transition shrink-0"
                          >
                            {copiedShareLink ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <a
                          href={shareStatus.shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open Shared View in New Tab</span>
                        </a>

                        <button
                          type="button"
                          disabled={updatingShare}
                          onClick={handleDisableShareLink}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {updatingShare ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                          <span>Disable Link</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                        <Globe className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-gray-900">No active share link</h4>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto">
                          Generate a unique, cryptographically secure share link to allow stakeholders to view this dashboard in read-only mode.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={updatingShare}
                        onClick={handleCreateShareLink}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition disabled:opacity-70"
                      >
                        {updatingShare ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                        <span>Create Share Link</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
              <span className="text-gray-400 text-[11px]">
                {shareStatus?.sharedAt
                  ? `Public link active since ${new Date(shareStatus.sharedAt).toLocaleDateString()}`
                  : "Private to Workspace"}
              </span>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. SCHEDULE REPORT MODAL */}
      {/* ============================================================ */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-5 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Dashboard Report Schedule & Exports</h3>
                  <p className="text-xs text-gray-500">
                    Automated snapshots, periodic delivery, and format exports
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/70 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setScheduleModalTab("CONFIG")}
                className={`flex-1 py-2.5 text-center border-b-2 transition ${
                  scheduleModalTab === "CONFIG"
                    ? "border-purple-600 text-purple-700 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                Schedule & Format
              </button>
              <button
                type="button"
                onClick={() => setScheduleModalTab("HISTORY")}
                className={`flex-1 py-2.5 text-center border-b-2 transition ${
                  scheduleModalTab === "HISTORY"
                    ? "border-purple-600 text-purple-700 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                Execution History ({reportExecutions.length})
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {loadingSchedule ? (
                <div className="flex items-center justify-center py-8 text-xs text-gray-500 gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-purple-600" />
                  <span>Loading schedule...</span>
                </div>
              ) : scheduleModalTab === "CONFIG" ? (
                <>
                  {/* Current Schedule Summary */}
                  <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Schedule Status</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          scheduleData?.enabled
                            ? "bg-green-100 text-green-800"
                            : scheduleData
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {scheduleData?.enabled ? "Active" : scheduleData ? "Paused" : "Not Scheduled"}
                      </span>
                    </div>
                    {scheduleData?.nextRunAt && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/60 text-[11px]">
                        <span className="text-gray-400">Next scheduled run:</span>
                        <span className="text-gray-700 font-medium">
                          {new Date(scheduleData.nextRunAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {scheduleData?.lastRunAt && (
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-gray-400">Last run:</span>
                        <span className="text-gray-700 font-medium">
                          {new Date(scheduleData.lastRunAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {scheduleData?.lastDeliveryStatus && (
                      <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-200/60 text-[11px]">
                        <span className="text-gray-400">Last delivery:</span>
                        <span
                          className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                            scheduleData.lastDeliveryStatus === "SUCCESS"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {scheduleData.lastDeliveryStatus === "SUCCESS"
                            ? `✓ Success${scheduleData.lastDeliveryAt ? ` (${new Date(scheduleData.lastDeliveryAt).toLocaleTimeString()})` : ""}`
                            : `✗ Failed: ${scheduleData.lastDeliveryError || "Error"}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Frequency Selection */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Report Frequency
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setScheduleFrequency("DAILY")}
                          className={`p-2 rounded-xl border text-xs font-medium text-center transition ${
                            scheduleFrequency === "DAILY"
                              ? "border-purple-600 bg-purple-50 text-purple-700 font-bold"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <p>Daily</p>
                          <span className="text-[10px] text-gray-400 font-normal">Every 24h</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleFrequency("WEEKLY")}
                          className={`p-2 rounded-xl border text-xs font-medium text-center transition ${
                            scheduleFrequency === "WEEKLY"
                              ? "border-purple-600 bg-purple-50 text-purple-700 font-bold"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <p>Weekly</p>
                          <span className="text-[10px] text-gray-400 font-normal">Every 7d</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleFrequency("MONTHLY")}
                          className={`p-2 rounded-xl border text-xs font-medium text-center transition ${
                            scheduleFrequency === "MONTHLY"
                              ? "border-purple-600 bg-purple-50 text-purple-700 font-bold"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <p>Monthly</p>
                          <span className="text-[10px] text-gray-400 font-normal">Every 30d</span>
                        </button>
                      </div>
                    </div>

                    {/* Report Format Selection */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Export Format
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(["PDF", "CSV", "PNG", "EXCEL"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setReportFormat(fmt)}
                            className={`py-1.5 px-2 rounded-lg border text-xs font-semibold text-center transition ${
                              reportFormat === fmt
                                ? "border-purple-600 bg-purple-50 text-purple-700"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Delivery Destination Inputs */}
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 block mb-0.5">
                          Email Recipients (Optional)
                        </label>
                        <input
                          type="text"
                          value={scheduleRecipients}
                          onChange={(e) => setScheduleRecipients(e.target.value)}
                          placeholder="reports@acme.com, exec@acme.com"
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-hidden focus:ring-1 focus:ring-purple-500 font-mono"
                        />
                        <span className="text-[10px] text-gray-400">Comma-separated email addresses</span>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 block mb-0.5">
                          Webhook URL (Optional)
                        </label>
                        <input
                          type="url"
                          value={scheduleWebhookUrl}
                          onChange={(e) => setScheduleWebhookUrl(e.target.value)}
                          placeholder="https://api.example.com/webhooks/reports"
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-hidden focus:ring-1 focus:ring-purple-500 font-mono"
                        />
                        <span className="text-[10px] text-gray-400">Receives report snapshot JSON event payload</span>
                      </div>
                    </div>

                    {/* Delivery notice */}
                    <div className="rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-500 border border-gray-100">
                      ℹ️ Snapshots & queries are automatically executed on schedule and recorded in Execution History. External SMTP email delivery requires organization email provider credentials.
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={scheduleEnabled}
                        onChange={(e) => setScheduleEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs font-medium text-gray-700">
                        Enable automated report generation on schedule
                      </span>
                    </label>
                  </div>

                  {/* Snapshot Preview */}
                  {lastGeneratedReport && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-indigo-900">
                        <span>Latest Report Snapshot ({reportFormat})</span>
                        <span className="text-[10px] text-indigo-500">
                          {lastGeneratedReport.summary.executionTimeMs}ms
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700">
                        Queried {lastGeneratedReport.chartCount} charts with {lastGeneratedReport.summary.totalRecords} total records.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      {scheduleData && (
                        <button
                          type="button"
                          onClick={handleDeleteSchedule}
                          disabled={deletingSchedule}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {deletingSchedule ? "Deleting..." : "Delete Schedule"}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateReportNow}
                        disabled={generatingReport}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 shadow-2xs"
                      >
                        {generatingReport ? "Generating..." : "Generate Now"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSchedule}
                        disabled={savingSchedule}
                        className="rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition shadow-xs disabled:opacity-50"
                      >
                        {savingSchedule ? "Saving..." : "Save Schedule"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Execution History Tab */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">
                      Report Execution Log ({reportExecutions.length} runs)
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const h = await apiGetDashboardReportHistory(id).catch(() => []);
                        setReportExecutions(h);
                      }}
                      className="text-[11px] text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Refresh
                    </button>
                  </div>

                  {reportExecutions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400">
                      No report executions logged yet. Click &quot;Generate Now&quot; to run an immediate snapshot.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden text-xs">
                      {reportExecutions.map((exec) => (
                        <div key={exec.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  exec.status === "SUCCESS"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {exec.status}
                              </span>
                              <span className="font-semibold text-gray-900">{exec.format}</span>
                              <span className="text-gray-400 text-[10px]">
                                {exec.triggeredBy || "SCHEDULED"}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500">
                              {new Date(exec.executedAt).toLocaleString()}
                              {exec.durationMs ? ` · ${exec.durationMs}ms` : ""}
                            </p>
                            {exec.errorMessage && (
                              <p className="text-[10px] text-red-600 mt-1">{exec.errorMessage}</p>
                            )}
                          </div>
                          <div className="text-right">
                            {exec.snapshotUrl ? (
                              <a
                                href={exec.snapshotUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-600 hover:underline text-xs font-semibold"
                              >
                                View Snapshot
                              </a>
                            ) : (
                              <span className="text-gray-400 text-[11px]">Archived</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Media Query Rules */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1.5cm;
            size: auto;
          }
          header,
          aside,
          .no-print,
          button,
          .fixed {
            display: none !important;
          }
          body,
          .min-h-screen,
          main {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
