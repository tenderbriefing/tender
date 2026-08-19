'use client'

import Link from 'next/link'
import { formatZarFromCents, type NeedsAttentionItem } from '@/lib/founder/dashboard'
import type { PresentationalLifecycle } from '@/lib/founder/dashboard'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-900 border-t-transparent" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
      <p className="font-semibold">Could not load this view</p>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 font-semibold underline underline-offset-2"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-6 py-14 text-center">
      <p className="text-sm font-medium text-brand-900">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  )
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const options = [
    { id: '7', label: '7 Days' },
    { id: '30', label: '30 Days' },
    { id: '90', label: '90 Days' },
    { id: 'all', label: 'All Time' },
  ]
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`min-h-[36px] rounded px-3 text-xs font-semibold ${
            value === opt.id ? 'bg-brand-900 text-white' : 'text-slate-600 hover:text-brand-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function KpiStrip({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>
}) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white lg:grid-cols-6">
      {items.map((kpi, i) => (
        <div
          key={kpi.label}
          className={`px-4 py-5 sm:px-5 ${i ? 'border-t border-slate-100 lg:border-l lg:border-t-0' : ''}`}
        >
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {kpi.label}
          </dt>
          <dd className="mt-2 text-[1.75rem] font-semibold tabular-nums tracking-tight text-brand-900">
            {kpi.value}
          </dd>
          {kpi.hint ? <p className="mt-1 text-[11px] text-slate-400">{kpi.hint}</p> : null}
        </div>
      ))}
    </dl>
  )
}

export function ActivityChart({
  points,
}: {
  points: Array<{
    date: string
    smeRegistrations: number
    youthAgentRegistrations: number
    paidBookings: number
  }>
}) {
  const max = Math.max(
    1,
    ...points.flatMap((p) => [p.smeRegistrations, p.youthAgentRegistrations, p.paidBookings])
  )
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-semibold text-brand-900">Business Activity</h2>
        <ul className="flex gap-4 text-[11px] text-slate-500">
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-800" /> SMEs
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Youth Agents
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" /> Paid bookings
          </li>
        </ul>
      </div>
      {points.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No activity in this period.</p>
      ) : (
        <div className="mt-6 flex h-36 items-end gap-px sm:gap-1">
          {points.map((p) => (
            <div key={p.date} className="flex min-w-0 flex-1 items-end justify-center gap-px">
              <span
                className="w-1 rounded-t bg-brand-800/80 sm:w-1.5"
                style={{ height: `${(p.smeRegistrations / max) * 100}%`, minHeight: p.smeRegistrations ? 2 : 0 }}
                title={`${p.date} SME ${p.smeRegistrations}`}
              />
              <span
                className="w-1 rounded-t bg-brand-400/80 sm:w-1.5"
                style={{
                  height: `${(p.youthAgentRegistrations / max) * 100}%`,
                  minHeight: p.youthAgentRegistrations ? 2 : 0,
                }}
                title={`${p.date} YA ${p.youthAgentRegistrations}`}
              />
              <span
                className="w-1 rounded-t bg-accent-500/80 sm:w-1.5"
                style={{ height: `${(p.paidBookings / max) * 100}%`, minHeight: p.paidBookings ? 2 : 0 }}
                title={`${p.date} Paid ${p.paidBookings}`}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function NeedsAttention({ items }: { items: NeedsAttentionItem[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-brand-900">Needs Attention</h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Nothing requires your attention.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="block px-4 py-3.5 transition hover:bg-slate-50"
              >
                <p className="text-sm font-medium text-brand-900">{item.title}</p>
                {item.detail ? (
                  <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const LIFECYCLE_TONE: Record<string, string> = {
  paid: 'bg-brand-50 text-brand-800',
  agent_assigned: 'bg-slate-100 text-slate-700',
  attended: 'bg-emerald-50 text-emerald-800',
  report_delivered: 'bg-accent-50 text-accent-800',
  cancelled: 'bg-slate-100 text-slate-500',
  unpaid: 'bg-slate-50 text-slate-500',
}

export function LifecycleBadge({
  lifecycle,
  label,
}: {
  lifecycle: PresentationalLifecycle | string
  label: string
}) {
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
        LIFECYCLE_TONE[lifecycle] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {label}
    </span>
  )
}

export function SearchPager({
  q,
  onQuery,
  page,
  totalPages,
  onPage,
  placeholder,
}: {
  q: string
  onQuery: (v: string) => void
  page: number
  totalPages: number
  onPage: (p: number) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        value={q}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full max-w-md rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-900/15 focus:ring-2"
      />
      {totalPages > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="font-semibold text-brand-800 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="tabular-nums text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            className="font-semibold text-brand-800 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function Money({ cents }: { cents: number | null | undefined }) {
  return <span className="tabular-nums">{formatZarFromCents(cents)}</span>
}
