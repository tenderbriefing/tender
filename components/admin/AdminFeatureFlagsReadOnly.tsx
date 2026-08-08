'use client'

import { getClientFeatureFlagSnapshot } from '@/lib/admin/controlCentre'

export default function AdminFeatureFlagsReadOnly() {
  const flags = getClientFeatureFlagSnapshot()

  return (
    <section aria-labelledby="feature-flags-heading" className="space-y-3">
      <div>
        <h3 id="feature-flags-heading" className="text-sm font-semibold text-brand-900">
          Feature flags
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Read-only client mirrors. Enablement is controlled via environment variables.
        </p>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {flags.map((flag) => (
          <li
            key={flag.key}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-900">{flag.label}</p>
              <p className="text-xs text-slate-500">{flag.note}</p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center self-start rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset sm:self-auto ${
                flag.enabled
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
                  : 'bg-slate-50 text-slate-600 ring-slate-200'
              }`}
            >
              {flag.enabled ? 'On' : 'Off'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
