"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { AppShell } from "@/components/shell/AppShell";
import {
  Database,
  Plus,
  Search,
  Sparkles,
  RefreshCw,
  Shield,
  Layers,
  FileSpreadsheet,
  Eye,
  Trash2,
  ArrowRight,
  X,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
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
  apiListDatasetRlsRules,
  apiCreateRlsRule,
  apiUpdateRlsRule,
  apiDeleteRlsRule,
  type RowLevelSecurityRule,
  type RlsOperator,
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

  // RLS (Row-Level Security) Modal state
  const [isRlsModalOpen, setIsRlsModalOpen] = useState(false);
  const [rlsDataset, setRlsDataset] = useState<DatasetData | null>(null);
  const [rlsRules, setRlsRules] = useState<RowLevelSecurityRule[]>([]);
  const [loadingRlsRules, setLoadingRlsRules] = useState(false);
  const [savingRlsRule, setSavingRlsRule] = useState(false);
  const [rlsFormName, setRlsFormName] = useState("");
  const [rlsFormCol, setRlsFormCol] = useState("");
  const [rlsFormOp, setRlsFormOp] = useState<RlsOperator>("EQUALS");
  const [rlsFormVal, setRlsFormVal] = useState("");
  const [rlsFormRole, setRlsFormRole] = useState("ALL");
  const [rlsFormUserEmail, setRlsFormUserEmail] = useState("");
  const [rlsFormDescription, setRlsFormDescription] = useState("");
  const [rlsError, setRlsError] = useState<string | null>(null);

  const openRlsModal = async (ds: DatasetData) => {
    setRlsDataset(ds);
    setIsRlsModalOpen(true);
    setRlsError(null);
    setRlsFormName("");
    setRlsFormCol(ds.columns?.[0]?.name || "");
    setRlsFormOp("EQUALS");
    setRlsFormVal("");
    setRlsFormRole("ALL");
    setRlsFormUserEmail("");
    setRlsFormDescription("");
    setLoadingRlsRules(true);
    try {
      const rules = await apiListDatasetRlsRules(ds.id);
      setRlsRules(rules);
    } catch (err) {
      setRlsError(err instanceof ApiError ? err.message : "Failed to load RLS rules");
    } finally {
      setLoadingRlsRules(false);
    }
  };

  const handleCreateRlsRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!rlsDataset || !rlsFormName.trim() || !rlsFormCol || !rlsFormVal.trim()) {
      setRlsError("Please enter rule name, column, and rule value");
      return;
    }
    setSavingRlsRule(true);
    setRlsError(null);
    try {
      let parsedVal: unknown = rlsFormVal.trim();
      if (rlsFormOp === "IN" || rlsFormOp === "NOT_IN") {
        parsedVal = rlsFormVal.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (!isNaN(Number(parsedVal)) && parsedVal !== "") {
        parsedVal = Number(parsedVal);
      }

      await apiCreateRlsRule(rlsDataset.id, {
        name: rlsFormName.trim(),
        description: rlsFormDescription.trim() || undefined,
        columnName: rlsFormCol,
        operator: rlsFormOp,
        ruleValue: parsedVal,
        roleName: rlsFormRole !== "ALL" ? rlsFormRole : undefined,
        userId: rlsFormUserEmail.trim() || undefined,
        isEnabled: true,
      });

      setSuccessMsg(`Created RLS rule "${rlsFormName.trim()}".`);
      setRlsFormName("");
      setRlsFormVal("");
      setRlsFormDescription("");
      const rules = await apiListDatasetRlsRules(rlsDataset.id);
      setRlsRules(rules);
    } catch (err) {
      setRlsError(err instanceof ApiError ? err.message : "Failed to create RLS rule");
    } finally {
      setSavingRlsRule(false);
    }
  };

  const handleToggleRlsRule = async (rule: RowLevelSecurityRule) => {
    if (!rlsDataset) return;
    try {
      await apiUpdateRlsRule(rlsDataset.id, rule.id, { isEnabled: !rule.isEnabled });
      const rules = await apiListDatasetRlsRules(rlsDataset.id);
      setRlsRules(rules);
    } catch (err) {
      setRlsError(err instanceof ApiError ? err.message : "Failed to update RLS rule");
    }
  };

  const handleDeleteRlsRule = async (ruleId: string) => {
    if (!rlsDataset) return;
    try {
      await apiDeleteRlsRule(rlsDataset.id, ruleId);
      setRlsRules((prev) => prev.filter((r) => r.id !== ruleId));
      setSuccessMsg("RLS rule deleted successfully.");
    } catch (err) {
      setRlsError(err instanceof ApiError ? err.message : "Failed to delete RLS rule");
    }
  };

  // Permissions
  const canCreate = hasPermission("DATASET_CREATE");
  const canEdit = hasPermission("DATASET_EDIT");
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
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono text-[#898989]">Loading datasets...</p>
        </div>
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

  const totalDatasets = datasets.length;
  const totalRows = datasets.reduce((acc, d) => acc + (d.rowCount || 0), 0);
  const connectedCount = datasets.filter((d) => d.type === "CONNECTED").length;
  const derivedCount = datasets.filter((d) => d.type === "DERIVED").length;

  return (
    <AppShell>
      <div className="flex-1 space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Alerts */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-mono text-rose-300 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-white p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-mono text-emerald-300 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-400 hover:text-white p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 4-KPI Metric Ribbon */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] mb-1">
              <span className="text-[11px] font-mono-code uppercase tracking-wider">Total Datasets</span>
              <Database className="h-4 w-4 text-[#ff6b35]" />
            </div>
            <div className="text-2xl font-semibold font-mono text-[#fafafa]">{totalDatasets}</div>
            <div className="text-[11px] text-[#666666] mt-0.5">Active in workspace</div>
          </div>
          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] mb-1">
              <span className="text-[11px] font-mono-code uppercase tracking-wider">Total Records</span>
              <TableIcon className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-semibold font-mono text-emerald-400">{totalRows.toLocaleString()}</div>
            <div className="text-[11px] text-[#666666] mt-0.5">Tabular data ingested</div>
          </div>
          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] mb-1">
              <span className="text-[11px] font-mono-code uppercase tracking-wider">Connected DBs</span>
              <RefreshCw className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-semibold font-mono text-[#fafafa]">{connectedCount}</div>
            <div className="text-[11px] text-[#666666] mt-0.5">Live database tables</div>
          </div>
          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4">
            <div className="flex items-center justify-between text-[#898989] mb-1">
              <span className="text-[11px] font-mono-code uppercase tracking-wider">Blended & Derived</span>
              <Layers className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-semibold font-mono text-purple-400">{derivedCount}</div>
            <div className="text-[11px] text-[#666666] mt-0.5">Virtual blended tables</div>
          </div>
        </div>

        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-normal tracking-[-0.02em] text-[#fafafa]">Datasets</h1>
            <p className="text-xs text-[#898989] mt-1 font-sans">
              Curate, preview, blend, and govern tabular datasets ready for exploration.
            </p>
          </div>

          {canCreate && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <Link
                href="/datasets/demo"
                id="explore-demo-datasets-btn"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-1.5 text-xs font-medium text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Demo Datasets</span>
              </Link>
              <button
                id="blend-datasets-btn"
                type="button"
                onClick={openBlendModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-1.5 text-xs font-medium text-[#dedede] hover:border-[#ff6b35]/40 hover:text-[#ff6b35] transition-colors cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5 text-[#ff6b35]" />
                <span>Blend Datasets</span>
              </button>
              <button
                id="add-dataset-btn"
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Dataset</span>
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {["ALL", "CSV", "XLSX", "JSON", "CONNECTED", "DERIVED"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
                  filterType === t
                    ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35] font-semibold"
                    : "border-[#262626] bg-[#141414] text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
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

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#666666]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search datasets..."
              className="w-full rounded-full border border-[#262626] bg-[#141414] pl-9 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Datasets Grid / Empty State */}
        {loadingData ? (
          <div className="py-20 text-center text-xs text-[#898989]">
            <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-[#ff6b35] border-t-transparent mb-3" />
            <p className="font-mono">Loading workspace datasets...</p>
          </div>
        ) : filteredDatasets.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#262626] bg-[#141414] p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1c1c1c] text-[#ff6b35] text-2xl mb-4 border border-[#262626]">
              <Database className="h-6 w-6 text-[#ff6b35]" />
            </div>
            {searchTerm || filterType !== "ALL" ? (
              <>
                <h3 className="text-base font-medium text-[#fafafa]">No matching datasets found</h3>
                <p className="mt-1 text-xs text-[#898989]">
                  No datasets match your active search term &quot;{searchTerm}&quot; or filter.
                </p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterType("ALL");
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#262626] bg-[#1a1a1a] px-3.5 py-1.5 text-xs font-medium text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] transition-colors"
                >
                  Clear Search & Filters
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-medium text-[#fafafa]">No datasets configured yet</h3>
                <p className="mt-1 text-xs text-[#898989] max-w-md mx-auto">
                  Connect PostgreSQL, MySQL, ClickHouse or upload CSV/XLSX spreadsheets to start building analytics.
                </p>
                {canCreate && (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-2 rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-2 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Dataset</span>
                    </button>
                    <Link
                      href="/datasets/demo"
                      className="inline-flex items-center gap-2 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-4 py-2 text-xs font-medium text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Explore Demo Datasets</span>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDatasets.map((ds) => (
              <div
                key={ds.id}
                className="group rounded-[16px] border border-[#262626] bg-[#141414] p-5 hover:border-[#3d3d3d] transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#333333] bg-[#1a1a1a] px-2 py-0.5 text-[10px] font-mono-code font-semibold text-[#dedede]">
                      {ds.type === "CONNECTED"
                        ? "🔌 Connected"
                        : ds.sourceType === "XLSX"
                        ? "📊 XLSX"
                        : ds.sourceType === "JSON"
                        ? "📦 JSON"
                        : "📄 CSV"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono-code font-semibold border ${
                        ds.status === "READY"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : ds.status === "FAILED" || ds.status === "ERROR"
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                          : "border-sky-500/30 bg-sky-500/10 text-sky-400"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      {ds.status}
                    </span>
                  </div>

                  <Link
                    href={`/datasets/${ds.id}`}
                    className="text-base font-medium text-[#fafafa] group-hover:text-[#ff6b35] transition-colors truncate block"
                  >
                    {ds.name}
                  </Link>

                  <p className="mt-1 text-xs text-[#898989] line-clamp-2 min-h-[32px] leading-relaxed">
                    {ds.description || "Tabular schema registered for reporting and exploratory analytics."}
                  </p>

                  <div className="mt-4 rounded-xl bg-[#181818] border border-[#222222] p-3 text-[11px] font-mono-code text-[#898989] space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[#666666]">Source:</span>
                      <span className="text-[#dedede] font-medium truncate max-w-[140px]">
                        {ds.dataSourceName || ds.fileName || (ds.sourceType ? `${ds.sourceType} File` : "Uploaded File")}
                      </span>
                    </div>
                    {ds.fileName && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">File:</span>
                        <span className="text-[#fafafa] truncate max-w-[140px]" title={ds.fileName}>
                          {ds.fileName}
                        </span>
                      </div>
                    )}
                    {ds.tableName && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">Table:</span>
                        <span className="text-[#ff6b35] truncate max-w-[140px]">
                          {ds.tableName}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[#666666]">Rows:</span>
                      <span className="text-emerald-400 font-semibold">
                        {ds.rowCount.toLocaleString()} rows
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#666666]">Columns:</span>
                      <span className="text-[#fafafa]">
                        {ds.columnCount || ds.columns.length} columns
                      </span>
                    </div>
                    {ds.fileSize && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">Size:</span>
                        <span className="text-[#dedede]">
                          {(ds.fileSize / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[#666666]">Updated:</span>
                      <span className="text-[#898989]">
                        {ds.updatedAt ? new Date(ds.updatedAt).toLocaleDateString() : "Recently"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[#222222] flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => void openQuickPreview(ds)}
                      className="rounded-md border border-[#262626] bg-[#1a1a1a] px-2.5 py-1 text-[11px] font-mono-code text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3 w-3 text-[#ff6b35]" />
                      <span>Preview</span>
                    </button>
                    <Link
                      href={`/datasets/${ds.id}`}
                      className="rounded-md border border-[#ff6b35]/40 bg-[#ff6b35]/10 px-2.5 py-1 text-[11px] font-medium text-[#ff6b35] hover:bg-[#ff6b35]/20 flex items-center gap-1 transition-colors"
                    >
                      <span>Details</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={() => void openRefreshModal(ds)}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Schedule automated data refresh"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => void openRlsModal(ds)}
                      className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[11px] font-medium text-purple-400 hover:bg-purple-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Manage Row-Level Security (RLS) rules"
                    >
                      <Shield className="h-3 w-3" />
                      <span>RLS</span>
                    </button>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => void handleDelete(ds.id, ds.name)}
                      className="rounded-md border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                      title="Delete dataset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Dataset */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl rounded-[20px] border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-[#fafafa]">
              <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
                <h2 className="text-base font-medium text-[#fafafa]">Create Dataset</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1 text-[#898989] hover:text-[#fafafa] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitCreate} className="mt-4 space-y-4">
                {/* Mode switch */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreationMode("FILE")}
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                      creationMode === "FILE"
                        ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35]"
                        : "border-[#262626] bg-[#1a1a1a] text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                    }`}
                  >
                    📁 Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMode("DATASOURCE")}
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                      creationMode === "DATASOURCE"
                        ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35]"
                        : "border-[#262626] bg-[#1a1a1a] text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                    }`}
                  >
                    🔌 Data Source
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMode("CSV")}
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                      creationMode === "CSV"
                        ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35]"
                        : "border-[#262626] bg-[#1a1a1a] text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                    }`}
                  >
                    📝 Paste CSV
                  </button>
                </div>

                {/* Mode: File Upload (CSV / XLSX / JSON) */}
                {creationMode === "FILE" && (
                  <div className="space-y-3 pt-2">
                    <div className="rounded-xl bg-[#ff6b35]/10 border border-[#ff6b35]/20 p-3 text-xs text-[#fafafa] space-y-1 font-sans">
                      <p className="font-semibold text-[#ff6b35] flex items-center gap-1.5">
                        <span>ℹ️</span> Supported Formats: CSV, XLSX, JSON
                      </p>
                      <p className="text-[#898989] text-[11px] leading-relaxed">
                        Upload files up to 15MB. RicozViz parses tabular records, extracts column headers, infers data types, and saves the dataset into your active workspace.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#898989] mb-1">
                        Choose File (.csv, .xlsx, or .json) *
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-[#181818] border-[#2e2e2e] hover:border-[#ff6b35]/50 hover:bg-[#1a1a1a] transition">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                            <svg className="w-8 h-8 mb-2 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {selectedFile ? (
                              <div>
                                <p className="text-xs font-bold text-[#ff6b35]">{selectedFile.name}</p>
                                <p className="text-[11px] text-[#898989]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs font-medium text-[#dedede]">Click or drag & drop to choose file</p>
                                <p className="text-[11px] text-[#666666]">CSV, XLSX, or JSON (max 15MB)</p>
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
                      <label className="block text-xs font-medium text-[#898989] mb-1">
                        Select Data Source *
                      </label>
                      <select
                        value={selectedSourceId}
                        onChange={(e) => handleSelectDataSource(e.target.value)}
                        className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      >
                        {dataSources.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.name} ({ds.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#898989] mb-1">
                        Select Table / View *
                      </label>
                      {loadingTables ? (
                        <p className="text-xs text-[#898989] font-mono">Discovering tables...</p>
                      ) : (
                        <select
                          value={selectedTable}
                          onChange={(e) =>
                            handleSelectTable(selectedSourceId, e.target.value)
                          }
                          className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-xs font-mono text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
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
                      <div className="rounded-xl bg-[#181818] border border-[#262626] p-3">
                        <p className="text-xs font-medium text-[#fafafa] mb-2 font-mono">
                          Discovered Schema ({discoveredCols.length} columns)
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {discoveredCols.map((c) => (
                            <span
                              key={c.name}
                              className="rounded-md bg-[#141414] border border-[#262626] px-2 py-0.5 text-xs text-[#dedede]"
                            >
                              <span className="font-mono">{c.name}</span>:{" "}
                              <span className="text-[#ff6b35] text-[10px]">{c.type}</span>
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
                      <label className="block text-xs font-medium text-[#898989] mb-1">
                        Paste CSV Content *
                      </label>
                      <textarea
                        rows={5}
                        required
                        value={csvInput}
                        onChange={(e) => setCsvInput(e.target.value)}
                        placeholder={`customer_id,name,revenue,is_active\n1,"Acme Corp",15000.50,true\n2,"Globex",8500.00,false`}
                        className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-xs font-mono text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleParseCsv}
                      disabled={previewingCsv || !csvInput.trim()}
                      className="rounded-full border border-[#262626] bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] cursor-pointer"
                    >
                      {previewingCsv ? "Parsing..." : "🔍 Inspect CSV & Infer Schema"}
                    </button>

                    {csvInferredCols.length > 0 && (
                      <div className="rounded-xl bg-[#181818] border border-[#262626] p-3">
                        <p className="text-xs font-medium text-[#fafafa] mb-2 font-mono">
                          Inferred Schema ({csvInferredCols.length} columns)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {csvInferredCols.map((c) => (
                            <span
                              key={c.name}
                              className="rounded-md bg-[#141414] border border-[#262626] px-2 py-0.5 text-xs text-[#dedede]"
                            >
                              <span className="font-mono">{c.name}</span>:{" "}
                              <span className="text-[#ff6b35] text-[10px]">{c.type}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Common Details */}
                <div>
                  <label className="block text-xs font-medium text-[#898989] mb-1">
                    Dataset Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Monthly Revenue"
                    className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#898989] mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional context about this dataset"
                    className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#242424]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-full border border-[#2e2e2e] bg-[#1c1c1c] px-4 py-2 text-xs font-medium text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-2 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{creationMode === "FILE" ? "Uploading..." : "Creating..."}</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl rounded-[20px] border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] flex flex-col text-[#fafafa]">
              <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
                <div>
                  <h2 className="text-base font-medium text-[#fafafa]">
                    Preview: {previewingDataset.name}
                  </h2>
                  <p className="text-xs text-[#898989] font-mono">
                    Showing up to 25 sample rows
                  </p>
                </div>
                <button
                  onClick={() => setPreviewingDataset(null)}
                  className="rounded-full p-1 text-[#898989] hover:text-[#fafafa] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto my-4 border border-[#262626] rounded-xl bg-[#141414]">
                {loadingPreview ? (
                  <div className="p-8 text-center text-xs font-mono text-[#898989]">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#ff6b35] border-t-transparent mb-2" />
                    <p>Loading preview data...</p>
                  </div>
                ) : previewRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#898989] font-mono">
                    No sample rows available.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-[#262626] text-xs font-mono-code">
                    <thead className="bg-[#1a1a1a]">
                      <tr>
                        {previewCols.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left text-[11px] font-semibold text-[#fafafa] uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222] bg-[#141414]">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#1a1a1a] transition-colors">
                          {previewCols.map((col) => (
                            <td
                              key={col}
                              className="px-3 py-2 text-[#b4b4b4] whitespace-nowrap"
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

              <div className="flex justify-end pt-2 border-t border-[#242424]">
                <button
                  onClick={() => setPreviewingDataset(null)}
                  className="rounded-full border border-[#2e2e2e] bg-[#1c1c1c] px-4 py-1.5 text-xs font-medium text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Modal: Data Blending */}
      {isBlendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-[20px] border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] flex flex-col text-[#fafafa]">
            <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff6b35]/15 text-[#ff6b35] font-bold text-sm border border-[#ff6b35]/30">
                  ⚡
                </span>
                <div>
                  <h2 className="text-base font-medium text-[#fafafa]">
                    Blend Two Datasets
                  </h2>
                  <p className="text-xs text-[#898989]">
                    Join datasets by a common field using INNER or LEFT JOIN.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBlendModalOpen(false)}
                className="rounded-full p-1 text-[#898989] hover:text-[#fafafa] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 space-y-5 pr-1 font-sans">
              {blendError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex justify-between items-center font-mono">
                  <span>{blendError}</span>
                  <button
                    type="button"
                    onClick={() => setBlendError(null)}
                    className="text-rose-400 hover:text-white font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Dataset Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dataset A */}
                <div className="rounded-xl border border-[#262626] bg-[#181818] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#fafafa]">Primary Dataset (A)</span>
                    <span className="text-[10px] font-mono-code bg-[#ff6b35]/15 text-[#ff6b35] px-2 py-0.5 rounded border border-[#ff6b35]/30">Left Table</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#898989] mb-1">Select Dataset</label>
                    <select
                      value={blendDatasetAId}
                      onChange={(e) => handleSelectDatasetA(e.target.value)}
                      className="w-full rounded-lg border border-[#262626] bg-[#141414] px-2.5 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
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
                    <label className="block text-[11px] font-medium text-[#898989] mb-1">Common Join Key (Column A)</label>
                    <select
                      value={blendJoinColA}
                      onChange={(e) => {
                        setBlendJoinColA(e.target.value);
                        setBlendPreviewResult(null);
                      }}
                      disabled={!blendDatasetAId}
                      className="w-full rounded-lg border border-[#262626] bg-[#141414] px-2.5 py-1.5 text-xs font-mono text-[#fafafa] focus:border-[#ff6b35] focus:outline-none disabled:opacity-40"
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
                <div className="rounded-xl border border-[#262626] bg-[#181818] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#fafafa]">Secondary Dataset (B)</span>
                    <span className="text-[10px] font-mono-code bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">Right Table</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#898989] mb-1">Select Dataset</label>
                    <select
                      value={blendDatasetBId}
                      onChange={(e) => handleSelectDatasetB(e.target.value)}
                      className="w-full rounded-lg border border-[#262626] bg-[#141414] px-2.5 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
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
                    <label className="block text-[11px] font-medium text-[#898989] mb-1">Common Join Key (Column B)</label>
                    <select
                      value={blendJoinColB}
                      onChange={(e) => {
                        setBlendJoinColB(e.target.value);
                        setBlendPreviewResult(null);
                      }}
                      disabled={!blendDatasetBId}
                      className="w-full rounded-lg border border-[#262626] bg-[#141414] px-2.5 py-1.5 text-xs font-mono text-[#fafafa] focus:border-[#ff6b35] focus:outline-none disabled:opacity-40"
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
                <label className="block text-xs font-medium text-[#898989] mb-2">Join Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBlendJoinType("INNER");
                      setBlendPreviewResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      blendJoinType === "INNER"
                        ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#fafafa]"
                        : "border-[#262626] bg-[#181818] text-[#898989] hover:border-[#393939] hover:text-[#dedede]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono">INNER JOIN</span>
                      <span className="text-[10px] text-[#ff6b35] font-semibold">Intersection</span>
                    </div>
                    <p className="text-[11px] text-[#898989] mt-1">
                      Includes only records with matching join values in both Dataset A and Dataset B.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBlendJoinType("LEFT");
                      setBlendPreviewResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      blendJoinType === "LEFT"
                        ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#fafafa]"
                        : "border-[#262626] bg-[#181818] text-[#898989] hover:border-[#393939] hover:text-[#dedede]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono">LEFT JOIN</span>
                      <span className="text-[10px] text-purple-400 font-semibold">All from A</span>
                    </div>
                    <p className="text-[11px] text-[#898989] mt-1">
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
                  className="inline-flex items-center gap-2 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-4 py-2 text-xs font-medium text-[#dedede] hover:border-[#ff6b35]/50 hover:text-[#ff6b35] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {previewingBlend ? (
                    <>
                      <span className="h-3.5 w-3.5 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
                      <span>Computing Live Blend...</span>
                    </>
                  ) : (
                    <span>🔍 Preview Blended Data</span>
                  )}
                </button>

                {blendPreviewResult && (
                  <span className="text-xs text-emerald-400 font-mono-code font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    ✓ {blendPreviewResult.rowCount} total rows ({blendPreviewResult.resultingColumns.length} columns)
                  </span>
                )}
              </div>

              {/* Preview Results Table & Metadata */}
              {blendPreviewResult && (
                <div className="space-y-3 pt-2 border-t border-[#242424]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#898989] font-medium mr-1">Resulting Columns:</span>
                    {blendPreviewResult.resultingColumns.map((c) => (
                      <span
                        key={c.name}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-code border ${
                          c.origin === "A"
                            ? "bg-[#ff6b35]/15 text-[#ff6b35] border-[#ff6b35]/30"
                            : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-[9px] opacity-60 uppercase">({c.type})</span>
                      </span>
                    ))}
                  </div>

                  <div className="border border-[#262626] rounded-xl overflow-auto max-h-52 bg-[#141414] text-xs font-mono-code">
                    <table className="min-w-full divide-y divide-[#262626]">
                      <thead className="bg-[#1a1a1a] sticky top-0">
                        <tr>
                          {blendPreviewResult.resultingColumns.map((col) => (
                            <th
                              key={col.name}
                              className="px-3 py-1.5 text-left font-semibold text-[#fafafa] whitespace-nowrap"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222]">
                        {blendPreviewResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-[#1a1a1a]">
                            {blendPreviewResult.resultingColumns.map((col) => (
                              <td
                                key={col.name}
                                className="px-3 py-1.5 text-[#dedede] whitespace-nowrap"
                              >
                                {row[col.name] !== undefined && row[col.name] !== null
                                  ? String(row[col.name])
                                  : <span className="text-[#666666] italic">null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Save form */}
                  <div className="space-y-3 pt-3 border-t border-[#242424]">
                    <div>
                      <label className="block text-xs font-medium text-[#898989] mb-1">
                        Blended Dataset Name <span className="text-[#ff6b35]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={blendName}
                        onChange={(e) => setBlendName(e.target.value)}
                        placeholder="e.g. Sales & Customers Unified"
                        className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#898989] mb-1">Description (Optional)</label>
                      <input
                        type="text"
                        value={blendDescription}
                        onChange={(e) => setBlendDescription(e.target.value)}
                        placeholder="e.g. Combined sales orders with customer demographic data"
                        className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242424]">
              <button
                type="button"
                onClick={() => setIsBlendModalOpen(false)}
                className="rounded-full border border-[#2e2e2e] bg-[#1c1c1c] px-4 py-1.5 text-xs font-medium text-[#dedede] hover:border-[#393939] hover:text-[#fafafa] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBlend}
                disabled={savingBlend || !blendPreviewResult || !blendName.trim()}
                className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingBlend ? "Saving Blend..." : "Save Blended Dataset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Scheduled Data Refresh */}
      {isRefreshModalOpen && refreshDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
              <div>
                <h2 className="text-base font-semibold text-[#fafafa] flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-[#ff6b35]" />
                  <span>Scheduled Data Refresh</span>
                </h2>
                <p className="text-xs text-[#898989] mt-0.5">
                  Automate re-ingestion and query updates for <span className="font-semibold text-[#fafafa]">{refreshDataset.name}</span>
                </p>
              </div>
              <button
                onClick={() => setIsRefreshModalOpen(false)}
                className="text-[#898989] hover:text-[#fafafa] rounded-lg p-1.5 hover:bg-[#1f1f1f] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingSchedule ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#898989]">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
                <span className="text-xs font-mono-code">Loading refresh schedule...</span>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Status Card */}
                <div className="rounded-xl border border-[#262626] bg-[#181818] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#898989] font-medium">Current Status:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[11px] font-mono-code ${
                        refreshSchedule?.lastStatus === "SUCCESS"
                          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                          : refreshSchedule?.lastStatus === "FAILED"
                          ? "bg-rose-500/15 border border-rose-500/30 text-rose-400"
                          : "bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35]"
                      }`}
                    >
                      {refreshSchedule?.lastStatus || "IDLE"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#898989] font-medium">Last Refreshed:</span>
                    <span className="text-[#fafafa] font-mono-code">
                      {refreshSchedule?.lastRunAt
                        ? new Date(refreshSchedule.lastRunAt).toLocaleString()
                        : "Never"}
                    </span>
                  </div>
                  {refreshSchedule?.nextRunAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#898989] font-medium">Next Scheduled Run:</span>
                      <span className="text-emerald-400 font-mono-code">
                        {new Date(refreshSchedule.nextRunAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {refreshSchedule?.lastError && (
                    <div className="mt-1 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-rose-400 text-[11px] font-mono-code">
                      {refreshSchedule.lastError}
                    </div>
                  )}
                </div>

                {/* Schedule Configuration */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#898989] mb-1">
                      Refresh Frequency *
                    </label>
                    <select
                      value={refreshFrequency}
                      onChange={(e) => setRefreshFrequency(e.target.value)}
                      className="w-full rounded-xl border border-[#262626] bg-[#121212] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    >
                      <option value="1H" className="bg-[#141414] text-[#fafafa]">Every Hour (1H)</option>
                      <option value="6H" className="bg-[#141414] text-[#fafafa]">Every 6 Hours (6H)</option>
                      <option value="12H" className="bg-[#141414] text-[#fafafa]">Every 12 Hours (12H)</option>
                      <option value="DAILY" className="bg-[#141414] text-[#fafafa]">Daily (24 Hours)</option>
                      <option value="WEEKLY" className="bg-[#141414] text-[#fafafa]">Weekly</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-refresh-toggle"
                      checked={refreshEnabled}
                      onChange={(e) => setRefreshEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-[#262626] bg-[#121212] accent-[#ff6b35] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="enable-refresh-toggle" className="text-xs font-medium text-[#fafafa] select-none cursor-pointer">
                      Enable automated scheduled execution
                    </label>
                  </div>
                </div>

                {/* Execution History */}
                {refreshSchedule?.history && refreshSchedule.history.length > 0 && (
                  <div className="border-t border-[#262626] pt-3">
                    <h3 className="text-xs font-medium text-[#898989] mb-2 uppercase tracking-wider font-mono-code">Recent Refresh Executions</h3>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {refreshSchedule.history.slice(0, 5).map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-[#181818] border border-[#262626]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                entry.status === "SUCCESS" ? "bg-emerald-400" : "bg-rose-500"
                              }`}
                            />
                            <span className="font-mono-code text-[#fafafa]">
                              {new Date(entry.executedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[#898989] font-mono-code">
                            <span>{entry.durationMs}ms</span>
                            <span
                              className={`font-semibold ${
                                entry.status === "SUCCESS" ? "text-emerald-400" : "text-rose-400"
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
                <div className="border-t border-[#262626] pt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerRefreshNow}
                    disabled={triggeringRefresh}
                    className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-3.5 py-1.5 text-xs font-mono-code text-[#ff6b35] hover:bg-[#ff6b35]/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {triggeringRefresh ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
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
                        className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50 cursor-pointer"
                      >
                        Disable
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={savingSchedule}
                      className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all disabled:opacity-50 cursor-pointer"
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

      {/* ============================================================ */}
      {/* PHASE 5: ROW-LEVEL SECURITY (RLS) MANAGEMENT MODAL */}
      {/* ============================================================ */}
      {isRlsModalOpen && rlsDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-2xl flex-col max-h-[85vh] rounded-2xl bg-[#141414] shadow-2xl border border-[#262626] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#262626] px-6 py-4 bg-[#181818]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35] font-bold text-sm">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#fafafa]">Row-Level Security (RLS)</h2>
                  <p className="text-xs text-[#898989]">
                    Restricts dataset rows returned to specific roles or users for {rlsDataset.name}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRlsModalOpen(false)}
                className="rounded-lg p-1.5 text-[#898989] hover:bg-[#262626] hover:text-[#fafafa] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {rlsError && (
                <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/30 font-mono-code">
                  {rlsError}
                </div>
              )}

              {/* Add Rule Form (Hidden/disabled if !canEdit) */}
              {canEdit ? (
                <form onSubmit={handleCreateRlsRule} className="rounded-xl border border-[#262626] bg-[#181818] p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-[#ff6b35] uppercase tracking-wider flex items-center gap-1.5 font-mono-code">
                    <span>+ Add Security Rule</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-[#898989] block mb-1">Rule Name</label>
                      <input
                        type="text"
                        value={rlsFormName}
                        onChange={(e) => setRlsFormName(e.target.value)}
                        placeholder="e.g. India Region Only"
                        className="w-full rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#898989] block mb-1">Column</label>
                      <select
                        value={rlsFormCol}
                        onChange={(e) => setRlsFormCol(e.target.value)}
                        className="w-full rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                        required
                      >
                        {rlsDataset.columns?.map((c) => (
                          <option key={c.name} value={c.name} className="bg-[#141414] text-[#fafafa]">
                            {c.name} ({c.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#898989] block mb-1">Condition Operator</label>
                      <select
                        value={rlsFormOp}
                        onChange={(e) => setRlsFormOp(e.target.value as RlsOperator)}
                        className="w-full rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      >
                        <option value="EQUALS" className="bg-[#141414] text-[#fafafa]">= Equals</option>
                        <option value="NOT_EQUALS" className="bg-[#141414] text-[#fafafa]">!= Not Equals</option>
                        <option value="IN" className="bg-[#141414] text-[#fafafa]">IN (comma-separated)</option>
                        <option value="NOT_IN" className="bg-[#141414] text-[#fafafa]">NOT IN (comma-separated)</option>
                        <option value="GREATER_THAN" className="bg-[#141414] text-[#fafafa]">&gt; Greater Than</option>
                        <option value="LESS_THAN" className="bg-[#141414] text-[#fafafa]">&lt; Less Than</option>
                        <option value="CONTAINS" className="bg-[#141414] text-[#fafafa]">CONTAINS substring</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#898989] block mb-1">Filter Value</label>
                      <input
                        type="text"
                        value={rlsFormVal}
                        onChange={(e) => setRlsFormVal(e.target.value)}
                        placeholder="e.g. India or USA"
                        className="w-full rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#898989] block mb-1">Target Workspace Role</label>
                      <select
                        value={rlsFormRole}
                        onChange={(e) => setRlsFormRole(e.target.value)}
                        className="w-full rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      >
                        <option value="ALL" className="bg-[#141414] text-[#fafafa]">All Non-Admin Users</option>
                        <option value="VIEWER" className="bg-[#141414] text-[#fafafa]">VIEWER only</option>
                        <option value="EDITOR" className="bg-[#141414] text-[#fafafa]">EDITOR only</option>
                        <option value="MEMBER" className="bg-[#141414] text-[#fafafa]">MEMBER only</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#898989] block mb-1">
                        Specific User Email / ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={rlsFormUserEmail}
                        onChange={(e) => setRlsFormUserEmail(e.target.value)}
                        placeholder="Leave blank for all users in role"
                        className="w-full rounded-xl border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingRlsRule}
                      className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {savingRlsRule ? "Saving..." : "Add Rule"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300 border border-amber-500/30">
                  ℹ️ Read-only view: You do not have permissions to modify Row-Level Security rules.
                </div>
              )}

              {/* Existing Rules List */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[#898989] uppercase tracking-wider font-mono-code">
                  Configured RLS Rules ({rlsRules.length})
                </h3>

                {loadingRlsRules ? (
                  <p className="text-xs text-[#898989] py-4 text-center font-mono-code">Loading security rules...</p>
                ) : rlsRules.length === 0 ? (
                  <p className="text-xs text-[#898989] italic py-3 text-center border border-dashed border-[#262626] rounded-xl font-mono-code">
                    No active RLS rules. All workspace members with read access see all rows.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rlsRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="rounded-xl border border-[#262626] bg-[#181818] p-3.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#fafafa] truncate">{rule.name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono-code ${
                                rule.isEnabled
                                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                                  : "bg-[#262626] text-[#898989]"
                              }`}
                            >
                              {rule.isEnabled ? "Active" : "Disabled"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#898989] mt-1 font-mono-code">
                            <span className="text-[#ff6b35] font-semibold">{rule.columnName}</span>{" "}
                            {rule.operator} &quot;
                            <span className="font-semibold text-[#fafafa]">
                              {Array.isArray(rule.ruleValue)
                                ? (rule.ruleValue as string[]).join(", ")
                                : String(rule.ruleValue)}
                            </span>
                            &quot;
                            {rule.roleName && (
                              <span className="ml-2 font-sans text-[#898989]">
                                (Applies to: {rule.roleName})
                              </span>
                            )}
                            {rule.userId && (
                              <span className="ml-2 font-sans text-[#898989]">
                                (User: {rule.userId})
                              </span>
                            )}
                          </p>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleToggleRlsRule(rule)}
                              className="rounded-full border border-[#2e2e2e] bg-[#141414] px-2.5 py-1 text-[11px] font-medium text-[#fafafa] hover:bg-[#1f1f1f] cursor-pointer"
                            >
                              {rule.isEnabled ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteRlsRule(rule.id)}
                              className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[#262626] px-6 py-3 bg-[#181818]">
              <span className="text-[11px] text-[#898989]">
                Row-Level Security rules are automatically enforced across all charts, AI queries, and exports.
              </span>
              <button
                type="button"
                onClick={() => setIsRlsModalOpen(false)}
                className="rounded-full border border-[#2e2e2e] bg-[#141414] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:bg-[#1f1f1f] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}

