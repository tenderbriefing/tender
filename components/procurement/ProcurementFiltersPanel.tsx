'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react'
import type { ProcurementFilterState } from '@/lib/procurement/filters'
import { defaultProcurementFilters } from '@/lib/procurement/filters'

interface Options {
  provinces: string[]
  departments: string[]
  categories: string[]
  tenderTypes: string[]
}

interface ProcurementFiltersPanelProps {
  filters: ProcurementFilterState
  onChange: (filters: ProcurementFilterState) => void
  options: Options
  resultCount: number
}

export default function ProcurementFiltersPanel({
  filters,
  onChange,
  options,
  resultCount,
}: ProcurementFiltersPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const set = (patch: Partial<ProcurementFilterState>) =>
    onChange({ ...filters, ...patch })

  const activeChips = [
    filters.tenderNumber && { key: 'tenderNumber', label: `Tender # ${filters.tenderNumber}` },
    filters.search && { key: 'search', label: `Search: ${filters.search}` },
    filters.province && { key: 'province', label: filters.province },
    filters.department && { key: 'department', label: filters.department },
    filters.category && { key: 'category', label: filters.category },
    filters.compulsoryOnly && { key: 'compulsoryOnly', label: 'Compulsory only' },
    filters.closingSoon && { key: 'closingSoon', label: 'Closing soon' },
    filters.briefingsThisWeek && { key: 'briefingsThisWeek', label: 'Briefings this week' },
  ].filter(Boolean) as { key: string; label: string }[]

  const panel = (
    <div className="space-y-4">
      <div>
        <label className="form-label">Tender Number</label>
        <input
          className="form-input"
          placeholder="e.g. RFQ, RFP reference"
          value={filters.tenderNumber}
          onChange={(e) => set({ tenderNumber: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Description / Title</label>
        <input
          className="form-input"
          placeholder="Search description"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Province</label>
        <select
          className="form-input"
          value={filters.province}
          onChange={(e) => set({ province: e.target.value })}
        >
          <option value="">All provinces</option>
          {options.provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Department</label>
        <select
          className="form-input"
          value={filters.department}
          onChange={(e) => set({ department: e.target.value })}
        >
          <option value="">All departments</option>
          {options.departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Category</label>
        <select
          className="form-input"
          value={filters.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {options.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Tender type</label>
        <select
          className="form-input"
          value={filters.tenderType}
          onChange={(e) => set({ tenderType: e.target.value })}
        >
          <option value="">All types</option>
          {options.tenderTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="form-label">Closing from</label>
          <input
            type="date"
            className="form-input"
            value={filters.closingFrom}
            onChange={(e) => set({ closingFrom: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Closing to</label>
          <input
            type="date"
            className="form-input"
            value={filters.closingTo}
            onChange={(e) => set({ closingTo: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2 border-t border-slate-200 pt-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.briefingRequired}
            onChange={(e) => set({ briefingRequired: e.target.checked })}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Briefing required
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.compulsoryOnly}
            onChange={(e) => set({ compulsoryOnly: e.target.checked })}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Compulsory briefing only
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.closingSoon}
            onChange={(e) => set({ closingSoon: e.target.checked })}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Closing soon (7 days)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.briefingsThisWeek}
            onChange={(e) => set({ briefingsThisWeek: e.target.checked })}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Briefings this week
        </label>
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...defaultProcurementFilters })}
        className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Clear all filters
      </button>
    </div>
  )

  return (
    <>
      <button
        type="button"
        className="lg:hidden flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-controls="procurement-filters-panel"
      >
        <span className="inline-flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters ({resultCount} results)
        </span>
        {mobileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                const patch: Partial<ProcurementFilterState> = {}
                if (chip.key === 'compulsoryOnly') patch.compulsoryOnly = false
                else if (chip.key === 'closingSoon') patch.closingSoon = false
                else if (chip.key === 'briefingsThisWeek') patch.briefingsThisWeek = false
                else patch[chip.key as keyof ProcurementFilterState] = '' as never
                set(patch)
              }}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      <aside
        id="procurement-filters-panel"
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } lg:block lg:sticky lg:top-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm`}
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 mb-4">
          Search &amp; filter opportunities
        </h2>
        {panel}
      </aside>
    </>
  )
}
