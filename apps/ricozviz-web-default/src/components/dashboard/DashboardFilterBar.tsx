"use client";

import React, { useState, useMemo } from "react";
import {
  Filter,
  X,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Calendar,
  CheckSquare,
  Square,
  Sparkles,
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
  columnValues?: Record<string, string[]>;
}

export type RelativeDatePreset =
  | "Today"
  | "Yesterday"
  | "Last 7 days"
  | "Last 30 days"
  | "This month";

export function DashboardFilterBar({
  availableColumns,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  onResetDashboard,
  columnValues = {},
}: DashboardFilterBarProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDatePresetsOpen, setIsDatePresetsOpen] = useState(false);

  // Filter creation state
  const [selectedField, setSelectedField] = useState("");
  const [operator, setOperator] = useState<FilterOperator>("=");
  const [value, setValue] = useState("");
  const [selectedMultiValues, setSelectedMultiValues] = useState<string[]>([]);
  const [customMultiInput, setCustomMultiInput] = useState("");

  // Date preset state
  const [selectedDateField, setSelectedDateField] = useState("");

  // Detect date columns
  const dateColumns = useMemo(() => {
    return availableColumns.filter(
      (c) =>
        c.type === "date" ||
        c.type === "datetime" ||
        c.type === "timestamp" ||
        c.name.toLowerCase().includes("date") ||
        c.name.toLowerCase().includes("created") ||
        c.name.toLowerCase().includes("time")
    );
  }, [availableColumns]);

  // Options for multi-select on currently selected field
  const currentFieldOptions = useMemo(() => {
    if (!selectedField) return [];
    const valuesFromProps = columnValues[selectedField] || [];
    // If none found, provide clean default category suggestions if applicable
    if (valuesFromProps.length > 0) {
      return Array.from(new Set(valuesFromProps));
    }
    return [];
  }, [selectedField, columnValues]);

  const handleToggleMultiValue = (val: string) => {
    setSelectedMultiValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const handleAddCustomMultiValue = () => {
    const trimmed = customMultiInput.trim();
    if (!trimmed) return;
    if (!selectedMultiValues.includes(trimmed)) {
      setSelectedMultiValues((prev) => [...prev, trimmed]);
    }
    setCustomMultiInput("");
  };

  const handleCreateFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField) return;

    const col = availableColumns.find((c) => c.name === selectedField);

    if (operator === "in") {
      if (selectedMultiValues.length === 0) return;
      onAddFilter({
        id: `filter-${Date.now()}`,
        field: selectedField,
        operator: "in",
        value: selectedMultiValues,
        label: `${selectedField}: [${selectedMultiValues.join(", ")}]`,
        isCrossFilter: false,
      });
    } else {
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
    }

    setIsAddOpen(false);
    setSelectedField("");
    setValue("");
    setSelectedMultiValues([]);
    setCustomMultiInput("");
  };

  // Apply relative date preset
  const handleApplyDatePreset = (preset: RelativeDatePreset) => {
    const targetField = selectedDateField || dateColumns[0]?.name;
    if (!targetField) return;

    const now = new Date();
    let startDateIso = "";
    const label = `${targetField}: ${preset}`;

    if (preset === "Today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDateIso = today.toISOString().slice(0, 10);
    } else if (preset === "Yesterday") {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      startDateIso = yesterday.toISOString().slice(0, 10);
    } else if (preset === "Last 7 days") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDateIso = sevenDaysAgo.toISOString().slice(0, 10);
    } else if (preset === "Last 30 days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDateIso = thirtyDaysAgo.toISOString().slice(0, 10);
    } else if (preset === "This month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDateIso = startOfMonth.toISOString().slice(0, 10);
    }

    onAddFilter({
      id: `filter-date-${now.getTime()}`,
      field: targetField,
      operator: ">=",
      value: startDateIso,
      label,
      isCrossFilter: false,
    });

    setIsDatePresetsOpen(false);
  };

  const selectedCol = availableColumns.find((c) => c.name === selectedField);

  return (
    <div className="bg-[#141414] border-b border-[#242424] px-4 py-2.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Active Filter Chips & Add Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#fafafa] mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#ff6b35]" />
            <span>Filters</span>
            {filters.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-[#ff6b35]/15 border border-[#ff6b35]/30 px-1.5 py-0.2 text-[10px] font-mono font-medium text-[#ff8c5a]">
                {filters.length}
              </span>
            )}
          </div>

          {filters.length === 0 ? (
            <span className="text-xs text-[#898989] italic">No active filters</span>
          ) : (
            filters.map((f) => (
              <span
                key={f.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-normal border transition ${
                  f.isCrossFilter
                    ? "bg-[#ff6b35]/10 border-[#ff6b35]/35 text-[#ff8c5a]"
                    : f.operator === "in"
                    ? "bg-[#1c1c1c] border-[#2e2e2e] text-[#dedede]"
                    : "bg-[#181818] border-[#282828] text-[#dedede]"
                }`}
              >
                {f.isCrossFilter && <span className="text-[10px] text-[#ff6b35] font-bold">⚡</span>}
                {f.label ? (
                  <span>{f.label}</span>
                ) : f.operator === "in" && Array.isArray(f.value) ? (
                  <span>
                    <strong className="font-medium text-[#fafafa]">{f.field}</strong> in [{(f.value as unknown[]).join(", ")}]
                  </span>
                ) : (
                  <span>
                    <strong className="font-medium text-[#fafafa]">{f.field}</strong> {f.operator} {String(f.value)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveFilter(f.id)}
                  className="rounded-full p-0.5 hover:bg-white/10 transition text-[#898989] hover:text-[#fafafa] cursor-pointer"
                  title="Remove Filter"
                  aria-label={`Remove filter for ${f.field}`}
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
              onClick={() => {
                setIsAddOpen(!isAddOpen);
                setIsDatePresetsOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-1 text-xs font-normal text-[#dedede] hover:bg-[#222222] hover:text-[#fafafa] hover:border-[#ff6b35]/40 transition cursor-pointer"
            >
              <Plus className="h-3 w-3 text-[#ff6b35]" />
              <span>Add Filter</span>
              <ChevronDown className="h-3 w-3 text-[#898989] ml-0.5" />
            </button>

            {/* Filter Creation Popover */}
            {isAddOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-[#2a2a2a] bg-[#171717] p-3.5 shadow-2xl z-30 text-[#fafafa]">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#242424]">
                  <span className="text-xs font-medium text-[#fafafa] flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-[#ff6b35]" />
                    <span>Apply Filter</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="text-[#898989] hover:text-[#fafafa] text-xs cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreateFilter} className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-medium text-[#898989] block mb-0.5">
                      Field
                    </label>
                    <select
                      value={selectedField}
                      onChange={(e) => {
                        setSelectedField(e.target.value);
                        setSelectedMultiValues([]);
                      }}
                      required
                      className="w-full rounded-md border border-[#2e2e2e] bg-[#121212] p-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    >
                      <option value="" className="bg-[#141414] text-[#898989]">Select Field...</option>
                      {availableColumns.map((col) => (
                        <option key={col.name} value={col.name} className="bg-[#141414] text-[#fafafa]">
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-[#898989] block mb-0.5">
                      Operator
                    </label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value as FilterOperator)}
                      className="w-full rounded-md border border-[#2e2e2e] bg-[#121212] p-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                    >
                      <option value="=" className="bg-[#141414] text-[#fafafa]">= equals</option>
                      <option value="in" className="bg-[#141414] text-[#fafafa]">☑ in (multi-select)</option>
                      <option value="!=" className="bg-[#141414] text-[#fafafa]">!= not equals</option>
                      <option value=">" className="bg-[#141414] text-[#fafafa]">&gt; greater than</option>
                      <option value=">=" className="bg-[#141414] text-[#fafafa]">&gt;= greater or equal</option>
                      <option value="<" className="bg-[#141414] text-[#fafafa]">&lt; less than</option>
                      <option value="<=" className="bg-[#141414] text-[#fafafa]">&lt;= less or equal</option>
                      <option value="contains" className="bg-[#141414] text-[#fafafa]">contains</option>
                    </select>
                  </div>

                  {operator === "in" ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-medium text-[#898989]">
                          Select Categories ({selectedMultiValues.length} selected)
                        </label>
                        {selectedMultiValues.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedMultiValues([])}
                            className="text-[10px] text-[#898989] hover:text-[#ef4444]"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Checkbox Options List */}
                      <div className="max-h-36 overflow-y-auto rounded-md border border-[#262626] p-2 space-y-1 bg-[#121212]">
                        {currentFieldOptions.length > 0 ? (
                          currentFieldOptions.map((opt) => {
                            const isChecked = selectedMultiValues.includes(opt);
                            return (
                              <label
                                key={opt}
                                className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1 rounded transition text-[#dedede] text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleMultiValue(opt)}
                                  className="rounded border-[#333333] accent-[#ff6b35] h-3.5 w-3.5"
                                />
                                <span className="truncate">{opt}</span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="text-[11px] text-[#898989] italic p-1">
                            No cached category values. Type values below:
                          </p>
                        )}
                      </div>

                      {/* Add Custom / Additional Category Option */}
                      <div className="mt-2 flex gap-1.5">
                        <input
                          type="text"
                          value={customMultiInput}
                          onChange={(e) => setCustomMultiInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomMultiValue();
                            }
                          }}
                          placeholder="Type option and press Add..."
                          className="flex-1 rounded-md border border-[#2e2e2e] bg-[#121212] px-2 py-1 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomMultiValue}
                          className="rounded bg-[#222222] hover:bg-[#2a2a2a] px-2 py-1 text-xs font-normal text-[#fafafa] transition cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {/* Show active custom selected items chips */}
                      {selectedMultiValues.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                          {selectedMultiValues.map((v) => (
                            <span
                              key={v}
                              className="inline-flex items-center gap-1 rounded bg-[#ff6b35]/15 border border-[#ff6b35]/30 px-1.5 py-0.5 text-[10px] text-[#ff8c5a]"
                            >
                              <span>{v}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleMultiValue(v)}
                                className="hover:text-red-400 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-medium text-[#898989] block mb-0.5">
                        Value
                      </label>
                      {selectedCol?.type === "boolean" ? (
                        <select
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          required
                          className="w-full rounded-md border border-[#2e2e2e] bg-[#121212] p-1.5 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                        >
                          <option value="" className="bg-[#141414] text-[#898989]">Select...</option>
                          <option value="true" className="bg-[#141414] text-[#fafafa]">True</option>
                          <option value="false" className="bg-[#141414] text-[#fafafa]">False</option>
                        </select>
                      ) : (
                        <input
                          type={
                            selectedCol?.type === "number" || selectedCol?.type === "integer"
                              ? "number"
                              : selectedCol?.type === "date" ||
                                selectedCol?.type === "datetime" ||
                                selectedCol?.type === "timestamp"
                              ? "date"
                              : "text"
                          }
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={
                            selectedCol?.type === "date" || selectedCol?.type === "datetime"
                              ? "YYYY-MM-DD"
                              : "Filter value..."
                          }
                          required
                          className="w-full rounded-md border border-[#2e2e2e] bg-[#121212] p-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none"
                        />
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-1.5 border-t border-[#242424]">
                    <button
                      type="button"
                      onClick={() => setIsAddOpen(false)}
                      className="rounded px-2.5 py-1 text-[#898989] hover:bg-white/5 hover:text-white font-normal cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={operator === "in" && selectedMultiValues.length === 0}
                      className="rounded bg-[#ff6b35] hover:bg-[#c2410c] px-3 py-1 text-white font-medium shadow-xs disabled:opacity-50 cursor-pointer transition"
                    >
                      Apply
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Relative Date Presets Button (shown when date columns exist) */}
          {dateColumns.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsDatePresetsOpen(!isDatePresetsOpen);
                  setIsAddOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-1 text-xs font-normal text-[#dedede] hover:bg-[#222222] hover:text-[#fafafa] hover:border-[#ff6b35]/40 transition cursor-pointer"
              >
                <Calendar className="h-3 w-3 text-[#ff6b35]" />
                <span>Date Presets</span>
                <ChevronDown className="h-3 w-3 text-[#898989] ml-0.5" />
              </button>

              {isDatePresetsOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-[#2a2a2a] bg-[#171717] p-3 shadow-2xl z-30 text-[#fafafa]">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#242424]">
                    <span className="text-xs font-medium text-[#fafafa] flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#ff6b35]" />
                      <span>Relative Date Presets</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDatePresetsOpen(false)}
                      className="text-[#898989] hover:text-[#fafafa] text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  {dateColumns.length > 1 && (
                    <div className="mb-2">
                      <label className="text-[10px] font-medium text-[#898989] block mb-0.5">
                        Date Field
                      </label>
                      <select
                        value={selectedDateField || dateColumns[0]?.name}
                        onChange={(e) => setSelectedDateField(e.target.value)}
                        className="w-full rounded-md border border-[#2e2e2e] bg-[#121212] p-1 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                      >
                        {dateColumns.map((col) => (
                          <option key={col.name} value={col.name} className="bg-[#141414] text-[#fafafa]">
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    {(
                      [
                        "Today",
                        "Yesterday",
                        "Last 7 days",
                        "Last 30 days",
                        "This month",
                      ] as RelativeDatePreset[]
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleApplyDatePreset(preset)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-normal text-[#dedede] hover:bg-[#ff6b35]/10 hover:text-[#ff8c5a] transition flex items-center justify-between cursor-pointer"
                      >
                        <span>{preset}</span>
                        <span className="text-[10px] text-[#898989] font-mono">preset</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Clear All & Reset Buttons */}
        <div className="flex items-center gap-2 text-xs">
          {filters.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[#898989] hover:text-[#ef4444] font-normal px-2 py-1 rounded transition hover:bg-white/5 cursor-pointer"
            >
              Clear all ({filters.length})
            </button>
          )}

          <button
            type="button"
            onClick={onResetDashboard}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-1 text-xs font-normal text-[#dedede] hover:text-white hover:bg-[#222222] transition cursor-pointer"
            title="Reset all filters and refresh visualizations"
          >
            <RotateCcw className="h-3 w-3 text-[#898989]" />
            <span>Reset Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
