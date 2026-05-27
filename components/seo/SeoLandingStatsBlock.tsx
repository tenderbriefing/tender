'use client'

import { useEffect, useState } from 'react'
import type { PublicTenderStats } from '@/lib/security/publicTender'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function SeoLandingStatsBlock() {
  const [stats, setStats] = useState<PublicTenderStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/tender-briefings/stats/summary')
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success) setStats(json.data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner />
      </div>
    )
  }

  if (!stats) return null

  const tiles = [
    {
      label: 'Compulsory briefings live',
      value: stats.compulsoryBriefings,
    },
    {
      label: 'Closing within 7 days',
      value: stats.closingWithin7Days,
    },
    {
      label: 'Provinces covered',
      value: stats.provincesRepresented.length,
    },
    {
      label: 'Top departments tracked',
      value: stats.topDepartments.length,
    },
  ]

  return (
    <section className="mt-14">
      <h2 className="text-2xl font-bold text-brand-900">Live procurement snapshot</h2>
      <p className="mt-2 text-slate-600">
        Real counts from official eTenders sync — updated as new compulsory briefing opportunities
        are published across South Africa.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-5 shadow-sm"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
              {tile.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-brand-900">{tile.value}</p>
          </div>
        ))}
      </div>
      {stats.topDepartments.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <p className="text-sm font-semibold text-brand-900">Departments publishing opportunities</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.topDepartments.slice(0, 8).map((dept) => (
              <span
                key={dept.name}
                className="rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-medium text-brand-800"
              >
                {dept.name} ({dept.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
