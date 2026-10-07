"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  Table as TableIcon,
  Gauge,
  Plus,
  Trash2,
  Play,
  Save,
  RefreshCw,
  Database,
  ArrowUpDown,
  Filter as FunnelIcon,
  Check,
  AlertCircle,
  FolderOpen,
  ScatterChart as ScatterIcon,
  Radar as RadarIcon,
  LayoutGrid as HeatmapIcon,
  Sparkles,
  LayoutDashboard,
  Layers,
  Share2,
  Copy,
  ExternalLink,
  Lock,
  Sliders,
} from "lucide-react";
import { useAuth } from "../../contexts/auth-context";
import {
  apiListDatasets,
  apiQueryDataset,
  apiListVisualizations,
  apiCreateVisualization,
  apiUpdateVisualization,
  apiDeleteVisualization,
  apiGetDashboards,
  apiCreateChart,
  apiShareVisualization,
  apiRevokeVisualizationShare,
  type DatasetData,
  type DatasetColumn,
  type DatasetQueryResult,
  type VisualizationData,
  type ChartType,
  type AggregationFunction,
  type DashboardItem,
} from "../../lib/api";
import { ChartRenderer, COLOR_PALETTES } from "../../components/charts/ChartRenderer";
import {
  getRecommendedVisualizations,
  validateChartCompatibility,
  type ChartRecommendation,
} from "../../lib/chart-recommender";
import { AppShell } from "../../components/shell/AppShell";

const CHART_TYPES: Array<{
  id: ChartType;
  label: string;
  icon: typeof BarChart3;
  description: string;
}> = [
  { id: "BAR", label: "Bar Chart", icon: BarChart3, description: "Compare categorical values & frequencies" },
  { id: "LINE", label: "Line Chart", icon: LineChartIcon, description: "Trends and continuous sequences over time" },
  { id: "AREA", label: "Area Chart", icon: AreaChartIcon, description: "Volume and cumulative progression" },
  { id: "PIE", label: "Pie Chart", icon: PieChartIcon, description: "Proportions and category shares" },
  { id: "DONUT", label: "Donut Chart", icon: PieChartIcon, description: "Ring proportions with central readout" },
  { id: "SCATTER", label: "Scatter Plot", icon: ScatterIcon, description: "Correlation & clusters between numeric variables" },
  { id: "BUBBLE", label: "Bubble Chart", icon: ScatterIcon, description: "3-variable scatter with point size" },
  { id: "RADAR", label: "Radar Chart", icon: RadarIcon, description: "Multi-metric radial profile comparison" },
  { id: "FUNNEL", label: "Funnel Chart", icon: FunnelIcon, description: "Sequential stages and conversion dropoffs" },
  { id: "HEATMAP", label: "Heatmap Matrix", icon: HeatmapIcon, description: "2D category cross-table density matrix" },
  { id: "TREEMAP", label: "Treemap", icon: HeatmapIcon, description: "Hierarchical nested area proportions" },
  { id: "GAUGE", label: "Gauge Meter", icon: Gauge, description: "Radial dial progress against min/max target" },
  { id: "KPI", label: "KPI Metric", icon: Gauge, description: "Single highlighted key summary metric" },
  { id: "TABLE", label: "Data Table", icon: TableIcon, description: "Tabular raw records and aggregations" },
];

const AGGREGATIONS: Array<{ id: AggregationFunction; label: string }> = [
  { id: "SUM", label: "SUM — Total" },
  { id: "AVG", label: "AVG — Average" },
  { id: "COUNT", label: "COUNT — Frequency" },
  { id: "MIN", label: "MIN — Minimum" },
  { id: "MAX", label: "MAX — Maximum" },
];

const FILTER_OPERATORS = [
  { id: "equals", label: "Equals (=)" },
  { id: "not equals", label: "Not Equals (!=)" },
  { id: "greater than", label: "Greater Than (>)" },
  { id: "greater than or equal", label: "Greater Than or Equal (>=)" },
  { id: "less than", label: "Less Than (<)" },
  { id: "less than or equal", label: "Less Than or Equal (<=)" },
  { id: "contains", label: "Contains text" },
  { id: "is empty", label: "Is Empty" },
  { id: "is not empty", label: "Is Not Empty" },
];

interface FilterRow {
  column: string;
  operator: string;
  value: string;
}

function VisualizationsStudioContent() {
  const { auth, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation & State
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");

  // Datasets
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    searchParams.get("datasetId") || ""
  );
  const [isLoadingDatasets, setIsLoadingDatasets] = useState<boolean>(true);

  // Visualization Configuration
  const [title, setTitle] = useState<string>(
    searchParams.get("title") || "New Visualization"
  );
  const [description, setDescription] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>(
    (searchParams.get("chartType") as ChartType) || "BAR"
  );
  const [categoryCol, setCategoryCol] = useState<string>(
    searchParams.get("category") || ""
  );
  const [valueCol, setValueCol] = useState<string>(
    searchParams.get("value") || ""
  );
  const [secondaryValueCol, setSecondaryValueCol] = useState<string>(
    searchParams.get("secondary") || ""
  );
  const [groupCol, setGroupCol] = useState<string>(
    searchParams.get("group") || ""
  );
  const [aggregation, setAggregation] = useState<AggregationFunction>(
    (searchParams.get("agg") as AggregationFunction) || "SUM"
  );
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [editingVizId, setEditingVizId] = useState<string | null>(null);

  // Feature 11: Advanced Customization State
  const [activeBuilderSubTab, setActiveBuilderSubTab] = useState<"fields" | "customization">("fields");
  const [colorPalette, setColorPalette] = useState<string>("default");
  const [legendShow, setLegendShow] = useState<boolean>(true);
  const [legendPosition, setLegendPosition] = useState<"top" | "bottom" | "left" | "right">("top");
  const [xAxisTitle, setXAxisTitle] = useState<string>("");
  const [showXGrid, setShowXGrid] = useState<boolean>(false);
  const [yAxisTitle, setYAxisTitle] = useState<string>("");
  const [showYGrid, setShowYGrid] = useState<boolean>(true);
  const [numberPrefix, setNumberPrefix] = useState<string>("");
  const [numberSuffix, setNumberSuffix] = useState<string>("");
  const [numberDecimals, setNumberDecimals] = useState<number>(2);
  const [numberCompact, setNumberCompact] = useState<boolean>(false);
  const [numberFormatType, setNumberFormatType] = useState<"number" | "currency" | "percentage">("number");
  const [chartStacked, setChartStacked] = useState<boolean>(false);
  const [chartSmooth, setChartSmooth] = useState<boolean>(true);

  // Feature 15: Share Visualization Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingVizId, setSharingVizId] = useState<string | null>(null);
  const [sharingVizTitle, setSharingVizTitle] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Live Query Execution & Preview
  const [queryResult, setQueryResult] = useState<DatasetQueryResult | null>(null);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"chart" | "data">("chart");

  // Saved Visualizations
  const [savedVisualizations, setSavedVisualizations] = useState<VisualizationData[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Add to Dashboard Modal State
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState("");
  const [addingToDashboard, setAddingToDashboard] = useState(false);
  const [targetVizForDashboard, setTargetVizForDashboard] = useState<VisualizationData | null>(null);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, authLoading, router]);

  // Load Datasets
  const loadDatasets = useCallback(async () => {
    setIsLoadingDatasets(true);
    try {
      const list = await apiListDatasets();
      setDatasets(list);
      if (list.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(list[0].id);
      }
    } catch {
      // Ignore initial load error
    } finally {
      setIsLoadingDatasets(false);
    }
  }, [selectedDatasetId]);

  // Load Saved Visualizations
  const loadSavedVisualizations = useCallback(async () => {
    setIsLoadingSaved(true);
    try {
      const list = await apiListVisualizations();
      setSavedVisualizations(list);
    } catch {
      // Ignore
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  // Load Available Dashboards
  const loadDashboards = useCallback(async () => {
    try {
      const res = await apiGetDashboards();
      setDashboards(res.dashboards || []);
      if (res.dashboards?.length > 0 && !selectedDashboardId) {
        setSelectedDashboardId(res.dashboards[0].id);
      }
    } catch {
      // Ignore
    }
  }, [selectedDashboardId]);

  useEffect(() => {
    if (auth) {
      void loadDatasets();
      void loadSavedVisualizations();
      void loadDashboards();
    }
  }, [auth, loadDatasets, loadSavedVisualizations, loadDashboards]);

  // Current selected dataset object and its columns
  const currentDataset = useMemo(() => {
    return datasets.find((d) => d.id === selectedDatasetId) || null;
  }, [datasets, selectedDatasetId]);

  const columns: DatasetColumn[] = useMemo(() => {
    if (!currentDataset) return [];
    return currentDataset.columns || [];
  }, [currentDataset]);

  // Dynamic recommendations based on current dataset columns
  const recommendations = useMemo(() => {
    return getRecommendedVisualizations(columns);
  }, [columns]);

  // Live Chart Compatibility Check
  const compatibility = useMemo(() => {
    return validateChartCompatibility(chartType, {
      categoryCol,
      valueCol,
      secondaryValueCol,
      groupCol,
      aggregation,
      columns,
    });
  }, [chartType, categoryCol, valueCol, secondaryValueCol, groupCol, aggregation, columns]);

  // Auto-select initial Category & Value fields when dataset changes if none selected
  useEffect(() => {
    if (columns.length > 0) {
      const numericCols = columns.filter(
        (c) => c.type.toLowerCase() === "number" || c.type.toLowerCase() === "integer"
      );
      const textCols = columns.filter(
        (c) => c.type.toLowerCase() !== "number" && c.type.toLowerCase() !== "integer"
      );

      if (!categoryCol || !columns.some((c) => c.name === categoryCol)) {
        setCategoryCol(textCols[0]?.name || columns[0].name);
      }

      if (!valueCol || !columns.some((c) => c.name === valueCol)) {
        setValueCol(numericCols[0]?.name || columns[1]?.name || columns[0].name);
      }
    }
  }, [columns, categoryCol, valueCol]);

  // Apply a recommendation
  const applyRecommendation = (rec: ChartRecommendation) => {
    setChartType(rec.chartType);
    setCategoryCol(rec.categoryCol);
    setValueCol(rec.valueCol);
    if (rec.secondaryValueCol) setSecondaryValueCol(rec.secondaryValueCol);
    if (rec.groupCol) setGroupCol(rec.groupCol);
    setAggregation(rec.aggregation);
    setTitle(rec.title);
    setFeedbackMessage({
      type: "success",
      text: `Applied recommendation: ${rec.title}`,
    });
  };

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Execute Query against Backend Engine
  const executeQuery = useCallback(async () => {
    if (!selectedDatasetId) {
      setQueryError("Please select a dataset.");
      return;
    }

    setIsQuerying(true);
    setQueryError(null);

    try {
      // Build filters
      const validFilters = filters
        .filter((f) => f.column && f.operator)
        .map((f) => ({
          column: f.column,
          operator: f.operator,
          value: f.operator === "is empty" || f.operator === "is not empty" ? undefined : f.value,
        }));

      const queryPayload: Record<string, unknown> = {
        limit: 1000,
        filters: validFilters,
      };

      if (sortCol) {
        queryPayload.orderBy = {
          column: sortCol,
          direction: sortDir,
        };
      }

      if (chartType === "KPI") {
        if (valueCol) {
          queryPayload.aggregations = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
        }
      } else if (chartType === "TABLE") {
        if (categoryCol && valueCol) {
          queryPayload.groupBy = [categoryCol];
          queryPayload.aggregations = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
        } else {
          queryPayload.columns = columns.map((c) => c.name).slice(0, 15);
        }
      } else if (chartType === "SCATTER") {
        // Raw data points mode for Scatter if both X & Y exist
        if (categoryCol && valueCol) {
          queryPayload.columns = [categoryCol, valueCol];
        }
      } else if (chartType === "HEATMAP") {
        // 2D Matrix: categoryCol × groupCol with value aggregate
        if (categoryCol && groupCol && valueCol) {
          queryPayload.groupBy = [categoryCol, groupCol];
          queryPayload.aggregations = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
        } else if (categoryCol && valueCol) {
          queryPayload.groupBy = [categoryCol];
          queryPayload.aggregations = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
        }
      } else {
        // BAR, LINE, AREA, PIE, DONUT, RADAR, FUNNEL
        if (categoryCol && valueCol) {
          queryPayload.groupBy = [categoryCol];
          const aggs = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
          if (secondaryValueCol && secondaryValueCol !== valueCol) {
            aggs.push({
              column: secondaryValueCol,
              function: aggregation,
              alias: secondaryValueCol,
            });
          }
          queryPayload.aggregations = aggs;
        } else if (categoryCol) {
          queryPayload.groupBy = [categoryCol];
          queryPayload.aggregations = [
            {
              column: "*",
              function: "COUNT",
              alias: "count",
            },
          ];
        }
      }

      const res = await apiQueryDataset(selectedDatasetId, queryPayload);
      setQueryResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute query";
      setQueryError(msg);
      setQueryResult(null);
    } finally {
      setIsQuerying(false);
    }
  }, [
    selectedDatasetId,
    chartType,
    categoryCol,
    valueCol,
    secondaryValueCol,
    groupCol,
    aggregation,
    sortCol,
    sortDir,
    filters,
    columns,
  ]);

  // Auto-run query on configuration change
  useEffect(() => {
    if (selectedDatasetId && (categoryCol || valueCol)) {
      void executeQuery();
    }
  }, [selectedDatasetId, chartType, categoryCol, valueCol, secondaryValueCol, groupCol, aggregation, executeQuery]);

  // Build current chart config object
  const currentChartConfig = useMemo(() => {
    return {
      xAxis: categoryCol,
      category: categoryCol,
      yAxis: secondaryValueCol ? [valueCol, secondaryValueCol] : valueCol,
      value: valueCol,
      secondaryValueCol: secondaryValueCol || undefined,
      groupCol: groupCol || undefined,
      aggregation,
      dimensions: groupCol ? [categoryCol, groupCol] : categoryCol ? [categoryCol] : [],
      measures: valueCol
        ? [
            {
              column: valueCol,
              aggregation,
              alias: valueCol,
            },
            ...(secondaryValueCol
              ? [
                  {
                    column: secondaryValueCol,
                    aggregation,
                    alias: secondaryValueCol,
                  },
                ]
              : []),
          ]
        : [],
      filters: filters.map((f) => ({
        column: f.column,
        operator: f.operator,
        value: f.value,
      })),
      sort: sortCol ? { column: sortCol, direction: sortDir } : undefined,
      colorPalette,
      legend: {
        show: legendShow,
        position: legendPosition,
      },
      xAxisConfig: {
        title: xAxisTitle || undefined,
        showGrid: showXGrid,
        showLabels: true,
      },
      yAxisConfig: {
        title: yAxisTitle || undefined,
        showGrid: showYGrid,
      },
      numberFormat: {
        prefix: numberPrefix,
        suffix: numberSuffix,
        decimals: numberDecimals,
        compact: numberCompact,
        formatType: numberFormatType,
      },
      chartOptions: {
        stacked: chartStacked,
        smooth: chartSmooth,
      },
    };
  }, [
    categoryCol,
    valueCol,
    secondaryValueCol,
    groupCol,
    aggregation,
    filters,
    sortCol,
    sortDir,
    colorPalette,
    legendShow,
    legendPosition,
    xAxisTitle,
    showXGrid,
    yAxisTitle,
    showYGrid,
    numberPrefix,
    numberSuffix,
    numberDecimals,
    numberCompact,
    numberFormatType,
    chartStacked,
    chartSmooth,
  ]);

  // Save Visualization
  const handleSaveVisualization = async () => {
    if (!title.trim()) {
      setFeedbackMessage({ type: "error", text: "Please enter a visualization title." });
      return;
    }
    if (!selectedDatasetId) {
      setFeedbackMessage({ type: "error", text: "Please select a dataset." });
      return;
    }

    setIsSaving(true);
    setFeedbackMessage(null);

    try {
      if (editingVizId) {
        await apiUpdateVisualization(editingVizId, {
          title,
          description: description || undefined,
          chartType,
          datasetId: selectedDatasetId,
          config: currentChartConfig,
        });
        setFeedbackMessage({ type: "success", text: "Visualization updated successfully!" });
      } else {
        const created = await apiCreateVisualization({
          title,
          description: description || undefined,
          chartType,
          datasetId: selectedDatasetId,
          config: currentChartConfig,
        });
        setEditingVizId(created.id);
        setFeedbackMessage({
          type: "success",
          text: "Visualization saved successfully! Ready to add to Dashboards.",
        });
      }
      void loadSavedVisualizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save visualization";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Open "Add to Dashboard" Modal
  const openAddToDashboard = (viz?: VisualizationData) => {
    setTargetVizForDashboard(viz || null);
    setIsDashboardModalOpen(true);
  };

  // Add chart to selected Dashboard
  const handleConfirmAddToDashboard = async () => {
    if (!selectedDashboardId) {
      setFeedbackMessage({ type: "error", text: "Please choose a destination dashboard." });
      return;
    }

    setAddingToDashboard(true);
    try {
      const targetConfig = targetVizForDashboard
        ? (targetVizForDashboard.config as Record<string, unknown>)
        : currentChartConfig;
      const targetTitle = targetVizForDashboard?.title || title;
      const targetType = targetVizForDashboard?.chartType || chartType;
      const targetDsId = targetVizForDashboard?.datasetId || selectedDatasetId;

      await apiCreateChart(selectedDashboardId, {
        datasetId: targetDsId,
        title: targetTitle,
        description: description || undefined,
        chartType: targetType,
        config: targetConfig,
      });

      const dashName =
        dashboards.find((d) => d.id === selectedDashboardId)?.name || "Dashboard";
      setIsDashboardModalOpen(false);
      setFeedbackMessage({
        type: "success",
        text: `🎉 Chart added to "${dashName}"!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add chart to dashboard";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setAddingToDashboard(false);
    }
  };

  // Load an existing saved visualization into the builder
  const handleLoadSaved = (viz: VisualizationData) => {
    setEditingVizId(viz.id);
    setTitle(viz.title);
    setDescription(viz.description || "");
    setChartType(viz.chartType);
    if (viz.datasetId) {
      setSelectedDatasetId(viz.datasetId);
    }

    const cfg = (viz.config || {}) as Record<string, any>;
    if (cfg.xAxis || cfg.category) setCategoryCol(String(cfg.xAxis || cfg.category));
    if (cfg.value) setValueCol(String(cfg.value));
    if (cfg.secondaryValueCol) setSecondaryValueCol(String(cfg.secondaryValueCol));
    if (cfg.groupCol) setGroupCol(String(cfg.groupCol));
    if (cfg.aggregation) setAggregation(cfg.aggregation as AggregationFunction);

    if (cfg.filters && Array.isArray(cfg.filters)) {
      setFilters(
        cfg.filters.map((f: any) => ({
          column: f.column,
          operator: String(f.operator),
          value: f.value !== undefined ? String(f.value) : "",
        }))
      );
    } else {
      setFilters([]);
    }

    if (cfg.sort) {
      setSortCol(cfg.sort.column);
      setSortDir(cfg.sort.direction?.toLowerCase() === "desc" ? "desc" : "asc");
    }

    // Feature 11: Restore advanced customization settings
    if (cfg.colorPalette) setColorPalette(cfg.colorPalette);
    if (cfg.legend) {
      if (typeof cfg.legend.show === "boolean") setLegendShow(cfg.legend.show);
      if (cfg.legend.position) setLegendPosition(cfg.legend.position);
    }
    if (cfg.xAxisConfig) {
      if (cfg.xAxisConfig.title) setXAxisTitle(cfg.xAxisConfig.title);
      if (typeof cfg.xAxisConfig.showGrid === "boolean") setShowXGrid(cfg.xAxisConfig.showGrid);
    }
    if (cfg.yAxisConfig) {
      if (cfg.yAxisConfig.title) setYAxisTitle(cfg.yAxisConfig.title);
      if (typeof cfg.yAxisConfig.showGrid === "boolean") setShowYGrid(cfg.yAxisConfig.showGrid);
    }
    if (cfg.numberFormat) {
      if (cfg.numberFormat.prefix) setNumberPrefix(cfg.numberFormat.prefix);
      if (cfg.numberFormat.suffix) setNumberSuffix(cfg.numberFormat.suffix);
      if (typeof cfg.numberFormat.decimals === "number") setNumberDecimals(cfg.numberFormat.decimals);
      if (typeof cfg.numberFormat.compact === "boolean") setNumberCompact(cfg.numberFormat.compact);
      if (cfg.numberFormat.formatType) setNumberFormatType(cfg.numberFormat.formatType);
    }
    if (cfg.chartOptions) {
      if (typeof cfg.chartOptions.stacked === "boolean") setChartStacked(cfg.chartOptions.stacked);
      if (typeof cfg.chartOptions.smooth === "boolean") setChartSmooth(cfg.chartOptions.smooth);
    }

    setActiveTab("builder");
    setFeedbackMessage({ type: "success", text: `Loaded "${viz.title}" into builder.` });
  };

  // Feature 15: Share Visualization
  const handleOpenShareModal = async (viz: VisualizationData) => {
    setSharingVizId(viz.id);
    setSharingVizTitle(viz.title);
    setIsShareModalOpen(true);
    setIsSharingLoading(true);
    setCopiedShare(false);
    try {
      const res = await apiShareVisualization(viz.id);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setShareUrl(`${origin}/visualizations/shared/${res.shareToken}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create share link";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setIsSharingLoading(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!sharingVizId) return;
    setIsSharingLoading(true);
    try {
      await apiRevokeVisualizationShare(sharingVizId);
      setShareUrl(null);
      setFeedbackMessage({ type: "success", text: "Public share link revoked." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke share link";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setIsSharingLoading(false);
    }
  };

  // Delete saved visualization
  const handleDeleteSaved = async (id: string, name: string) => {
    if (!confirm(`Delete visualization "${name}"?`)) return;
    try {
      await apiDeleteVisualization(id);
      if (editingVizId === id) {
        setEditingVizId(null);
      }
      setFeedbackMessage({ type: "success", text: "Visualization deleted." });
      void loadSavedVisualizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setFeedbackMessage({ type: "error", text: msg });
    }
  };

  // Filter Row helpers
  const addFilterRow = () => {
    const firstCol = columns[0]?.name || "";
    setFilters((prev) => [...prev, { column: firstCol, operator: "equals", value: "" }]);
  };

  const removeFilterRow = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFilterRow = (index: number, field: keyof FilterRow, val: string) => {
    setFilters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading visualization engine…</p>
        </div>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <AppShell
      title="Visualizations Studio"
      subtitle="Curate 14+ chart architectures powered by AI heuristics and realtime DuckDB analytics."
      breadcrumbs={[
        { label: "App", href: "/" },
        { label: "Datasets", href: "/datasets" },
        { label: "Visualizations Studio" },
      ]}
      actions={
        <div className="flex items-center gap-2.5">
          {/* Tab switcher */}
          <div className="flex items-center bg-[hsl(var(--surface-subtle))] p-0.5 rounded-lg border border-[hsl(var(--surface-border))] text-xs font-semibold">
            <button
              onClick={() => setActiveTab("builder")}
              className={`px-3 py-1 rounded-md transition ${
                activeTab === "builder"
                  ? "bg-[hsl(var(--surface))] text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Studio Builder
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                activeTab === "saved"
                  ? "bg-[hsl(var(--surface))] text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Saved ({savedVisualizations.length})</span>
            </button>
          </div>

          {activeTab === "builder" && (
            <>
              <button
                type="button"
                onClick={() => openAddToDashboard()}
                className="btn-tactile btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-semibold"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Add to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={handleSaveVisualization}
                disabled={isSaving}
                className="btn-tactile btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5 font-semibold"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? "Saving…" : editingVizId ? "Update" : "Save Visualization"}</span>
              </button>
            </>
          )}
        </div>
      }
    >

      {/* FEEDBACK TOAST */}
      {feedbackMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg transition animate-in fade-in slide-in-from-bottom-2 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* TAB 1: STUDIO BUILDER */}
      {activeTab === "builder" && (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT CONFIGURATION SIDEBAR */}
          <aside className="w-96 border-r border-gray-200 bg-white flex flex-col h-[calc(100vh-57px)] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Visualization Settings
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Configure chart axes & aggregations</p>
              </div>
              {editingVizId && (
                <button
                  onClick={() => {
                    setEditingVizId(null);
                    setTitle("New Visualization");
                    setDescription("");
                  }}
                  className="text-2xs text-indigo-600 hover:underline font-medium"
                >
                  New Chart
                </button>
              )}
            </div>

            {/* Sub-tab switcher: Data Fields vs. Customization */}
            <div className="flex border-b border-gray-100 bg-gray-50/70 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveBuilderSubTab("fields")}
                className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                  activeBuilderSubTab === "fields"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Data & Metrics</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveBuilderSubTab("customization")}
                className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                  activeBuilderSubTab === "customization"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Style & Axes</span>
              </button>
            </div>

            {activeBuilderSubTab === "fields" ? (
            <div className="p-5 space-y-5">
              {/* 1. DATASET SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-indigo-600" />
                    Select Dataset
                  </span>
                  <Link href="/datasets" className="text-2xs text-indigo-600 hover:underline">
                    Manage Datasets
                  </Link>
                </label>
                {isLoadingDatasets ? (
                  <div className="h-9 w-full bg-gray-100 animate-pulse rounded-lg" />
                ) : datasets.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                    No datasets available.{" "}
                    <Link href="/datasets" className="font-semibold underline">
                      Upload a dataset first
                    </Link>
                    .
                  </div>
                ) : (
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.rowCount} rows, {d.columnCount} cols)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. DYNAMIC RECOMMENDATIONS */}
              {recommendations.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-2xs font-bold text-amber-900 uppercase tracking-wider">
                      <Sparkles className="h-3 w-3 text-amber-600" />
                      Recommended Charts
                    </span>
                    <span className="text-3xs text-amber-700">Auto-detected from columns</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendations.slice(0, 4).map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => applyRecommendation(rec)}
                        title={rec.description}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-2xs font-medium text-amber-900 hover:bg-amber-100 transition shadow-2xs"
                      >
                        <span className="font-semibold">{rec.chartType}</span>
                        <span className="text-gray-400">·</span>
                        <span className="truncate max-w-[120px]">{rec.valueCol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. CHART TYPE SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Chart Type ({CHART_TYPES.length})
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHART_TYPES.map((t) => {
                    const Icon = t.icon;
                    const isSelected = chartType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setChartType(t.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold shadow-2xs"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isSelected ? "text-indigo-600" : "text-gray-400"}`} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. COMPATIBILITY ALERT */}
              {compatibility.severity !== "none" && (
                <div
                  className={`rounded-lg p-3 text-2xs flex items-start gap-2 ${
                    compatibility.severity === "error"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Chart Configuration Note</span>
                    <span>{compatibility.message}</span>
                  </div>
                </div>
              )}

              {/* 5. DIMENSIONS & MEASURES */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                {/* Category / X-Axis */}
                {chartType !== "KPI" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                      <span>Category / X-Axis</span>
                      <span className="text-2xs text-gray-400 font-normal">Primary Dimension</span>
                    </label>
                    <select
                      value={categoryCol}
                      onChange={(e) => setCategoryCol(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="">— Select Category Column —</option>
                      {columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Value / Measure 1 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Value / Y-Axis</span>
                    <span className="text-2xs text-gray-400 font-normal">Primary Metric</span>
                  </label>
                  <select
                    value={valueCol}
                    onChange={(e) => setValueCol(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="">— Select Measure Column —</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Second Measure (Multi-series / Radar) */}
                {(chartType === "BAR" ||
                  chartType === "LINE" ||
                  chartType === "AREA" ||
                  chartType === "RADAR") && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                      <span>Secondary Series (Optional)</span>
                      <span className="text-2xs text-gray-400 font-normal">Multi-Metric</span>
                    </label>
                    <select
                      value={secondaryValueCol}
                      onChange={(e) => setSecondaryValueCol(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="">— None (Single Series) —</option>
                      {columns
                        .filter((c) => c.name !== valueCol)
                        .map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Optional Grouping / Matrix Column (Heatmap) */}
                {chartType === "HEATMAP" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                      <span>Matrix Y-Axis (Category 2)</span>
                      <span className="text-2xs text-indigo-600 font-bold">Required for Matrix</span>
                    </label>
                    <select
                      value={groupCol}
                      onChange={(e) => setGroupCol(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="">— Select Second Category —</option>
                      {columns
                        .filter((c) => c.name !== categoryCol)
                        .map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Aggregation Function */}
                {chartType !== "SCATTER" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Aggregation Method
                    </label>
                    <select
                      value={aggregation}
                      onChange={(e) => setAggregation(e.target.value as AggregationFunction)}
                      className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                    >
                      {AGGREGATIONS.map((agg) => (
                        <option key={agg.id} value={agg.id}>
                          {agg.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 6. SORTING */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                  Sorting
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortCol}
                    onChange={(e) => setSortCol(e.target.value)}
                    className="text-xs rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-gray-800 shadow-2xs"
                  >
                    <option value="">— Default Sort —</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                    className="text-xs rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-gray-800 shadow-2xs"
                  >
                    <option value="asc">Ascending (A→Z, 0→9)</option>
                    <option value="desc">Descending (Z→A, 9→0)</option>
                  </select>
                </div>
              </div>

              {/* 7. FILTERS */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <FunnelIcon className="h-3.5 w-3.5 text-gray-400" />
                    Query Filters ({filters.length})
                  </label>
                  <button
                    type="button"
                    onClick={addFilterRow}
                    className="text-2xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Add Filter
                  </button>
                </div>

                {filters.length === 0 ? (
                  <p className="text-2xs text-gray-400">No active filters applied.</p>
                ) : (
                  <div className="space-y-2">
                    {filters.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <select
                          value={f.column}
                          onChange={(e) => updateFilterRow(idx, "column", e.target.value)}
                          className="w-1/3 text-3xs rounded border border-gray-300 bg-white p-1"
                        >
                          {columns.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={f.operator}
                          onChange={(e) => updateFilterRow(idx, "operator", e.target.value)}
                          className="w-1/3 text-3xs rounded border border-gray-300 bg-white p-1"
                        >
                          {FILTER_OPERATORS.map((op) => (
                            <option key={op.id} value={op.id}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        {!f.operator.includes("empty") && (
                          <input
                            type="text"
                            placeholder="Value"
                            value={f.value}
                            onChange={(e) => updateFilterRow(idx, "value", e.target.value)}
                            className="w-1/3 text-3xs rounded border border-gray-300 bg-white p-1"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFilterRow(idx)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* 1. COLOR PALETTE */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Color Palette
                  </label>
                  <div className="space-y-1.5">
                    {Object.entries(COLOR_PALETTES).map(([key, colors]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setColorPalette(key)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs transition ${
                          colorPalette === key
                            ? "border-indigo-600 bg-indigo-50/50 shadow-2xs font-semibold"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <span className="capitalize text-gray-800">{key}</span>
                        <div className="flex items-center gap-1">
                          {colors.slice(0, 5).map((c, i) => (
                            <span
                              key={i}
                              className="h-3 w-3 rounded-full inline-block shadow-2xs"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. LEGEND CONFIGURATION */}
                <div className="pt-2 border-t border-gray-100 space-y-2.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    Legend Settings
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Show Legend</span>
                    <input
                      type="checkbox"
                      checked={legendShow}
                      onChange={(e) => setLegendShow(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                  </div>
                  {legendShow && (
                    <div>
                      <span className="text-2xs text-gray-400 block mb-1">Position</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["top", "bottom", "left", "right"] as const).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setLegendPosition(pos)}
                            className={`py-1 rounded text-2xs font-medium capitalize border transition ${
                              legendPosition === pos
                                ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. AXIS CONFIGURATION */}
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <label className="block text-xs font-semibold text-gray-700">
                    Axes & Gridlines
                  </label>
                  <div>
                    <span className="text-2xs text-gray-500 block mb-1">X-Axis Custom Title</span>
                    <input
                      type="text"
                      value={xAxisTitle}
                      onChange={(e) => setXAxisTitle(e.target.value)}
                      placeholder="e.g. Regions, Months, Categories"
                      className="w-full text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Show X-Axis Gridlines</span>
                    <input
                      type="checkbox"
                      checked={showXGrid}
                      onChange={(e) => setShowXGrid(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <span className="text-2xs text-gray-500 block mb-1">Y-Axis Custom Title</span>
                    <input
                      type="text"
                      value={yAxisTitle}
                      onChange={(e) => setYAxisTitle(e.target.value)}
                      placeholder="e.g. Revenue ($), Total Count"
                      className="w-full text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Show Y-Axis Gridlines</span>
                    <input
                      type="checkbox"
                      checked={showYGrid}
                      onChange={(e) => setShowYGrid(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 4. NUMBER FORMATTING */}
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <label className="block text-xs font-semibold text-gray-700">
                    Metric & Number Formatting
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "number", label: "Standard" },
                      { id: "currency", label: "Currency ($)" },
                      { id: "percentage", label: "Percent (%)" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setNumberFormatType(f.id as any)}
                        className={`py-1.5 text-2xs rounded-lg border text-center font-medium transition ${
                          numberFormatType === f.id
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-2xs text-gray-500 block mb-1">Prefix</span>
                      <input
                        type="text"
                        value={numberPrefix}
                        onChange={(e) => setNumberPrefix(e.target.value)}
                        placeholder="e.g. $, €"
                        className="w-full text-xs rounded-lg border border-gray-300 px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-2xs text-gray-500 block mb-1">Suffix</span>
                      <input
                        type="text"
                        value={numberSuffix}
                        onChange={(e) => setNumberSuffix(e.target.value)}
                        placeholder="e.g. USD, /mo"
                        className="w-full text-xs rounded-lg border border-gray-300 px-2 py-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Decimal Places</span>
                    <select
                      value={numberDecimals}
                      onChange={(e) => setNumberDecimals(Number(e.target.value))}
                      className="text-xs rounded border border-gray-300 bg-white px-2 py-1"
                    >
                      <option value={0}>0 (Integer)</option>
                      <option value={1}>1 decimal</option>
                      <option value={2}>2 decimals</option>
                      <option value={3}>3 decimals</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Compact Format (1.5M, 24K)</span>
                    <input
                      type="checkbox"
                      checked={numberCompact}
                      onChange={(e) => setNumberCompact(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 5. VISUALIZATION-SPECIFIC SETTINGS */}
                <div className="pt-2 border-t border-gray-100 space-y-2.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    Display Settings
                  </label>
                  {(chartType === "BAR" || chartType === "AREA") && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Stacked Series</span>
                      <input
                        type="checkbox"
                        checked={chartStacked}
                        onChange={(e) => setChartStacked(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                  {(chartType === "LINE" || chartType === "AREA") && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Smooth Spline Curve</span>
                      <input
                        type="checkbox"
                        checked={chartSmooth}
                        onChange={(e) => setChartSmooth(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* MAIN PREVIEW CANVAS */}
          <main className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-gray-50/70 p-6">
            {/* Title & Metadata Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
              <div className="flex-1 max-w-xl">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Visualization Title"
                  className="w-full text-base font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-500 focus:outline-hidden px-1 py-0.5"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add an optional description or business insight notes…"
                  className="w-full text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-500 focus:outline-hidden px-1 py-0.5 mt-0.5"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                  <button
                    onClick={() => setPreviewTab("chart")}
                    className={`px-3 py-1 rounded-md transition ${
                      previewTab === "chart"
                        ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Live Chart
                  </button>
                  <button
                    onClick={() => setPreviewTab("data")}
                    className={`px-3 py-1 rounded-md transition ${
                      previewTab === "data"
                        ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Raw Data ({queryResult?.rows?.length ?? 0})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={executeQuery}
                  disabled={isQuerying}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isQuerying ? "animate-spin text-indigo-600" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col overflow-hidden">
              {previewTab === "chart" ? (
                <div className="flex-1 w-full h-full relative">
                  <ChartRenderer
                    chartType={chartType}
                    config={currentChartConfig}
                    queryResult={queryResult}
                    isLoading={isQuerying}
                    error={queryError}
                    height="100%"
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-auto rounded-lg border border-gray-100">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {queryResult?.columns?.map((col) => (
                          <th key={col.name} className="px-3.5 py-2.5 text-left font-semibold text-gray-700">
                            {col.name}
                            <span className="block text-3xs text-gray-400 font-mono font-normal">
                              {col.type}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {queryResult?.rows?.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-gray-50">
                          {queryResult.columns.map((col) => (
                            <td key={col.name} className="px-3.5 py-2 font-mono text-gray-800">
                              {row[col.name] !== undefined && row[col.name] !== null
                                ? String(row[col.name])
                                : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* TAB 2: SAVED VISUALIZATIONS */}
      {activeTab === "saved" && (
        <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Saved Visualizations Gallery</h2>
              <p className="text-xs text-gray-500 mt-1">
                Explore, edit, or attach saved visualizations directly into your dashboards.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingVizId(null);
                setTitle("New Visualization");
                setActiveTab("builder");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Visualization</span>
            </button>
          </div>

          {isLoadingSaved ? (
            <div className="py-20 text-center text-sm text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2" />
              <p>Loading saved visualizations…</p>
            </div>
          ) : savedVisualizations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-2xl mb-3">
                📊
              </div>
              <h3 className="text-base font-bold text-gray-900">No saved visualizations yet</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Use the Studio Builder to create and save charts, then pin them onto your analytics dashboards.
              </p>
              <button
                onClick={() => setActiveTab("builder")}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500"
              >
                Open Studio Builder →
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {savedVisualizations.map((viz) => (
                <div
                  key={viz.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-2xs font-semibold text-indigo-700">
                        {viz.chartType}
                      </span>
                      <span className="text-3xs text-gray-400">
                        {new Date(viz.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 truncate">{viz.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {viz.description || "No description provided."}
                    </p>

                    <div className="mt-4 pt-3 border-t border-gray-100 text-2xs text-gray-500 flex items-center justify-between">
                      <span className="truncate">
                        Dataset: <strong>{viz.datasetName || "Linked Dataset"}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSaved(viz)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Edit in Builder
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenShareModal(viz)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-2xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs"
                        title="Share visualization"
                      >
                        <Share2 className="h-3 w-3 text-indigo-600" />
                        <span>Share</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAddToDashboard(viz)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-2xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs"
                      >
                        <LayoutDashboard className="h-3 w-3 text-indigo-600" />
                        <span>Add to Dashboard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(viz.id, viz.title)}
                        className="text-gray-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ADD TO DASHBOARD MODAL */}
      {isDashboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-1">Add to Dashboard</h3>
            <p className="text-xs text-gray-500 mb-4">
              Pin &quot;{targetVizForDashboard?.title || title}&quot; to one of your active dashboards.
            </p>

            {dashboards.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200 mb-4">
                No dashboards found in your organization.{" "}
                <Link href="/dashboards" className="underline font-bold">
                  Create a dashboard first
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                <label className="block text-xs font-semibold text-gray-700">
                  Select Destination Dashboard
                </label>
                <select
                  value={selectedDashboardId}
                  onChange={(e) => setSelectedDashboardId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-300 bg-white p-2.5 text-gray-800 shadow-2xs"
                >
                  {dashboards.map((dash) => (
                    <option key={dash.id} value={dash.id}>
                      {dash.name} ({dash.charts?.length ?? dash.chartCount ?? 0} charts)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsDashboardModalOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addingToDashboard || dashboards.length === 0}
                onClick={handleConfirmAddToDashboard}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50"
              >
                {addingToDashboard ? "Adding…" : "Confirm & Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE VISUALIZATION MODAL (FEATURE 15) */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Share Visualization</h3>
                  <p className="text-2xs text-gray-500">Public view-only standalone access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                ✕
              </button>
            </div>

            {isSharingLoading ? (
              <div className="py-8 text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
                <span>Generating secure public link...</span>
              </div>
            ) : shareUrl ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Anyone with this link can view the &quot;{sharingVizTitle}&quot; chart in live read-only mode without logging in.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (shareUrl) {
                        void navigator.clipboard.writeText(shareUrl);
                        setCopiedShare(true);
                        setTimeout(() => setCopiedShare(false), 2000);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500"
                  >
                    {copiedShare ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-medium"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Open in new tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleRevokeShare}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline font-medium"
                  >
                    <Lock className="h-3 w-3" />
                    <span>Revoke link</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-gray-500">
                  This chart is not publicly shared. Create a shareable link to allow external viewing.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (sharingVizId) {
                      void apiShareVisualization(sharingVizId).then((res) => {
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        setShareUrl(`${origin}/visualizations/shared/${res.shareToken}`);
                      });
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Generate Share Link
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function VisualizationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-xs text-gray-500">Loading Visualizations Studio…</p>
        </div>
      }
    >
      <VisualizationsStudioContent />
    </Suspense>
  );
}
