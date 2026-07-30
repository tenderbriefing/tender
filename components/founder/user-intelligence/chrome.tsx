'use client'

import { formatCount } from './charts'

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string | number | null | undefined
  hint?: string
  accent?: 'navy' | 'gold' | 'muted'
}) {
  const border =
    accent === 'gold'
      ? 'border-l-accent-500'
      : accent === 'navy'
        ? 'border-l-brand-800'
        : 'border-l-transparent'

  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm border-l-[3px] ${border}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-brand-900">
        {formatCount(value)}
      </p>
      {hint && <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>}
    </div>
  )
}

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
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-brand-900 sm:text-lg">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
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
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
      <p className="font-semibold">Could not load intelligence</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-semibold underline underline-offset-2"
        >
          Retry
        </button>
      )}
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
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
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
