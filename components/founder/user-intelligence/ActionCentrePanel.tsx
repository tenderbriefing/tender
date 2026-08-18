'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { AudienceBadge, HorizontalBarList, PriorityBadge } from './charts'
import { EmptyPanel } from './chrome'
import type { ActionItem } from './types'

const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 }

export function ActionCentrePanel({ actions }: { actions?: ActionItem[] }) {
  const items = [...(actions || [])].sort(
    (a, b) =>
      (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0) ||
      (b.affectedCount || 0) - (a.affectedCount || 0)
  )

  const byPriority = ['high', 'medium', 'low'].map((p) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    value: items.filter((a) => a.priority === p).reduce((s, a) => s + (a.affectedCount || 0), 0),
  }))

  const byAudience = [
    {
      label: 'SME',
      value: items
        .filter((a) => a.audience === 'sme')
        .reduce((s, a) => s + (a.affectedCount || 0), 0),
    },
    {
      label: 'Youth Agent',
      value: items
        .filter((a) => a.audience === 'youth-agent' || a.audience === 'agent')
        .reduce((s, a) => s + (a.affectedCount || 0), 0),
    },
  ]

  if (items.length === 0) {
    return (
      <EmptyPanel
        title="No intervention recommendations right now"
        description="Action Centre surfaces advisory prompts when engagement or coverage gaps appear."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-brand-900">Affected users by priority</h3>
          <p className="mt-0.5 text-xs text-slate-500">Sum of affected counts in each band</p>
          <div className="mt-4">
            <HorizontalBarList
              rows={byPriority}
              color="#0F1E3D"
              emptyLabel="No priority totals"
            />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-brand-900">Affected users by audience</h3>
          <p className="mt-0.5 text-xs text-slate-500">SME and Youth Agent stay separated</p>
          <div className="mt-4">
            <HorizontalBarList
              rows={byAudience}
              color="#D4AF37"
              emptyLabel="No audience totals"
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {items.map((a) => (
          <article
            key={a.id}
            className={`px-4 py-4 sm:px-5 ${
              a.priority === 'high'
                ? 'border-l-[3px] border-l-amber-500'
                : a.priority === 'medium'
                  ? 'border-l-[3px] border-l-brand-800'
                  : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AudienceBadge audience={a.audience} />
                  <PriorityBadge priority={a.priority} />
                </div>
                <h3 className="text-sm font-semibold text-brand-900">{a.title}</h3>
              </div>
              <span className="text-xs font-semibold tabular-nums text-slate-600">
                {a.affectedCount.toLocaleString('en-ZA')} affected
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Why:</span> {a.why}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Suggested:</span>{' '}
              {a.suggestedAction}
            </p>
          </article>
        ))}
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        Recommendations are advisory. No automated messaging or reassignment is performed.
      </p>
    </div>
  )
}
