"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import { BrandLogo } from "@/components/shell/BrandLogo";
import {
  apiGetDataset,
  apiPreviewDataset,
  apiUpdateDataset,
  apiQueryDataset,
  apiPreviewCalculatedField,
  apiCreateCalculatedField,
  apiDeleteCalculatedField,
  apiPreviewTransformations,
  apiApplyTransformations,
  apiListDatasetVersions,
  apiRestoreDatasetVersion,
  apiGetDatasetLineage,
  type DatasetData,
  type DatasetQueryFilter,
  type DatasetQueryMeasure,
  type DatasetQueryResult,
  type FilterOperator,
  type AggregationFunction,
  type CalculatedFieldConfig,
  type PreviewCalculatedFieldResult,
  type TransformationStep,
  type TransformationPreviewResponse,
  type DatasetVersionItem,
  type DatasetLineageResponse,
  ApiError,
} from "../../../lib/api";
import {
  getRecommendedVisualizations,
  classifyColumn,
} from "../../../lib/chart-recommender";

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
  const [activeTab, setActiveTab] = useState<
    "SCHEMA" | "PREVIEW" | "EXPLORE" | "CALCULATED" | "TRANSFORM" | "VERSIONS_LINEAGE" | "VISUALIZATIONS"
  >("SCHEMA");
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Transformation Pipeline State (Feature 13)
  const [transformSteps, setTransformSteps] = useState<TransformationStep[]>([]);
  const [newStepType, setNewStepType] = useState<TransformationStep["type"]>("FILTER_ROWS");
  const [stepColumn, setStepColumn] = useState<string>("");
  const [stepOperator, setStepOperator] = useState<"EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN" | "CONTAINS" | "IS_NULL" | "IS_NOT_NULL">("EQUALS");
  const [stepValue, setStepValue] = useState<string>("");
  const [stepNewName, setStepNewName] = useState<string>("");
  const [stepTargetType, setStepTargetType] = useState<"STRING" | "NUMBER" | "BOOLEAN" | "DATE">("STRING");
  const [stepMissingStrategy, setStepMissingStrategy] = useState<"DROP_ROW" | "FILL_ZERO" | "FILL_MEAN" | "FILL_VALUE">("DROP_ROW");
  const [stepFillValue, setStepFillValue] = useState<string>("");
  const [stepCaseMode, setStepCaseMode] = useState<"UPPER" | "LOWER">("UPPER");
  const [stepDerivedName, setStepDerivedName] = useState<string>("");
  const [stepDerivedExpr, setStepDerivedExpr] = useState<string>("");

  const [previewingTransform, setPreviewingTransform] = useState(false);
  const [transformPreviewResult, setTransformPreviewResult] = useState<TransformationPreviewResponse | null>(null);
  const [applyingTransform, setApplyingTransform] = useState(false);
  const [transformMode, setTransformMode] = useState<"CREATE_NEW" | "SAVE_VERSION">("CREATE_NEW");
  const [newCleanedDatasetName, setNewCleanedDatasetName] = useState<string>("");
  const [transformChangeSummary, setTransformChangeSummary] = useState<string>("");
  const [transformError, setTransformError] = useState<string | null>(null);

  // Versioning & Lineage State (Feature 14)
  const [versions, setVersions] = useState<DatasetVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [lineage, setLineage] = useState<DatasetLineageResponse | null>(null);
  const [loadingLineage, setLoadingLineage] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);

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

  const loadVersionsAndLineage = useCallback((datasetId: string) => {
    setLoadingVersions(true);
    setLoadingLineage(true);
    apiListDatasetVersions(datasetId)
      .then((data) => setVersions(data))
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false));

    apiGetDatasetLineage(datasetId)
      .then((data) => setLineage(data))
      .catch(() => setLineage(null))
      .finally(() => setLoadingLineage(false));
  }, []);

  const handleAddTransformStep = () => {
    if (!stepColumn && newStepType !== "REMOVE_DUPLICATES" && newStepType !== "DERIVED_COLUMN") {
      setTransformError("Please select a target column");
      return;
    }
    setTransformError(null);

    let newStep: TransformationStep;
    switch (newStepType) {
      case "FILTER_ROWS":
        newStep = {
          type: "FILTER_ROWS",
          column: stepColumn,
          operator: stepOperator,
          value: stepOperator === "IS_NULL" || stepOperator === "IS_NOT_NULL" ? undefined : stepValue,
        };
        break;
      case "RENAME_COLUMN":
        if (!stepNewName.trim()) {
          setTransformError("New column name is required");
          return;
        }
        newStep = {
          type: "RENAME_COLUMN",
          oldName: stepColumn,
          newName: stepNewName.trim(),
        };
        break;
      case "TYPE_CONVERSION":
        newStep = {
          type: "TYPE_CONVERSION",
          column: stepColumn,
          targetType: stepTargetType,
        };
        break;
      case "HANDLE_MISSING":
        newStep = {
          type: "HANDLE_MISSING",
          column: stepColumn,
          strategy: stepMissingStrategy,
          fillValue: stepMissingStrategy === "FILL_VALUE" ? stepFillValue : undefined,
        };
        break;
      case "REMOVE_DUPLICATES":
        newStep = {
          type: "REMOVE_DUPLICATES",
          columns: stepColumn ? [stepColumn] : undefined,
        };
        break;
      case "DERIVED_COLUMN":
        if (!stepDerivedName.trim() || !stepDerivedExpr.trim()) {
          setTransformError("Column name and formula expression are required");
          return;
        }
        newStep = {
          type: "DERIVED_COLUMN",
          name: stepDerivedName.trim(),
          expression: stepDerivedExpr.trim(),
        };
        break;
      case "DROP_COLUMN":
        newStep = {
          type: "DROP_COLUMN",
          column: stepColumn,
        };
        break;
      case "TRIM_WHITESPACE":
        newStep = {
          type: "TRIM_WHITESPACE",
          column: stepColumn,
        };
        break;
      case "CASE_CONVERT":
        newStep = {
          type: "CASE_CONVERT",
          column: stepColumn,
          mode: stepCaseMode,
        };
        break;
      default:
        return;
    }

    setTransformSteps((prev) => [...prev, newStep]);
    setTransformPreviewResult(null);
    setStepValue("");
    setStepNewName("");
    setStepFillValue("");
    setStepDerivedName("");
    setStepDerivedExpr("");
  };

  const handlePreviewTransform = async () => {
    if (!dataset || transformSteps.length === 0) return;
    setPreviewingTransform(true);
    setTransformError(null);
    try {
      const res = await apiPreviewTransformations(dataset.id, transformSteps);
      setTransformPreviewResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to preview transformations";
      setTransformError(msg);
      setTransformPreviewResult(null);
    } finally {
      setPreviewingTransform(false);
    }
  };

  const handleApplyTransform = async () => {
    if (!dataset || transformSteps.length === 0) return;
    setApplyingTransform(true);
    setTransformError(null);
    try {
      const res = await apiApplyTransformations(dataset.id, {
        steps: transformSteps,
        mode: transformMode,
        newDatasetName: transformMode === "CREATE_NEW" ? newCleanedDatasetName.trim() || `${dataset.name} (Cleaned)` : undefined,
        changeSummary: transformChangeSummary.trim() || `Transformation pipeline with ${transformSteps.length} steps`,
      });

      if (transformMode === "CREATE_NEW" && (res.dataset as Record<string, unknown>)?.id) {
        setSuccessMsg(`Derived dataset "${(res.dataset as Record<string, unknown>).name}" created successfully!`);
        router.push(`/datasets/${(res.dataset as Record<string, unknown>).id}`);
      } else {
        setSuccessMsg(`Dataset updated and version saved successfully!`);
        const updated = await apiGetDataset(dataset.id);
        setDataset(updated);
        setTransformSteps([]);
        setTransformPreviewResult(null);
        setActiveTab("SCHEMA");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply transformations";
      setTransformError(msg);
    } finally {
      setApplyingTransform(false);
    }
  };

  const handleRestoreVersion = async (versionNum: number) => {
    if (!dataset) return;
    if (!confirm(`Restore dataset to version ${versionNum}? This will safely roll back columns and create a new version.`)) {
      return;
    }
    setRestoringVersion(versionNum);
    try {
      await apiRestoreDatasetVersion(dataset.id, versionNum);
      setSuccessMsg(`Dataset rolled back to version ${versionNum} successfully!`);
      const updated = await apiGetDataset(dataset.id);
      setDataset(updated);
      loadVersionsAndLineage(dataset.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to restore version";
      setErrorMsg(msg);
    } finally {
      setRestoringVersion(null);
    }
  };

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
              <BrandLogo size={32} />
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
              <div className="flex items-center gap-2">
                <Link
                  href={`/data-quality?datasetId=${dataset.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 transition"
                >
                  <span>🛡️ Data Quality Profile</span>
                </Link>
                <Link
                  href={`/visualizations?datasetId=${dataset.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
                >
                  <span>📊 Create Visualization</span>
                </Link>
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  ✏️ Edit Metadata
                </button>
              </div>
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
        <div className="flex border-b border-gray-200 mb-6 gap-2 overflow-x-auto">
          <Link
            href={`/data-quality?datasetId=${dataset.id}`}
            className="pb-3 px-4 text-xs font-bold transition border-b-2 border-transparent text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>🛡️ Quality & Profiling</span>
          </Link>
          <button
            onClick={() => setActiveTab("SCHEMA")}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 whitespace-nowrap ${
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
          <button
            onClick={() => setActiveTab("TRANSFORM")}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "TRANSFORM"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>🧹 Transformations</span>
            {transformSteps.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                {transformSteps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("VERSIONS_LINEAGE");
              if (dataset) loadVersionsAndLineage(dataset.id);
            }}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "VERSIONS_LINEAGE"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>📜 Versioning & Lineage</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
              v{dataset.currentVersion || 1}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("VISUALIZATIONS")}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "VISUALIZATIONS"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>📊 Visualizations & Recommendations</span>
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
              {getRecommendedVisualizations(dataset.columns).length}
            </span>
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
                    Role / Classification
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
                      {(() => {
                        const cls = classifyColumn(col);
                        if (cls === "numeric") {
                          return (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                              🔢 Numeric Measure
                            </span>
                          );
                        }
                        if (cls === "date") {
                          return (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              📅 Date / Temporal
                            </span>
                          );
                        }
                        if (cls === "boolean") {
                          return (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                              ⚑ Boolean Flag
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            🏷️ Dimension
                          </span>
                        );
                      })()}
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

        {/* Tab: Data Transformation Pipeline (Feature 13) */}
        {activeTab === "TRANSFORM" && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 mb-2">
                    🧹 Data Cleaning & Transformation Pipeline
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Clean, Transform & Derive {dataset.name}
                  </h2>
                  <p className="mt-1 text-xs text-gray-600 max-w-2xl leading-relaxed">
                    Build multi-step pipelines to filter outliers, rename columns, convert data types, handle missing values, and generate computed columns. Preview results safely in-memory before applying.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 shadow-2xs">
                    Pipeline Steps: <strong>{transformSteps.length}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="mt-4 pt-3 border-t border-indigo-100/60 flex flex-wrap items-center gap-2">
                <span className="text-2xs font-semibold uppercase tracking-wider text-gray-500">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    const firstNum = dataset.columns.find((c) => c.type === "number" || c.type === "integer");
                    if (firstNum) {
                      setTransformSteps((prev) => [
                        ...prev,
                        { type: "FILL_MISSING", column: firstNum.name, strategy: "DROP_ROW" },
                      ]);
                      setTransformPreviewResult(null);
                    }
                  }}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-2xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  + Drop Missing Rows
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransformSteps((prev) => [
                      ...prev,
                      { type: "REMOVE_DUPLICATES" },
                    ]);
                    setTransformPreviewResult(null);
                  }}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-2xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  + Deduplicate All Records
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstText = dataset.columns.find((c) => c.type === "string" || c.type === "text");
                    if (firstText) {
                      setTransformSteps((prev) => [
                        ...prev,
                        { type: "TRIM_WHITESPACE", column: firstText.name },
                      ]);
                      setTransformPreviewResult(null);
                    }
                  }}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-2xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  + Trim Text Columns
                </button>
              </div>
            </div>

            {transformError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
                <strong>Error:</strong> {transformError}
              </div>
            )}

            {/* Step Builder Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Step Builder Form */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    Add Transformation Step
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">Step #{transformSteps.length + 1}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Transformation Type
                  </label>
                  <select
                    value={newStepType}
                    onChange={(e) => {
                      setNewStepType(e.target.value as TransformationStep["type"]);
                      setTransformError(null);
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  >
                    <option value="FILTER_ROWS">Filter Rows (By Condition)</option>
                    <option value="RENAME_COLUMN">Rename Column</option>
                    <option value="TYPE_CONVERSION">Convert Column Type</option>
                    <option value="HANDLE_MISSING">Handle Missing / Null Values</option>
                    <option value="REMOVE_DUPLICATES">Remove Duplicate Rows</option>
                    <option value="DERIVED_COLUMN">Derived Computed Column</option>
                    <option value="DROP_COLUMN">Drop / Remove Column</option>
                    <option value="TRIM_WHITESPACE">Trim String Whitespace</option>
                    <option value="CASE_CONVERT">Change Text Casing (UPPER/LOWER)</option>
                  </select>
                </div>

                {/* Target Column Selector (unless Derived or Deduplicate All) */}
                {newStepType !== "DERIVED_COLUMN" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {newStepType === "REMOVE_DUPLICATES" ? "Key Column (Optional)" : "Target Column"}
                    </label>
                    <select
                      value={stepColumn}
                      onChange={(e) => setStepColumn(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                    >
                      <option value="">{newStepType === "REMOVE_DUPLICATES" ? "-- All Columns --" : "-- Select Column --"}</option>
                      {dataset.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Dynamic Configuration based on Step Type */}
                {newStepType === "FILTER_ROWS" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Filter Operator</label>
                      <select
                        value={stepOperator}
                        onChange={(e) => setStepOperator(e.target.value as any)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                      >
                        <option value="EQUALS">Equals (=)</option>
                        <option value="NOT_EQUALS">Not Equals (!=)</option>
                        <option value="GREATER_THAN">Greater Than (&gt;)</option>
                        <option value="LESS_THAN">Less Than (&lt;)</option>
                        <option value="CONTAINS">Contains (text search)</option>
                        <option value="IS_NULL">Is Null / Empty</option>
                        <option value="IS_NOT_NULL">Is Not Null / Present</option>
                      </select>
                    </div>

                    {stepOperator !== "IS_NULL" && stepOperator !== "IS_NOT_NULL" && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Comparison Value</label>
                        <input
                          type="text"
                          value={stepValue}
                          onChange={(e) => setStepValue(e.target.value)}
                          placeholder="e.g. 100, active, East"
                          className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                  </>
                )}

                {newStepType === "RENAME_COLUMN" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">New Column Name</label>
                    <input
                      type="text"
                      value={stepNewName}
                      onChange={(e) => setStepNewName(e.target.value)}
                      placeholder="e.g. customer_region"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none font-mono"
                    />
                  </div>
                )}

                {newStepType === "TYPE_CONVERSION" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Target Data Type</label>
                    <select
                      value={stepTargetType}
                      onChange={(e) => setStepTargetType(e.target.value as any)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                    >
                      <option value="STRING">STRING (Text)</option>
                      <option value="NUMBER">NUMBER (Decimal / Integer)</option>
                      <option value="BOOLEAN">BOOLEAN (True / False)</option>
                      <option value="DATE">DATE (Timestamp / ISO)</option>
                    </select>
                  </div>
                )}

                {newStepType === "HANDLE_MISSING" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Missing Value Strategy</label>
                      <select
                        value={stepMissingStrategy}
                        onChange={(e) => setStepMissingStrategy(e.target.value as any)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                      >
                        <option value="DROP_ROW">Drop rows with missing values</option>
                        <option value="FILL_ZERO">Fill with 0 (numeric zero)</option>
                        <option value="FILL_MEAN">Fill with column average / mean</option>
                        <option value="FILL_VALUE">Fill with custom literal value</option>
                      </select>
                    </div>

                    {stepMissingStrategy === "FILL_VALUE" && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Fill Literal</label>
                        <input
                          type="text"
                          value={stepFillValue}
                          onChange={(e) => setStepFillValue(e.target.value)}
                          placeholder="e.g. N/A or Unknown"
                          className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                  </>
                )}

                {newStepType === "CASE_CONVERT" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Casing Mode</label>
                    <select
                      value={stepCaseMode}
                      onChange={(e) => setStepCaseMode(e.target.value as any)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                    >
                      <option value="UPPER">UPPERCASE (ALL CAPS)</option>
                      <option value="LOWER">lowercase (all small)</option>
                    </select>
                  </div>
                )}

                {newStepType === "DERIVED_COLUMN" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">New Column Name</label>
                      <input
                        type="text"
                        value={stepDerivedName}
                        onChange={(e) => setStepDerivedName(e.target.value)}
                        placeholder="e.g. net_margin"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Formula Expression</label>
                      <input
                        type="text"
                        value={stepDerivedExpr}
                        onChange={(e) => setStepDerivedExpr(e.target.value)}
                        placeholder="e.g. revenue - cost or UPPER(city)"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none font-mono"
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleAddTransformStep}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 transition"
                >
                  + Add Step to Pipeline
                </button>
              </div>

              {/* Right 2 Columns: Pipeline Sequence & Execution */}
              <div className="lg:col-span-2 space-y-5">
                {/* Current Pipeline Card */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                        Pipeline Sequence ({transformSteps.length} steps)
                      </h3>
                      <p className="text-2xs text-gray-500">Steps will execute sequentially top-to-bottom</p>
                    </div>
                    {transformSteps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransformSteps([]);
                          setTransformPreviewResult(null);
                        }}
                        className="text-2xs font-semibold text-red-600 hover:underline"
                      >
                        Clear Pipeline
                      </button>
                    )}
                  </div>

                  {transformSteps.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center bg-gray-50/50">
                      <span className="text-2xl mb-1.5 block">🧹</span>
                      <p className="text-xs font-semibold text-gray-700">Pipeline is currently empty</p>
                      <p className="text-2xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Add one or more transformation steps on the left or select a quick preset above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transformSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-xs hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-semibold text-gray-900 block">
                                {step.type.replace(/_/g, " ")}
                              </span>
                              <span className="text-2xs text-gray-500 font-mono">
                                {"column" in step && `col: ${step.column} `}
                                {"operator" in step && `[${step.operator} ${step.value ?? ""}]`}
                                {"newName" in step && `→ ${step.newName}`}
                                {"targetType" in step && `→ ${step.targetType}`}
                                {"strategy" in step && `[${step.strategy}]`}
                                {"mode" in step && `[${step.mode}]`}
                                {"name" in step && `${step.name} = ${step.expression}`}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTransformSteps((prev) => prev.filter((_, i) => i !== idx));
                              setTransformPreviewResult(null);
                            }}
                            className="text-gray-400 hover:text-red-600 p-1 rounded"
                            title="Remove step"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview Trigger */}
                  {transformSteps.length > 0 && (
                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handlePreviewTransform}
                        disabled={previewingTransform}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                      >
                        {previewingTransform ? "Processing Sample..." : "👁️ Preview Transformed Output"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Transformed Preview Results Box */}
                {transformPreviewResult && (
                  <div className="rounded-xl border border-indigo-100 bg-white p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                          Sample Preview & Statistics
                        </h4>
                        <p className="text-2xs text-gray-500">Previewed on real sample rows</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                          Rows: {transformPreviewResult.originalRowCount} → {transformPreviewResult.transformedRowCount}
                        </span>
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-blue-700 border border-blue-200">
                          Cols: {transformPreviewResult.transformedColumns?.length || 0}
                        </span>
                      </div>
                    </div>

                    {/* Preview Table */}
                    <div className="max-h-64 overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-2xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {(transformPreviewResult.transformedColumns || []).map((col) => (
                              <th
                                key={col.name}
                                className="px-3 py-2 text-left font-semibold text-gray-700 uppercase whitespace-nowrap"
                              >
                                {col.name} <span className="text-gray-400 font-normal">({col.type})</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white font-mono">
                          {((transformPreviewResult.sampleRows || transformPreviewResult.previewRows || []) as Record<string, unknown>[]).slice(0, 8).map((row: Record<string, unknown>, rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-gray-50">
                              {(transformPreviewResult.transformedColumns || []).map((col) => (
                                <td key={col.name} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
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

                    {/* Apply Pipeline Action Box */}
                    <div className="pt-4 border-t border-gray-100 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-800 block">Apply Action</label>
                          <div className="flex items-center gap-4 text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="transformMode"
                                checked={transformMode === "CREATE_NEW"}
                                onChange={() => setTransformMode("CREATE_NEW")}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-medium text-gray-700">Create New Cleaned Dataset</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="transformMode"
                                checked={transformMode === "SAVE_VERSION"}
                                onChange={() => setTransformMode("SAVE_VERSION")}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-medium text-gray-700">Save as New Version (v{(dataset.currentVersion || 1) + 1})</span>
                            </label>
                          </div>
                        </div>

                        {transformMode === "CREATE_NEW" && (
                          <div className="flex-1 max-w-xs">
                            <input
                              type="text"
                              value={newCleanedDatasetName}
                              onChange={(e) => setNewCleanedDatasetName(e.target.value)}
                              placeholder={`${dataset.name} (Cleaned)`}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          value={transformChangeSummary}
                          onChange={(e) => setTransformChangeSummary(e.target.value)}
                          placeholder="Change summary / log description (e.g. Removed duplicates and cleaned null values)"
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleApplyTransform}
                          disabled={applyingTransform}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition disabled:opacity-50"
                        >
                          {applyingTransform ? "Executing Pipeline..." : "🚀 Apply Transformations"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Dataset Versioning & Lineage (Feature 14) */}
        {activeTab === "VERSIONS_LINEAGE" && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800 mb-2">
                    📜 Versioning & Data Lineage
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Lineage Graph & Immutable Version History
                  </h2>
                  <p className="mt-1 text-xs text-gray-600 max-w-2xl leading-relaxed">
                    Track the full provenance of your data from original ingestion to downstream visualizations. Roll back safely to any prior snapshot without losing historical records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dataset && loadVersionsAndLineage(dataset.id)}
                  className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs"
                >
                  🔄 Refresh Lineage
                </button>
              </div>
            </div>

            {/* SECTION 1: END-TO-END DATA LINEAGE GRAPH */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    End-to-End Data Lineage Graph
                  </h3>
                  <p className="text-2xs text-gray-500">Upstream sources, active dataset, and downstream dependencies</p>
                </div>
              </div>

              {loadingLineage ? (
                <div className="py-12 text-center text-xs text-gray-500">Loading lineage provenance...</div>
              ) : (
                <div className="flex flex-col lg:flex-row items-stretch gap-4 py-2">
                  {/* Upstream Card */}
                  <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-gray-400 block">1. Upstream Origin</span>
                    {lineage?.parent ? (
                      <div className="space-y-1">
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-2xs font-bold text-indigo-700 border border-indigo-200">
                          Derived From Dataset
                        </span>
                        <h4 className="text-xs font-bold text-gray-900">{lineage.parent.name}</h4>
                        <Link
                          href={`/datasets/${lineage.parent.id}`}
                          className="text-2xs text-indigo-600 hover:underline font-medium inline-block"
                        >
                          View Parent Dataset →
                        </Link>
                      </div>
                    ) : dataset.dataSource ? (
                      <div className="space-y-1">
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-2xs font-bold text-emerald-700 border border-emerald-200">
                          Connected Data Source
                        </span>
                        <h4 className="text-xs font-bold text-gray-900">{dataset.dataSource.name}</h4>
                        <p className="text-2xs text-gray-500">{dataset.dataSource.type}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-bold text-slate-700 border border-slate-200">
                          File Upload / Demo
                        </span>
                        <h4 className="text-xs font-bold text-gray-900">{dataset.fileName || dataset.name}</h4>
                        <p className="text-2xs text-gray-500">{(dataset.type as string) === "CSV" ? "CSV Ingestion" : "Raw Data"}</p>
                      </div>
                    )}
                  </div>

                  {/* Flow Arrow */}
                  <div className="hidden lg:flex items-center text-gray-300 font-bold text-xl">→</div>

                  {/* Current Active Dataset Card */}
                  <div className="flex-1 rounded-xl border-2 border-indigo-500 bg-indigo-50/40 p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold uppercase tracking-wider text-indigo-600 block">2. Current Dataset</span>
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-2xs font-bold text-white">
                        v{dataset.currentVersion || 1} Active
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-900">{dataset.name}</h4>
                    <div className="text-2xs text-gray-600 space-y-0.5">
                      <p><strong>{dataset.rowCount}</strong> records · <strong>{dataset.columns.length}</strong> columns</p>
                      <p className="text-gray-400">ID: {dataset.id}</p>
                    </div>
                  </div>

                  {/* Flow Arrow */}
                  <div className="hidden lg:flex items-center text-gray-300 font-bold text-xl">→</div>

                  {/* Downstream Dependencies Card */}
                  <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                    <span className="text-2xs font-bold uppercase tracking-wider text-gray-400 block">3. Downstream Impact</span>

                    {/* Visualizations List */}
                    <div className="space-y-1">
                      <span className="text-2xs font-semibold text-gray-600 block">
                        Linked Visualizations ({lineage?.linkedVisualizations?.length || 0}):
                      </span>
                      {lineage?.linkedVisualizations && lineage.linkedVisualizations.length > 0 ? (
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {lineage.linkedVisualizations.map((v) => (
                            <Link
                              key={v.id}
                              href={`/visualizations?id=${v.id}`}
                              className="flex items-center justify-between p-1.5 rounded bg-white border border-gray-200 text-2xs hover:border-indigo-300 hover:text-indigo-600 transition"
                            >
                              <span className="font-medium truncate">{v.title}</span>
                              <span className="text-gray-400 uppercase text-[9px]">{v.type}</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-2xs text-gray-400 italic">No visualizations built on this dataset yet</p>
                      )}
                    </div>

                    {/* Derived Child Datasets */}
                    {lineage?.derivedDatasets && lineage.derivedDatasets.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-gray-200/60">
                        <span className="text-2xs font-semibold text-gray-600 block">
                          Derived Datasets ({lineage.derivedDatasets.length}):
                        </span>
                        <div className="space-y-1">
                          {lineage.derivedDatasets.map((d) => (
                            <Link
                              key={d.id}
                              href={`/datasets/${d.id}`}
                              className="flex items-center justify-between p-1.5 rounded bg-white border border-gray-200 text-2xs hover:border-indigo-300 hover:text-indigo-600 transition"
                            >
                              <span className="font-medium truncate">{d.name}</span>
                              <span className="text-gray-400 text-[9px]">v{d.currentVersion}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: IMMUTABLE VERSION HISTORY */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    Version History Timeline
                  </h3>
                  <p className="text-2xs text-gray-500">Historical snapshots and non-destructive rollbacks</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-2xs font-semibold text-slate-700">
                  Total Versions: {versions.length}
                </span>
              </div>

              {loadingVersions ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading version history...</div>
              ) : versions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center bg-gray-50/50">
                  <p className="text-xs font-semibold text-gray-700">Initial Version (v1)</p>
                  <p className="text-2xs text-gray-400 mt-1">
                    No transformation versions have been saved yet. Apply a transformation pipeline in the Transformations tab to create version checkpoints.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden text-xs">
                  {versions.map((ver) => {
                    const isCurrent = ver.versionNumber === (dataset.currentVersion || 1);
                    return (
                      <div
                        key={ver.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition ${
                          isCurrent ? "bg-indigo-50/20" : ""
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                                isCurrent
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              v{ver.versionNumber}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {ver.changeSummary || `Version ${ver.versionNumber}`}
                            </span>
                            {isCurrent && (
                              <span className="rounded bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                Current Active
                              </span>
                            )}
                          </div>
                          <p className="text-2xs text-gray-500">
                            Created on {new Date(ver.createdAt).toLocaleString()} · Snapshot: {ver.rowCount} rows, {ver.columnCount} columns
                          </p>
                          {ver.creator && (
                            <p className="text-2xs text-gray-400">By {ver.creator.name} ({ver.creator.email})</p>
                          )}
                        </div>

                        <div>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleRestoreVersion(ver.versionNumber)}
                              disabled={restoringVersion !== null}
                              className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition shadow-2xs disabled:opacity-50"
                            >
                              {restoringVersion === ver.versionNumber ? "Restoring..." : `↩ Restore v${ver.versionNumber}`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Visualizations & Recommendations */}
        {activeTab === "VISUALIZATIONS" && (
          <div className="space-y-6">
            {/* Recommendations Banner */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 mb-2">
                    ✨ Schema-Aware Multi-Chart Recommendations
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Explore {dataset.name} with Suitable Visualizations
                  </h2>
                  <p className="mt-1 text-xs text-gray-600 max-w-2xl leading-relaxed">
                    RicozViz automatically inspects column data types (dates, numerics, dimensions, and flags) to curate instant chart recipes using your real data. Click any card below to launch the Visualization Studio pre-configured for this dataset.
                  </p>
                </div>
                <Link
                  href={`/visualizations?datasetId=${dataset.id}`}
                  className="self-start md:self-auto inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition whitespace-nowrap"
                >
                  <span>Open Studio</span>
                  <span>→</span>
                </Link>
              </div>

              {/* Column Stats Pill Row */}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-white px-2.5 py-1 text-slate-700 border border-slate-200 font-medium">
                  Total Columns: <strong className="text-gray-900">{dataset.columns.length}</strong>
                </span>
                <span className="rounded-md bg-blue-50 px-2.5 py-1 text-blue-700 border border-blue-200 font-medium">
                  Numeric Measures: <strong className="text-blue-900">{dataset.columns.filter((c) => classifyColumn(c) === "numeric").length}</strong>
                </span>
                <span className="rounded-md bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-200 font-medium">
                  Date / Time: <strong className="text-amber-900">{dataset.columns.filter((c) => classifyColumn(c) === "date").length}</strong>
                </span>
                <span className="rounded-md bg-purple-50 px-2.5 py-1 text-purple-700 border border-purple-200 font-medium">
                  Dimensions: <strong className="text-purple-900">{dataset.columns.filter((c) => classifyColumn(c) === "categorical").length}</strong>
                </span>
              </div>
            </div>

            {/* Recommendations Grid */}
            {(() => {
              const recs = getRecommendedVisualizations(dataset.columns);
              if (recs.length === 0) {
                return (
                  <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-xs text-gray-500">
                    No automatic recommendations available. Ensure your dataset has at least one numeric or categorical column.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {recs.map((rec) => {
                    const studioUrl = `/visualizations?datasetId=${dataset.id}&chartType=${rec.chartType}&category=${encodeURIComponent(rec.categoryCol)}&value=${encodeURIComponent(rec.valueCol)}${rec.secondaryValueCol ? `&secondary=${encodeURIComponent(rec.secondaryValueCol)}` : ""}${rec.groupCol ? `&group=${encodeURIComponent(rec.groupCol)}` : ""}&agg=${rec.aggregation}`;

                    const badgeColor =
                      rec.badge === "Trend"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : rec.badge === "Distribution"
                          ? "bg-purple-100 text-purple-800 border-purple-200"
                          : rec.badge === "Correlation"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : rec.badge === "Matrix"
                              ? "bg-pink-100 text-pink-800 border-pink-200"
                              : rec.badge === "KPI"
                                ? "bg-cyan-100 text-cyan-800 border-cyan-200"
                                : "bg-blue-100 text-blue-800 border-blue-200";

                    return (
                      <div
                        key={rec.id}
                        className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                              {rec.badge}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {rec.suitabilityScore}% match
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition">
                            {rec.title}
                          </h3>
                          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                            {rec.description}
                          </p>

                          {/* Mapping Details */}
                          <div className="mt-4 rounded-lg bg-gray-50 p-3 space-y-1.5 text-[11px] font-mono text-gray-600 border border-gray-100">
                            {rec.categoryCol ? (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">Dimension / X:</span>
                                <span className="font-semibold text-gray-800">{rec.categoryCol}</span>
                              </div>
                            ) : null}
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Measure / Y:</span>
                              <span className="font-semibold text-indigo-700">
                                {rec.aggregation}({rec.valueCol})
                              </span>
                            </div>
                            {rec.secondaryValueCol && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">Secondary Series:</span>
                                <span className="font-semibold text-purple-700">{rec.secondaryValueCol}</span>
                              </div>
                            )}
                            {rec.groupCol && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">Matrix Dimension:</span>
                                <span className="font-semibold text-pink-700">{rec.groupCol}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            {rec.chartType}
                          </span>
                          <Link
                            href={studioUrl}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 group-hover:underline"
                          >
                            <span>Launch Chart</span>
                            <span>→</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
