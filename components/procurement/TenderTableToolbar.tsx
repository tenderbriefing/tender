'use client'

import { TENDER_TABLE_COLUMNS, type TenderColumnKey } from '@/lib/procurement/tableColumns'
import { Columns, RotateCcw } from 'lucide-react'

export default function TenderTableToolbar({
  visibleColumns,
  onToggleColumn,
  onResetColumns,
  resultCount,
}: {
  visibleColumns: Set<TenderColumnKey>
  onToggleColumn: (key: TenderColumnKey) => void
  onResetColumns: () => void
  resultCount: number
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{resultCount}</span> opportunities
        displayed
      </p>
      <details className="relative">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <Columns className="h-4 w-4" aria-hidden />
          Columns
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Show columns</p>
          <ul className="space-y-1">
            {TENDER_TABLE_COLUMNS.map((col) => (
              <li key={col.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => onToggleColumn(col.key)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {col.label}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onResetColumns}
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset columns
          </button>
        </div>
      </details>
    </div>
  )
}
