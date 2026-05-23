import { AlertTriangle, MapPin, Calendar } from 'lucide-react'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  countdownLabel,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'

export function CompulsoryBriefingBadge({ pulse = true }: { pulse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900 ${
        pulse ? 'animate-pulse-subtle' : ''
      }`}
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      Compulsory Briefing
    </span>
  )
}

export function BriefingSessionBlock({ tender }: { tender: TenderBriefing }) {
  const hasBriefing = Boolean(tender.briefingDate || tender.briefingVenue || tender.briefingCompulsory)
  const briefingCountdown = countdownLabel(tender.briefingDate)
  const closingCountdown = countdownLabel(tender.closingDate)

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        tender.briefingCompulsory
          ? 'border-amber-200 bg-amber-50/80'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {tender.briefingCompulsory && <CompulsoryBriefingBadge />}
        {briefingCountdown && (
          <span className="text-xs font-medium text-amber-800">
            Briefing in {briefingCountdown}
          </span>
        )}
        {closingCountdown && closingCountdown !== briefingCountdown && (
          <span className="text-xs font-medium text-slate-600">
            Closes in {closingCountdown}
          </span>
        )}
      </div>
      {hasBriefing ? (
        <ul className="space-y-1 text-slate-700">
          <li className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              <span className="font-medium text-slate-900">Briefing Session: </span>
              {formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              <span className="font-medium text-slate-900">Venue: </span>
              {tender.briefingVenue || 'Briefing details to be confirmed'}
            </span>
          </li>
        </ul>
      ) : (
        <p className="text-slate-600 italic">Briefing details to be confirmed</p>
      )}
    </div>
  )
}
