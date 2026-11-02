"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import { AppShell } from "../../components/shell/AppShell";
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
  apiImportSourceTable,
  type DataSourceData,
  type DataSourceType,
  type SourceTable,
  type DatasetColumn,
  ApiError,
} from "../../lib/api";
import {
  Database,
  Plus,
  RefreshCw,
  Server,
  FileSpreadsheet,
  FileCode,
  Globe,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Sparkles,
  ExternalLink,
  Table,
  Layers,
  ArrowRight,
  Search,
} from "lucide-react";

export default function DataSourcesPage() {
  const { auth, isLoading, logout, hasPermission } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [dataSources, setDataSources] = useState<DataSourceData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
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
  // SQLite fields
  const [sqlitePath, setSqlitePath] = useState("analytics.sqlite");
  // XLSX fields
  const [xlsxFileName, setXlsxFileName] = useState("report.xlsx");
  const [xlsxSheetName, setXlsxSheetName] = useState("Sheet1");
  // JSON fields
  const [jsonFileName, setJsonFileName] = useState("data.json");
  const [jsonDataPath, setJsonDataPath] = useState("records");
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

  // Role permissions
  const canCreate =
    hasPermission("DATASOURCE_CREATE") ||
    auth?.role === "ADMIN" ||
    auth?.role === "ANALYST";
  const canEdit =
    hasPermission("DATASOURCE_EDIT") ||
    auth?.role === "ADMIN" ||
    auth?.role === "ANALYST";
  const canDelete =
    hasPermission("DATASOURCE_DELETE") || auth?.role === "ADMIN";
  const canTest =
    hasPermission("DATASOURCE_TEST") ||
    auth?.role === "ADMIN" ||
    auth?.role === "ANALYST";

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  useEffect(() => {
    if (auth) {
      refreshDataSources();
    }
  }, [auth, currentWorkspace?.id]);

  function refreshDataSources() {
    setLoadingData(true);
    apiListDataSources(currentWorkspace?.id ? { workspaceId: currentWorkspace.id } : undefined)
      .then((data) => {
        setDataSources(data);
        setErrorMsg(null);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg("Failed to load data sources.");
        }
      })
      .finally(() => {
        setLoadingData(false);
      });
  }

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
    setSqlitePath("analytics.sqlite");
    setXlsxFileName("report.xlsx");
    setXlsxSheetName("Sheet1");
    setJsonFileName("data.json");
    setJsonDataPath("records");
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
      setPgPassword("");
    } else if (ds.type === "MYSQL") {
      setMysqlHost(String(conn.host || "localhost"));
      setMysqlPort(Number(conn.port || 3306));
      setMysqlDatabase(String(conn.database || ""));
      setMysqlUsername(String(conn.username || "root"));
      setMysqlPassword("");
    } else if (ds.type === "SQLITE") {
      setSqlitePath(String(conn.databasePath || conn.fileName || "analytics.sqlite"));
    } else if (ds.type === "XLSX") {
      setXlsxFileName(String(conn.fileName || "report.xlsx"));
      setXlsxSheetName(String(conn.sheetName || "Sheet1"));
    } else if (ds.type === "JSON") {
      setJsonFileName(String(conn.fileName || "data.json"));
      setJsonDataPath(String(conn.dataPath || "records"));
    } else if (ds.type === "CSV") {
      setCsvFileName(String(conn.fileName || ""));
      setCsvDelimiter(String(conn.delimiter || ","));
    } else if (ds.type === "REST_API") {
      setApiUrl(String(conn.url || ""));
      setApiMethod((conn.method as "GET" | "POST") || "GET");
      setApiAuthType((conn.authType as "NONE" | "API_KEY" | "BEARER") || "NONE");
      setApiSecret("");
    }

    setErrorMsg(null);
    setIsModalOpen(true);
  }

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
    } else if (formType === "SQLITE") {
      connection = {
        databasePath: sqlitePath.trim(),
        fileName: sqlitePath.trim(),
      };
    } else if (formType === "XLSX") {
      connection = {
        fileName: xlsxFileName.trim(),
        sheetName: xlsxSheetName.trim() || "Sheet1",
      };
    } else if (formType === "JSON") {
      connection = {
        fileName: jsonFileName.trim(),
        dataPath: jsonDataPath.trim() || "records",
      };
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
      const res = await apiTestRawConnection({ type: formType, connection });
      const isOk = res.success || res.status === "CONNECTED";
      setRawTestResult({
        success: isOk,
        message: res.message || (isOk ? "Connection verified" : "Connection failed"),
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

  async function openDiscoveryModal(ds: DataSourceData) {
    setDiscoverySource(ds);
    setIsDiscoveryOpen(true);
    setSelectedDiscoveryTable(null);
    setDiscoveredTableCols([]);
    setDiscoveryError(null);
    setDiscoverySuccess(null);
    setNewDatasetNameFromDiscovery("");
    setLoadingDiscoveryTables(true);

    try {
      const tables = await apiListSourceTables(ds.id);
      setDiscoveryTables(tables);
      if (tables.length > 0) {
        void handleSelectDiscoveryTable(ds.id, tables[0].name);
      }
    } catch (err) {
      setDiscoveryError(err instanceof ApiError ? err.message : "Failed to scan source tables");
    } finally {
      setLoadingDiscoveryTables(false);
    }
  }

  async function handleSelectDiscoveryTable(dsId: string, tableName: string) {
    setSelectedDiscoveryTable(tableName);
    setNewDatasetNameFromDiscovery(
      tableName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Dataset"
    );
    setLoadingDiscoveryCols(true);
    setDiscoveryError(null);

    try {
      const schema = await apiGetSourceTableSchema(dsId, tableName);
      setDiscoveredTableCols(schema.columns);
    } catch (err) {
      setDiscoveryError(err instanceof ApiError ? err.message : "Failed to fetch table columns");
    } finally {
      setLoadingDiscoveryCols(false);
    }
  }

  async function handleCreateDatasetFromDiscovery() {
    if (!discoverySource || !selectedDiscoveryTable) return;
    setCreatingDatasetFromTable(true);
    setDiscoveryError(null);
    setDiscoverySuccess(null);

    try {
      let ds: { id: string; name: string };
      try {
        ds = await apiImportSourceTable(discoverySource.id, {
          tableName: selectedDiscoveryTable,
          name: newDatasetNameFromDiscovery.trim() || `${selectedDiscoveryTable} Dataset`,
          workspaceId: currentWorkspace?.id,
        });
      } catch {
        ds = await apiCreateDataset({
          name: newDatasetNameFromDiscovery.trim() || `${selectedDiscoveryTable} Dataset`,
          type: "CONNECTED",
          dataSourceId: discoverySource.id,
          tableName: selectedDiscoveryTable,
          workspaceId: currentWorkspace?.id,
          columns: discoveredTableCols,
        });
      }

      setDiscoverySuccess(`Dataset "${ds.name}" imported and profiled successfully! Redirecting...`);
      setTimeout(() => {
        setIsDiscoveryOpen(false);
        router.push(`/data-quality?datasetId=${ds.id}`);
      }, 1200);
    } catch (err) {
      setDiscoveryError(err instanceof ApiError ? err.message : "Failed to import dataset from table");
    } finally {
      setCreatingDatasetFromTable(false);
    }
  }

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
    } else if (formType === "SQLITE") {
      connection = {
        databasePath: sqlitePath.trim(),
        fileName: sqlitePath.trim(),
      };
    } else if (formType === "XLSX") {
      connection = {
        fileName: xlsxFileName.trim(),
        sheetName: xlsxSheetName.trim() || "Sheet1",
      };
    } else if (formType === "JSON") {
      connection = {
        fileName: jsonFileName.trim(),
        dataPath: jsonDataPath.trim() || "records",
      };
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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete data source "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiDeleteDataSource(id);
      setDataSources((prev) => prev.filter((ds) => ds.id !== id));
      setSuccessMsg(`Data source "${name}" deleted.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to delete data source.");
      }
    }
  }

  async function handleTestConnection(id: string) {
    setTestingId(id);
    setTestResult(null);

    try {
      const res = await apiTestDataSourceConnection(id);
      const isOk = res.success || res.status === "CONNECTED";
      setTestResult({
        id,
        success: isOk,
        message: res.message || (isOk ? "Connection active" : "Connection failed"),
      });
      refreshDataSources();
    } catch (err) {
      setTestResult({
        id,
        success: false,
        message: err instanceof ApiError ? err.message : "Connection test error",
      });
    } finally {
      setTestingId(null);
    }
  }

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono-code text-[#898989]">Connecting to analytical data mesh...</p>
        </div>
      </div>
    );
  }

  const filteredSources = dataSources
    .filter((ds) => filterType === "ALL" || ds.type === filterType)
    .filter((ds) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ds.name.toLowerCase().includes(q) ||
        (ds.description && ds.description.toLowerCase().includes(q)) ||
        ds.type.toLowerCase().includes(q)
      );
    });

  const connectedCount = dataSources.filter((d) => d.status === "CONNECTED").length;
  const dbCount = dataSources.filter((d) => ["POSTGRESQL", "MYSQL", "SQLITE"].includes(d.type)).length;
  const fileCount = dataSources.filter((d) => ["CSV", "XLSX", "JSON"].includes(d.type)).length;
  const apiCount = dataSources.filter((d) => d.type === "REST_API").length;

  return (
    <AppShell
      title="Data Sources"
      subtitle="Connect PostgreSQL, MySQL, SQLite, Excel, CSV, and REST APIs to fuel real-time in-memory analytics."
      breadcrumbs={[
        { label: "Data Studio", href: "/datasets" },
        { label: "Data Sources" },
      ]}
      actions={
        canCreate ? (
          <button
            id="add-data-source-btn"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Data Source</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Alerts */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-300 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-400 hover:text-red-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4-KPI Mesh Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>TOTAL SOURCES</span>
              <Database className="h-4 w-4 text-[#ff6b35]" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{dataSources.length}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Registered connectors</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>LIVE CONNECTED</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-emerald-400">{connectedCount}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Healthy mesh latency</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>RELATIONAL ENGINES</span>
              <Server className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{dbCount}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Postgres · MySQL · SQLite</div>
          </div>

          <div className="rounded-xl border border-[#242424] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] text-xs font-mono-code mb-2">
              <span>FILE & REST APIS</span>
              <Globe className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{fileCount + apiCount}</div>
            <div className="text-[11px] text-[#898989] mt-1 font-mono-code">Parquet, CSV, Excel, HTTP</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#242424] pb-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {["ALL", "POSTGRESQL", "MYSQL", "SQLITE", "XLSX", "JSON", "CSV", "REST_API"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition whitespace-nowrap cursor-pointer ${
                  filterType === type
                    ? "bg-[#ff6b35] text-white shadow-sm font-semibold"
                    : "bg-[#141414] text-[#898989] hover:text-[#fafafa] hover:bg-[#1a1a1a] border border-[#242424]"
                }`}
              >
                {type === "ALL"
                  ? "All Types"
                  : type === "POSTGRESQL"
                    ? "PostgreSQL"
                    : type === "MYSQL"
                      ? "MySQL"
                      : type === "SQLITE"
                        ? "SQLite"
                        : type === "XLSX"
                          ? "Excel"
                          : type === "JSON"
                            ? "JSON"
                            : type.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-[#898989] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search data sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#242424] bg-[#141414] pl-9 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
            />
          </div>
        </div>

        {/* Data Source Grid / Empty State */}
        {loadingData ? (
          <div className="py-20 text-center text-xs font-mono-code text-[#898989]">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent mb-3" />
            <p>Scanning connected data sources...</p>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2e2e2e] bg-[#141414]/50 p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff6b35]/10 text-[#ff6b35] text-2xl mb-4 border border-[#ff6b35]/20">
              <Database className="h-7 w-7" />
            </div>
            <h3 className="text-base font-medium text-[#fafafa]">No data sources found</h3>
            <p className="mt-1 text-xs text-[#898989] font-mono-code max-w-md mx-auto">
              {filterType === "ALL"
                ? "Connect your PostgreSQL, MySQL, SQLite, Excel, CSV, or REST endpoint to unlock instant OLAP querying."
                : `No data sources found matching filter "${filterType}".`}
            </p>
            {canCreate && (
              <button
                onClick={openCreateModal}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Data Source</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((ds) => {
              const isTesting = testingId === ds.id;
              const result = testResult?.id === ds.id ? testResult : null;
              const isDiscoverable =
                ds.type === "POSTGRESQL" ||
                ds.type === "MYSQL" ||
                ds.type === "SQLITE" ||
                ds.type === "XLSX" ||
                ds.type === "JSON";

              return (
                <div
                  key={ds.id}
                  className="rounded-xl border border-[#242424] bg-[#141414] p-5 shadow-sm hover:border-[#ff6b35]/40 transition flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Type and Status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#181818] border border-[#2e2e2e] px-2 py-1 text-[11px] font-mono-code text-[#fafafa]">
                        {ds.type === "POSTGRESQL" && "🐘 PostgreSQL"}
                        {ds.type === "MYSQL" && "🐬 MySQL"}
                        {ds.type === "SQLITE" && "💾 SQLite"}
                        {ds.type === "XLSX" && "📊 Excel"}
                        {ds.type === "JSON" && "📦 JSON"}
                        {ds.type === "CSV" && "📄 CSV"}
                        {ds.type === "REST_API" && "🌐 REST API"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono-code font-semibold ${
                          ds.status === "CONNECTED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : ds.status === "FAILED"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {ds.status}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-[#fafafa] truncate group-hover:text-[#ff6b35] transition-colors">
                      {ds.name}
                    </h3>
                    {ds.description ? (
                      <p className="mt-1 text-xs text-[#898989] line-clamp-2">
                        {ds.description}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-[#666666] italic">No description provided</p>
                    )}

                    {/* Metadata view */}
                    <div className="mt-4 rounded-lg bg-[#181818] border border-[#262626] p-2.5 text-xs text-[#898989] font-mono-code break-all">
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
                      {ds.type === "SQLITE" && (
                        <span>
                          DB: {String(ds.connection.databasePath || ds.connection.fileName || "")}
                        </span>
                      )}
                      {ds.type === "XLSX" && (
                        <span>
                          File: {String(ds.connection.fileName || "")} ({String(ds.connection.sheetName || "Sheet1")})
                        </span>
                      )}
                      {ds.type === "JSON" && (
                        <span>
                          File: {String(ds.connection.fileName || "")} (Path: {String(ds.connection.dataPath || "records")})
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
                        className={`mt-3 rounded-lg p-2.5 text-xs font-mono-code ${
                          result.success
                            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-950/40 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {result.message}
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-5 pt-3.5 border-t border-[#242424] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isDiscoverable && (
                        <button
                          onClick={() => void openDiscoveryModal(ds)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-2.5 py-1.5 text-xs font-mono-code font-semibold text-[#ff6b35] hover:bg-[#ff6b35]/20 transition cursor-pointer"
                          title="Discover tables & create dataset"
                        >
                          <Table className="h-3 w-3" />
                          <span>Tables</span>
                        </button>
                      )}
                      {canTest && (
                        <button
                          onClick={() => void handleTestConnection(ds.id)}
                          disabled={isTesting}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#181818] px-2.5 py-1.5 text-xs font-mono-code text-[#fafafa] hover:bg-[#222222] disabled:opacity-50 transition cursor-pointer"
                        >
                          <RefreshCw className={`h-3 w-3 ${isTesting ? "animate-spin text-[#ff6b35]" : ""}`} />
                          <span>{isTesting ? "Testing..." : "Test"}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(ds)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#1f1f1f] transition cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => void handleDelete(ds.id, ds.name)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
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

      {/* Modal: Add / Edit Data Source */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-[#fafafa]">
            <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
              <div>
                <h2 className="text-lg font-bold text-[#fafafa]">
                  {editingSource ? "Edit Data Source" : "Add New Data Source"}
                </h2>
                <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                  Configure live connection credentials for in-memory analytics.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#898989] hover:text-[#fafafa] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Source Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Production Analytics Warehouse"
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional details about this data source"
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                />
              </div>

              {/* Type Selector (disabled on edit) */}
              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Live Connectors
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["POSTGRESQL", "MYSQL", "SQLITE", "XLSX", "JSON", "CSV", "REST_API"] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      disabled={Boolean(editingSource)}
                      onClick={() => setFormType(t)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-mono-code font-semibold border transition text-center cursor-pointer ${
                        formType === t
                          ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35]"
                          : "border-[#242424] bg-[#181818] text-[#898989] hover:text-[#fafafa] hover:bg-[#202020]"
                      } ${editingSource ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {t === "POSTGRESQL" && "🐘 PostgreSQL"}
                      {t === "MYSQL" && "🐬 MySQL"}
                      {t === "SQLITE" && "💾 SQLite"}
                      {t === "XLSX" && "📊 Excel"}
                      {t === "JSON" && "📦 JSON"}
                      {t === "CSV" && "📄 CSV"}
                      {t === "REST_API" && "🌐 REST API"}
                    </button>
                  ))}
                </div>

                {/* Coming Soon Warehouses & Object Stores */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono-code uppercase tracking-wider text-[#666666]">
                      Enterprise Warehouses & Lakehouses
                    </label>
                    <span className="text-[10px] font-mono-code text-[#ff6b35] bg-[#ff6b35]/10 px-2 py-0.5 rounded border border-[#ff6b35]/20">
                      Coming soon
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: "Snowflake", icon: "❄️" },
                      { name: "Google BigQuery", icon: "🔍" },
                      { name: "ClickHouse", icon: "⚡" },
                      { name: "Databricks", icon: "🧱" },
                      { name: "Amazon Redshift", icon: "🔴" },
                      { name: "Amazon S3 Parquet", icon: "🪣" },
                    ].map((w) => (
                      <div
                        key={w.name}
                        className="py-2 px-2.5 rounded-lg text-xs font-mono-code border border-[#222222] bg-[#141414]/80 text-[#666666] flex items-center justify-between opacity-60 cursor-not-allowed select-none"
                        title={`${w.name} connector is coming soon and disabled in this release`}
                      >
                        <span className="truncate">{w.icon} {w.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-[#898989] shrink-0 bg-[#1c1c1c] px-1.5 py-0.5 rounded border border-[#2e2e2e]">Soon</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Type-Specific Dynamic Fields */}
              {formType === "POSTGRESQL" && (
                <div className="space-y-3 pt-3 border-t border-[#242424]">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Host *
                      </label>
                      <input
                        type="text"
                        required
                        value={pgHost}
                        onChange={(e) => setPgHost(e.target.value)}
                        placeholder="localhost or ip"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Port *
                      </label>
                      <input
                        type="number"
                        required
                        value={pgPort}
                        onChange={(e) => setPgPort(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-[#898989] mb-1">
                      Database *
                    </label>
                    <input
                      type="text"
                      required
                      value={pgDatabase}
                      onChange={(e) => setPgDatabase(e.target.value)}
                      placeholder="database_name"
                      className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        value={pgUsername}
                        onChange={(e) => setPgUsername(e.target.value)}
                        placeholder="postgres"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        {editingSource ? "New Password" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={pgPassword}
                        onChange={(e) => setPgPassword(e.target.value)}
                        placeholder={editingSource ? "Leave blank to keep current" : "••••••••"}
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formType === "MYSQL" && (
                <div className="space-y-3 pt-3 border-t border-[#242424]">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Host *
                      </label>
                      <input
                        type="text"
                        required
                        value={mysqlHost}
                        onChange={(e) => setMysqlHost(e.target.value)}
                        placeholder="localhost or ip"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Port *
                      </label>
                      <input
                        type="number"
                        required
                        value={mysqlPort}
                        onChange={(e) => setMysqlPort(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono-code text-[#898989] mb-1">
                      Database *
                    </label>
                    <input
                      type="text"
                      required
                      value={mysqlDatabase}
                      onChange={(e) => setMysqlDatabase(e.target.value)}
                      placeholder="database_name"
                      className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        value={mysqlUsername}
                        onChange={(e) => setMysqlUsername(e.target.value)}
                        placeholder="root"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        {editingSource ? "New Password" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={mysqlPassword}
                        onChange={(e) => setMysqlPassword(e.target.value)}
                        placeholder={editingSource ? "Leave blank to keep current" : "••••••••"}
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formType === "SQLITE" && (
                <div className="space-y-3 pt-3 border-t border-[#242424]">
                  <div>
                    <label className="block text-xs font-mono-code text-[#898989] mb-1">
                      Database Path *
                    </label>
                    <input
                      type="text"
                      required
                      value={sqlitePath}
                      onChange={(e) => setSqlitePath(e.target.value)}
                      placeholder="analytics.sqlite"
                      className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                    />
                  </div>
                </div>
              )}

              {formType === "XLSX" && (
                <div className="space-y-3 pt-3 border-t border-[#242424]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        File Name / Path *
                      </label>
                      <input
                        type="text"
                        required
                        value={xlsxFileName}
                        onChange={(e) => setXlsxFileName(e.target.value)}
                        placeholder="report.xlsx"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Sheet Name
                      </label>
                      <input
                        type="text"
                        value={xlsxSheetName}
                        onChange={(e) => setXlsxSheetName(e.target.value)}
                        placeholder="Sheet1"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formType === "JSON" && (
                <div className="space-y-3 pt-3 border-t border-[#242424]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        File Name / Path *
                      </label>
                      <input
                        type="text"
                        required
                        value={jsonFileName}
                        onChange={(e) => setJsonFileName(e.target.value)}
                        placeholder="data.json"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        JSON Data Key Path
                      </label>
                      <input
                        type="text"
                        value={jsonDataPath}
                        onChange={(e) => setJsonDataPath(e.target.value)}
                        placeholder="records"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formType === "CSV" && (
                <div className="space-y-3 pt-3 border-t border-[#242424]">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        File Name / Path *
                      </label>
                      <input
                        type="text"
                        required
                        value={csvFileName}
                        onChange={(e) => setCsvFileName(e.target.value)}
                        placeholder="data.csv"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Delimiter
                      </label>
                      <input
                        type="text"
                        value={csvDelimiter}
                        onChange={(e) => setCsvDelimiter(e.target.value)}
                        placeholder=","
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formType === "REST_API" && (
                <div className="space-y-3 pt-3 border-t border-[#242424]">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Method
                      </label>
                      <select
                        value={apiMethod}
                        onChange={(e) => setApiMethod(e.target.value as "GET" | "POST")}
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-2 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Endpoint URL *
                      </label>
                      <input
                        type="url"
                        required
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api.example.com/v1/telemetry"
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        Auth Type
                      </label>
                      <select
                        value={apiAuthType}
                        onChange={(e) =>
                          setApiAuthType(e.target.value as "NONE" | "API_KEY" | "BEARER")
                        }
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-2 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      >
                        <option value="NONE">None</option>
                        <option value="API_KEY">API Key</option>
                        <option value="BEARER">Bearer Token</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono-code text-[#898989] mb-1">
                        {apiAuthType === "API_KEY" ? "API Key Secret" : "Token Secret"}
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
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pre-Save Connection Test Section */}
              <div className="pt-3 border-t border-[#242424] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#181818] border border-[#262626] p-3 rounded-xl">
                <div className="text-xs font-mono-code">
                  {rawTestResult ? (
                    <span
                      className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
                        rawTestResult.success
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-950/60 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {rawTestResult.success ? "✓ Connection verified" : `✕ ${rawTestResult.message}`}
                    </span>
                  ) : (
                    <span className="text-[#898989]">Validate credentials before saving:</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleRawTest()}
                  disabled={testingRaw}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-3 py-1.5 text-xs font-mono-code font-semibold text-[#ff6b35] hover:bg-[#ff6b35]/20 disabled:opacity-50 transition cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${testingRaw ? "animate-spin" : ""}`} />
                  <span>{testingRaw ? "Testing..." : "Test Connection"}</span>
                </button>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#242424]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-2 text-xs font-mono-code font-medium text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] disabled:opacity-50 cursor-pointer transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] flex flex-col text-[#fafafa]">
            <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
              <div>
                <h2 className="text-lg font-bold text-[#fafafa] flex items-center gap-2">
                  <Table className="h-5 w-5 text-[#ff6b35]" />
                  <span>Discover Tables: {discoverySource.name}</span>
                </h2>
                <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                  Scan and materialize relational tables into zero-latency DuckDB datasets.
                </p>
              </div>
              <button
                onClick={() => setIsDiscoveryOpen(false)}
                className="text-[#898989] hover:text-[#fafafa] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {discoveryError && (
              <div className="my-3 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs font-mono-code text-red-300">
                {discoveryError}
              </div>
            )}

            {discoverySuccess && (
              <div className="my-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs font-mono-code text-emerald-300">
                {discoverySuccess}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tables list */}
              <div className="border border-[#262626] bg-[#181818] rounded-xl p-3.5">
                <h3 className="text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-3 flex items-center justify-between">
                  <span>Available Tables ({discoveryTables.length})</span>
                  <Database className="h-3.5 w-3.5 text-[#ff6b35]" />
                </h3>
                {loadingDiscoveryTables ? (
                  <p className="text-xs text-[#898989] font-mono-code py-8 text-center">Scanning database catalogs...</p>
                ) : discoveryTables.length === 0 ? (
                  <p className="text-xs text-[#898989] font-mono-code py-8 text-center">No accessible tables discovered</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {discoveryTables.map((tbl) => (
                      <button
                        key={tbl.name}
                        type="button"
                        onClick={() => void handleSelectDiscoveryTable(discoverySource.id, tbl.name)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono-code flex items-center justify-between transition cursor-pointer ${
                          selectedDiscoveryTable === tbl.name
                            ? "bg-[#ff6b35]/15 border border-[#ff6b35]/40 text-[#ff6b35] font-bold"
                            : "hover:bg-[#202020] border border-transparent text-[#fafafa]"
                        }`}
                      >
                        <span className="truncate">📋 {tbl.name}</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#121212] border border-[#2a2a2a] text-[#898989]">
                          {tbl.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Table Columns & Dataset Creation */}
              <div className="border border-[#262626] bg-[#181818] rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-3">
                    Schema: {selectedDiscoveryTable || "Select a table"}
                  </h3>
                  {loadingDiscoveryCols ? (
                    <p className="text-xs text-[#898989] font-mono-code py-8 text-center">Loading column schema...</p>
                  ) : discoveredTableCols.length === 0 ? (
                    <p className="text-xs text-[#898989] font-mono-code py-8 text-center">Select a table on the left</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto border-b border-[#242424] pb-3 mb-3 pr-1">
                      {discoveredTableCols.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-[#141414] border border-[#242424]"
                        >
                          <span className="font-mono-code text-[#fafafa]">{col.name}</span>
                          <span className="text-[10px] font-mono-code text-[#ff6b35] font-semibold">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDiscoveryTable && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1">
                        New Dataset Name
                      </label>
                      <input
                        type="text"
                        value={newDatasetNameFromDiscovery}
                        onChange={(e) => setNewDatasetNameFromDiscovery(e.target.value)}
                        className="w-full rounded-lg border border-[#2e2e2e] bg-[#141414] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateDatasetFromDiscovery()}
                      disabled={creatingDatasetFromTable || !selectedDiscoveryTable}
                      className="w-full rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{creatingDatasetFromTable ? "Creating Dataset..." : "Materialize In-Memory Dataset"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#242424] flex justify-end">
              <button
                type="button"
                onClick={() => setIsDiscoveryOpen(false)}
                className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-1.5 text-xs font-mono-code font-medium text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] cursor-pointer"
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
