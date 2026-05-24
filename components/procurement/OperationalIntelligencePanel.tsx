'use client'

import OperationalMetricCard from './OperationalMetricCard'
import SyncHealthIndicator from './SyncHealthIndicator'
import type { OperationalIntelligence } from '@/lib/procurement/operationalIntelligence'
import { Calendar, Clock, MapPin, RefreshCw, TrendingUp, Users } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function OperationalIntelligencePanel({
  data,
  loading,
  compact = false,
}: {
  data: OperationalIntelligence | null
  loading?: boolean
  compact?: boolean
}) {
  if (loading && !data) {
    return (
      <div className="flex justify-center py-6" role="status" aria-label="Loading operational data">
        <LoadingSpinner />
      </div>
    )
  }

  if (!data) return null

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OperationalMetricCard
          label="Briefings today"
          value={data.briefingsToday}
          icon={<Calendar className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="This week"
          value={data.briefingsThisWeek}
          icon={<Calendar className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="Closing soon"
          value={data.closingSoon}
          icon={<Clock className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="New (15 min)"
          value={data.newTendersLast15Min}
          pulse={data.newTendersLast15Min > 0}
          icon={<RefreshCw className="h-4 w-4" />}
        />
      </div>
    )
  }

  return (
    <section className="space-y-4" aria-label="Operational intelligence">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <OperationalMetricCard
          label="Active tenders"
          value={data.totalActiveTenders}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="Compulsory briefings"
          value={data.compulsoryBriefings}
          icon={<Calendar className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="Briefings today"
          value={data.briefingsToday}
          icon={<Calendar className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="Briefings this week"
          value={data.briefingsThisWeek}
          icon={<Calendar className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="Closing within 7 days"
          value={data.closingSoon}
          icon={<Clock className="h-4 w-4" />}
        />
        <OperationalMetricCard
          label="New in last 15 min"
          value={data.newTendersLast15Min}
          pulse={data.newTendersLast15Min > 0}
          icon={<RefreshCw className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SyncHealthIndicator
          syncHealth={data.syncHealth}
          isRunning={data.isSyncRunning}
          lastSync={data.lastSync}
          firestoreHealth={data.firestoreHealth}
        />

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">High-demand provinces</h3>
          </div>
          {data.highDemandProvinces.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No attendance requests yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {data.highDemandProvinces.map((p) => (
                <li key={p.province} className="flex justify-between text-sm">
                  <span className="text-slate-700">{p.province}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {p.requestCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">Most requested briefings</h3>
          </div>
          {data.mostRequestedBriefings.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No attendance requests yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {data.mostRequestedBriefings.map((b) => (
                <li key={b.tenderId} className="text-sm">
                  <span className="line-clamp-1 font-medium text-slate-800">
                    {b.tenderTitle || b.tenderId}
                  </span>
                  <span className="text-xs text-slate-500">{b.requestCount} requests</span>
                </li>
              ))}
            </ul>
          )}
          {data.averageAgentResponseMinutes !== null && (
            <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600">
              Avg agent response: {data.averageAgentResponseMinutes} min
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
