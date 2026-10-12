"use client";

import { useState } from "react";
import {
  Sparkles,
  Send,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  X,
  CheckCircle,
  HelpCircle,
  Database,
  ArrowRight,
} from "lucide-react";
import {
  apiAskDataAnalyst,
  apiNlToChart,
  apiGetInsights,
  type AnalystQueryResponse,
  type NlToChartResponse,
  type AutoInsight,
  type DatasetData,
  type DatasetQueryFilter,
} from "../../lib/api";
import { ChartRenderer } from "../visualization/ChartRenderer";

interface AiAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: DatasetData[];
  defaultDatasetId?: string;
  activeFilters?: DatasetQueryFilter[];
  dashboardId?: string;
  onAddGeneratedChart?: (chartSpec: NlToChartResponse) => void;
}

export function AiAnalyticsModal({
  isOpen,
  onClose,
  datasets,
  defaultDatasetId,
  activeFilters = [],
  dashboardId,
  onAddGeneratedChart,
}: AiAnalyticsModalProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    defaultDatasetId || datasets[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<"analyst" | "nl-chart" | "insights">("analyst");

  // AI Analyst state
  const [analystQuestion, setAnalystQuestion] = useState("");
  const [analystLoading, setAnalystLoading] = useState(false);
  const [analystResult, setAnalystResult] = useState<AnalystQueryResponse | null>(null);
  const [analystError, setAnalystError] = useState<string | null>(null);

  // NL to Chart state
  const [nlPrompt, setNlPrompt] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<NlToChartResponse | null>(null);
  const [nlError, setNlError] = useState<string | null>(null);

  // Insights state
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsList, setInsightsList] = useState<AutoInsight[]>([]);
  const [insightsSummary, setInsightsSummary] = useState<string>("");
  const [insightsError, setInsightsError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAskAnalyst = async (questionToAsk?: string) => {
    const q = questionToAsk || analystQuestion;
    if (!q.trim() || !selectedDatasetId) return;

    setAnalystLoading(true);
    setAnalystError(null);
    try {
      const res = await apiAskDataAnalyst({
        datasetId: selectedDatasetId,
        question: q.trim(),
        filters: activeFilters,
        dashboardId,
      });
      setAnalystResult(res);
    } catch (err) {
      setAnalystError(err instanceof Error ? err.message : "Failed to analyze question");
    } finally {
      setAnalystLoading(false);
    }
  };

  const handleGenerateChart = async (promptToUse?: string) => {
    const p = promptToUse || nlPrompt;
    if (!p.trim() || !selectedDatasetId) return;

    setNlLoading(true);
    setNlError(null);
    try {
      const res = await apiNlToChart({
        datasetId: selectedDatasetId,
        prompt: p.trim(),
        filters: activeFilters,
      });
      setNlResult(res);
    } catch (err) {
      setNlError(err instanceof Error ? err.message : "Failed to generate chart");
    } finally {
      setNlLoading(false);
    }
  };

  const handleFetchInsights = async () => {
    if (!selectedDatasetId) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await apiGetInsights({
        datasetId: selectedDatasetId,
        filters: activeFilters,
      });
      setInsightsList(res.insights);
      setInsightsSummary(res.summary);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : "Failed to generate insights");
    } finally {
      setInsightsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md">
              <Sparkles className="h-5 w-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">RicozViz AI Analytics</h2>
              <p className="text-[11px] text-indigo-200">
                Grounded Analytical AI & Query Intelligence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-indigo-200 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dataset Selector & Navigation Tabs */}
        <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600">Dataset:</span>
            <select
              value={selectedDatasetId}
              onChange={(e) => {
                setSelectedDatasetId(e.target.value);
                setAnalystResult(null);
                setNlResult(null);
                setInsightsList([]);
              }}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.rowCount || 0} rows)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("analyst")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "analyst"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-gray-600 hover:bg-gray-200/60"
              }`}
            >
              AI Data Analyst
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("nl-chart")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "nl-chart"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-gray-600 hover:bg-gray-200/60"
              }`}
            >
              Natural Language → Chart
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("insights");
                if (insightsList.length === 0) void handleFetchInsights();
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "insights"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-gray-600 hover:bg-gray-200/60"
              }`}
            >
              Insights & Anomalies
            </button>
          </div>
        </div>

        {/* Tab 1: AI Data Analyst */}
        {activeTab === "analyst" && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Ask an analytical question
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAskAnalyst();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={analystQuestion}
                  onChange={(e) => setAnalystQuestion(e.target.value)}
                  placeholder="e.g. 'What is our total revenue?' or 'Which region has the highest revenue?'"
                  className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2 text-xs text-gray-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={analystLoading || !analystQuestion.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{analystLoading ? "Analyzing..." : "Ask"}</span>
                </button>
              </form>
            </div>

            {/* Quick Question Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-gray-400 font-medium">Try asking:</span>
              {[
                "What is our total revenue?",
                "Which region has the highest revenue?",
                "What were our sales last month?",
                "Which product generated the most profit?",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setAnalystQuestion(q);
                    void handleAskAnalyst(q);
                  }}
                  className="rounded-full bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 border border-gray-200 transition"
                >
                  {q}
                </button>
              ))}
            </div>

            {analystError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {analystError}
              </div>
            )}

            {/* Analyst Response Display */}
            {analystResult && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-gray-500 border-b border-indigo-100 pb-2">
                  <span className="font-semibold text-indigo-900">
                    Question: &ldquo;{analystResult.question}&rdquo;
                  </span>
                  <span className="font-mono text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified Grounded ({analystResult.groundingVerification.executionTimeMs}ms)
                  </span>
                </div>

                <div className="text-xs text-gray-800 leading-relaxed font-medium bg-white p-3 rounded-lg border border-indigo-100/70 shadow-2xs">
                  {analystResult.answer}
                </div>

                {analystResult.chartSuggestion && (
                  <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-lg border border-indigo-100 text-xs">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-600" />
                      <span>
                        Suggested View: <strong>{analystResult.chartSuggestion.title}</strong> (
                        {analystResult.chartSuggestion.chartType})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("nl-chart");
                        setNlPrompt(
                          `Show ${analystResult.chartSuggestion?.measure} by ${analystResult.chartSuggestion?.dimension}`
                        );
                        void handleGenerateChart(
                          `Show ${analystResult.chartSuggestion?.measure} by ${analystResult.chartSuggestion?.dimension}`
                        );
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <span>Plot Chart</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Natural Language -> Chart */}
        {activeTab === "nl-chart" && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Describe the chart you want to see
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleGenerateChart();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={nlPrompt}
                  onChange={(e) => setNlPrompt(e.target.value)}
                  placeholder="e.g. 'Show revenue by region' or 'Top 5 products by revenue'"
                  className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2 text-xs text-gray-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={nlLoading || !nlPrompt.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>{nlLoading ? "Generating..." : "Generate Chart"}</span>
                </button>
              </form>
            </div>

            {/* Quick Chart Prompts */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-gray-400 font-medium">Examples:</span>
              {[
                "Show revenue by region",
                "Show revenue by product",
                "Show monthly profit",
                "Top 5 products by revenue",
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setNlPrompt(p);
                    void handleGenerateChart(p);
                  }}
                  className="rounded-full bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 border border-gray-200 transition"
                >
                  {p}
                </button>
              ))}
            </div>

            {nlError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {nlError}
              </div>
            )}

            {/* Rendered Generated Chart */}
            {nlResult && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{nlResult.title}</h3>
                    <p className="text-[11px] text-gray-400">{nlResult.explanation}</p>
                  </div>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-700 uppercase">
                    {nlResult.chartType}
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ChartRenderer
                    chartType={nlResult.chartType as any}
                    config={nlResult.config as any}
                    queryResult={{
                      rows: nlResult.data,
                      columns: nlResult.columns,
                      rowCount: nlResult.rowCount,
                      total: nlResult.rowCount,
                      limit: 100,
                      offset: 0,
                      executionTimeMs: 0,
                    }}
                    height="100%"
                  />
                </div>

                {onAddGeneratedChart && (
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => onAddGeneratedChart(nlResult)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 transition"
                    >
                      <span>Add to Dashboard</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Automatic Insights & Anomaly Detection */}
        {activeTab === "insights" && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                  Statistical Insights & Anomaly Detection
                </h3>
                <p className="text-[11px] text-gray-500">
                  Deterministic detection using Z-score (threshold $\ge 2.5$) and IQR 1.5x outlier methods
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleFetchInsights()}
                disabled={insightsLoading}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 transition"
              >
                {insightsLoading ? "Scanning..." : "Re-scan"}
              </button>
            </div>

            {insightsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {insightsError}
              </div>
            )}

            {insightsSummary && (
              <div className="rounded-lg bg-indigo-50/60 p-2.5 text-xs text-indigo-900 font-medium border border-indigo-100">
                {insightsSummary}
              </div>
            )}

            {insightsList.length === 0 && !insightsLoading ? (
              <div className="text-center py-8 text-xs text-gray-400">
                No insights or anomalies generated yet. Click &ldquo;Re-scan&rdquo; to analyze this dataset.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insightsList.map((ins) => (
                  <div
                    key={ins.id}
                    className={`rounded-xl p-3 border text-xs flex flex-col justify-between ${
                      ins.isAnomaly
                        ? "border-amber-300 bg-amber-50/60 text-amber-950"
                        : "border-indigo-100 bg-white text-gray-800 shadow-2xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        {ins.isAnomaly ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        )}
                        <span>{ins.title}</span>
                      </div>
                      <p className="text-gray-600 leading-relaxed text-[11px]">{ins.description}</p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-gray-100/60 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Method: {ins.detectionMethod || "STATISTICAL"}</span>
                      {ins.score !== undefined && <span>Score: {ins.score}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
