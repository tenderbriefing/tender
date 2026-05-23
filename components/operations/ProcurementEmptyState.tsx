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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {Icon && <Icon className="mx-auto h-10 w-10 text-slate-300" aria-hidden />}
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
