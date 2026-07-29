import { SyncHealthBadge } from './StatusBadges'
import { Activity, Database } from 'lucide-react'
import { formatLastSyncLabel, isSyncStale } from '@/lib/procurement/formatLastSync'

export default function SyncHealthIndicator({
  syncHealth,
  isRunning,
  lastSync,
  firestoreHealth,
  compact = false,
}: {
  syncHealth?: string
  isRunning?: boolean
  lastSync?: string | null
  firestoreHealth?: 'healthy' | 'degraded' | 'unknown'
  compact?: boolean
}) {
  const lastSyncLabel = formatLastSyncLabel(lastSync) || 'Not yet synced'
  const stale = Boolean(lastSync && isSyncStale(lastSync))

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <SyncHealthBadge health={syncHealth} isRunning={isRunning} />
        <span className={stale ? 'font-medium text-amber-800' : undefined}>
          Last sync: {lastSyncLabel}
          {stale ? ' · delayed' : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-600" aria-hidden />
          <span className="text-sm font-semibold text-slate-900">Sync health</span>
        </div>
        <SyncHealthBadge health={syncHealth} isRunning={isRunning} />
      </div>
      <p className={`mt-2 text-sm ${stale ? 'font-medium text-amber-800' : 'text-slate-600'}`}>
        Last sync: {lastSyncLabel}
        {stale ? ' · delayed' : ''}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <Database className="h-3.5 w-3.5" aria-hidden />
        <span>
          Firestore:{' '}
          {firestoreHealth === 'healthy'
            ? 'Connected'
            : firestoreHealth === 'degraded'
              ? 'Degraded'
              : 'Unknown'}
        </span>
      </div>
    </div>
  )
}
