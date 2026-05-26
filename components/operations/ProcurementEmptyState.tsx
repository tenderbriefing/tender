import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface ProcurementEmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  icon?: LucideIcon
}

export default function ProcurementEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon,
}: ProcurementEmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-brand-200 bg-gradient-to-br from-brand-50/40 via-white to-accent-50/30 px-6 py-12 text-center">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent-100/50 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-brand-200/40 blur-2xl" />

      {Icon && (
        <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 text-accent-400 shadow-soft">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <h3 className="relative text-base font-bold text-brand-900">{title}</h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="relative mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
