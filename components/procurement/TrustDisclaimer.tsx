import { ShieldCheck } from 'lucide-react'

export function TrustStrip({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden />
        Uses official government procurement data
      </span>
      <span>Automatically updated every 15 minutes</span>
      <span>Does not replace official submission channels</span>
    </div>
  )
}

export function ProcurementDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`text-slate-600 ${compact ? 'text-xs' : 'text-sm'} border-l-4 border-brand-500 pl-4`}
    >
      TenderBriefing helps users monitor and manage tender briefing opportunities. Final tender
      submissions must still be completed through the relevant official procurement channels.
    </p>
  )
}
