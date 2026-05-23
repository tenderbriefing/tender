'use client'

import Link from 'next/link'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { tenderLabelFromRequest, departmentFromRequest } from '@/lib/tenderBriefing/enrichment'
import RequestStatusBadge from './RequestStatusBadge'
import { DeclinedBadge } from '@/components/procurement/StatusBadges'
import {
  countdownLabel,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'
import { Calendar, MapPin, Building2, Hash } from 'lucide-react'

interface AttendanceRequestCardProps {
  request: EnrichedAttendanceRequest
  actions?: React.ReactNode
  detailHref?: string
  showDeclined?: boolean
}

export default function AttendanceRequestCard({
  request,
  actions,
  detailHref,
  showDeclined,
}: AttendanceRequestCardProps) {
  const tenderNumber = tenderLabelFromRequest(request)
  const department = departmentFromRequest(request)
  const briefingCountdown = countdownLabel(
    request.tender?.briefingDate || request.briefingDate
  )
  const hasDeclines = (request.declines?.length || 0) > 0

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RequestStatusBadge status={request.status} />
            {showDeclined && hasDeclines && <DeclinedBadge />}
            {briefingCountdown && (
              <span className="text-xs font-semibold text-amber-800">
                Briefing in {briefingCountdown}
              </span>
            )}
          </div>

          <p className="mt-2 flex items-center gap-1 font-mono text-xs font-bold text-slate-700">
            <Hash className="h-3.5 w-3.5" />
            {tenderNumber}
          </p>

          <h3 className="mt-1 text-base font-semibold text-slate-900 line-clamp-2 sm:text-lg">
            {request.tender?.title || request.tenderTitle || 'Tender briefing'}
          </h3>

          {department && (
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
              <Building2 className="h-4 w-4 shrink-0" />
              {department}
            </p>
          )}

          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
            <p className="text-xs font-semibold uppercase text-amber-900">Briefing Venue</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {request.briefingVenue || 'Briefing details to be confirmed'}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Briefing Date:{' '}
                {formatProcurementDateTime(
                  request.tender?.briefingDate || request.briefingDate,
                  request.briefingTime
                )}
              </span>
              {(request.tender?.province || request.province) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Province: {request.tender?.province || request.province}
                </span>
              )}
              {request.tender?.closingDate && (
                <span className="inline-flex items-center gap-1">
                  Closing: {request.tender.closingDate}
                </span>
              )}
            </div>
          </div>

          {request.agentName && (
            <p className="mt-3 text-sm">
              <span className="text-slate-500">Assigned Youth Agent: </span>
              <span className="font-semibold text-brand-800">{request.agentName}</span>
            </p>
          )}
          {request.smeCompany && (
            <p className="mt-1 text-xs text-slate-500">SME: {request.smeCompany}</p>
          )}
        </div>

        {detailHref && (
          <Link
            href={detailHref}
            className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800 min-h-[44px] flex items-center"
          >
            View details
          </Link>
        )}
      </div>

      {actions && (
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      )}
    </article>
  )
}
