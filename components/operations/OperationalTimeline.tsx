'use client'

import type { AttendanceRequest, BriefingReport } from '@/lib/tenderBriefing/types'
import { Check } from 'lucide-react'

function formatWhen(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface OperationalTimelineProps {
  request: AttendanceRequest
  reports?: BriefingReport[]
}

export default function OperationalTimeline({
  request,
  reports = [],
}: OperationalTimelineProps) {
  const hasReport = reports.length > 0
  const report = reports[0]

  const events = [
    {
      key: 'submitted',
      label: 'Attendance request submitted',
      done: true,
      at: request.createdAt,
      detail: request.smeCompany || request.smeName,
    },
    {
      key: 'assigned',
      label: 'Youth Agent assigned',
      done:
        request.status === 'assigned' ||
        request.status === 'accepted' ||
        request.status === 'completed',
      at: request.acceptedAt || request.updatedAt,
      detail: request.agentName || undefined,
    },
    {
      key: 'briefing',
      label: 'Briefing session',
      done: request.status === 'completed',
      at: request.briefingDate,
      detail: request.briefingVenue,
    },
    {
      key: 'report',
      label: 'Briefing Report uploaded',
      done: hasReport || request.status === 'completed',
      at: report?.createdAt,
      detail: hasReport ? 'Report available to SME' : undefined,
    },
    {
      key: 'completed',
      label: 'Workflow completed',
      done: request.status === 'completed',
      at: request.status === 'completed' ? request.updatedAt : undefined,
    },
  ]

  if (request.status === 'cancelled') {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        This attendance request was cancelled.
      </p>
    )
  }

  return (
    <ol className="space-y-0" aria-label="Attendance request timeline">
      {events.map((event, i) => {
        const done = event.done
        const isLast = i === events.length - 1
        return (
          <li key={event.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  done
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              {!isLast && (
                <span
                  className={`my-1 min-h-[2rem] w-0.5 flex-1 ${done ? 'bg-brand-300' : 'bg-slate-200'}`}
                />
              )}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
              <p
                className={`text-sm font-semibold ${
                  done ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {event.label}
              </p>
              {event.at && (
                <p className="mt-0.5 text-xs text-slate-500">{formatWhen(event.at)}</p>
              )}
              {event.detail && (
                <p className="mt-1 text-xs font-medium text-brand-800">{event.detail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
