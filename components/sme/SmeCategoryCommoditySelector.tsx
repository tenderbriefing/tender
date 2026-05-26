'use client'

import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  CSD_PROCUREMENT_CATEGORIES,
  getCategoryByName,
  searchCatalog,
} from '@/lib/data/csdProcurementCatalog'

export type SmeCategoryCommoditySelection = {
  categories: string[]
  commodities: string[]
}

type Props = {
  value: SmeCategoryCommoditySelection
  onChange: (value: SmeCategoryCommoditySelection) => void
  showFreeModelBanner?: boolean
}

export default function SmeCategoryCommoditySelector({
  value,
  onChange,
  showFreeModelBanner = true,
}: Props) {
  const [search, setSearch] = useState('')

  const { categories: filteredCategories, commodityHits } = useMemo(
    () => searchCatalog(search),
    [search]
  )

  const selectedCategorySet = useMemo(
    () => new Set(value.categories),
    [value.categories]
  )

  const toggleCategory = (name: string) => {
    if (selectedCategorySet.has(name)) {
      const cat = getCategoryByName(name)
      const remainingCommodities = value.commodities.filter(
        (c) => !cat?.commodities.includes(c)
      )
      onChange({
        categories: value.categories.filter((c) => c !== name),
        commodities: remainingCommodities,
      })
    } else {
      onChange({
        categories: [...value.categories, name],
        commodities: value.commodities,
      })
    }
  }

  const toggleCommodity = (commodity: string) => {
    if (value.commodities.includes(commodity)) {
      onChange({
        ...value,
        commodities: value.commodities.filter((c) => c !== commodity),
      })
    } else {
      onChange({
        ...value,
        commodities: [...value.commodities, commodity],
      })
    }
  }

  const removeChip = (type: 'category' | 'commodity', label: string) => {
    if (type === 'category') toggleCategory(label)
    else toggleCommodity(label)
  }

  const selectedCategoriesWithCommodities = CSD_PROCUREMENT_CATEGORIES.filter((c) =>
    selectedCategorySet.has(c.name)
  )

  return (
    <div className="space-y-6">
      {showFreeModelBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-900">
            TenderBriefing is free for SMEs
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            You only pay R249 when you request a verified Youth Agent to attend a compulsory
            briefing on your behalf.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-slate-900">Business categories & commodities</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Select your business categories and commodities so TenderBriefing can match you with
          relevant tender opportunities and compulsory briefing sessions.
        </p>
      </div>

      {(value.categories.length > 0 || value.commodities.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your selections
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {value.categories.map((name) => (
              <span
                key={`cat-${name}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-900"
              >
                <span className="truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => removeChip('category', name)}
                  className="rounded-full p-0.5 hover:bg-brand-100"
                  aria-label={`Remove ${name}`}
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {value.commodities.map((name) => (
              <span
                key={`com-${name}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
              >
                <span className="truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => removeChip('commodity', name)}
                  className="rounded-full p-0.5 hover:bg-slate-100"
                  aria-label={`Remove ${name}`}
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories and commodities…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {search.trim() && commodityHits.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Commodity matches
          </p>
          <ul className="mt-2 space-y-2">
            {commodityHits.slice(0, 8).map(({ category, commodity }) => (
              <li key={`${category}-${commodity}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-700">{commodity}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{category}</span>
                {!selectedCategorySet.has(category) && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="text-xs font-semibold text-brand-700 hover:underline"
                  >
                    Add category
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-800">Step 1 — Select business categories</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredCategories.map((category) => {
            const selected = selectedCategorySet.has(category.name)
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.name)}
                className={`rounded-xl border p-4 text-left transition shadow-sm ${
                  selected
                    ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/30'
                    : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{category.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {category.commodities.length} commodities available
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {selected ? '✓' : ''}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedCategoriesWithCommodities.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            Step 2 — Select commodities (optional but improves matching)
          </p>
          {selectedCategoriesWithCommodities.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h4 className="font-semibold text-brand-800">{category.name}</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {category.commodities
                  .filter(
                    (c) =>
                      !search.trim() ||
                      c.toLowerCase().includes(search.trim().toLowerCase()) ||
                      category.name.toLowerCase().includes(search.trim().toLowerCase())
                  )
                  .map((commodity) => {
                    const selected = value.commodities.includes(commodity)
                    return (
                      <button
                        key={commodity}
                        type="button"
                        onClick={() => toggleCommodity(commodity)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition sm:text-sm ${
                          selected
                            ? 'border-brand-500 bg-brand-50 text-brand-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-200'
                        }`}
                      >
                        {commodity}
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {value.categories.length === 0 && (
        <p className="text-sm text-slate-500">
          Select at least one category to continue. You can add commodities after choosing categories.
        </p>
      )}
    </div>
  )
}
