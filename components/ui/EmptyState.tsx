import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-dashed border-brand-200 bg-gradient-to-br from-brand-50/40 via-white to-accent-50/30 p-10 text-center ${className}`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent-100/50 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-brand-200/40 blur-2xl" />

      {Icon && (
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 text-accent-400 shadow-soft">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
      )}
      <h3 className="relative text-lg font-bold text-brand-900">{title}</h3>
      {description && (
        <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          {description}
        </p>
      )}
      {action && (
        <div className="relative mt-6">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
