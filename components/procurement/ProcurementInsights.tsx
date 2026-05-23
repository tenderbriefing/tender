'use client'

import { useEffect, useState } from 'react'

interface Summary {
  provincesRepresented: string[]
  topDepartments: Array<{ name: string; count: number }>
  compulsoryBriefings: number
  totalBriefings: number
  closingWithin7Days: number
}

export default function ProcurementInsights() {
  const [stats, setStats] = useState<Summary | null>(null)

  useEffect(() => {
    fetch('/api/tender-briefings/stats/summary')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setStats(j.data)
      })
      .catch(() => {})
  }, [])

  if (!stats) return null

  const maxDept = Math.max(...(stats.topDepartments?.map((d) => d.count) || [1]), 1)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Procurement intelligence</h2>
      <p className="mt-1 text-sm text-slate-600">Live summaries from official sync data</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-brand-50 p-4 text-center">
          <p className="text-2xl font-bold text-brand-800">{stats.compulsoryBriefings}</p>
          <p className="text-xs font-medium text-brand-900">Compulsory briefings</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-4 text-center">
          <p className="text-2xl font-bold text-amber-900">{stats.closingWithin7Days}</p>
          <p className="text-xs font-medium text-amber-900">Closing within 7 days</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {stats.provincesRepresented?.length || 0}
          </p>
          <p className="text-xs font-medium text-slate-600">Provinces covered</p>
        </div>
      </div>

      {stats.topDepartments?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-700">Top departments</h3>
          <ul className="mt-3 space-y-2">
            {stats.topDepartments.slice(0, 6).map((d) => (
              <li key={d.name}>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span className="truncate pr-2">{d.name}</span>
                  <span>{d.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
