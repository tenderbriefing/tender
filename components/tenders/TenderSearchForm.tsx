'use client'

import { FormEvent, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { buildTendersSearchHref, normalizeTenderSearchQuery } from '@/lib/procurement/tenderSearch'

type Variant = 'hero' | 'inline' | 'compact'

interface TenderSearchFormProps {
  variant?: Variant
  initialQuery?: string
  className?: string
  autoFocus?: boolean
  onNavigate?: (href: string) => void
}

export default function TenderSearchForm({
  variant = 'inline',
  initialQuery = '',
  className = '',
  autoFocus = false,
  onNavigate,
}: TenderSearchFormProps) {
  const router = useRouter()
  const inputId = useId()
  const [query, setQuery] = useState(initialQuery)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const q = normalizeTenderSearchQuery(query)
    const href = buildTendersSearchHref({ q })
    if (onNavigate) onNavigate(href)
    else router.push(href)
  }

  const isHero = variant === 'hero'
  const isCompact = variant === 'compact'

  return (
    <form
      role="search"
      onSubmit={submit}
      className={`w-full ${className}`}
      aria-label="Search tenders"
    >
      <div
        className={
          isHero
            ? 'flex w-full flex-col gap-3 sm:flex-row sm:items-stretch'
            : isCompact
              ? 'flex w-full items-center gap-2'
              : 'flex w-full flex-col gap-2 sm:flex-row sm:items-stretch'
        }
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            Search tenders
          </label>
          <MagnifyingGlassIcon
            className={`pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${
              isHero ? 'text-brand-200' : 'text-slate-400'
            }`}
            aria-hidden
          />
          <input
            id={inputId}
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by keyword, tender number or organisation"
            autoFocus={autoFocus}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={120}
            className={
              isHero
                ? 'w-full rounded-xl border border-white/25 bg-white/10 py-3.5 pl-11 pr-4 text-base text-white placeholder:text-brand-100/60 backdrop-blur-sm focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/40'
                : isCompact
                  ? 'w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20'
                  : 'w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20'
            }
          />
        </div>
        <button
          type="submit"
          className={
            isHero
              ? 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-brand-950 shadow-gold transition hover:bg-accent-400 sm:shrink-0'
              : isCompact
                ? 'inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700'
                : 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 sm:shrink-0'
          }
        >
          <MagnifyingGlassIcon className="h-5 w-5 sm:hidden" aria-hidden />
          <span>Search tenders</span>
        </button>
      </div>
    </form>
  )
}
