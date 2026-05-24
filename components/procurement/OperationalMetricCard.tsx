import type { ReactNode } from 'react'

export default function OperationalMetricCard({
  label,
  value,
  hint,
  icon,
  pulse,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  pulse?: boolean
}) {
  return (
    <div
      className={`procurement-metric-card ${pulse ? 'procurement-metric-pulse' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
