"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import { useWorkspace } from "../../../contexts/workspace-context";
import {
  apiGetDemoCatalog,
  apiGetDemoDataset,
  apiImportDemoDataset,
  type DemoDatasetCatalogItem,
  type ImportedDatasetData,
  ApiError,
} from "../../../lib/api";

const CATEGORIES = [
  "ALL",
  "Food & Nutrition",
  "Pop Culture & Entertainment",
  "Science & Nature",
  "Science & Mystery",
  "Government & Culture",
  "Aviation & Science",
  "Retail & Products",
];

export default function DemoDatasetsPage() {
  const { auth, isLoading, logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [catalog, setCatalog] = useState<DemoDatasetCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Import state: tracks which demoId is importing, and holds imported dataset results
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedMap, setImportedMap] = useState<Record<string, ImportedDatasetData>>({});

  // Preview Modal state
  const [previewItem, setPreviewItem] = useState<DemoDatasetCatalogItem | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"data" | "schema">("data");

  // ---- Auth guard ----
  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  // ---- Fetch catalog ----
  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    apiGetDemoCatalog()
      .then((data) => {
        setCatalog(data);
      })
      .catch((err) => {
        setErrorMsg(err instanceof ApiError ? err.message : "Failed to load demo catalog");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [auth]);

  // Open Preview Modal
  async function handleOpenPreview(item: DemoDatasetCatalogItem) {
    setLoadingPreview(true);
    setActiveTab("data");
    try {
      // Fetch full details with records
      const fullDetails = await apiGetDemoDataset(item.id);
      setPreviewItem(fullDetails);
    } catch {
      // Fallback to catalog item with sampleData
      setPreviewItem(item);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Handle Import
  async function handleImport(demoId: string) {
    setImportingId(demoId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const imported = await apiImportDemoDataset(demoId, {
        workspaceId: currentWorkspace?.id,
      });

      setImportedMap((prev) => ({
        ...prev,
        [demoId]: imported,
      }));

      const isAlready = imported.alreadyImported;
      setSuccessMsg(
        isAlready
          ? `Dataset "${imported.name}" is already in your workspace. You can explore it now.`
          : `🎉 Successfully imported "${imported.name}" into workspace "${currentWorkspace?.name || "Default"}".`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "Failed to import demo dataset into workspace."
      );
    } finally {
      setImportingId(null);
    }
  }

  // Filter items
  const filteredItems = catalog.filter((item) => {
    if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchCat && !matchTags) return false;
    }
    return true;
  });

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading demo datasets catalog...</p>
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
            <Link href="/datasets" className="text-sm text-gray-500 hover:text-gray-900">
              Datasets
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-amber-700">✨ Demo Datasets</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/datasets"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
            >
              ← Back to Workspace Datasets
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

        {/* Hero Banner */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 p-6 sm:p-8 text-white shadow-md">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white mb-3">
              <span>🌟 Curated Beginner-Friendly Collection</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Curated Demo Datasets
            </h1>
            <p className="mt-2 text-sm sm:text-base text-amber-100">
              Explore beginner-friendly open datasets referenced in Rachael Tatman&apos;s Kaggle
              collection. Pre-configured with rich schemas, verified open licenses (CC0, CC-BY, Public
              Domain), and instant one-click import into your active workspace.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/90">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-300" />
                Verified Legal Redistribution / CC0 / Open Data
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-300" />
                Ready for Charts, Blends &amp; Calculated Fields
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-300" />
                Workspace Isolation &amp; Deduplication
              </span>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-1.5 pb-2 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search demo datasets..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none shadow-2xs"
            />
          </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2" />
            <p>Loading curated demo catalog...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 text-2xl mb-4">
              🔍
            </div>
            <h3 className="text-base font-semibold text-gray-900">No matching demo datasets</h3>
            <p className="mt-1 text-sm text-gray-500">
              No datasets match your active search &quot;{searchQuery}&quot; or selected category.
            </p>
            <button
              onClick={() => {
                setSelectedCategory("ALL");
                setSearchQuery("");
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const imported = importedMap[item.id];
              const isImporting = importingId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Category + License */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-2xs font-semibold text-indigo-700">
                        {item.category}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700 border border-emerald-200">
                        {item.license.split(":")[0]}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-600 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Metadata Stats */}
                    <div className="mt-4 grid grid-cols-3 gap-2 border-y border-gray-100 py-2.5 text-center text-xs">
                      <div>
                        <span className="block font-bold text-gray-900">{item.rowCount}</span>
                        <span className="text-2xs text-gray-500">Rows</span>
                      </div>
                      <div>
                        <span className="block font-bold text-gray-900">{item.columnCount}</span>
                        <span className="text-2xs text-gray-500">Columns</span>
                      </div>
                      <div>
                        <span className="block font-bold text-gray-900">{item.sourceType}</span>
                        <span className="text-2xs text-gray-500">Format</span>
                      </div>
                    </div>

                    {/* Source Attribution & Link */}
                    <div className="mt-3 text-2xs text-gray-500">
                      <p className="truncate">
                        <strong className="text-gray-700">Source:</strong> {item.sourceAttribution}
                      </p>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline truncate inline-block mt-0.5"
                      >
                        Source Link ↗
                      </a>
                    </div>

                    {/* Tags */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-gray-100 px-2 py-0.5 text-2xs text-gray-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(item)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      👁️ Preview
                    </button>

                    {imported ? (
                      <Link
                        href={`/datasets/${imported.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-500 transition"
                      >
                        <span>Open Explorer →</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={isImporting}
                        onClick={() => handleImport(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition ${
                          isImporting
                            ? "bg-indigo-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-500"
                        }`}
                      >
                        {isImporting ? (
                          <>
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <span>⚡ Use Dataset</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-2xs font-semibold text-indigo-700">
                    {previewItem.category}
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-2xs font-medium text-emerald-800">
                    {previewItem.license}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-1">{previewItem.name}</h2>
                <p className="text-xs text-gray-500">{previewItem.description}</p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-gray-200 px-6 pt-2 bg-white gap-4 text-xs font-medium">
              <button
                onClick={() => setActiveTab("data")}
                className={`pb-2.5 border-b-2 transition ${
                  activeTab === "data"
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Data Preview ({previewItem.records?.length || previewItem.sampleData.length} rows)
              </button>
              <button
                onClick={() => setActiveTab("schema")}
                className={`pb-2.5 border-b-2 transition ${
                  activeTab === "schema"
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Schema Columns ({previewItem.columns.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6">
              {loadingPreview ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2" />
                  <p>Loading full preview records...</p>
                </div>
              ) : activeTab === "data" ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-2xs">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        {previewItem.columns.map((col) => (
                          <th
                            key={col.name}
                            className="px-3.5 py-2.5 text-left font-semibold tracking-wider"
                          >
                            <span className="block">{col.name}</span>
                            <span className="text-3xs font-normal uppercase text-gray-500">
                              {col.type}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {(previewItem.records || previewItem.sampleData).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          {previewItem.columns.map((col) => (
                            <td
                              key={col.name}
                              className="whitespace-nowrap px-3.5 py-2 text-gray-800"
                            >
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
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-hidden shadow-2xs">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">Column Name</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Inferred Type</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Nullable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {previewItem.columns.map((col) => (
                        <tr key={col.name} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-gray-900 font-medium">
                            {col.name}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-indigo-700">
                              {col.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {col.nullable ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
              <div className="text-2xs text-gray-500">
                Attribution: <strong>{previewItem.sourceAttribution}</strong>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                {importedMap[previewItem.id] ? (
                  <Link
                    href={`/datasets/${importedMap[previewItem.id]?.id}`}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-500"
                  >
                    Open in Dataset Explorer →
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={importingId === previewItem.id}
                    onClick={() => handleImport(previewItem.id)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {importingId === previewItem.id ? "Importing..." : "⚡ Use Dataset"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
