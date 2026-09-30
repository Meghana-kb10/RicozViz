"use client";

import React, { useState } from "react";
import {
  Filter,
  X,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import type { DatasetColumn, FilterOperator } from "../../lib/api";
import type { DashboardFilter } from "../../lib/dashboard-filters";

export interface DashboardFilterBarProps {
  availableColumns: DatasetColumn[];
  filters: DashboardFilter[];
  onAddFilter: (filter: DashboardFilter) => void;
  onRemoveFilter: (filterId: string) => void;
  onClearAll: () => void;
  onResetDashboard: () => void;
}

export function DashboardFilterBar({
  availableColumns,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  onResetDashboard,
}: DashboardFilterBarProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedField, setSelectedField] = useState("");
  const [operator, setOperator] = useState<FilterOperator>("=");
  const [value, setValue] = useState("");

  const handleCreateFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField) return;

    const col = availableColumns.find((c) => c.name === selectedField);
    let parsedVal: unknown = value;
    if (col && (col.type === "number" || col.type === "integer")) {
      parsedVal = value !== "" ? Number(value) : undefined;
    } else if (col && col.type === "boolean") {
      parsedVal = value === "true";
    }

    onAddFilter({
      id: `filter-${Date.now()}`,
      field: selectedField,
      operator,
      value: parsedVal,
      isCrossFilter: false,
    });

    setIsAddOpen(false);
    setSelectedField("");
    setValue("");
  };

  const selectedCol = availableColumns.find((c) => c.name === selectedField);

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Active Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
            <span>Filters:</span>
          </div>

          {filters.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No active filters</span>
          ) : (
            filters.map((f) => (
              <span
                key={f.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border transition ${
                  f.isCrossFilter
                    ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
              >
                {f.isCrossFilter && <span className="text-[10px] text-indigo-500 font-bold">⚡</span>}
                <span>
                  <strong className="font-semibold">{f.field}</strong> {f.operator} {String(f.value)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFilter(f.id)}
                  className="rounded-full p-0.5 hover:bg-black/10 transition text-gray-500 hover:text-gray-900"
                  title="Remove Filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}

          {/* Add Filter Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddOpen(!isAddOpen)}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition"
            >
              <Plus className="h-3 w-3 text-indigo-600" />
              <span>Add Filter</span>
              <ChevronDown className="h-3 w-3 text-gray-400 ml-0.5" />
            </button>

            {/* Filter Creation Popover */}
            {isAddOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xl z-30">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Apply Filter</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreateFilter} className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">
                      Field
                    </label>
                    <select
                      value={selectedField}
                      onChange={(e) => setSelectedField(e.target.value)}
                      required
                      className="w-full rounded-md border border-gray-200 p-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Field...</option>
                      {availableColumns.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">
                      Operator
                    </label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value as FilterOperator)}
                      className="w-full rounded-md border border-gray-200 p-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="=">= equals</option>
                      <option value="!=">!= not equals</option>
                      <option value=">">&gt; greater than</option>
                      <option value=">=">&gt;= greater or equal</option>
                      <option value="<">&lt; less than</option>
                      <option value="<=">&lt;= less or equal</option>
                      <option value="contains">contains</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">
                      Value
                    </label>
                    {selectedCol?.type === "boolean" ? (
                      <select
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        required
                        className="w-full rounded-md border border-gray-200 p-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">Select...</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : (
                      <input
                        type={
                          selectedCol?.type === "number" || selectedCol?.type === "integer"
                            ? "number"
                            : "text"
                        }
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Filter value..."
                        required
                        className="w-full rounded-md border border-gray-200 p-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                      />
                    )}
                  </div>

                  <div className="pt-2 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddOpen(false)}
                      className="rounded px-2.5 py-1 text-gray-500 hover:bg-gray-100 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded bg-indigo-600 px-3 py-1 text-white font-semibold hover:bg-indigo-500 shadow-2xs"
                    >
                      Apply
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right: Clear All & Reset Buttons */}
        <div className="flex items-center gap-2 text-xs">
          {filters.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-gray-500 hover:text-red-600 font-semibold px-2 py-1 rounded transition hover:bg-red-50"
            >
              Clear filters ({filters.length})
            </button>
          )}

          <button
            type="button"
            onClick={onResetDashboard}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition"
            title="Reset all filters and refresh visualizations"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
