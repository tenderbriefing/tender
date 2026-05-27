'use client'

import { MagnifyingGlassIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { ProcurementFilterState, TenderSortKey } from '@/lib/procurement/filters'

interface TenderFiltersBarProps {
  filters: ProcurementFilterState
  onChange: (filters: ProcurementFilterState) => void
  onReset: () => void
  sortKey: TenderSortKey
  sortDir: 'asc' | 'desc'
  onSortChange: (key: TenderSortKey, dir: 'asc' | 'desc') => void
  options: {
    provinces: string[]
    departments: string[]
  }
  resultCount: number
}

const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20'

export default function TenderFiltersBar({
  filters,
  onChange,
  onReset,
  sortKey,
  sortDir,
  onSortChange,
  options,
  resultCount,
}: TenderFiltersBarProps) {
  const hasActive =
    filters.search ||
    filters.province ||
    filters.department ||
    filters.status !== 'active'

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700 ring-1 ring-inset ring-accent-200">
            <ShieldCheckIcon className="h-3.5 w-3.5" aria-hidden />
            Compulsory briefings only
          </span>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search compulsory briefings by title, description, or department…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            aria-label="Search compulsory briefings"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Province
            </span>
            <select
              value={filters.province}
              onChange={(e) => onChange({ ...filters, province: e.target.value })}
              className={selectClass}
            >
              <option value="">All provinces</option>
              {options.provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Department
            </span>
            <select
              value={filters.department}
              onChange={(e) => onChange({ ...filters, department: e.target.value })}
              className={selectClass}
            >
              <option value="">All departments</option>
              {options.departments.map((d) => (
                <option key={d} value={d}>
                  {d.length > 42 ? `${d.slice(0, 42)}…` : d}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(e) => onChange({ ...filters, status: e.target.value })}
              className={selectClass}
            >
              <option value="active">Open / Active</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
              <option value="">All statuses</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sort by
            </span>
            <select
              value={`${sortKey}-${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split('-') as [TenderSortKey, 'asc' | 'desc']
                onSortChange(key, dir)
              }}
              className={selectClass}
            >
              <option value="closingDate-asc">Closing date (soonest)</option>
              <option value="closingDate-desc">Closing date (latest)</option>
              <option value="briefingDate-asc">Briefing date (soonest)</option>
              <option value="department-asc">Department (A–Z)</option>
              <option value="province-asc">Province (A–Z)</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-brand-900">{resultCount}</span> compulsory
            briefing{resultCount === 1 ? '' : 's'} match your filters
          </p>
          {hasActive && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden />
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
