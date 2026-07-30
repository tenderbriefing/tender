'use client'

import { LinkIcon } from '@heroicons/react/24/outline'
import { DonutChart, formatCount } from './charts'
import { EmptyPanel, Panel, StatCard } from './chrome'
import type { NetworkData } from './types'

export function NetworkPanel({
  network,
  onSelect,
}: {
  network?: NetworkData
  onSelect: (uid: string) => void
}) {
  const pairs = network?.pairs || []
  const withoutAgent = network?.smesWithoutAgents ?? 0
  const withoutSme = network?.agentsWithoutSmes ?? 0
  const linkedApprox = pairs.length

  const coverageSegments = [
    { key: 'linked', label: 'Recent links', value: linkedApprox, color: '#0F1E3D' },
    { key: 'sme-gap', label: 'SMEs without agent history', value: withoutAgent, color: '#d97706' },
    { key: 'agent-gap', label: 'Agents without SME history', value: withoutSme, color: '#D4AF37' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="SMEs without agent history"
          value={withoutAgent}
          accent="navy"
        />
        <StatCard
          label="Agents without SME history"
          value={withoutSme}
          accent="gold"
        />
        <StatCard
          label="Recent attendance-request links"
          value={linkedApprox}
          hint="Bounded sample from attendance requests"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Panel title="Coverage snapshot" subtitle="Gaps vs recent links">
          <div className="flex flex-col items-center">
            <DonutChart
              segments={coverageSegments}
              centerLabel={formatCount(withoutAgent + withoutSme + linkedApprox)}
              centerSub="signals"
            />
            <ul className="mt-4 w-full space-y-2 text-xs">
              {coverageSegments.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-slate-600">{s.label}</span>
                  <span className="font-semibold tabular-nums text-brand-900">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-brand-900">
              <LinkIcon className="h-5 w-5 text-brand-700" />
              Agent–SME request links
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Derived from attendance requests — not permanent portfolios
            </p>
          </div>

          {pairs.length === 0 ? (
            <div className="p-5">
              <EmptyPanel
                title="No request links yet"
                description="Pairs appear when attendance requests connect an SME and Youth Agent."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-semibold">Request</th>
                    <th className="px-3 py-3 font-semibold">SME</th>
                    <th className="px-3 py-3 font-semibold">Agent</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => (
                    <tr key={p.requestId} className="border-b border-slate-50">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-600">
                        {p.requestId}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          className="font-semibold text-brand-800 hover:underline"
                          onClick={() => onSelect(p.smeId)}
                        >
                          {p.smeId.slice(0, 8)}…
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          className="font-semibold text-accent-800 hover:underline"
                          onClick={() => onSelect(p.agentId)}
                        >
                          {p.agentId.slice(0, 8)}…
                        </button>
                      </td>
                      <td className="px-3 py-2.5 capitalize text-slate-700">
                        {p.status || 'Unknown'}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-slate-600">
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleString('en-ZA')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
