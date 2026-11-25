"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
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
  const activeQueryDatasetIdRef = useRef<string | null>(null);

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

    const currentTargetDatasetId = selectedDatasetId;
    activeQueryDatasetIdRef.current = currentTargetDatasetId;
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

      const res = await apiQueryDataset(currentTargetDatasetId, queryPayload);
      if (activeQueryDatasetIdRef.current === currentTargetDatasetId) {
        setQueryResult(res);
      }
    } catch (err: unknown) {
      if (activeQueryDatasetIdRef.current === currentTargetDatasetId) {
        const msg = err instanceof Error ? err.message : "Failed to execute query";
        setQueryError(msg);
        setQueryResult(null);
      }
    } finally {
      if (activeQueryDatasetIdRef.current === currentTargetDatasetId) {
        setIsQuerying(false);
      }
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
    if (
      selectedDatasetId &&
      (categoryCol || valueCol) &&
      (!categoryCol || columns.some((c) => c.name === categoryCol)) &&
      (!valueCol || columns.some((c) => c.name === valueCol))
    ) {
      void executeQuery();
    }
  }, [selectedDatasetId, chartType, categoryCol, valueCol, secondaryValueCol, groupCol, aggregation, columns, executeQuery]);

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
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono-code text-[#898989]">Loading visualization engine…</p>
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
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab switcher */}
          <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#262626] text-xs">
            <button
              onClick={() => setActiveTab("builder")}
              className={`px-3 py-1 rounded-full transition font-mono-code ${
                activeTab === "builder"
                  ? "bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 font-semibold"
                  : "text-[#898989] hover:text-[#fafafa] border border-transparent"
              }`}
            >
              Studio Builder
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-3 py-1 rounded-full transition flex items-center gap-1.5 font-mono-code ${
                activeTab === "saved"
                  ? "bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 font-semibold"
                  : "text-[#898989] hover:text-[#fafafa] border border-transparent"
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
                className="rounded-full border border-[#262626] bg-[#1a1a1a] text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5 font-medium text-[#fafafa] hover:bg-[#242424] transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-[#ff6b35]" />
                <span>Add to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={handleSaveVisualization}
                disabled={isSaving}
                className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] text-xs py-1.5 px-4 inline-flex items-center gap-1.5 font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
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
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-mono-code shadow-2xl transition animate-in fade-in slide-in-from-bottom-2 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/30"
              : "bg-rose-950/90 text-rose-300 border border-rose-500/30"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* TAB 1: STUDIO BUILDER */}
      {activeTab === "builder" && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* LEFT CONFIGURATION SIDEBAR */}
          <aside className="w-full lg:w-96 shrink-0 border-b lg:border-b-0 lg:border-r border-[#262626] bg-[#141414] flex flex-col lg:h-[calc(100vh-57px)] overflow-y-auto">
            <div className="p-5 border-b border-[#262626] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#fafafa] uppercase tracking-wider font-mono-code">
                  Visualization Settings
                </h2>
                <p className="text-xs text-[#898989] mt-0.5">Configure chart axes & aggregations</p>
              </div>
              {editingVizId && (
                <button
                  onClick={() => {
                    setEditingVizId(null);
                    setTitle("New Visualization");
                    setDescription("");
                  }}
                  className="text-xs font-mono-code text-[#ff6b35] hover:underline"
                >
                  New Chart
                </button>
              )}
            </div>

            {/* Sub-tab switcher: Data Fields vs. Customization */}
            <div className="flex border-b border-[#262626] bg-[#181818] text-xs">
              <button
                type="button"
                onClick={() => setActiveBuilderSubTab("fields")}
                className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 font-mono-code ${
                  activeBuilderSubTab === "fields"
                    ? "border-[#ff6b35] text-[#ff6b35] bg-[#141414] font-semibold"
                    : "border-transparent text-[#898989] hover:text-[#fafafa]"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Data & Metrics</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveBuilderSubTab("customization")}
                className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 font-mono-code ${
                  activeBuilderSubTab === "customization"
                    ? "border-[#ff6b35] text-[#ff6b35] bg-[#141414] font-semibold"
                    : "border-transparent text-[#898989] hover:text-[#fafafa]"
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
                <label className="block text-xs font-medium text-[#898989] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[#fafafa]">
                    <Database className="h-3.5 w-3.5 text-[#ff6b35]" />
                    Select Dataset
                  </span>
                  <Link href="/datasets" className="text-xs font-mono-code text-[#ff6b35] hover:underline">
                    Manage Datasets
                  </Link>
                </label>
                {isLoadingDatasets ? (
                  <div className="h-9 w-full bg-[#181818] animate-pulse rounded-xl" />
                ) : datasets.length === 0 ? (
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs text-amber-300">
                    No datasets available.{" "}
                    <Link href="/datasets" className="font-semibold underline text-[#ff6b35]">
                      Upload a dataset first
                    </Link>
                    .
                  </div>
                ) : (
                  <select
                    id="dataset-select"
                    value={selectedDatasetId}
                    onChange={(e) => {
                      setSelectedDatasetId(e.target.value);
                      setCategoryCol("");
                      setValueCol("");
                      setSecondaryValueCol("");
                      setGroupCol("");
                      setQueryResult(null);
                    }}
                    className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-2 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#141414] text-[#fafafa]">
                        {d.name} ({d.rowCount} rows, {d.columnCount} cols)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. DYNAMIC RECOMMENDATIONS */}
              {recommendations.length > 0 && (
                <div className="rounded-xl border border-[#ff6b35]/30 bg-[#ff6b35]/5 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ff6b35] uppercase tracking-wider font-mono-code">
                      <Sparkles className="h-3.5 w-3.5 text-[#ff6b35]" />
                      Recommended Charts
                    </span>
                    <span className="text-[10px] text-[#898989] font-mono-code">AI Heuristics</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendations.slice(0, 4).map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => applyRecommendation(rec)}
                        title={rec.description}
                        className="inline-flex items-center gap-1 rounded-full border border-[#ff6b35]/40 bg-[#181818] px-2.5 py-1 text-[11px] font-mono-code text-[#ff6b35] hover:bg-[#ff6b35]/15 transition cursor-pointer"
                      >
                        <span className="font-semibold">{rec.chartType}</span>
                        <span className="text-[#898989]">·</span>
                        <span className="truncate max-w-[120px] text-[#fafafa]">{rec.valueCol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. CHART TYPE SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-[#fafafa] mb-1.5 uppercase tracking-wider font-mono-code">
                  Chart Architecture ({CHART_TYPES.length})
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
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                          isSelected
                            ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35] font-semibold shadow-[0_0_15px_rgba(255,107,53,0.15)]"
                            : "border-[#262626] bg-[#181818] text-[#898989] hover:border-[#383838] hover:text-[#fafafa]"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-[#ff6b35]" : "text-[#898989]"}`} />
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. COMPATIBILITY ALERT */}
              {compatibility.severity !== "none" && (
                <div
                  className={`rounded-xl p-3 text-xs flex items-start gap-2 ${
                    compatibility.severity === "error"
                      ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                      : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#ff6b35]" />
                  <div>
                    <span className="font-semibold block font-mono-code">Configuration Advisory</span>
                    <span className="text-[11px]">{compatibility.message}</span>
                  </div>
                </div>
              )}

              {/* 5. DIMENSIONS & MEASURES */}
              <div className="space-y-3 pt-2 border-t border-[#262626]">
                {/* Category / X-Axis */}
                {chartType !== "KPI" && (
                  <div>
                    <label className="block text-xs font-medium text-[#898989] mb-1 flex items-center justify-between">
                      <span className="text-[#fafafa]">Category / X-Axis</span>
                      <span className="text-[10px] text-[#898989] font-mono-code">Primary Dimension</span>
                    </label>
                    <select
                      id="category-col-select"
                      value={categoryCol}
                      onChange={(e) => setCategoryCol(e.target.value)}
                      className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-2 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    >
                      <option value="" className="bg-[#141414] text-[#fafafa]">— Select Category Column —</option>
                      {columns.map((c) => (
                        <option key={c.name} value={c.name} className="bg-[#141414] text-[#fafafa]">
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Value / Measure 1 */}
                <div>
                  <label className="block text-xs font-medium text-[#898989] mb-1 flex items-center justify-between">
                    <span className="text-[#fafafa]">Value / Y-Axis</span>
                    <span className="text-[10px] text-[#898989] font-mono-code">Primary Metric</span>
                  </label>
                  <select
                    id="value-col-select"
                    value={valueCol}
                    onChange={(e) => setValueCol(e.target.value)}
                    className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-2 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                  >
                    <option value="" className="bg-[#141414] text-[#fafafa]">— Select Measure Column —</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name} className="bg-[#141414] text-[#fafafa]">
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
                    <label className="block text-xs font-medium text-[#898989] mb-1 flex items-center justify-between">
                      <span className="text-[#fafafa]">Secondary Series (Optional)</span>
                      <span className="text-[10px] text-[#898989] font-mono-code">Multi-Metric</span>
                    </label>
                    <select
                      value={secondaryValueCol}
                      onChange={(e) => setSecondaryValueCol(e.target.value)}
                      className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-2 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    >
                      <option value="" className="bg-[#141414] text-[#fafafa]">— None (Single Series) —</option>
                      {columns
                        .filter((c) => c.name !== valueCol)
                        .map((c) => (
                          <option key={c.name} value={c.name} className="bg-[#141414] text-[#fafafa]">
                            {c.name} ({c.type})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Optional Grouping / Matrix Column (Heatmap) */}
                {chartType === "HEATMAP" && (
                  <div>
                    <label className="block text-xs font-medium text-[#898989] mb-1 flex items-center justify-between">
                      <span className="text-[#fafafa]">Matrix Y-Axis (Category 2)</span>
                      <span className="text-[10px] text-[#ff6b35] font-mono-code font-bold">Required for Matrix</span>
                    </label>
                    <select
                      value={groupCol}
                      onChange={(e) => setGroupCol(e.target.value)}
                      className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-2 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    >
                      <option value="" className="bg-[#141414] text-[#fafafa]">— Select Second Category —</option>
                      {columns
                        .filter((c) => c.name !== categoryCol)
                        .map((c) => (
                          <option key={c.name} value={c.name} className="bg-[#141414] text-[#fafafa]">
                            {c.name} ({c.type})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Aggregation Function */}
                {chartType !== "SCATTER" && (
                  <div>
                    <label className="block text-xs font-medium text-[#898989] mb-1">
                      Aggregation Method
                    </label>
                    <select
                      value={aggregation}
                      onChange={(e) => setAggregation(e.target.value as AggregationFunction)}
                      className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-2 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    >
                      {AGGREGATIONS.map((agg) => (
                        <option key={agg.id} value={agg.id} className="bg-[#141414] text-[#fafafa]">
                          {agg.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 6. SORTING */}
              <div className="pt-2 border-t border-[#262626]">
                <label className="block text-xs font-semibold text-[#fafafa] mb-1.5 flex items-center gap-1.5 uppercase tracking-wider font-mono-code">
                  <ArrowUpDown className="h-3.5 w-3.5 text-[#ff6b35]" />
                  Sorting
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortCol}
                    onChange={(e) => setSortCol(e.target.value)}
                    className="text-xs rounded-xl border border-[#262626] bg-[#121212] px-2.5 py-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                  >
                    <option value="" className="bg-[#141414] text-[#fafafa]">— Default Sort —</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name} className="bg-[#141414] text-[#fafafa]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                    className="text-xs rounded-xl border border-[#262626] bg-[#121212] px-2.5 py-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                  >
                    <option value="asc" className="bg-[#141414] text-[#fafafa]">Ascending (A→Z, 0→9)</option>
                    <option value="desc" className="bg-[#141414] text-[#fafafa]">Descending (Z→A, 9→0)</option>
                  </select>
                </div>
              </div>

              {/* 7. FILTERS */}
              <div className="pt-2 border-t border-[#262626]">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5 uppercase tracking-wider font-mono-code">
                    <FunnelIcon className="h-3.5 w-3.5 text-[#ff6b35]" />
                    Query Filters ({filters.length})
                  </label>
                  <button
                    type="button"
                    onClick={addFilterRow}
                    className="text-xs font-mono-code text-[#ff6b35] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Filter
                  </button>
                </div>

                {filters.length === 0 ? (
                  <p className="text-xs text-[#898989] font-mono-code italic">No active filters applied.</p>
                ) : (
                  <div className="space-y-2">
                    {filters.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-[#181818] p-2.5 rounded-xl border border-[#262626]">
                        <select
                          value={f.column}
                          onChange={(e) => updateFilterRow(idx, "column", e.target.value)}
                          className="w-1/3 text-xs rounded-lg border border-[#262626] bg-[#121212] p-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                        >
                          {columns.map((c) => (
                            <option key={c.name} value={c.name} className="bg-[#141414] text-[#fafafa]">
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={f.operator}
                          onChange={(e) => updateFilterRow(idx, "operator", e.target.value)}
                          className="w-1/3 text-xs rounded-lg border border-[#262626] bg-[#121212] p-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                        >
                          {FILTER_OPERATORS.map((op) => (
                            <option key={op.id} value={op.id} className="bg-[#141414] text-[#fafafa]">
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
                            className="w-1/3 text-xs rounded-lg border border-[#262626] bg-[#121212] p-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFilterRow(idx)}
                          className="text-[#898989] hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
                  <label className="block text-xs font-semibold text-[#fafafa] mb-1.5 uppercase tracking-wider font-mono-code">
                    Color Palette
                  </label>
                  <div className="space-y-1.5">
                    {Object.entries(COLOR_PALETTES).map(([key, colors]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setColorPalette(key)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                          colorPalette === key
                            ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#fafafa] font-semibold shadow-[0_0_15px_rgba(255,107,53,0.15)]"
                            : "border-[#262626] bg-[#181818] text-[#898989] hover:border-[#383838] hover:text-[#fafafa]"
                        }`}
                      >
                        <span className="capitalize">{key}</span>
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
                <div className="pt-2 border-t border-[#262626] space-y-2.5">
                  <label className="block text-xs font-semibold text-[#fafafa] uppercase tracking-wider font-mono-code">
                    Legend Settings
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#898989]">Show Legend</span>
                    <input
                      type="checkbox"
                      checked={legendShow}
                      onChange={(e) => setLegendShow(e.target.checked)}
                      className="h-4 w-4 rounded border-[#262626] bg-[#121212] accent-[#ff6b35] focus:ring-0 cursor-pointer"
                    />
                  </div>
                  {legendShow && (
                    <div>
                      <span className="text-[10px] text-[#898989] font-mono-code block mb-1">Position</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["top", "bottom", "left", "right"] as const).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setLegendPosition(pos)}
                            className={`py-1.5 rounded-xl text-xs font-mono-code capitalize border transition cursor-pointer ${
                              legendPosition === pos
                                ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35] font-semibold"
                                : "border-[#262626] bg-[#181818] text-[#898989] hover:border-[#383838] hover:text-[#fafafa]"
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
                <div className="pt-2 border-t border-[#262626] space-y-3">
                  <label className="block text-xs font-semibold text-[#fafafa] uppercase tracking-wider font-mono-code">
                    Axes & Gridlines
                  </label>
                  <div>
                    <span className="text-[10px] text-[#898989] font-mono-code block mb-1">X-Axis Custom Title</span>
                    <input
                      type="text"
                      value={xAxisTitle}
                      onChange={(e) => setXAxisTitle(e.target.value)}
                      placeholder="e.g. Regions, Months, Categories"
                      className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#898989]">Show X-Axis Gridlines</span>
                    <input
                      type="checkbox"
                      checked={showXGrid}
                      onChange={(e) => setShowXGrid(e.target.checked)}
                      className="h-4 w-4 rounded border-[#262626] bg-[#121212] accent-[#ff6b35] focus:ring-0 cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#898989] font-mono-code block mb-1">Y-Axis Custom Title</span>
                    <input
                      type="text"
                      value={yAxisTitle}
                      onChange={(e) => setYAxisTitle(e.target.value)}
                      placeholder="e.g. Revenue ($), Total Count"
                      className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#898989]">Show Y-Axis Gridlines</span>
                    <input
                      type="checkbox"
                      checked={showYGrid}
                      onChange={(e) => setShowYGrid(e.target.checked)}
                      className="h-4 w-4 rounded border-[#262626] bg-[#121212] accent-[#ff6b35] focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 4. NUMBER FORMATTING */}
                <div className="pt-2 border-t border-[#262626] space-y-3">
                  <label className="block text-xs font-semibold text-[#fafafa] uppercase tracking-wider font-mono-code">
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
                        className={`py-1.5 text-xs rounded-xl border text-center font-mono-code transition cursor-pointer ${
                          numberFormatType === f.id
                            ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35] font-semibold"
                            : "border-[#262626] bg-[#181818] text-[#898989] hover:border-[#383838] hover:text-[#fafafa]"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[#898989] font-mono-code block mb-1">Prefix</span>
                      <input
                        type="text"
                        value={numberPrefix}
                        onChange={(e) => setNumberPrefix(e.target.value)}
                        placeholder="e.g. $, €"
                        className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#898989] font-mono-code block mb-1">Suffix</span>
                      <input
                        type="text"
                        value={numberSuffix}
                        onChange={(e) => setNumberSuffix(e.target.value)}
                        placeholder="e.g. USD, /mo"
                        className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#898989]">Decimal Places</span>
                    <select
                      value={numberDecimals}
                      onChange={(e) => setNumberDecimals(Number(e.target.value))}
                      className="text-xs rounded-xl border border-[#262626] bg-[#121212] px-2.5 py-1 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                    >
                      <option value={0} className="bg-[#141414] text-[#fafafa]">0 (Integer)</option>
                      <option value={1} className="bg-[#141414] text-[#fafafa]">1 decimal</option>
                      <option value={2} className="bg-[#141414] text-[#fafafa]">2 decimals</option>
                      <option value={3} className="bg-[#141414] text-[#fafafa]">3 decimals</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#898989]">Compact Format (1.5M, 24K)</span>
                    <input
                      type="checkbox"
                      checked={numberCompact}
                      onChange={(e) => setNumberCompact(e.target.checked)}
                      className="h-4 w-4 rounded border-[#262626] bg-[#121212] accent-[#ff6b35] focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 5. VISUALIZATION-SPECIFIC SETTINGS */}
                <div className="pt-2 border-t border-[#262626] space-y-2.5">
                  <label className="block text-xs font-semibold text-[#fafafa] uppercase tracking-wider font-mono-code">
                    Display Settings
                  </label>
                  {(chartType === "BAR" || chartType === "AREA") && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#898989]">Stacked Series</span>
                      <input
                        type="checkbox"
                        checked={chartStacked}
                        onChange={(e) => setChartStacked(e.target.checked)}
                        className="h-4 w-4 rounded border-[#262626] bg-[#121212] accent-[#ff6b35] focus:ring-0 cursor-pointer"
                      />
                    </div>
                  )}
                  {(chartType === "LINE" || chartType === "AREA") && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#898989]">Smooth Spline Curve</span>
                      <input
                        type="checkbox"
                        checked={chartSmooth}
                        onChange={(e) => setChartSmooth(e.target.checked)}
                        className="h-4 w-4 rounded border-[#262626] bg-[#121212] accent-[#ff6b35] focus:ring-0 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* MAIN PREVIEW CANVAS */}
          <main className="flex-1 min-w-0 flex flex-col lg:h-[calc(100vh-57px)] overflow-y-auto bg-[#121212] p-4 sm:p-6">
            {/* Title & Metadata Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 bg-[#141414] p-4 rounded-2xl border border-[#262626] shadow-sm">
              <div className="flex-1 max-w-xl">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Visualization Title"
                  className="w-full text-base font-semibold text-[#fafafa] bg-transparent border-b border-transparent hover:border-[#262626] focus:border-[#ff6b35] focus:outline-none px-1 py-0.5"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add an optional description or business insight notes…"
                  className="w-full text-xs text-[#898989] bg-transparent border-b border-transparent hover:border-[#262626] focus:border-[#ff6b35] focus:outline-none px-1 py-0.5 mt-0.5"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-[#181818] p-1 rounded-full border border-[#262626] text-xs font-mono-code">
                  <button
                    onClick={() => setPreviewTab("chart")}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      previewTab === "chart"
                        ? "bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 font-semibold"
                        : "text-[#898989] hover:text-[#fafafa] border border-transparent"
                    }`}
                  >
                    Live Chart
                  </button>
                  <button
                    onClick={() => setPreviewTab("data")}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      previewTab === "data"
                        ? "bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 font-semibold"
                        : "text-[#898989] hover:text-[#fafafa] border border-transparent"
                    }`}
                  >
                    Raw Data ({queryResult?.rows?.length ?? 0})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={executeQuery}
                  disabled={isQuerying}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#262626] bg-[#181818] px-3.5 py-1 text-xs font-mono-code text-[#fafafa] hover:bg-[#222] transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isQuerying ? "animate-spin text-[#ff6b35]" : "text-[#898989]"}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 bg-[#141414] rounded-2xl border border-[#262626] p-6 shadow-sm flex flex-col overflow-hidden">
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
                <div className="flex-1 overflow-auto rounded-xl border border-[#262626] bg-[#121212]">
                  <table className="min-w-full divide-y divide-[#262626] text-xs">
                    <thead className="bg-[#181818] sticky top-0">
                      <tr>
                        {queryResult?.columns?.map((col) => (
                          <th key={col.name} className="px-3.5 py-2.5 text-left font-medium text-[#fafafa] font-mono-code">
                            {col.name}
                            <span className="block text-[10px] text-[#898989] font-normal">
                              {col.type}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626] bg-[#141414]">
                      {queryResult?.rows?.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#181818]/60 transition-colors">
                          {queryResult.columns.map((col) => (
                            <td key={col.name} className="px-3.5 py-2 font-mono-code text-[#fafafa]">
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
              <h2 className="text-xl font-semibold text-[#fafafa]">Saved Visualizations Gallery</h2>
              <p className="text-xs text-[#898989] mt-1">
                Explore, edit, or attach saved visualizations directly into your dashboards.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingVizId(null);
                setTitle("New Visualization");
                setActiveTab("builder");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-2 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Visualization</span>
            </button>
          </div>

          {isLoadingSaved ? (
            <div className="py-20 text-center text-xs font-mono-code text-[#898989]">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-[#ff6b35] border-t-transparent mb-2" />
              <p>Loading saved visualizations…</p>
            </div>
          ) : savedVisualizations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#262626] bg-[#141414] p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35] text-2xl mb-3">
                📊
              </div>
              <h3 className="text-base font-semibold text-[#fafafa]">No saved visualizations yet</h3>
              <p className="text-xs text-[#898989] mt-1 max-w-sm mx-auto">
                Use the Studio Builder to create and save charts, then pin them onto your analytics dashboards.
              </p>
              <button
                onClick={() => setActiveTab("builder")}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-2 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer"
              >
                Open Studio Builder →
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {savedVisualizations.map((viz) => (
                <div
                  key={viz.id}
                  className="rounded-2xl border border-[#262626] bg-[#141414] p-5 shadow-sm hover:border-[#ff6b35]/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ff6b35]/15 border border-[#ff6b35]/30 px-2.5 py-0.5 text-[11px] font-semibold font-mono-code text-[#ff6b35]">
                        {viz.chartType}
                      </span>
                      <span className="text-[10px] text-[#898989] font-mono-code">
                        {new Date(viz.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-[#fafafa] truncate">{viz.title}</h3>
                    <p className="text-xs text-[#898989] mt-1 line-clamp-2">
                      {viz.description || "No description provided."}
                    </p>

                    <div className="mt-4 pt-3 border-t border-[#262626] text-xs text-[#898989] flex items-center justify-between">
                      <span className="truncate">
                        Dataset: <strong className="text-[#fafafa] font-normal">{viz.datasetName || "Linked Dataset"}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#262626] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSaved(viz)}
                      className="text-xs font-mono-code text-[#ff6b35] hover:underline cursor-pointer"
                    >
                      Edit in Builder
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenShareModal(viz)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#262626] bg-[#181818] px-2.5 py-1 text-xs text-[#fafafa] hover:bg-[#222] transition cursor-pointer"
                        title="Share visualization"
                      >
                        <Share2 className="h-3 w-3 text-[#ff6b35]" />
                        <span>Share</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAddToDashboard(viz)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#262626] bg-[#181818] px-2.5 py-1 text-xs text-[#fafafa] hover:bg-[#222] transition cursor-pointer"
                      >
                        <LayoutDashboard className="h-3 w-3 text-[#ff6b35]" />
                        <span>Add</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(viz.id, viz.title)}
                        className="text-[#898989] hover:text-rose-400 p-1 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-[#141414] border border-[#262626] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-[#fafafa] mb-1">Add to Dashboard</h3>
            <p className="text-xs text-[#898989] mb-4">
              Pin &quot;{targetVizForDashboard?.title || title}&quot; to one of your active dashboards.
            </p>

            {dashboards.length === 0 ? (
              <div className="p-4 bg-amber-500/10 rounded-xl text-xs text-amber-300 border border-amber-500/30 mb-4">
                No dashboards found in your organization.{" "}
                <Link href="/dashboards" className="underline font-bold text-[#ff6b35]">
                  Create a dashboard first
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                <label className="block text-xs font-medium text-[#898989]">
                  Select Destination Dashboard
                </label>
                <select
                  id="destination-dashboard-select"
                  value={selectedDashboardId}
                  onChange={(e) => setSelectedDashboardId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-[#262626] bg-[#121212] p-2.5 text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                >
                  {dashboards.map((dash) => (
                    <option key={dash.id} value={dash.id} className="bg-[#141414] text-[#fafafa]">
                      {dash.name} ({dash.charts?.length ?? dash.chartCount ?? 0} charts)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-[#262626] pt-4">
              <button
                type="button"
                onClick={() => setIsDashboardModalOpen(false)}
                className="rounded-full border border-[#262626] bg-[#181818] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:bg-[#222] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addingToDashboard || dashboards.length === 0}
                onClick={handleConfirmAddToDashboard}
                className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer disabled:opacity-50"
              >
                {addingToDashboard ? "Adding…" : "Confirm & Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE VISUALIZATION MODAL (FEATURE 15) */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-[#141414] border border-[#262626] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35] flex items-center justify-center">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#fafafa]">Share Visualization</h3>
                  <p className="text-[11px] text-[#898989]">Public view-only standalone access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-[#898989] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-[#1f1f1f] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isSharingLoading ? (
              <div className="py-8 text-center text-xs text-[#898989] flex flex-col items-center gap-2 font-mono-code">
                <RefreshCw className="h-5 w-5 animate-spin text-[#ff6b35]" />
                <span>Generating secure public link...</span>
              </div>
            ) : shareUrl ? (
              <div className="space-y-3">
                <p className="text-xs text-[#898989]">
                  Anyone with this link can view the &quot;{sharingVizTitle}&quot; chart in live read-only mode without logging in.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-[180px] text-xs font-mono-code bg-[#121212] border border-[#262626] rounded-xl px-3 py-2 text-[#fafafa] select-all focus:outline-none"
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-3.5 py-2 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer shrink-0 whitespace-nowrap"
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
                    className="inline-flex items-center gap-1 text-xs font-mono-code text-[#ff6b35] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Open in new tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleRevokeShare}
                    className="inline-flex items-center gap-1 text-xs font-mono-code text-rose-400 hover:underline cursor-pointer"
                  >
                    <Lock className="h-3 w-3" />
                    <span>Revoke link</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-[#898989]">
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
                  className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-2 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer"
                >
                  Generate Share Link
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-[#262626] flex justify-end">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="rounded-full border border-[#262626] bg-[#181818] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:bg-[#222] transition cursor-pointer"
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
        <div className="min-h-screen flex items-center justify-center bg-[#121212]">
          <p className="text-xs font-mono-code text-[#898989]">Loading Visualizations Studio…</p>
        </div>
      }
    >
      <VisualizationsStudioContent />
    </Suspense>
  );
}
