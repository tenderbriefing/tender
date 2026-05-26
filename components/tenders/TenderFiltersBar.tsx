'use client'

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { ProcurementFilterState, TenderSortKey } from '@/lib/procurement/filters'

type BriefingTypeFilter = ProcurementFilterState['briefingType']

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
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'

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
    filters.status !== 'active' ||
    filters.briefingType

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search tenders by title, description, or department…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            aria-label="Search tenders"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              Briefing
            </span>
            <select
              value={filters.briefingType}
              onChange={(e) =>
                onChange({
                  ...filters,
                  briefingType: e.target.value as BriefingTypeFilter,
                })
              }
              className={selectClass}
            >
              <option value="">All briefing types</option>
              <option value="compulsory">Compulsory briefing</option>
              <option value="has_briefing">Briefing available</option>
              <option value="optional">Optional / no compulsory</option>
              <option value="none">No briefing listed</option>
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
            <span className="font-semibold text-slate-900">{resultCount}</span> opportunities
            match your filters
          </p>
          {hasActive && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
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
