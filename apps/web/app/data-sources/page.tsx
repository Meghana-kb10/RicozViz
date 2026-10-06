"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import {
  apiListDataSources,
  apiCreateDataSource,
  apiUpdateDataSource,
  apiDeleteDataSource,
  apiTestDataSourceConnection,
  apiTestRawConnection,
  apiListSourceTables,
  apiGetSourceTableSchema,
  apiCreateDataset,
  type DataSourceData,
  type DataSourceType,
  type SourceTable,
  type DatasetColumn,
  ApiError,
} from "../../lib/api";

export default function DataSourcesPage() {
  const { auth, isLoading, logout, hasPermission } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [dataSources, setDataSources] = useState<DataSourceData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSourceData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formType, setFormType] = useState<DataSourceType>("POSTGRESQL");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  // Postgres fields
  const [pgHost, setPgHost] = useState("localhost");
  const [pgPort, setPgPort] = useState(5432);
  const [pgDatabase, setPgDatabase] = useState("");
  const [pgUsername, setPgUsername] = useState("");
  const [pgPassword, setPgPassword] = useState("");
  // MySQL fields
  const [mysqlHost, setMysqlHost] = useState("localhost");
  const [mysqlPort, setMysqlPort] = useState(3306);
  const [mysqlDatabase, setMysqlDatabase] = useState("");
  const [mysqlUsername, setMysqlUsername] = useState("root");
  const [mysqlPassword, setMysqlPassword] = useState("");
  // CSV fields
  const [csvFileName, setCsvFileName] = useState("");
  const [csvDelimiter, setCsvDelimiter] = useState(",");
  // REST API fields
  const [apiUrl, setApiUrl] = useState("");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">("GET");
  const [apiAuthType, setApiAuthType] = useState<"NONE" | "API_KEY" | "BEARER">("NONE");
  const [apiSecret, setApiSecret] = useState("");

  // Testing connection state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Pre-save test connection state
  const [testingRaw, setTestingRaw] = useState(false);
  const [rawTestResult, setRawTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Discovery modal state
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [discoverySource, setDiscoverySource] = useState<DataSourceData | null>(null);
  const [discoveryTables, setDiscoveryTables] = useState<SourceTable[]>([]);
  const [loadingDiscoveryTables, setLoadingDiscoveryTables] = useState(false);
  const [selectedDiscoveryTable, setSelectedDiscoveryTable] = useState<string | null>(null);
  const [discoveredTableCols, setDiscoveredTableCols] = useState<DatasetColumn[]>([]);
  const [loadingDiscoveryCols, setLoadingDiscoveryCols] = useState(false);
  const [newDatasetNameFromDiscovery, setNewDatasetNameFromDiscovery] = useState("");
  const [creatingDatasetFromTable, setCreatingDatasetFromTable] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoverySuccess, setDiscoverySuccess] = useState<string | null>(null);

  // ---- Auth guard ----
  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  // ---- Fetch Data Sources ----
  const refreshDataSources = () => {
    setLoadingData(true);
    apiListDataSources(currentWorkspace?.id ? { workspaceId: currentWorkspace.id } : undefined)
      .then((list) => {
        setDataSources(list);
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg(err instanceof ApiError ? err.message : "Failed to load data sources");
      })
      .finally(() => {
        setLoadingData(false);
      });
  };

  useEffect(() => {
    if (!auth) return;
    let ignore = false;

    apiListDataSources(currentWorkspace?.id ? { workspaceId: currentWorkspace.id } : undefined)
      .then((list) => {
        if (!ignore) {
          setDataSources(list);
          setLoadingData(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load data sources");
          setLoadingData(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, currentWorkspace?.id]);

  // Permissions
  const canCreate = hasPermission("DATA_SOURCE_CREATE");
  const canEdit = hasPermission("DATA_SOURCE_EDIT");
  const canDelete = hasPermission("DATA_SOURCE_DELETE");
  const canTest = hasPermission("DATA_SOURCE_TEST");

  // ---- Reset Modal Form ----
  function openCreateModal() {
    setEditingSource(null);
    setFormType("POSTGRESQL");
    setFormName("");
    setFormDescription("");
    setPgHost("localhost");
    setPgPort(5432);
    setPgDatabase("");
    setPgUsername("");
    setPgPassword("");
    setMysqlHost("localhost");
    setMysqlPort(3306);
    setMysqlDatabase("");
    setMysqlUsername("root");
    setMysqlPassword("");
    setCsvFileName("");
    setCsvDelimiter(",");
    setApiUrl("");
    setApiMethod("GET");
    setApiAuthType("NONE");
    setApiSecret("");
    setRawTestResult(null);
    setErrorMsg(null);
    setIsModalOpen(true);
  }

  function openEditModal(ds: DataSourceData) {
    setEditingSource(ds);
    setFormType(ds.type);
    setFormName(ds.name);
    setFormDescription(ds.description || "");
    setRawTestResult(null);

    const conn = ds.connection || {};
    if (ds.type === "POSTGRESQL") {
      setPgHost(String(conn.host || "localhost"));
      setPgPort(Number(conn.port || 5432));
      setPgDatabase(String(conn.database || ""));
      setPgUsername(String(conn.username || ""));
      setPgPassword(""); // Never prefill passwords
    } else if (ds.type === "MYSQL") {
      setMysqlHost(String(conn.host || "localhost"));
      setMysqlPort(Number(conn.port || 3306));
      setMysqlDatabase(String(conn.database || ""));
      setMysqlUsername(String(conn.username || "root"));
      setMysqlPassword(""); // Never prefill passwords
    } else if (ds.type === "CSV") {
      setCsvFileName(String(conn.fileName || ""));
      setCsvDelimiter(String(conn.delimiter || ","));
    } else if (ds.type === "REST_API") {
      setApiUrl(String(conn.url || ""));
      setApiMethod((conn.method as "GET" | "POST") || "GET");
      setApiAuthType((conn.authType as "NONE" | "API_KEY" | "BEARER") || "NONE");
      setApiSecret(""); // Never prefill secret keys
    }

    setErrorMsg(null);
    setIsModalOpen(true);
  }

  // ---- Pre-Save Connection Test ----
  async function handleRawTest() {
    setTestingRaw(true);
    setRawTestResult(null);

    let connection: Record<string, unknown> = {};
    if (formType === "POSTGRESQL") {
      connection = {
        host: pgHost.trim(),
        port: Number(pgPort) || 5432,
        database: pgDatabase.trim(),
        username: pgUsername.trim(),
      };
      if (pgPassword) connection.password = pgPassword;
    } else if (formType === "MYSQL") {
      connection = {
        host: mysqlHost.trim(),
        port: Number(mysqlPort) || 3306,
        database: mysqlDatabase.trim(),
        username: mysqlUsername.trim(),
      };
      if (mysqlPassword) connection.password = mysqlPassword;
    } else if (formType === "CSV") {
      connection = {
        fileName: csvFileName.trim(),
        delimiter: csvDelimiter,
      };
    } else if (formType === "REST_API") {
      connection = {
        url: apiUrl.trim(),
        method: apiMethod,
        authType: apiAuthType,
      };
      if (apiSecret) {
        if (apiAuthType === "API_KEY") connection.apiKey = apiSecret;
        if (apiAuthType === "BEARER") connection.bearerToken = apiSecret;
      }
    }

    try {
      const res = await apiTestRawConnection({
        type: formType,
        connection,
      });
      setRawTestResult({
        success: res.success,
        message: res.message,
      });
    } catch (err) {
      setRawTestResult({
        success: false,
        message: err instanceof ApiError ? err.message : "Connection test failed",
      });
    } finally {
      setTestingRaw(false);
    }
  }

  // ---- Schema / Table Discovery & Dataset Creation ----
  async function openDiscoveryModal(ds: DataSourceData) {
    setDiscoverySource(ds);
    setDiscoveryTables([]);
    setSelectedDiscoveryTable(null);
    setDiscoveredTableCols([]);
    setDiscoveryError(null);
    setDiscoverySuccess(null);
    setLoadingDiscoveryTables(true);
    setIsDiscoveryOpen(true);

    try {
      const tables = await apiListSourceTables(ds.id);
      setDiscoveryTables(tables);
      if (tables.length > 0 && tables[0]) {
        void handleSelectDiscoveryTable(ds.id, tables[0].name);
      }
    } catch (err) {
      setDiscoveryError(err instanceof ApiError ? err.message : "Failed to load tables from data source");
    } finally {
      setLoadingDiscoveryTables(false);
    }
  }

  async function handleSelectDiscoveryTable(dsId: string, tableName: string) {
    setSelectedDiscoveryTable(tableName);
    setNewDatasetNameFromDiscovery(`${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Dataset`);
    setLoadingDiscoveryCols(true);
    try {
      const res = await apiGetSourceTableSchema(dsId, tableName);
      setDiscoveredTableCols(res.columns || []);
    } catch {
      setDiscoveredTableCols([]);
    } finally {
      setLoadingDiscoveryCols(false);
    }
  }

  async function handleCreateDatasetFromDiscovery() {
    if (!discoverySource || !selectedDiscoveryTable) return;
    setCreatingDatasetFromTable(true);
    setDiscoveryError(null);
    try {
      const ds = await apiCreateDataset({
        name: newDatasetNameFromDiscovery.trim() || `${selectedDiscoveryTable} Dataset`,
        type: "CONNECTED",
        dataSourceId: discoverySource.id,
        tableName: selectedDiscoveryTable,
        workspaceId: currentWorkspace?.id,
        columns: discoveredTableCols,
      });
      setDiscoverySuccess(`Dataset "${ds.name}" created successfully! Redirecting...`);
      setTimeout(() => {
        setIsDiscoveryOpen(false);
        router.push(`/datasets/${ds.id}`);
      }, 1200);
    } catch (err) {
      setDiscoveryError(err instanceof ApiError ? err.message : "Failed to create dataset from table");
    } finally {
      setCreatingDatasetFromTable(false);
    }
  }

  // ---- Handle Form Submit ----
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    let connection: Record<string, unknown> = {};

    if (formType === "POSTGRESQL") {
      connection = {
        host: pgHost.trim(),
        port: Number(pgPort),
        database: pgDatabase.trim(),
        username: pgUsername.trim(),
      };
      if (pgPassword) {
        connection.password = pgPassword;
      }
    } else if (formType === "MYSQL") {
      connection = {
        host: mysqlHost.trim(),
        port: Number(mysqlPort) || 3306,
        database: mysqlDatabase.trim(),
        username: mysqlUsername.trim(),
      };
      if (mysqlPassword) {
        connection.password = mysqlPassword;
      }
    } else if (formType === "CSV") {
      connection = {
        fileName: csvFileName.trim(),
        delimiter: csvDelimiter,
      };
    } else if (formType === "REST_API") {
      connection = {
        url: apiUrl.trim(),
        method: apiMethod,
        authType: apiAuthType,
      };
      if (apiSecret) {
        if (apiAuthType === "API_KEY") connection.apiKey = apiSecret;
        if (apiAuthType === "BEARER") connection.bearerToken = apiSecret;
      }
    }

    try {
      if (editingSource) {
        await apiUpdateDataSource(editingSource.id, {
          name: formName,
          description: formDescription || null,
          connection,
        });
        setSuccessMsg(`Data source "${formName}" updated successfully.`);
      } else {
        await apiCreateDataSource({
          name: formName,
          description: formDescription || undefined,
          type: formType,
          connection,
          workspaceId: currentWorkspace?.id,
        });
        setSuccessMsg(`Data source "${formName}" created successfully.`);
      }

      setIsModalOpen(false);
      refreshDataSources();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to save data source.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Handle Delete ----
  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete data source "${name}"?`)) {
      return;
    }

    try {
      setErrorMsg(null);
      await apiDeleteDataSource(id);
      setSuccessMsg(`Data source "${name}" deleted.`);
      setDataSources((prev) => prev.filter((ds) => ds.id !== id));
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to delete data source.");
      }
    }
  }

  // ---- Handle Test Connection ----
  async function handleTestConnection(id: string) {
    try {
      setTestingId(id);
      setTestResult(null);
      const res = await apiTestDataSourceConnection(id);
      setTestResult({
        id,
        success: res.success,
        message: res.message,
      });

      // Update in local list status
      setDataSources((prev) =>
        prev.map((ds) =>
          ds.id === id ? { ...ds, status: res.status } : ds
        )
      );
    } catch (err) {
      setTestResult({
        id,
        success: false,
        message: err instanceof ApiError ? err.message : "Connection test failed",
      });
    } finally {
      setTestingId(null);
    }
  }

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading data sources...</p>
      </div>
    );
  }

  const filteredSources =
    filterType === "ALL"
      ? dataSources
      : dataSources.filter((ds) => ds.type === filterType);

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
            <span className="text-sm font-semibold text-gray-900">Data Sources</span>
            <span className="text-gray-300">|</span>
            <Link href="/datasets" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Datasets
            </Link>
          </div>

          <div className="flex items-center gap-4">
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
            <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
            <p className="text-sm text-gray-500 mt-1">
              Connect PostgreSQL databases, CSV files, and REST APIs to fuel dashboards.
            </p>
          </div>

          {canCreate && (
            <button
              id="add-data-source-btn"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              <span>+ Add Data Source</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3 overflow-x-auto">
          {["ALL", "POSTGRESQL", "MYSQL", "CSV", "REST_API"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                filterType === type
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {type === "ALL" ? "All Types" : type === "MYSQL" ? "MySQL" : type.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Data Source Grid / Empty State */}
        {loadingData ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Loading data sources...
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-2xl mb-4">
              🗄️
            </div>
            <h3 className="text-base font-semibold text-gray-900">No data sources found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filterType === "ALL"
                ? "Get started by connecting your first database or data file."
                : `No data sources found for type ${filterType}.`}
            </p>
            {canCreate && (
              <button
                onClick={openCreateModal}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                + Add Data Source
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((ds) => {
              const isTesting = testingId === ds.id;
              const result = testResult?.id === ds.id ? testResult : null;
              const isDb = ds.type === "POSTGRESQL" || ds.type === "MYSQL";

              return (
                <div
                  key={ds.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Type and Status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                        {ds.type === "POSTGRESQL" && "🐘 PostgreSQL"}
                        {ds.type === "MYSQL" && "🐬 MySQL"}
                        {ds.type === "CSV" && "📄 CSV File"}
                        {ds.type === "REST_API" && "🌐 REST API"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ds.status === "CONNECTED"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : ds.status === "FAILED"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {ds.status}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {ds.name}
                    </h3>
                    {ds.description && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                        {ds.description}
                      </p>
                    )}

                    {/* Metadata view */}
                    <div className="mt-4 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600 font-mono break-all">
                      {ds.type === "POSTGRESQL" && (
                        <span>
                          {String(ds.connection.host || "")}:{String(ds.connection.port || 5432)} /{" "}
                          {String(ds.connection.database || "")}
                        </span>
                      )}
                      {ds.type === "MYSQL" && (
                        <span>
                          {String(ds.connection.host || "")}:{String(ds.connection.port || 3306)} /{" "}
                          {String(ds.connection.database || "")}
                        </span>
                      )}
                      {ds.type === "CSV" && (
                        <span>File: {String(ds.connection.fileName || "")}</span>
                      )}
                      {ds.type === "REST_API" && (
                        <span>
                          {String(ds.connection.method || "GET")} {String(ds.connection.url || "")}
                        </span>
                      )}
                    </div>

                    {/* Test result toast inside card */}
                    {result && (
                      <div
                        className={`mt-3 rounded p-2 text-xs font-medium ${
                          result.success
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {result.message}
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isDb && (
                        <button
                          onClick={() => void openDiscoveryModal(ds)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                          title="Discover tables & create dataset"
                        >
                          <span>📑 Tables</span>
                        </button>
                      )}
                      {canTest && (
                        <button
                          onClick={() => void handleTestConnection(ds.id)}
                          disabled={isTesting}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                        >
                          {isTesting ? "Testing..." : "⚡ Test"}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(ds)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          Edit
                        </button>
                      )}
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
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Add / Edit Data Source */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSource ? "Edit Data Source" : "Add New Data Source"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Production Analytics"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional details about this data source"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Type Selector (disabled on edit) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Source Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["POSTGRESQL", "MYSQL", "CSV", "REST_API"] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      disabled={Boolean(editingSource)}
                      onClick={() => setFormType(t)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center ${
                        formType === t
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      } ${editingSource ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {t === "POSTGRESQL" && "🐘 PostgreSQL"}
                      {t === "MYSQL" && "🐬 MySQL"}
                      {t === "CSV" && "📄 CSV"}
                      {t === "REST_API" && "🌐 REST API"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type-Specific Dynamic Fields */}
              {formType === "POSTGRESQL" && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Host *
                      </label>
                      <input
                        type="text"
                        required
                        value={pgHost}
                        onChange={(e) => setPgHost(e.target.value)}
                        placeholder="localhost or ip"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Port *
                      </label>
                      <input
                        type="number"
                        required
                        value={pgPort}
                        onChange={(e) => setPgPort(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Database *
                    </label>
                    <input
                      type="text"
                      required
                      value={pgDatabase}
                      onChange={(e) => setPgDatabase(e.target.value)}
                      placeholder="database_name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        value={pgUsername}
                        onChange={(e) => setPgUsername(e.target.value)}
                        placeholder="postgres"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {editingSource ? "New Password" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={pgPassword}
                        onChange={(e) => setPgPassword(e.target.value)}
                        placeholder={editingSource ? "Leave blank to keep current" : "••••••••"}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formType === "MYSQL" && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Host *
                      </label>
                      <input
                        type="text"
                        required
                        value={mysqlHost}
                        onChange={(e) => setMysqlHost(e.target.value)}
                        placeholder="localhost or ip"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Port *
                      </label>
                      <input
                        type="number"
                        required
                        value={mysqlPort}
                        onChange={(e) => setMysqlPort(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Database *
                    </label>
                    <input
                      type="text"
                      required
                      value={mysqlDatabase}
                      onChange={(e) => setMysqlDatabase(e.target.value)}
                      placeholder="database_name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        value={mysqlUsername}
                        onChange={(e) => setMysqlUsername(e.target.value)}
                        placeholder="root"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {editingSource ? "New Password" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={mysqlPassword}
                        onChange={(e) => setMysqlPassword(e.target.value)}
                        placeholder={editingSource ? "Leave blank to keep current" : "••••••••"}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formType === "CSV" && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      CSV File Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={csvFileName}
                      onChange={(e) => setCsvFileName(e.target.value)}
                      placeholder="e.g. sales_2026.csv"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Delimiter
                    </label>
                    <input
                      type="text"
                      value={csvDelimiter}
                      onChange={(e) => setCsvDelimiter(e.target.value)}
                      placeholder=","
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {formType === "REST_API" && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Method
                      </label>
                      <select
                        value={apiMethod}
                        onChange={(e) => setApiMethod(e.target.value as "GET" | "POST")}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Endpoint URL *
                      </label>
                      <input
                        type="url"
                        required
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api.example.com/v1/metrics"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Auth Type
                      </label>
                      <select
                        value={apiAuthType}
                        onChange={(e) =>
                          setApiAuthType(e.target.value as "NONE" | "API_KEY" | "BEARER")
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="NONE">None</option>
                        <option value="API_KEY">API Key</option>
                        <option value="BEARER">Bearer Token</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {apiAuthType === "API_KEY" ? "API Key" : "Token Secret"}
                      </label>
                      <input
                        type="password"
                        disabled={apiAuthType === "NONE"}
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        placeholder={
                          apiAuthType === "NONE"
                            ? "N/A"
                            : editingSource
                              ? "Leave blank to keep"
                              : "Secret"
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pre-Save Connection Test Section */}
              <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 p-3 rounded-lg">
                <div className="text-xs">
                  {rawTestResult ? (
                    <span
                      className={`inline-flex items-center gap-1 font-semibold px-2 py-1 rounded-md ${
                        rawTestResult.success
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {rawTestResult.success ? "✓ Connection verified" : `✕ ${rawTestResult.message}`}
                    </span>
                  ) : (
                    <span className="text-gray-500">Validate credentials before saving:</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleRawTest()}
                  disabled={testingRaw}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-50 transition"
                >
                  {testingRaw ? "Testing Connection..." : "⚡ Test Connection"}
                </button>
              </div>

              {/* Form buttons */}
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
                  {submitting ? "Saving..." : editingSource ? "Save Changes" : "Create Data Source"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schema / Table Discovery & Dataset Creation */}
      {isDiscoveryOpen && discoverySource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Discover Tables: {discoverySource.name}
                </h2>
                <p className="text-xs text-gray-500">
                  {discoverySource.type === "POSTGRESQL" ? "PostgreSQL" : "MySQL"} database tables and schemas
                </p>
              </div>
              <button
                onClick={() => setIsDiscoveryOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {discoveryError && (
              <div className="my-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {discoveryError}
              </div>
            )}

            {discoverySuccess && (
              <div className="my-3 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                {discoverySuccess}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tables list */}
              <div className="border border-gray-200 rounded-lg p-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Available Tables ({discoveryTables.length})
                </h3>
                {loadingDiscoveryTables ? (
                  <p className="text-xs text-gray-500 py-4 text-center">Scanning database tables...</p>
                ) : discoveryTables.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center">No accessible tables discovered</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {discoveryTables.map((tbl) => (
                      <button
                        key={tbl.name}
                        type="button"
                        onClick={() => void handleSelectDiscoveryTable(discoverySource.id, tbl.name)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                          selectedDiscoveryTable === tbl.name
                            ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
                            : "hover:bg-gray-50 border border-transparent text-gray-700"
                        }`}
                      >
                        <span className="truncate">📋 {tbl.name}</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {tbl.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Table Columns & Dataset Creation */}
              <div className="border border-gray-200 rounded-lg p-3 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Schema: {selectedDiscoveryTable || "Select a table"}
                  </h3>
                  {loadingDiscoveryCols ? (
                    <p className="text-xs text-gray-500 py-4 text-center">Loading column schema...</p>
                  ) : discoveredTableCols.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4 text-center">Select a table on the left</p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto border-b border-gray-100 pb-3 mb-3">
                      {discoveredTableCols.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-50"
                        >
                          <span className="font-mono text-gray-800">{col.name}</span>
                          <span className="text-[11px] text-gray-500 font-semibold">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDiscoveryTable && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        New Dataset Name
                      </label>
                      <input
                        type="text"
                        value={newDatasetNameFromDiscovery}
                        onChange={(e) => setNewDatasetNameFromDiscovery(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateDatasetFromDiscovery()}
                      disabled={creatingDatasetFromTable || !selectedDiscoveryTable}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
                    >
                      {creatingDatasetFromTable ? "Creating Dataset..." : "⚡ Create RicozViz Dataset"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDiscoveryOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
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
