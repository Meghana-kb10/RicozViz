"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import {
  apiGetDataset,
  apiPreviewDataset,
  apiUpdateDataset,
  apiQueryDataset,
  apiPreviewCalculatedField,
  apiCreateCalculatedField,
  apiDeleteCalculatedField,
  type DatasetData,
  type DatasetQueryFilter,
  type DatasetQueryMeasure,
  type DatasetQueryResult,
  type FilterOperator,
  type AggregationFunction,
  type CalculatedFieldConfig,
  type PreviewCalculatedFieldResult,
  ApiError,
} from "../../../lib/api";

const FILTER_OPERATORS: { label: string; value: FilterOperator }[] = [
  { label: "equals (=)", value: "=" },
  { label: "not equals (!=)", value: "!=" },
  { label: "greater than (>)", value: ">" },
  { label: "greater or equal (>=)", value: ">=" },
  { label: "less than (<)", value: "<" },
  { label: "less or equal (<=)", value: "<=" },
  { label: "contains", value: "contains" },
  { label: "starts with", value: "startsWith" },
  { label: "ends with", value: "endsWith" },
  { label: "is null", value: "isNull" },
  { label: "is not null", value: "isNotNull" },
];

const AGGREGATION_OPTIONS: AggregationFunction[] = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
];

export default function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { auth, isLoading } = useAuth();
  const router = useRouter();

  const [dataset, setDataset] = useState<DatasetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"SCHEMA" | "PREVIEW" | "EXPLORE" | "CALCULATED">("SCHEMA");
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Calculated Fields State
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [calcName, setCalcName] = useState("");
  const [calcExpression, setCalcExpression] = useState("");
  const [calcPreviewResult, setCalcPreviewResult] = useState<PreviewCalculatedFieldResult | null>(null);
  const [previewingCalc, setPreviewingCalc] = useState(false);
  const [savingCalc, setSavingCalc] = useState(false);
  const [calcModalError, setCalcModalError] = useState<string | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Explorer State
  const [queryMode, setQueryMode] = useState<"RAW" | "AGGREGATE">("RAW");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [measures, setMeasures] = useState<DatasetQueryMeasure[]>([]);
  const [newMeasureCol, setNewMeasureCol] = useState<string>("");
  const [newMeasureAgg, setNewMeasureAgg] = useState<AggregationFunction>("SUM");
  const [newMeasureAlias, setNewMeasureAlias] = useState<string>("");

  const [filters, setFilters] = useState<DatasetQueryFilter[]>([]);
  const [filterLogic, setFilterLogic] = useState<"AND" | "OR">("AND");
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
  const [queryLimit, setQueryLimit] = useState<number>(50);

  const [queryResult, setQueryResult] = useState<DatasetQueryResult | null>(null);
  const [queryRunning, setQueryRunning] = useState<boolean>(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  useEffect(() => {
    if (!auth || !id) return;
    let ignore = false;

    apiGetDataset(id)
      .then((data) => {
        if (!ignore) {
          setDataset(data);
          setEditName(data.name);
          setEditDescription(data.description || "");
          setSelectedColumns(data.columns.map((c) => c.name));
          if (data.columns.length > 0) {
            setSortColumn(data.columns[0]?.name || "");
            const numCol = data.columns.find((c) => c.type === "number" || c.type === "integer");
            setNewMeasureCol(numCol ? numCol.name : data.columns[0]?.name || "");
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dataset details");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, id]);

  const loadPreviewData = useCallback((datasetId: string) => {
    setLoadingPreview(true);
    apiPreviewDataset(datasetId, 25)
      .then((res) => {
        setPreviewRows(res.rows);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingPreview(false);
      });
  }, []);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!dataset) return;
    setSavingEdit(true);
    setErrorMsg(null);

    try {
      const updated = await apiUpdateDataset(dataset.id, {
        name: editName,
        description: editDescription || null,
      });
      setDataset(updated);
      setIsEditing(false);
      setSuccessMsg("Dataset updated successfully.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update dataset");
    } finally {
      setSavingEdit(false);
    }
  }

  // ---- Query Explorer Handlers ----
  function handleAddFilter() {
    if (!dataset || dataset.columns.length === 0) return;
    setFilters((prev) => [
      ...prev,
      {
        column: dataset.columns[0]?.name || "",
        operator: "=",
        value: "",
      },
    ]);
  }

  function handleRemoveFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFilterChange(index: number, patch: Partial<DatasetQueryFilter>) {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  function handleAddMeasure() {
    if (!newMeasureCol) return;
    const defaultAlias = `${newMeasureAgg.toLowerCase()}_${newMeasureCol}`;
    setMeasures((prev) => [
      ...prev,
      {
        column: newMeasureCol,
        aggregation: newMeasureAgg,
        alias: newMeasureAlias.trim() || defaultAlias,
      },
    ]);
    setNewMeasureAlias("");
  }

  function handleRemoveMeasure(index: number) {
    setMeasures((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleColumnSelection(colName: string) {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  }

  function toggleDimensionSelection(colName: string) {
    setSelectedDimensions((prev) =>
      prev.includes(colName) ? prev.filter((d) => d !== colName) : [...prev, colName]
    );
  }

  async function handleExecuteQuery() {
    if (!id) return;
    setQueryRunning(true);
    setQueryError(null);

    try {
      const payload: {
        columns?: string[];
        dimensions?: string[];
        measures?: DatasetQueryMeasure[];
        filters?: DatasetQueryFilter[];
        filterLogic?: "AND" | "OR";
        orderBy?: { column: string; direction: "ASC" | "DESC" };
        limit?: number;
      } = {
        limit: queryLimit,
        filterLogic,
      };

      if (filters.length > 0) {
        payload.filters = filters;
      }

      if (sortColumn) {
        payload.orderBy = {
          column: sortColumn,
          direction: sortDirection,
        };
      }

      if (queryMode === "AGGREGATE") {
        payload.dimensions = selectedDimensions;
        payload.measures = measures.length > 0 ? measures : [{ column: "*", aggregation: "COUNT", alias: "count" }];
      } else {
        payload.columns = selectedColumns.length > 0 ? selectedColumns : undefined;
      }

      const res = await apiQueryDataset(id, payload);
      setQueryResult(res);
    } catch (err) {
      setQueryError(err instanceof ApiError ? err.message : "Failed to execute query");
      setQueryResult(null);
    } finally {
      setQueryRunning(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading dataset details...</p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-base font-semibold text-gray-900">Dataset not found</p>
          <Link
            href="/datasets"
            className="mt-4 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            ← Back to Datasets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                R
              </span>
              <span>RicozViz</span>
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-900">
              Workspace
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/datasets" className="text-sm text-gray-500 hover:text-gray-900">
              Datasets
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">{dataset.name}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Breadcrumb back */}
        <div className="mb-4">
          <Link
            href="/datasets"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 inline-flex items-center gap-1"
          >
            ← Back to all Datasets
          </Link>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 text-xs font-medium text-green-700 border border-green-200">
            {successMsg}
          </div>
        )}

        {/* Dataset Header Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div className="flex-1">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3 max-w-md">
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base font-bold text-gray-900"
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">{dataset.name}</h1>
                  <p className="mt-1 text-xs text-gray-500">
                    {dataset.description || "No description provided."}
                  </p>
                </>
              )}
            </div>

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                ✏️ Edit Metadata
              </button>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Source Type</span>
              <span className="font-semibold text-gray-900">
                {dataset.type === "CONNECTED"
                  ? `🔌 ${dataset.dataSourceName || "PostgreSQL"}`
                  : "📄 Uploaded CSV"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Status</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
                {dataset.status}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Columns / Rows</span>
              <span className="font-semibold text-gray-900">
                {dataset.columns.length} columns · {dataset.rowCount} rows
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Created</span>
              <span className="font-semibold text-gray-900">
                {new Date(dataset.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab("SCHEMA")}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === "SCHEMA"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📋 Schema Definition ({dataset.columns.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("PREVIEW");
              if (previewRows.length === 0 && id) {
                loadPreviewData(id);
              }
            }}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === "PREVIEW"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            👁️ Sample Data Preview
          </button>
          <button
            onClick={() => setActiveTab("EXPLORE")}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === "EXPLORE"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🔍 Explore Data
          </button>
          <button
            onClick={() => setActiveTab("CALCULATED")}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 ${
              activeTab === "CALCULATED"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            ⚡ Calculated Fields ({dataset.calculatedFields?.length || dataset.columns.filter((c) => c.isCalculated).length})
          </button>
        </div>

        {/* Tab 1: Schema Table */}
        {activeTab === "SCHEMA" && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">
                    Column
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">
                    Nullable
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">
                    Position
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {dataset.columns.map((col, idx) => (
                  <tr key={col.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">
                      {col.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          col.type === "integer" || col.type === "number"
                            ? "bg-blue-50 text-blue-700"
                            : col.type === "boolean"
                              ? "bg-purple-50 text-purple-700"
                              : col.type === "date"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {col.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          col.nullable
                            ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {col.nullable ? "Nullable" : "Required"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">
                      {col.ordinalPosition ?? idx + 1}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Preview Table */}
        {activeTab === "PREVIEW" && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {loadingPreview ? (
              <div className="p-12 text-center text-sm text-gray-500">
                Loading sample rows...
              </div>
            ) : previewRows.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">
                No preview rows available for this dataset.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {dataset.columns.map((col) => (
                        <th
                          key={col.name}
                          className="px-4 py-2.5 text-left font-semibold text-gray-700 uppercase whitespace-nowrap"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {dataset.columns.map((col) => (
                          <td
                            key={col.name}
                            className="px-4 py-2 text-gray-700 whitespace-nowrap"
                          >
                            {row[col.name] !== undefined && row[col.name] !== null
                              ? String(row[col.name])
                              : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Explore Data */}
        {activeTab === "EXPLORE" && (
          <div className="space-y-6">
            {/* Query Builder Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Query & Explore Dataset</h2>
                  <p className="text-xs text-gray-500">
                    Configure columns, filters, aggregations, and sorting to inspect records safely.
                  </p>
                </div>
                {/* Mode Selector */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setQueryMode("RAW")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      queryMode === "RAW"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Raw Records
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueryMode("AGGREGATE")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      queryMode === "AGGREGATE"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Group & Aggregate
                  </button>
                </div>
              </div>

              {/* Mode Specific Controls */}
              {queryMode === "RAW" ? (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-700">
                      Select Columns ({selectedColumns.length}/{dataset.columns.length})
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedColumns(dataset.columns.map((c) => c.name))}
                        className="text-[11px] text-indigo-600 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedColumns([])}
                        className="text-[11px] text-gray-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dataset.columns.map((col) => {
                      const isSelected = selectedColumns.includes(col.name);
                      return (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => toggleColumnSelection(col.name)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {isSelected ? "✓ " : "+ "}
                          {col.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-6 space-y-4">
                  {/* Dimensions */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-2">
                      Group By (Dimensions)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {dataset.columns.map((col) => {
                        const isSelected = selectedDimensions.includes(col.name);
                        return (
                          <button
                            key={col.name}
                            type="button"
                            onClick={() => toggleDimensionSelection(col.name)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                              isSelected
                                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {isSelected ? "✓ " : "+ "}
                            {col.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Measures */}
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <label className="text-xs font-semibold text-gray-700 block mb-2">
                      Measures ({measures.length})
                    </label>
                    {measures.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {measures.map((m, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-800"
                          >
                            <span className="font-bold text-indigo-600">{m.aggregation}</span>(
                            {m.column}) as {m.alias || `${m.aggregation.toLowerCase()}_${m.column}`}
                            <button
                              type="button"
                              onClick={() => handleRemoveMeasure(idx)}
                              className="text-red-500 hover:text-red-700 ml-1 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Add Measure Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={newMeasureAgg}
                        onChange={(e) => setNewMeasureAgg(e.target.value as AggregationFunction)}
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
                      >
                        {AGGREGATION_OPTIONS.map((agg) => (
                          <option key={agg} value={agg}>
                            {agg}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newMeasureCol}
                        onChange={(e) => setNewMeasureCol(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
                      >
                        {newMeasureAgg === "COUNT" && <option value="*">* (All rows)</option>}
                        {dataset.columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newMeasureAlias}
                        onChange={(e) => setNewMeasureAlias(e.target.value)}
                        placeholder="Alias (optional)"
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 w-36"
                      />
                      <button
                        type="button"
                        onClick={handleAddMeasure}
                        className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-300"
                      >
                        + Add Metric
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters Section */}
              <div className="border-t border-gray-100 pt-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-gray-700">Filters</label>
                    <div className="flex rounded-md border border-gray-200 overflow-hidden text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setFilterLogic("AND")}
                        className={`px-2 py-0.5 ${
                          filterLogic === "AND"
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        AND
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterLogic("OR")}
                        className={`px-2 py-0.5 ${
                          filterLogic === "OR"
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        OR
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFilter}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    + Add Filter
                  </button>
                </div>

                {filters.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No filters added. All rows will be processed.</p>
                ) : (
                  <div className="space-y-2">
                    {filters.map((filter, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-lg">
                        <select
                          value={filter.column}
                          onChange={(e) => handleFilterChange(idx, { column: e.target.value })}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                        >
                          {dataset.columns.map((col) => (
                            <option key={col.name} value={col.name}>
                              {col.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(e) =>
                            handleFilterChange(idx, { operator: e.target.value as FilterOperator })
                          }
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                        >
                          {FILTER_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        {filter.operator !== "isNull" && filter.operator !== "isNotNull" && (
                          <input
                            type="text"
                            value={String(filter.value ?? "")}
                            onChange={(e) => handleFilterChange(idx, { value: e.target.value })}
                            placeholder="Value..."
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 w-44"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFilter(idx)}
                          className="text-red-500 hover:text-red-700 text-base font-bold ml-auto px-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sorting & Limits Row */}
              <div className="border-t border-gray-100 pt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-700">
                    <span className="font-semibold">Order by:</span>
                    <select
                      value={sortColumn}
                      onChange={(e) => setSortColumn(e.target.value)}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                    >
                      <option value="">(None)</option>
                      {queryMode === "AGGREGATE" ? (
                        <>
                          {selectedDimensions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                          {measures.map((m) => {
                            const alias = m.alias || `${m.aggregation.toLowerCase()}_${m.column}`;
                            return (
                              <option key={alias} value={alias}>
                                {alias}
                              </option>
                            );
                          })}
                        </>
                      ) : (
                        dataset.columns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))
                      )}
                    </select>
                    <select
                      value={sortDirection}
                      onChange={(e) => setSortDirection(e.target.value as "ASC" | "DESC")}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                    >
                      <option value="ASC">ASC</option>
                      <option value="DESC">DESC</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-700">
                    <span className="font-semibold">Limit:</span>
                    <select
                      value={queryLimit}
                      onChange={(e) => setQueryLimit(Number(e.target.value))}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                    >
                      <option value={25}>25 rows</option>
                      <option value={50}>50 rows</option>
                      <option value={100}>100 rows</option>
                      <option value={250}>250 rows</option>
                      <option value={500}>500 rows</option>
                      <option value={1000}>1000 rows</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteQuery}
                  disabled={queryRunning}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {queryRunning ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
                      Executing...
                    </>
                  ) : (
                    <>⚡ Execute Query</>
                  )}
                </button>
              </div>
            </div>

            {/* Query Error */}
            {queryError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
                ❌ Query Error: {queryError}
              </div>
            )}

            {/* Query Results */}
            {queryResult && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-900">Query Results</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                      ⚡ {queryResult.executionTimeMs} ms
                    </span>
                    <span className="text-xs text-gray-500">
                      {queryResult.rowCount} rows · {queryResult.columns.length} columns
                    </span>
                  </div>
                </div>

                {queryResult.rows.length === 0 ? (
                  <div className="p-12 text-center text-sm text-gray-500">
                    No rows match the query criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          {queryResult.columns.map((col) => (
                            <th
                              key={col.name}
                              className="px-4 py-2.5 text-left font-semibold text-gray-800 uppercase whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{col.name}</span>
                                <span className="font-normal text-[10px] text-gray-500">
                                  ({col.type})
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white font-mono">
                        {queryResult.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {queryResult.columns.map((col) => (
                              <td
                                key={col.name}
                                className="px-4 py-2 text-gray-700 whitespace-nowrap"
                              >
                                {row[col.name] !== undefined && row[col.name] !== null
                                  ? String(row[col.name])
                                  : "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Calculated Fields */}
        {activeTab === "CALCULATED" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Calculated Fields (Formula Columns)</h3>
                <p className="text-xs text-gray-500">
                  Combine or transform existing columns using mathematical and string expressions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCalcName("");
                  setCalcExpression("");
                  setCalcPreviewResult(null);
                  setCalcModalError(null);
                  setIsCalcModalOpen(true);
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
              >
                + Add Calculated Field
              </button>
            </div>

            {(!dataset.calculatedFields || dataset.calculatedFields.length === 0) &&
            dataset.columns.filter((c) => c.isCalculated).length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center bg-gray-50">
                <span className="text-2xl mb-2 block">⚡</span>
                <p className="text-xs font-semibold text-gray-700">No calculated fields defined yet</p>
                <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                  Create formulas like <code className="bg-gray-200 px-1 rounded">revenue - cost</code> or <code className="bg-gray-200 px-1 rounded">UPPER(region)</code> to compute custom values across rows.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCalcModalOpen(true)}
                  className="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                >
                  Create First Calculated Field
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">Field Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">Expression</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">Data Type</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {(dataset.calculatedFields || []).map((cf) => (
                      <tr key={cf.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900 flex items-center gap-1.5">
                          <span className="inline-block rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-bold text-indigo-700">fx</span>
                          {cf.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700 bg-gray-50 rounded">
                          {cf.expression}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                            {cf.dataType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Delete calculated field "${cf.name}"?`)) return;
                              try {
                                const res = await apiDeleteCalculatedField(dataset.id, cf.id);
                                setDataset(res.dataset);
                                setSuccessMsg(`Calculated field "${cf.name}" deleted.`);
                              } catch (err: any) {
                                setErrorMsg(err.message || "Failed to delete calculated field");
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Create Calculated Field */}
        {isCalcModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700 font-bold text-xs">fx</span>
                  <h2 className="text-base font-bold text-gray-900">Create Calculated Field</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCalcModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {calcModalError && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {calcModalError}
                </div>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Field Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={calcName}
                    onChange={(e) => setCalcName(e.target.value)}
                    placeholder="e.g. profit, revenue_per_unit"
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Formula Expression <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={calcExpression}
                    onChange={(e) => setCalcExpression(e.target.value)}
                    placeholder="e.g. revenue - cost, revenue / quantity * 100, UPPER(region)"
                    className="w-full font-mono rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 bg-gray-50 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Helper chips: Columns */}
                <div>
                  <span className="block text-[11px] font-semibold text-gray-500 mb-1">Available Columns (Click to insert):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {dataset.columns.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setCalcExpression((prev) => (prev ? `${prev} ${c.name}` : c.name))}
                        className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100 font-mono"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Helper chips: Functions & Operators */}
                <div>
                  <span className="block text-[11px] font-semibold text-gray-500 mb-1">Functions & Operators:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["+", "-", "*", "/", "%", "ROUND()", "ABS()", "UPPER()", "LOWER()", "TRIM()"].map((fn) => (
                      <button
                        key={fn}
                        type="button"
                        onClick={() => {
                          if (fn.endsWith("()")) {
                            const nameOnly = fn.slice(0, -2);
                            setCalcExpression((prev) => (prev ? `${nameOnly}(${prev})` : `${nameOnly}()`));
                          } else {
                            setCalcExpression((prev) => (prev ? `${prev} ${fn} ` : `${fn} `));
                          }
                        }}
                        className="rounded border border-indigo-100 bg-indigo-50/50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100 font-mono font-medium"
                      >
                        {fn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={previewingCalc || !calcName.trim() || !calcExpression.trim()}
                    onClick={async () => {
                      setPreviewingCalc(true);
                      setCalcModalError(null);
                      try {
                        const res = await apiPreviewCalculatedField(dataset.id, {
                          name: calcName.trim(),
                          expression: calcExpression.trim(),
                          limit: 5,
                        });
                        setCalcPreviewResult(res);
                      } catch (err: any) {
                        setCalcModalError(err.message || "Failed to evaluate expression");
                        setCalcPreviewResult(null);
                      } finally {
                        setPreviewingCalc(false);
                      }
                    }}
                    className="w-full rounded-lg border border-indigo-600 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer disabled:opacity-50"
                  >
                    {previewingCalc ? "Evaluating..." : "👁️ Preview Formula Output"}
                  </button>
                </div>

                {/* Preview Result Box */}
                {calcPreviewResult && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">
                        Inferred Type: <span className="text-indigo-600 font-bold">{calcPreviewResult.dataType}</span>
                      </span>
                      <span className="text-gray-500">
                        Referenced: {calcPreviewResult.referencedColumns.join(", ") || "None"}
                      </span>
                    </div>

                    <div className="max-h-40 overflow-x-auto rounded border border-gray-200 bg-white">
                      <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                        <thead className="bg-gray-100">
                          <tr>
                            {calcPreviewResult.referencedColumns.map((col) => (
                              <th key={col} className="px-2.5 py-1.5 text-left font-semibold text-gray-600">
                                {col}
                              </th>
                            ))}
                            <th className="px-2.5 py-1.5 text-left font-bold text-indigo-700 bg-indigo-50">
                              ⚡ {calcPreviewResult.name}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono">
                          {calcPreviewResult.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              {calcPreviewResult.referencedColumns.map((col) => (
                                <td key={col} className="px-2.5 py-1 text-gray-600 whitespace-nowrap">
                                  {row[col] !== undefined && row[col] !== null ? String(row[col]) : "-"}
                                </td>
                              ))}
                              <td className="px-2.5 py-1 font-bold text-indigo-800 bg-indigo-50/50 whitespace-nowrap">
                                {row[calcPreviewResult.name] !== undefined && row[calcPreviewResult.name] !== null
                                  ? String(row[calcPreviewResult.name])
                                  : "null"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCalcModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingCalc || !calcName.trim() || !calcExpression.trim()}
                  onClick={async () => {
                    setSavingCalc(true);
                    setCalcModalError(null);
                    try {
                      const res = await apiCreateCalculatedField(dataset.id, {
                        name: calcName.trim(),
                        expression: calcExpression.trim(),
                      });
                      setDataset(res.dataset);
                      setIsCalcModalOpen(false);
                      setSuccessMsg(`Calculated field "${res.field.name}" created successfully!`);
                    } catch (err: any) {
                      setCalcModalError(err.message || "Failed to create calculated field");
                    } finally {
                      setSavingCalc(false);
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {savingCalc ? "Saving..." : "Save Calculated Field"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
