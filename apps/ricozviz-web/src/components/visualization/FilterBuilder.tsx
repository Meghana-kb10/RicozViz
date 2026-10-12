"use client";

import React from "react";
import { Plus, Trash2, Filter as FilterIcon } from "lucide-react";
import type { DatasetColumn, FilterOperator, ChartFilter } from "../../lib/api";

export const FILTER_OPERATORS: { value: FilterOperator; label: string; unary?: boolean }[] = [
  { value: "=", label: "= equals" },
  { value: "!=", label: "!= not equals" },
  { value: ">", label: "> greater than" },
  { value: ">=", label: ">= greater than or equal" },
  { value: "<", label: "< less than" },
  { value: "<=", label: "<= less than or equal" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "isNull", label: "is null", unary: true },
  { value: "isNotNull", label: "is not null", unary: true },
];

export interface FilterBuilderProps {
  columns: DatasetColumn[];
  filters: ChartFilter[];
  filterLogic: "AND" | "OR";
  onChangeFilterLogic: (logic: "AND" | "OR") => void;
  onAddFilter: () => void;
  onUpdateFilter: (index: number, updated: ChartFilter) => void;
  onRemoveFilter: (index: number) => void;
}

export function FilterBuilder({
  columns,
  filters,
  filterLogic,
  onChangeFilterLogic,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
}: FilterBuilderProps) {
  const getColumnType = (colName: string): string => {
    const col = columns.find((c) => c.name === colName);
    return col?.type || "string";
  };

  return (
    <div className="space-y-3">
      {/* Filter Logic Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <FilterIcon className="h-3.5 w-3.5 text-indigo-600" />
          <span>Filters ({filters.length})</span>
        </div>

        {filters.length > 1 && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => onChangeFilterLogic("AND")}
              className={`px-2 py-0.5 rounded transition ${
                filterLogic === "AND"
                  ? "bg-white text-indigo-600 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              AND
            </button>
            <button
              type="button"
              onClick={() => onChangeFilterLogic("OR")}
              className={`px-2 py-0.5 rounded transition ${
                filterLogic === "OR"
                  ? "bg-white text-indigo-600 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              OR
            </button>
          </div>
        )}
      </div>

      {/* Filter Rows */}
      {filters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-400">No active filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filters.map((filter, idx) => {
            const opConfig = FILTER_OPERATORS.find((op) => op.value === filter.operator);
            const isUnary = opConfig?.unary ?? false;
            const colType = getColumnType(filter.column);

            return (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 p-2 text-xs"
              >
                {/* Column Select */}
                <select
                  value={filter.column}
                  onChange={(e) =>
                    onUpdateFilter(idx, {
                      ...filter,
                      column: e.target.value,
                    })
                  }
                  className="w-1/3 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select Field...
                  </option>
                  {columns.map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.type})
                    </option>
                  ))}
                </select>

                {/* Operator Select */}
                <select
                  value={filter.operator}
                  onChange={(e) =>
                    onUpdateFilter(idx, {
                      ...filter,
                      operator: e.target.value,
                    })
                  }
                  className="w-1/3 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                >
                  {FILTER_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value Input (Hidden if unary operator like isNull/isNotNull) */}
                {!isUnary ? (
                  <input
                    type={colType === "number" || colType === "integer" ? "number" : "text"}
                    value={filter.value !== undefined && filter.value !== null ? String(filter.value) : ""}
                    onChange={(e) => {
                      const val =
                        colType === "number" || colType === "integer"
                          ? e.target.value === ""
                            ? undefined
                            : Number(e.target.value)
                          : e.target.value;
                      onUpdateFilter(idx, {
                        ...filter,
                        value: val,
                      });
                    }}
                    placeholder="Value..."
                    className="w-1/3 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                  />
                ) : (
                  <div className="w-1/3 text-[11px] text-gray-400 italic px-2">No value needed</div>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemoveFilter(idx)}
                  className="p-1 text-gray-400 hover:text-red-600 transition rounded"
                  title="Remove Filter"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Filter Button */}
      <button
        type="button"
        onClick={onAddFilter}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-semibold text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add Filter Condition</span>
      </button>
    </div>
  );
}
