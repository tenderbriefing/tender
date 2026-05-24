'use client'

import { SA_PROVINCES } from '@/lib/procurement/provinces'

export default function QuickProvinceFilters({
  activeProvince,
  onSelect,
  availableProvinces,
}: {
  activeProvince: string
  onSelect: (province: string) => void
  availableProvinces?: string[]
}) {
  const provinces =
    availableProvinces && availableProvinces.length > 0
      ? availableProvinces
      : [...SA_PROVINCES]

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick province filters">
      <button
        type="button"
        onClick={() => onSelect('')}
        className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          !activeProvince
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'
        }`}
      >
        All provinces
      </button>
      {provinces.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(activeProvince === p ? '' : p)}
          className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            activeProvince === p
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
