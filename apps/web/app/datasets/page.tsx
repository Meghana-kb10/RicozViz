"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import {
  apiListDatasets,
  apiCreateDataset,
  apiUploadDataset,
  apiDeleteDataset,
  apiPreviewDataset,
  apiListDataSources,
  apiListSourceTables,
  apiGetSourceTableSchema,
  apiPreviewCsvSchema,
  apiPreviewDatasetBlend,
  apiCreateDatasetBlend,
  apiGetDatasetRefreshSchedule,
  apiSaveDatasetRefreshSchedule,
  apiDeleteDatasetRefreshSchedule,
  apiTriggerDatasetRefresh,
  type DatasetData,
  type DatasetColumn,
  type DataSourceData,
  type SourceTable,
  type DatasetBlendPreviewResult,
  type BlendJoinType,
  type DatasetRefreshSchedule,
  ApiError,
} from "../../lib/api";

export default function DatasetsPage() {
  const { auth, isLoading, logout, hasPermission } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick Preview modal
  const [previewingDataset, setPreviewingDataset] = useState<DatasetData | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<"FILE" | "DATASOURCE" | "CSV">("FILE");
  const [submitting, setSubmitting] = useState(false);

  // Form common fields
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // Mode: File Upload (CSV / JSON)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Mode: DataSource
  const [dataSources, setDataSources] = useState<DataSourceData[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [sourceTables, setSourceTables] = useState<SourceTable[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [discoveredCols, setDiscoveredCols] = useState<DatasetColumn[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  // Mode: CSV
  const [csvInput, setCsvInput] = useState("");
  const [csvInferredCols, setCsvInferredCols] = useState<DatasetColumn[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewingCsv, setPreviewingCsv] = useState(false);

  // Data Blending Modal state
  const [isBlendModalOpen, setIsBlendModalOpen] = useState(false);
  const [blendDatasetAId, setBlendDatasetAId] = useState("");
  const [blendDatasetBId, setBlendDatasetBId] = useState("");
  const [blendJoinColA, setBlendJoinColA] = useState("");
  const [blendJoinColB, setBlendJoinColB] = useState("");
  const [blendJoinType, setBlendJoinType] = useState<BlendJoinType>("INNER");
  const [blendName, setBlendName] = useState("");
  const [blendDescription, setBlendDescription] = useState("");
  const [blendPreviewResult, setBlendPreviewResult] = useState<DatasetBlendPreviewResult | null>(null);
  const [previewingBlend, setPreviewingBlend] = useState(false);
  const [savingBlend, setSavingBlend] = useState(false);
  const [blendError, setBlendError] = useState<string | null>(null);

  // Scheduled Refresh Modal state
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const [refreshDataset, setRefreshDataset] = useState<DatasetData | null>(null);
  const [refreshSchedule, setRefreshSchedule] = useState<DatasetRefreshSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [triggeringRefresh, setTriggeringRefresh] = useState(false);
  const [refreshFrequency, setRefreshFrequency] = useState<string>("6H");
  const [refreshEnabled, setRefreshEnabled] = useState<boolean>(true);

  // Permissions
  const canCreate = hasPermission("DATASET_CREATE");
  const canDelete = hasPermission("DATASET_DELETE");

  // ---- Auth guard ----
  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  // ---- Data loading ----
  const refreshDatasets = () => {
    setLoadingData(true);
    apiListDatasets({
      workspaceId: currentWorkspace?.id,
      search: searchTerm || undefined,
    })
      .then((list) => {
        setDatasets(list);
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg(err instanceof ApiError ? err.message : "Failed to load datasets");
      })
      .finally(() => {
        setLoadingData(false);
      });
  };

  useEffect(() => {
    if (!auth) return;
    let ignore = false;

    apiListDatasets({
      workspaceId: currentWorkspace?.id,
      search: searchTerm || undefined,
    })
      .then((list) => {
        if (!ignore) {
          setDatasets(list);
          setLoadingData(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load datasets");
          setLoadingData(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, currentWorkspace?.id, searchTerm]);

  // Open creation modal
  function openCreateModal() {
    setIsModalOpen(true);
    setCreationMode("FILE");
    setSelectedFile(null);
    setFormName("");
    setFormDescription("");
    setSelectedSourceId("");
    setSelectedTable("");
    setSourceTables([]);
    setDiscoveredCols([]);
    setCsvInput("");
    setCsvInferredCols([]);
    setCsvPreviewRows([]);
    setErrorMsg(null);

    // Fetch data sources for selection
    apiListDataSources()
      .then((dsList) => {
        setDataSources(dsList);
        if (dsList.length > 0 && dsList[0]) {
          handleSelectDataSource(dsList[0].id);
        }
      })
      .catch(() => {});
  }

  // Handle selecting a data source in creation modal
  function handleSelectDataSource(dsId: string) {
    setSelectedSourceId(dsId);
    setSelectedTable("");
    setDiscoveredCols([]);
    setLoadingTables(true);

    apiListSourceTables(dsId)
      .then((tables) => {
        setSourceTables(tables);
        if (tables.length > 0 && tables[0]) {
          handleSelectTable(dsId, tables[0].name);
        }
      })
      .catch(() => {
        setSourceTables([]);
      })
      .finally(() => {
        setLoadingTables(false);
      });
  }

  // Handle selecting a table
  function handleSelectTable(dsId: string, tableName: string) {
    setSelectedTable(tableName);
    if (!formName) {
      setFormName(`${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Dataset`);
    }

    apiGetSourceTableSchema(dsId, tableName)
      .then((res) => {
        setDiscoveredCols(res.columns);
      })
      .catch(() => {
        setDiscoveredCols([]);
      });
  }

  // Handle CSV Schema Preview
  function handleParseCsv() {
    if (!csvInput.trim()) return;
    setPreviewingCsv(true);

    apiPreviewCsvSchema(csvInput)
      .then((res) => {
        setCsvInferredCols(res.columns);
        setCsvPreviewRows(res.previewRows);
        if (!formName) {
          setFormName("Uploaded CSV Dataset");
        }
      })
      .catch((err) => {
        setErrorMsg(err instanceof ApiError ? err.message : "Failed to parse CSV");
      })
      .finally(() => {
        setPreviewingCsv(false);
      });
  }

  // Submit dataset creation
  async function handleSubmitCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (creationMode === "FILE") {
        if (!selectedFile) {
          setErrorMsg("Please choose a CSV, XLSX, or JSON file to upload");
          setSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("name", formName || selectedFile.name.replace(/\.[^/.]+$/, ""));
        if (formDescription) formData.append("description", formDescription);
        if (currentWorkspace?.id) formData.append("workspaceId", currentWorkspace.id);

        const created = await apiUploadDataset(formData);
        setSuccessMsg(
          `Dataset "${created.name}" (${created.sourceType || "CSV"}, ${created.rowCount} rows, ${
            created.columnCount || created.columns.length
          } columns) uploaded and processed successfully.`
        );
      } else if (creationMode === "DATASOURCE") {
        await apiCreateDataset({
          workspaceId: currentWorkspace?.id,
          name: formName,
          description: formDescription || undefined,
          type: "CONNECTED",
          dataSourceId: selectedSourceId,
          tableName: selectedTable,
          columns: discoveredCols,
        });
        setSuccessMsg(`Dataset "${formName}" created successfully.`);
      } else {
        await apiCreateDataset({
          workspaceId: currentWorkspace?.id,
          name: formName,
          description: formDescription || undefined,
          type: "UPLOADED",
          csvText: csvInput,
          columns: csvInferredCols,
        });
        setSuccessMsg(`Dataset "${formName}" created successfully.`);
      }

      setIsModalOpen(false);
      refreshDatasets();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to create dataset");
    } finally {
      setSubmitting(false);
    }
  }

  // Quick Preview
  async function openQuickPreview(ds: DatasetData) {
    setPreviewingDataset(ds);
    setLoadingPreview(true);
    setPreviewCols(ds.columns ? ds.columns.map((c) => c.name) : []);

    try {
      const res = await apiPreviewDataset(ds.id, 25);
      setPreviewCols(res.columnNames || res.columns || []);
      setPreviewRows(res.previewRows || res.rows || []);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to preview dataset");
    } finally {
      setLoadingPreview(false);
    }
  }

  // Delete Dataset
  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete dataset "${name}"?`)) {
      return;
    }

    try {
      await apiDeleteDataset(id);
      setSuccessMsg(`Dataset "${name}" deleted.`);
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete dataset");
    }
  }

  // Scheduled Refresh Handlers
  async function openRefreshModal(ds: DatasetData) {
    setRefreshDataset(ds);
    setIsRefreshModalOpen(true);
    setLoadingSchedule(true);
    try {
      const schedule = await apiGetDatasetRefreshSchedule(ds.id);
      setRefreshSchedule(schedule);
      setRefreshFrequency(schedule.frequency || "6H");
      setRefreshEnabled(schedule.enabled ?? true);
    } catch {
      setRefreshSchedule({
        enabled: true,
        frequency: "6H",
        lastStatus: "IDLE",
      });
      setRefreshFrequency("6H");
      setRefreshEnabled(true);
    } finally {
      setLoadingSchedule(false);
    }
  }

  async function handleSaveSchedule() {
    if (!refreshDataset) return;
    setSavingSchedule(true);
    try {
      const saved = await apiSaveDatasetRefreshSchedule(refreshDataset.id, {
        enabled: refreshEnabled,
        frequency: refreshFrequency,
      });
      setRefreshSchedule(saved);
      setSuccessMsg(`Refresh schedule updated (${refreshFrequency}, ${refreshEnabled ? "Active" : "Paused"}).`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save refresh schedule");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleDeleteSchedule() {
    if (!refreshDataset) return;
    setSavingSchedule(true);
    try {
      await apiDeleteDatasetRefreshSchedule(refreshDataset.id);
      setRefreshSchedule({
        enabled: false,
        frequency: "6H",
        lastStatus: "IDLE",
      });
      setRefreshEnabled(false);
      setSuccessMsg("Refresh schedule disabled and cleared.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to clear refresh schedule");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleTriggerRefreshNow() {
    if (!refreshDataset) return;
    setTriggeringRefresh(true);
    try {
      const res = await apiTriggerDatasetRefresh(refreshDataset.id);
      setSuccessMsg(`Dataset refreshed successfully! Rows: ${res.rowCount ?? "updated"}, took ${res.durationMs}ms.`);
      const updated = await apiGetDatasetRefreshSchedule(refreshDataset.id);
      setRefreshSchedule(updated);
      refreshDatasets();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Dataset refresh failed");
    } finally {
      setTriggeringRefresh(false);
    }
  }

  // Data Blending Handlers
  function openBlendModal() {
    setBlendError(null);
    setBlendPreviewResult(null);

    const firstA = datasets[0];
    const firstB = datasets.length > 1 ? datasets[1] : null;

    if (firstA) {
      setBlendDatasetAId(firstA.id);
      setBlendJoinColA(firstA.columns?.[0]?.name || "");
    } else {
      setBlendDatasetAId("");
      setBlendJoinColA("");
    }

    if (firstB) {
      setBlendDatasetBId(firstB.id);
      const matchingCol = firstB.columns?.find(
        (cb) => cb.name.toLowerCase() === (firstA?.columns?.[0]?.name || "").toLowerCase()
      );
      setBlendJoinColB(matchingCol ? matchingCol.name : firstB.columns?.[0]?.name || "");
      setBlendName(`${firstA.name} & ${firstB.name} Blend`);
    } else {
      setBlendDatasetBId("");
      setBlendJoinColB("");
      setBlendName("");
    }

    setBlendDescription("");
    setBlendJoinType("INNER");
    setIsBlendModalOpen(true);
  }

  function handleSelectDatasetA(id: string) {
    setBlendDatasetAId(id);
    const dsA = datasets.find((d) => d.id === id);
    const firstColA = dsA?.columns?.[0]?.name || "";
    setBlendJoinColA(firstColA);
    setBlendPreviewResult(null);

    const dsB = datasets.find((d) => d.id === blendDatasetBId);
    if (dsA && dsB) {
      setBlendName(`${dsA.name} & ${dsB.name} Blend`);
    }
  }

  function handleSelectDatasetB(id: string) {
    setBlendDatasetBId(id);
    const dsB = datasets.find((d) => d.id === id);
    const dsA = datasets.find((d) => d.id === blendDatasetAId);

    const matched = dsB?.columns?.find(
      (cb) => cb.name.toLowerCase() === blendJoinColA.toLowerCase()
    );
    setBlendJoinColB(matched ? matched.name : dsB?.columns?.[0]?.name || "");
    setBlendPreviewResult(null);

    if (dsA && dsB) {
      setBlendName(`${dsA.name} & ${dsB.name} Blend`);
    }
  }

  async function handlePreviewBlend() {
    if (!blendDatasetAId || !blendDatasetBId) {
      setBlendError("Please select both Dataset A and Dataset B.");
      return;
    }
    if (blendDatasetAId === blendDatasetBId) {
      setBlendError("Dataset A and Dataset B must be different datasets.");
      return;
    }
    if (!blendJoinColA || !blendJoinColB) {
      setBlendError("Please select join columns for both datasets.");
      return;
    }

    setPreviewingBlend(true);
    setBlendError(null);

    try {
      const res = await apiPreviewDatasetBlend({
        datasetAId: blendDatasetAId,
        datasetBId: blendDatasetBId,
        joinColumnA: blendJoinColA,
        joinColumnB: blendJoinColB,
        joinType: blendJoinType,
        limit: 50,
      });
      setBlendPreviewResult(res);
      if (!blendName) {
        setBlendName(`${res.datasetA.name} & ${res.datasetB.name} Blend`);
      }
    } catch (err) {
      setBlendError(err instanceof ApiError ? err.message : "Failed to preview blend");
    } finally {
      setPreviewingBlend(false);
    }
  }

  async function handleSaveBlend(e: FormEvent) {
    e.preventDefault();
    if (!blendName.trim()) {
      setBlendError("Please enter a name for the blended dataset.");
      return;
    }
    if (!blendDatasetAId || !blendDatasetBId || !blendJoinColA || !blendJoinColB) {
      setBlendError("Incomplete blend configuration.");
      return;
    }

    setSavingBlend(true);
    setBlendError(null);

    try {
      const created = await apiCreateDatasetBlend({
        name: blendName.trim(),
        description: blendDescription.trim() || undefined,
        datasetAId: blendDatasetAId,
        datasetBId: blendDatasetBId,
        joinColumnA: blendJoinColA,
        joinColumnB: blendJoinColB,
        joinType: blendJoinType,
      });

      setDatasets((prev) => [created, ...prev]);
      setIsBlendModalOpen(false);
      setSuccessMsg(
        `Blended dataset "${created.name}" created successfully (${created.rowCount} rows, ${
          created.columnCount || created.columns.length
        } columns). It can now be queried and visualized!`
      );
    } catch (err) {
      setBlendError(err instanceof ApiError ? err.message : "Failed to save blended dataset");
    } finally {
      setSavingBlend(false);
    }
  }

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading datasets...</p>
      </div>
    );
  }

  const filteredDatasets = datasets.filter((d) => {
    // 1. Source type filter
    if (filterType !== "ALL") {
      if (filterType === "CONNECTED" && d.type !== "CONNECTED") return false;
      if (filterType === "DERIVED" && d.type !== "DERIVED") return false;
      if (filterType === "CSV" && (d.type === "DERIVED" || (d.sourceType !== "CSV" && (d.type === "CONNECTED" || d.sourceType)))) return false;
      if (filterType === "XLSX" && d.sourceType !== "XLSX") return false;
      if (filterType === "JSON" && d.sourceType !== "JSON") return false;
    }
    // 2. Client-side Search Term (matches name, description, fileName, tableName)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = d.name.toLowerCase().includes(q);
      const matchDesc = (d.description || "").toLowerCase().includes(q);
      const matchFile = (d.fileName || "").toLowerCase().includes(q);
      const matchTable = (d.tableName || "").toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchFile && !matchTable) return false;
    }
    return true;
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
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
            <span className="text-sm font-semibold text-gray-900">Datasets</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/data-sources"
              className="text-xs font-medium text-gray-600 hover:text-indigo-600 transition hidden sm:inline"
            >
              Data Sources →
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
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-500 hover:text-red-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex justify-between items-center">
            <span>{successMsg}</span>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-green-500 hover:text-green-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Datasets</h1>
            <p className="text-sm text-gray-500 mt-1">
              Curate, preview, blend, and govern tabular datasets ready for exploration.
            </p>
          </div>

          {canCreate && (
            <div className="flex items-center gap-2.5">
              <Link
                href="/datasets/demo"
                id="explore-demo-datasets-btn"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition shadow-2xs"
              >
                <span>✨ Demo Datasets</span>
              </Link>
              <button
                id="blend-datasets-btn"
                type="button"
                onClick={openBlendModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/80 px-3.5 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition shadow-2xs"
              >
                <span>⚡ Blend Datasets</span>
              </button>
              <button
                id="add-dataset-btn"
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
              >
                <span>+ Create Dataset</span>
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-2 sm:pb-0 sm:border-0">
            {["ALL", "CSV", "XLSX", "JSON", "CONNECTED", "DERIVED"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterType === t
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {t === "ALL"
                  ? "All Sources"
                  : t === "CSV"
                  ? "CSV"
                  : t === "XLSX"
                  ? "Excel (XLSX)"
                  : t === "JSON"
                  ? "JSON"
                  : t === "CONNECTED"
                  ? "Connected DB"
                  : "⚡ Blended"}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search datasets..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Datasets Grid / Empty State */}
        {loadingData ? (
          <div className="py-16 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2" />
            <p>Loading datasets...</p>
          </div>
        ) : filteredDatasets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-2xl mb-4">
              🗃️
            </div>
            {searchTerm || filterType !== "ALL" ? (
              <>
                <h3 className="text-base font-semibold text-gray-900">No matching datasets found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No datasets match your active search term &quot;{searchTerm}&quot; or source filter.
                </p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterType("ALL");
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs"
                >
                  Clear Search & Filters
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-gray-900">No datasets found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create a dataset from a connected PostgreSQL database or import an uploaded CSV/Excel file.
                </p>
                {canCreate && (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    >
                      + Create Dataset
                    </button>
                    <Link
                      href="/datasets/demo"
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-2xs hover:bg-amber-100"
                    >
                      ✨ Explore Demo Datasets
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDatasets.map((ds) => (
              <div
                key={ds.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {ds.type === "CONNECTED"
                        ? "🔌 Connected"
                        : ds.sourceType === "XLSX"
                        ? "📊 XLSX"
                        : ds.sourceType === "JSON"
                        ? "📦 JSON"
                        : "📄 CSV"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        ds.status === "READY"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : ds.status === "FAILED" || ds.status === "ERROR"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {ds.status}
                    </span>
                  </div>

                  <Link
                    href={`/datasets/${ds.id}`}
                    className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition truncate block"
                  >
                    {ds.name}
                  </Link>

                  {ds.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {ds.description}
                    </p>
                  )}

                  <div className="mt-4 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Source:</span>
                      <span className="font-medium text-gray-700 truncate max-w-[140px]">
                        {ds.dataSourceName || ds.fileName || (ds.sourceType ? `${ds.sourceType} File` : "Uploaded File")}
                      </span>
                    </div>
                    {ds.fileName && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">File:</span>
                        <span className="font-mono text-gray-700 truncate max-w-[140px]" title={ds.fileName}>
                          {ds.fileName}
                        </span>
                      </div>
                    )}
                    {ds.tableName && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Table:</span>
                        <span className="font-mono text-gray-700 truncate max-w-[140px]">
                          {ds.tableName}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rows:</span>
                      <span className="font-medium text-gray-700">
                        {ds.rowCount.toLocaleString()} rows
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Columns:</span>
                      <span className="font-medium text-gray-700">
                        {ds.columnCount || ds.columns.length} columns
                      </span>
                    </div>
                    {ds.fileSize && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Size:</span>
                        <span className="font-medium text-gray-700">
                          {(ds.fileSize / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Updated:</span>
                      <span className="text-gray-700">
                        {ds.updatedAt ? new Date(ds.updatedAt).toLocaleDateString() : "Recently"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void openQuickPreview(ds)}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      👁️ Preview
                    </button>
                    <Link
                      href={`/datasets/${ds.id}`}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      Details →
                    </Link>
                    <button
                      onClick={() => void openRefreshModal(ds)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
                      title="Schedule automated data refresh"
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => void handleDelete(ds.id, ds.name)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Create Dataset */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Create Dataset</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="mt-4 space-y-4">
              {/* Mode switch */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCreationMode("FILE")}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center ${
                    creationMode === "FILE"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  📁 Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode("DATASOURCE")}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center ${
                    creationMode === "DATASOURCE"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  🔌 Data Source
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode("CSV")}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center ${
                    creationMode === "CSV"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  📝 Paste CSV
                </button>
              </div>

              {/* Mode: File Upload (CSV / XLSX / JSON) */}
              {creationMode === "FILE" && (
                <div className="space-y-3 pt-2">
                  <div className="rounded-lg bg-indigo-50/70 border border-indigo-100 p-3 text-xs text-indigo-900 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <span>ℹ️</span> Supported Formats: CSV, XLSX, JSON
                    </p>
                    <p className="text-indigo-700 text-[11px] leading-relaxed">
                      Upload files up to 15MB. RicozViz parses tabular records, extracts column headers, infers data types (string, integer, decimal/number, boolean, date, datetime), and saves the dataset into your active workspace.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Choose File (.csv, .xlsx, or .json) *
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 border-gray-300 hover:bg-gray-100 transition">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                          <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          {selectedFile ? (
                            <div>
                              <p className="text-xs font-bold text-indigo-600">{selectedFile.name}</p>
                              <p className="text-[11px] text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-gray-600">Click or drag & drop to choose file</p>
                              <p className="text-[11px] text-gray-400">CSV, XLSX, or JSON (max 15MB)</p>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setSelectedFile(file);
                            if (file && !formName) {
                              setFormName(file.name.replace(/\.[^/.]+$/, ""));
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Data Source */}
              {creationMode === "DATASOURCE" && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Data Source *
                    </label>
                    <select
                      value={selectedSourceId}
                      onChange={(e) => handleSelectDataSource(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      {dataSources.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {ds.name} ({ds.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Table / View *
                    </label>
                    {loadingTables ? (
                      <p className="text-xs text-gray-500">Discovering tables...</p>
                    ) : (
                      <select
                        value={selectedTable}
                        onChange={(e) =>
                          handleSelectTable(selectedSourceId, e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none font-mono text-xs"
                      >
                        {sourceTables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name} ({t.type})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {discoveredCols.length > 0 && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Discovered Schema ({discoveredCols.length} columns)
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {discoveredCols.map((c) => (
                          <span
                            key={c.name}
                            className="rounded bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-600"
                          >
                            <span className="font-mono">{c.name}</span>:{" "}
                            <span className="text-indigo-600 text-[10px]">{c.type}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode: CSV */}
              {creationMode === "CSV" && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Paste CSV Content *
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={csvInput}
                      onChange={(e) => setCsvInput(e.target.value)}
                      placeholder={`customer_id,name,revenue,is_active\n1,"Acme Corp",15000.50,true\n2,"Globex",8500.00,false`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleParseCsv}
                    disabled={previewingCsv || !csvInput.trim()}
                    className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    {previewingCsv ? "Parsing..." : "🔍 Inspect CSV & Infer Schema"}
                  </button>

                  {csvInferredCols.length > 0 && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Inferred Schema ({csvInferredCols.length} columns)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {csvInferredCols.map((c) => (
                          <span
                            key={c.name}
                            className="rounded bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-600"
                          >
                            <span className="font-mono">{c.name}</span>:{" "}
                            <span className="text-indigo-600 text-[10px]">{c.type}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Common Details */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dataset Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Monthly Revenue"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional context about this dataset"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{creationMode === "FILE" ? "Uploading & Ingesting..." : "Creating..."}</span>
                    </span>
                  ) : (
                    "Save Dataset"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Preview */}
      {previewingDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Preview: {previewingDataset.name}
                </h2>
                <p className="text-xs text-gray-500">
                  Showing up to 25 sample rows
                </p>
              </div>
              <button
                onClick={() => setPreviewingDataset(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto my-4 border border-gray-200 rounded-lg">
              {loadingPreview ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  Loading preview data...
                </div>
              ) : previewRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No sample rows available.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewCols.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {previewCols.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-2 text-gray-700 whitespace-nowrap"
                          >
                            {row[col] !== undefined && row[col] !== null
                              ? String(row[col])
                              : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewingDataset(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Data Blending */}
      {isBlendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-bold text-sm">
                  ⚡
                </span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Blend Two Datasets
                  </h2>
                  <p className="text-xs text-gray-500">
                    Join datasets by a common field using INNER or LEFT JOIN.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBlendModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 space-y-5 pr-1">
              {blendError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex justify-between items-center">
                  <span>{blendError}</span>
                  <button
                    type="button"
                    onClick={() => setBlendError(null)}
                    className="text-red-500 hover:text-red-700 font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Dataset Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dataset A */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">Primary Dataset (A)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Left Table</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Select Dataset</label>
                    <select
                      value={blendDatasetAId}
                      onChange={(e) => handleSelectDatasetA(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Choose Dataset A --</option>
                      {datasets.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.rowCount} rows)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Common Join Key (Column A)</label>
                    <select
                      value={blendJoinColA}
                      onChange={(e) => {
                        setBlendJoinColA(e.target.value);
                        setBlendPreviewResult(null);
                      }}
                      disabled={!blendDatasetAId}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none disabled:bg-gray-100"
                    >
                      <option value="">-- Select Join Column --</option>
                      {datasets.find((d) => d.id === blendDatasetAId)?.columns?.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dataset B */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">Secondary Dataset (B)</span>
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Right Table</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Select Dataset</label>
                    <select
                      value={blendDatasetBId}
                      onChange={(e) => handleSelectDatasetB(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Choose Dataset B --</option>
                      {datasets
                        .filter((d) => d.id !== blendDatasetAId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.rowCount} rows)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Common Join Key (Column B)</label>
                    <select
                      value={blendJoinColB}
                      onChange={(e) => {
                        setBlendJoinColB(e.target.value);
                        setBlendPreviewResult(null);
                      }}
                      disabled={!blendDatasetBId}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none disabled:bg-gray-100"
                    >
                      <option value="">-- Select Join Column --</option>
                      {datasets.find((d) => d.id === blendDatasetBId)?.columns?.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Join Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Join Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBlendJoinType("INNER");
                      setBlendPreviewResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      blendJoinType === "INNER"
                        ? "border-purple-600 bg-purple-50/70 text-purple-900 ring-1 ring-purple-600"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">INNER JOIN</span>
                      <span className="text-[10px] text-purple-600 font-semibold">Intersection</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Includes only records with matching join values in both Dataset A and Dataset B.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBlendJoinType("LEFT");
                      setBlendPreviewResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      blendJoinType === "LEFT"
                        ? "border-purple-600 bg-purple-50/70 text-purple-900 ring-1 ring-purple-600"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">LEFT JOIN</span>
                      <span className="text-[10px] text-purple-600 font-semibold">All from A</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Includes all records from Dataset A, with matching columns from Dataset B or nulls.
                    </p>
                  </button>
                </div>
              </div>

              {/* Preview Button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handlePreviewBlend}
                  disabled={previewingBlend || !blendDatasetAId || !blendDatasetBId || !blendJoinColA || !blendJoinColB}
                  className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {previewingBlend ? (
                    <>
                      <span className="h-3.5 w-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span>Computing Live Blend...</span>
                    </>
                  ) : (
                    <span>🔍 Preview Blended Data</span>
                  )}
                </button>

                {blendPreviewResult && (
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    ✓ {blendPreviewResult.rowCount} total rows ({blendPreviewResult.resultingColumns.length} columns)
                  </span>
                )}
              </div>

              {/* Preview Results Table & Metadata */}
              {blendPreviewResult && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gray-500 font-medium mr-1">Resulting Columns:</span>
                    {blendPreviewResult.resultingColumns.map((c) => (
                      <span
                        key={c.name}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                          c.origin === "A"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-[9px] opacity-60 uppercase">({c.type})</span>
                      </span>
                    ))}
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-auto max-h-52 bg-white text-xs">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {blendPreviewResult.resultingColumns.map((col) => (
                            <th
                              key={col.name}
                              className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {blendPreviewResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-gray-50">
                            {blendPreviewResult.resultingColumns.map((col) => (
                              <td
                                key={col.name}
                                className="px-3 py-1.5 text-gray-700 whitespace-nowrap"
                              >
                                {row[col.name] !== undefined && row[col.name] !== null
                                  ? String(row[col.name])
                                  : <span className="text-gray-400 italic">null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Save form */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Blended Dataset Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={blendName}
                        onChange={(e) => setBlendName(e.target.value)}
                        placeholder="e.g. Sales & Customers Unified"
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
                      <input
                        type="text"
                        value={blendDescription}
                        onChange={(e) => setBlendDescription(e.target.value)}
                        placeholder="e.g. Combined sales orders with customer demographic data"
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsBlendModalOpen(false)}
                className="rounded-lg border border-gray-300 px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBlend}
                disabled={savingBlend || !blendPreviewResult || !blendName.trim()}
                className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-500 transition disabled:opacity-50 cursor-pointer"
              >
                {savingBlend ? "Saving Blend..." : "Save Blended Dataset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Scheduled Data Refresh */}
      {isRefreshModalOpen && refreshDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>🔄</span>
                  <span>Scheduled Data Refresh</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automate re-ingestion and query updates for <span className="font-semibold text-gray-700">{refreshDataset.name}</span>
                </p>
              </div>
              <button
                onClick={() => setIsRefreshModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingSchedule ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span className="text-xs">Loading refresh schedule...</span>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Status Card */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Current Status:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                        refreshSchedule?.lastStatus === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800"
                          : refreshSchedule?.lastStatus === "FAILED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {refreshSchedule?.lastStatus || "IDLE"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Last Refreshed:</span>
                    <span className="text-gray-700 font-medium">
                      {refreshSchedule?.lastRunAt
                        ? new Date(refreshSchedule.lastRunAt).toLocaleString()
                        : "Never"}
                    </span>
                  </div>
                  {refreshSchedule?.nextRunAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Next Scheduled Run:</span>
                      <span className="text-emerald-700 font-medium">
                        {new Date(refreshSchedule.nextRunAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {refreshSchedule?.lastError && (
                    <div className="mt-1 rounded-lg bg-rose-50 border border-rose-200 p-2 text-rose-700 text-[11px]">
                      {refreshSchedule.lastError}
                    </div>
                  )}
                </div>

                {/* Schedule Configuration */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Refresh Frequency *
                    </label>
                    <select
                      value={refreshFrequency}
                      onChange={(e) => setRefreshFrequency(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="1H">Every Hour (1H)</option>
                      <option value="6H">Every 6 Hours (6H)</option>
                      <option value="12H">Every 12 Hours (12H)</option>
                      <option value="DAILY">Daily (24 Hours)</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-refresh-toggle"
                      checked={refreshEnabled}
                      onChange={(e) => setRefreshEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="enable-refresh-toggle" className="text-xs font-medium text-gray-700 select-none cursor-pointer">
                      Enable automated scheduled execution
                    </label>
                  </div>
                </div>

                {/* Execution History */}
                {refreshSchedule?.history && refreshSchedule.history.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <h3 className="text-xs font-bold text-gray-700 mb-2">Recent Refresh Executions</h3>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {refreshSchedule.history.slice(0, 5).map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-gray-50 border border-gray-100"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                entry.status === "SUCCESS" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            <span className="font-medium text-gray-700">
                              {new Date(entry.executedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            <span>{entry.durationMs}ms</span>
                            <span
                              className={`font-semibold ${
                                entry.status === "SUCCESS" ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {entry.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerRefreshNow}
                    disabled={triggeringRefresh}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {triggeringRefresh ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                        <span>Refreshing...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Refresh Now</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {refreshSchedule?.enabled && (
                      <button
                        type="button"
                        onClick={handleDeleteSchedule}
                        disabled={savingSchedule}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50 cursor-pointer"
                      >
                        Disable
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={savingSchedule}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
                    >
                      {savingSchedule ? "Saving..." : "Save Schedule"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
