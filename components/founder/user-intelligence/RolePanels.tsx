'use client'

import { BuildingOffice2Icon, UserGroupIcon } from '@heroicons/react/24/outline'
import { EngagementBadge } from './charts'
import { EmptyPanel, Pagination } from './chrome'
import type { AgentRow, Paginated, SmeRow } from './types'

export function SmeIntelligencePanel({
  data,
  onSelect,
  onPageChange,
}: {
  data?: Paginated<SmeRow>
  onSelect: (uid: string) => void
  onPageChange: (page: number) => void
}) {
  const items = data?.items || []

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-900">
              <BuildingOffice2Icon className="h-5 w-5 text-brand-700" />
              SME Intelligence
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {(data?.total ?? 0).toLocaleString('en-ZA')} SMEs · separate from Youth Agents
            </p>
          </div>
          <span className="rounded-md bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-inset ring-brand-100">
            SME only
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-5">
          <EmptyPanel
            title="No SMEs match these filters"
            description="Try clearing search or province filters."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-semibold">Business</th>
                <th className="px-3 py-3 font-semibold">Location</th>
                <th className="px-3 py-3 font-semibold">Engagement</th>
                <th className="px-3 py-3 font-semibold">Activity</th>
                <th className="px-3 py-3 font-semibold">Agent links</th>
                <th className="px-5 py-3 text-right font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer border-b border-slate-50 transition hover:bg-brand-50/40"
                  onClick={() => onSelect(s.id)}
                >
                  <td className="px-5 py-3">
                    <p className="font-semibold text-brand-900">
                      {s.companyName || s.displayName || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.displayName || '—'} · {s.email || '—'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {s.province || 'Unknown'}
                    {s.city ? `, ${s.city}` : ''}
                  </td>
                  <td className="px-3 py-3">
                    <EngagementBadge value={s.engagement} />
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    Saved {s.tendersSaved ?? 0} · Tracked {s.tendersTracked ?? 0} · Requests{' '}
                    {s.attendanceRequests ?? 0}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-800">
                    {s.assignedAgentCount ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600">
                    {s.registeredAt
                      ? new Date(s.registeredAt).toLocaleDateString('en-ZA')
                      : '—'}
                    <div className="text-slate-400">{s.daysOnPlatform ?? '—'}d</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data?.page || 1}
        totalPages={data?.totalPages || 1}
        onChange={onPageChange}
      />
    </section>
  )
}

export function AgentIntelligencePanel({
  data,
  onSelect,
  onPageChange,
}: {
  data?: Paginated<AgentRow>
  onSelect: (uid: string) => void
  onPageChange: (page: number) => void
}) {
  const items = data?.items || []

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-900">
              <UserGroupIcon className="h-5 w-5 text-accent-600" />
              Youth Agent Intelligence
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {(data?.total ?? 0).toLocaleString('en-ZA')} agents · service delivery focus
            </p>
          </div>
          <span className="rounded-md bg-accent-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-900 ring-1 ring-inset ring-accent-200">
            Agent only
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-5">
          <EmptyPanel
            title="No Youth Agents match these filters"
            description="Try clearing search or province filters."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-semibold">Agent</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Engagement</th>
                <th className="px-3 py-3 font-semibold">Portfolio</th>
                <th className="px-3 py-3 font-semibold">Jobs</th>
                <th className="px-5 py-3 text-right font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-b border-slate-50 transition hover:bg-accent-50/30"
                  onClick={() => onSelect(a.id)}
                >
                  <td className="px-5 py-3">
                    <p className="font-semibold text-brand-900">{a.displayName || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">
                      {a.email || '—'} · {a.province || 'Unknown'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-700">{a.agentStatus || 'Unknown'}</td>
                  <td className="px-3 py-3">
                    <EngagementBadge value={a.engagement} />
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-800">
                    {a.assignedSmeCount ?? 0} SMEs
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {a.completedBriefingCount ?? 0}/{a.acceptedBriefingCount ?? 0} · score{' '}
                    {a.reliabilityScore ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600">
                    {a.registeredAt
                      ? new Date(a.registeredAt).toLocaleDateString('en-ZA')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data?.page || 1}
        totalPages={data?.totalPages || 1}
        onChange={onPageChange}
      />
    </section>
  )
}
