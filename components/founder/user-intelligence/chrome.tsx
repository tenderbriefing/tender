'use client'

import { formatCount } from './charts'

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-900">
            {icon}
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

/** @deprecated Prefer metric strips; kept for role/network panels that still use cards */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number | null | undefined
  hint?: string
  accent?: 'navy' | 'gold' | 'muted'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-brand-900">
        {formatCount(value)}
      </p>
      {hint ? <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function EmptyPanel({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
      ) : null}
    </div>
  )
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
      <p className="font-semibold">Could not load intelligence</p>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-semibold underline underline-offset-2"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm sm:px-5">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="font-semibold text-brand-800 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="tabular-nums text-slate-500">
        Page {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="font-semibold text-brand-800 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  )
}
