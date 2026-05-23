import type { AttendanceRequest } from '@/lib/tenderBriefing/types'
import { Check } from 'lucide-react'

const steps = [
  { key: 'pending', label: 'Pending Attendance' },
  { key: 'assigned', label: 'Agent Assigned' },
  { key: 'completed', label: 'Briefing Completed' },
  { key: 'report', label: 'Briefing Report Available' },
] as const

function stepIndex(status: AttendanceRequest['status'], hasReport: boolean) {
  if (status === 'cancelled') return -1
  if (hasReport || status === 'completed') return 3
  if (status === 'assigned' || status === 'accepted') return 1
  return 0
}

export default function RequestStatusTimeline({
  request,
  hasReport,
}: {
  request: AttendanceRequest
  hasReport: boolean
}) {
  const current = stepIndex(request.status, hasReport)
  if (request.status === 'cancelled') {
    return (
      <p className="text-sm text-slate-600">This attendance request was cancelled.</p>
    )
  }

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const done = i <= current
        const active = i === current
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={`my-1 h-8 w-0.5 ${done ? 'bg-brand-300' : 'bg-slate-200'}`}
                />
              )}
            </div>
            <div className="pb-6 pt-1">
              <p
                className={`text-sm font-semibold ${
                  active ? 'text-brand-800' : done ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {step.label}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
