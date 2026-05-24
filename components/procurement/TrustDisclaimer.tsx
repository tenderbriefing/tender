import { ShieldCheck } from 'lucide-react'
import { SyncHealthBadge } from './StatusBadges'

export function TrustStrip({
  className = '',
  lastSync,
  syncHealth,
  isRunning,
}: {
  className?: string
  lastSync?: string | null
  syncHealth?: string
  isRunning?: boolean
}) {
  const syncLabel = lastSync
    ? new Date(lastSync).toLocaleString('en-ZA', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 ${className}`}
      role="status"
      aria-label="Procurement data trust indicators"
    >
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden />
        Uses official eTenders data
      </span>
      <span>Updated every 15 minutes</span>
      {syncLabel && <span>Last sync: {syncLabel}</span>}
      {(syncHealth || isRunning) && (
        <SyncHealthBadge health={syncHealth} isRunning={isRunning} />
      )}
      <span>Does not replace official submission channels</span>
    </div>
  )
}

export function ProcurementDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`border-l-4 border-brand-500 pl-4 text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}
    >
      TenderBriefing helps SMEs monitor and manage tender briefing opportunities. Final tender
      submissions must still be completed through the relevant official procurement channels.
    </p>
  )
}

/** Alias for design-system consistency */
export const ProcurementTrustStrip = TrustStrip
