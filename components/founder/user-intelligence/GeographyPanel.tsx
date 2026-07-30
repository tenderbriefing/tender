'use client'

import { MapPinIcon } from '@heroicons/react/24/outline'
import { HorizontalBarList } from './charts'
import { EmptyPanel, Panel } from './chrome'
import type { GeographyRow } from './types'

export function GeographyPanel({ geography }: { geography?: GeographyRow[] }) {
  const rows = [...(geography || [])].sort(
    (a, b) => b.smes + b.agents - (a.smes + a.agents)
  )

  const maxBar = Math.max(1, ...rows.map((g) => Math.max(g.smes, g.agents)))

  return (
    <div className="space-y-5">
      <Panel
        title="Province coverage"
        subtitle="Aggregated profile province only — exact residential coordinates are not stored"
        icon={<MapPinIcon className="h-5 w-5 text-brand-700" />}
      >
        {rows.length === 0 ? (
          <EmptyPanel
            title="No geography data"
            description="Province appears once users set it on their profile."
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-brand-800" /> SMEs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-accent-500" /> Agents
                </span>
              </div>
              <HorizontalBarList
                rows={rows.map((g) => ({
                  label: g.province || 'Unknown',
                  value: g.smes,
                  agents: g.agents,
                }))}
                color="#0F1E3D"
                secondaryColor="#D4AF37"
                secondaryKey="agents"
                max={maxBar}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Province</th>
                    <th className="py-2 pr-3 font-semibold">SMEs</th>
                    <th className="py-2 pr-3 font-semibold">Agents</th>
                    <th className="py-2 pr-3 font-semibold">SME:Agent</th>
                    <th className="py-2 font-semibold">Unassigned SMEs</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => (
                    <tr key={g.province} className="border-b border-slate-50">
                      <td className="py-2.5 pr-3 font-medium text-brand-900">
                        {g.province || 'Unknown'}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{g.smes}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{g.agents}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-700">
                        {g.ratio == null ? 'n/a' : g.ratio}
                      </td>
                      <td className="py-2.5 tabular-nums">{g.unassignedSmes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">
                Municipality drill-down is deferred until collected.
              </p>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
