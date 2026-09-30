"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import {
  apiGetDataset,
  apiPreviewDataset,
  apiUpdateDataset,
  type DatasetData,
  ApiError,
} from "../../../lib/api";

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
  const [activeTab, setActiveTab] = useState<"SCHEMA" | "PREVIEW">("SCHEMA");
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading dataset details...</p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-base font-semibold text-gray-700">Dataset not found</p>
        <Link href="/datasets" className="mt-4 text-xs font-semibold text-indigo-600">
          ← Back to Datasets
        </Link>
      </div>
    );
  }

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
            <Link href="/datasets" className="text-sm text-gray-500 hover:text-gray-900">
              Datasets
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">
              {dataset.name}
            </span>
          </div>

          <Link
            href="/datasets"
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            ← Back to Datasets
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 flex-1">
        {/* Alerts */}
        {errorMsg && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold">
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-green-500 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Dataset Header Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                  {dataset.type === "CONNECTED" ? "🔌 Connected Source" : "📄 CSV File"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {dataset.status}
                </span>
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3 mt-2">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Data Source</span>
              <span className="font-semibold text-gray-900">
                {dataset.dataSourceName || "Uploaded File"}
              </span>
            </div>
            {dataset.tableName && (
              <div>
                <span className="text-gray-400 block mb-0.5">Table Name</span>
                <span className="font-mono font-semibold text-gray-900">
                  {dataset.tableName}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-400 block mb-0.5">Columns</span>
              <span className="font-semibold text-gray-900">
                {dataset.columns.length} columns
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
        <div className="flex border-b border-gray-200 mb-6">
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
        </div>

        {/* Tab 1: Schema Table */}
        {activeTab === "SCHEMA" && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">
                    Column Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">
                    Data Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase">
                    Nullable
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {dataset.columns.map((col) => (
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
      </main>
    </div>
  );
}
