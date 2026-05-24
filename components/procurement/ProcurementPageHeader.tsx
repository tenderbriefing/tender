import type { ReactNode } from 'react'
import Link from 'next/link'

interface ProcurementPageHeaderProps {
  kicker?: string
  title: string
  description?: string
  breadcrumb?: { label: string; href: string }
  actions?: ReactNode
  meta?: ReactNode
  maxWidthClass?: string
}

export default function ProcurementPageHeader({
  kicker,
  title,
  description,
  breadcrumb,
  actions,
  meta,
  maxWidthClass = 'max-w-7xl',
}: ProcurementPageHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className={`mx-auto px-4 py-6 sm:px-6 lg:px-8 ${maxWidthClass}`}>
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="mb-3 text-sm">
            <Link
              href={breadcrumb.href}
              className="font-medium text-brand-700 hover:text-brand-800"
            >
              ← {breadcrumb.label}
            </Link>
          </nav>
        )}
        {kicker && <p className="procurement-kicker">{kicker}</p>}
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="procurement-page-header">{title}</h1>
            {description && (
              <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">{description}</p>
            )}
            {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    </header>
  )
}
