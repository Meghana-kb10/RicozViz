"use client";

import React, { useState, useMemo } from "react";
import {
  Database,
  Search,
  Table,
  Hash,
  Calendar,
  ToggleLeft,
  Type,
  Plus,
  Check,
  RefreshCw,
} from "lucide-react";
import type { DatasetData, DatasetColumn } from "../../lib/api";
import { categorizeColumns } from "../../lib/chart-query-mapper";

export interface FieldPanelProps {
  datasets: DatasetData[];
  selectedDatasetId: string;
  onSelectDataset: (id: string) => void;
  datasetDetail: DatasetData | null;
  loadingSchema: boolean;
  onRefreshSchema?: () => void;
  selectedDimensions: string[];
  onAddDimension: (colName: string) => void;
  selectedMeasures: string[];
  onAddMeasure: (colName: string) => void;
}

export function FieldPanel({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  datasetDetail,
  loadingSchema,
  onRefreshSchema,
  selectedDimensions,
  onAddDimension,
  selectedMeasures,
  onAddMeasure,
}: FieldPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const columns: DatasetColumn[] = useMemo(
    () => datasetDetail?.columns || [],
    [datasetDetail?.columns]
  );

  const { dimensions, measures } = useMemo(() => {
    return categorizeColumns(columns);
  }, [columns]);

  const filteredDimensions = useMemo(() => {
    if (!searchTerm) return dimensions;
    const term = searchTerm.toLowerCase();
    return dimensions.filter((d) => d.name.toLowerCase().includes(term));
  }, [dimensions, searchTerm]);

  const filteredMeasures = useMemo(() => {
    if (!searchTerm) return measures;
    const term = searchTerm.toLowerCase();
    return measures.filter((m) => m.name.toLowerCase().includes(term));
  }, [measures, searchTerm]);

  const getFieldIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "number":
      case "integer":
        return <Hash className="h-3.5 w-3.5 text-blue-500" />;
      case "date":
      case "timestamp":
        return <Calendar className="h-3.5 w-3.5 text-amber-500" />;
      case "boolean":
        return <ToggleLeft className="h-3.5 w-3.5 text-purple-500" />;
      case "string":
      default:
        return <Type className="h-3.5 w-3.5 text-indigo-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* 1. DATASET SELECTOR HEADER */}
      <div className="p-3.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-indigo-600" />
            <span>Dataset</span>
          </label>
          {onRefreshSchema && selectedDatasetId && (
            <button
              type="button"
              onClick={onRefreshSchema}
              disabled={loadingSchema}
              className="text-gray-400 hover:text-indigo-600 transition p-1 rounded hover:bg-gray-100"
              title="Refresh Schema"
            >
              <RefreshCw className={`h-3 w-3 ${loadingSchema ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          )}
        </div>

        <select
          value={selectedDatasetId}
          onChange={(e) => onSelectDataset(e.target.value)}
          className="w-full text-xs font-medium rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-gray-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="" disabled>
            Select a Dataset...
          </option>
          {datasets.map((ds) => (
            <option key={ds.id} value={ds.id}>
              {ds.name} ({ds.type})
            </option>
          ))}
        </select>

        {/* Selected Dataset Summary */}
        {datasetDetail && (
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-500 font-mono">
            <span className="flex items-center gap-1 truncate max-w-[150px]">
              <Table className="h-3 w-3 text-gray-400 shrink-0" />
              {datasetDetail.tableName || datasetDetail.name}
            </span>
            <span className="bg-gray-200/70 px-1.5 py-0.5 rounded text-gray-700 font-semibold">
              {datasetDetail.rowCount.toLocaleString()} rows
            </span>
          </div>
        )}
      </div>

      {/* 2. FIELD SEARCH */}
      {selectedDatasetId && (
        <div className="p-2.5 border-b border-gray-100">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs rounded-md border border-gray-200 pl-8 pr-2.5 py-1.5 text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* 3. FIELD LIST ACCORDION */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loadingSchema ? (
          <div className="py-8 text-center">
            <div className="h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Discovering schema...</p>
          </div>
        ) : !selectedDatasetId ? (
          <div className="py-12 text-center px-4">
            <Database className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-600">No Dataset Selected</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Choose an available dataset above to inspect its dimensions and measures.
            </p>
          </div>
        ) : columns.length === 0 ? (
          <div className="py-12 text-center px-4">
            <p className="text-xs font-semibold text-gray-600">No columns found</p>
            <p className="text-[11px] text-gray-400 mt-1">
              This dataset does not have any discovered columns.
            </p>
          </div>
        ) : (
          <>
            {/* DIMENSIONS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="h-3 w-3 text-indigo-500" />
                  Dimensions
                </span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {filteredDimensions.length}
                </span>
              </div>

              <div className="space-y-1">
                {filteredDimensions.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic px-1">No matching dimensions</p>
                ) : (
                  filteredDimensions.map((col) => {
                    const isAdded = selectedDimensions.includes(col.name);
                    return (
                      <div
                        key={col.name}
                        onClick={() => onAddDimension(col.name)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                          isAdded
                            ? "bg-indigo-50/70 border-indigo-200 text-indigo-900 font-semibold"
                            : "bg-white hover:bg-gray-50 border-gray-100 text-gray-700"
                        }`}
                        title={`Click to ${isAdded ? "toggle" : "add"} dimension: ${col.name} (${col.type})`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getFieldIcon(col.type)}
                          <span className="truncate">{col.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                          <span>{col.type}</span>
                          {isAdded ? (
                            <Check className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <Plus className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* MEASURES */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="h-3 w-3 text-blue-500" />
                  Measures
                </span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {filteredMeasures.length}
                </span>
              </div>

              <div className="space-y-1">
                {filteredMeasures.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic px-1">No matching measures</p>
                ) : (
                  filteredMeasures.map((col) => {
                    const isAdded = selectedMeasures.includes(col.name);
                    return (
                      <div
                        key={col.name}
                        onClick={() => onAddMeasure(col.name)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                          isAdded
                            ? "bg-blue-50/70 border-blue-200 text-blue-900 font-semibold"
                            : "bg-white hover:bg-gray-50 border-gray-100 text-gray-700"
                        }`}
                        title={`Click to add measure: ${col.name} (${col.type})`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Hash className="h-3.5 w-3.5 text-blue-500" />
                          <span className="truncate">{col.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                          <span>{col.type}</span>
                          <Plus className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
