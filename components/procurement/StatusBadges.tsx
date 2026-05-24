import type { AttendanceRequest } from '@/lib/tenderBriefing/types'
import type { AgentVerificationStatus } from '@/lib/auth'

const base = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold'

export function AttendanceRequestStatusBadge({
  status,
}: {
  status: AttendanceRequest['status']
}) {
  const labels: Record<string, string> = {
    pending: 'Pending Attendance',
    assigned: 'Agent Assigned',
    accepted: 'Agent Assigned',
    completed: 'Briefing Completed',
    cancelled: 'Cancelled',
  }
  const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-900 border-amber-200',
    assigned: 'bg-blue-50 text-blue-900 border-blue-200',
    accepted: 'bg-blue-50 text-blue-900 border-blue-200',
    completed: 'bg-green-50 text-green-900 border-green-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  const key = status === 'accepted' ? 'assigned' : status
  return (
    <span className={`${base} ${styles[key] || styles.pending}`}>
      {labels[status] || status}
    </span>
  )
}

export function AgentVerificationBadge({
  status = 'pending',
}: {
  status?: AgentVerificationStatus
}) {
  const config: Record<AgentVerificationStatus, { label: string; className: string }> = {
    pending: {
      label: 'Pending Verification',
      className: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    verified: {
      label: 'Verified Agent',
      className: 'bg-green-50 text-green-900 border-green-200',
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-red-50 text-red-900 border-red-200',
    },
  }
  const c = config[status] || config.pending
  return <span className={`${base} ${c.className}`}>{c.label}</span>
}

export function SyncHealthBadge({
  health,
  isRunning,
}: {
  health?: string
  isRunning?: boolean
}) {
  if (isRunning) {
    return <span className={`${base} bg-blue-50 text-blue-900 border-blue-200`}>Running</span>
  }
  if (health === 'healthy' || health === 'ok') {
    return <span className={`${base} bg-green-50 text-green-900 border-green-200`}>Healthy</span>
  }
  if (health === 'unhealthy' || health === 'failed') {
    return <span className={`${base} bg-red-50 text-red-900 border-red-200`}>Failed</span>
  }
  return <span className={`${base} bg-slate-100 text-slate-600 border-slate-200`}>Unknown</span>
}

export function TenderStatusBadge({
  variant,
}: {
  variant:
    | 'compulsory'
    | 'briefing-pending'
    | 'closing-soon'
    | 'open'
    | 'closed'
}) {
  const map = {
    compulsory: 'bg-amber-50 text-amber-900 border-amber-300',
    'briefing-pending': 'bg-slate-100 text-slate-700 border-slate-200',
    'closing-soon': 'bg-red-50 text-red-900 border-red-200',
    open: 'bg-green-50 text-green-900 border-green-200',
    closed: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  const labels = {
    compulsory: 'Compulsory Briefing',
    'briefing-pending': 'Briefing Details Pending',
    'closing-soon': 'Closing Soon',
    open: 'Open',
    closed: 'Closed',
  }
  return (
    <span className={`${base} ${map[variant]}`}>{labels[variant]}</span>
  )
}

export function DeclinedBadge() {
  return (
    <span className={`${base} bg-red-50 text-red-800 border-red-200`}>Declined</span>
  )
}

export function ReliableAgentBadge() {
  return (
    <span className={`${base} bg-green-50 text-green-900 border-green-300`}>Reliable Agent</span>
  )
}

export function NewAgentBadge() {
  return (
    <span className={`${base} bg-blue-50 text-blue-900 border-blue-200`}>New Agent</span>
  )
}
