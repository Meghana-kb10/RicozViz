import React, { type ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found.',
  isLoading = false,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs font-mono-code text-[#898989] border border-[#242424] rounded-xl bg-[#141414]">
        Loading records...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-xs font-mono-code text-[#666666] border border-[#242424] rounded-xl bg-[#141414]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-xl border border-[#242424] bg-[#141414] ${className}`}>
      <table className="w-full border-collapse text-left text-xs font-mono-code">
        <thead>
          <tr className="border-b border-[#242424] bg-[#171717]/80 text-[#898989]">
            {columns.map((col) => (
              <th key={col.key} className={`p-3 font-semibold uppercase tracking-wider ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e1e] text-[#fafafa]">
          {data.map((item, index) => (
            <tr key={keyExtractor(item, index)} className="hover:bg-[#1a1a1a] transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`p-3 ${col.className || ''}`}>
                  {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
