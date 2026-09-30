"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import {
  apiListDatasets,
  apiCreateDataset,
  apiDeleteDataset,
  apiPreviewDataset,
  apiListDataSources,
  apiListSourceTables,
  apiGetSourceTableSchema,
  apiPreviewCsvSchema,
  type DatasetData,
  type DatasetColumn,
  type DataSourceData,
  type SourceTable,
  ApiError,
} from "../../lib/api";

export default function DatasetsPage() {
  const { auth, isLoading, logout, hasPermission } = useAuth();
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
  const [creationMode, setCreationMode] = useState<"DATASOURCE" | "CSV">("DATASOURCE");
  const [submitting, setSubmitting] = useState(false);

  // Form common fields
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

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
    apiListDatasets({ search: searchTerm || undefined })
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

    apiListDatasets({ search: searchTerm || undefined })
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
  }, [auth, searchTerm]);

  // Open creation modal
  function openCreateModal() {
    setIsModalOpen(true);
    setCreationMode("DATASOURCE");
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
      if (creationMode === "DATASOURCE") {
        await apiCreateDataset({
          name: formName,
          description: formDescription || undefined,
          type: "CONNECTED",
          dataSourceId: selectedSourceId,
          tableName: selectedTable,
          columns: discoveredCols,
        });
      } else {
        await apiCreateDataset({
          name: formName,
          description: formDescription || undefined,
          type: "UPLOADED",
          csvText: csvInput,
          columns: csvInferredCols,
        });
      }

      setSuccessMsg(`Dataset "${formName}" created successfully.`);
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
    setPreviewCols(ds.columns.map((c) => c.name));

    try {
      const res = await apiPreviewDataset(ds.id, 25);
      setPreviewCols(res.columns);
      setPreviewRows(res.rows);
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

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading datasets...</p>
      </div>
    );
  }

  const filteredDatasets =
    filterType === "ALL"
      ? datasets
      : datasets.filter((d) => d.type === filterType);

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
              Curate, preview, and govern tabular datasets ready for exploration.
            </p>
          </div>

          {canCreate && (
            <button
              id="add-dataset-btn"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              <span>+ Create Dataset</span>
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2 sm:pb-0 sm:border-0">
            {["ALL", "CONNECTED", "UPLOADED"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterType === t
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {t === "ALL" ? "All Datasets" : t === "CONNECTED" ? "Connected Sources" : "Uploaded CSVs"}
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
          <div className="py-12 text-center text-sm text-gray-500">
            Loading datasets...
          </div>
        ) : filteredDatasets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-2xl mb-4">
              🗃️
            </div>
            <h3 className="text-base font-semibold text-gray-900">No datasets found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create a dataset from a connected PostgreSQL database or import an uploaded CSV.
            </p>
            {canCreate && (
              <button
                onClick={openCreateModal}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                + Create Dataset
              </button>
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
                      {ds.type === "CONNECTED" ? "🔌 Connected" : "📄 CSV"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        ds.status === "READY"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-yellow-50 text-yellow-700 border border-yellow-200"
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
                        {ds.dataSourceName || "Uploaded File"}
                      </span>
                    </div>
                    {ds.tableName && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Table:</span>
                        <span className="font-mono text-gray-700 truncate max-w-[140px]">
                          {ds.tableName}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Columns:</span>
                      <span className="font-medium text-gray-700">
                        {ds.columns.length} columns
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreationMode("DATASOURCE")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    creationMode === "DATASOURCE"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  🔌 From Connected Data Source
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode("CSV")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    creationMode === "CSV"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  📄 Upload / Paste CSV
                </button>
              </div>

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
                  {submitting ? "Creating..." : "Save Dataset"}
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
    </div>
  );
}
