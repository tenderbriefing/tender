/**
 * Phase 10 Operations Lifecycle V1.
 * Payment ≠ assignment secured. Delivery is manual (Founder emails outside platform).
 *
 * Legacy aliases (must keep rendering):
 * - paid_agent_required → assignment_required
 * - agent_assigned → assigned
 * - attendance_confirmed → attended
 * - report_pending → report_in_progress
 * - awaiting_payment → payment_required
 */

export const OPS_LIFECYCLE_STAGES = [
  'payment_required',
  'paid',
  'assignment_required',
  'assigned',
  'briefing_due',
  'attended',
  'evidence_required',
  'evidence_received',
  'report_in_progress',
  'report_ready',
  'delivered',
  'completed',
  'closed',
] as const

export type OpsLifecycleStage = (typeof OPS_LIFECYCLE_STAGES)[number]

/** @deprecated Prefer OPS_LIFECYCLE_STAGES — kept for callers still importing MANUAL_OPS_STAGES */
export const MANUAL_OPS_STAGES = OPS_LIFECYCLE_STAGES
export type ManualOpsStage = OpsLifecycleStage

export const OPS_LIFECYCLE_LABELS: Record<OpsLifecycleStage, string> = {
  payment_required: 'Payment Required',
  paid: 'Paid',
  assignment_required: 'Assignment Required',
  assigned: 'Assigned',
  briefing_due: 'Briefing Due',
  attended: 'Attended',
  evidence_required: 'Evidence Required',
  evidence_received: 'Evidence Received',
  report_in_progress: 'Report In Progress',
  report_ready: 'Report Ready',
  delivered: 'Delivered',
  completed: 'Completed',
  closed: 'Closed',
}

export const MANUAL_OPS_LABELS = OPS_LIFECYCLE_LABELS

/** Map legacy / synonym stage ids onto the Phase 10 canonical id. */
export const OPS_STAGE_ALIASES: Record<string, OpsLifecycleStage> = {
  awaiting_payment: 'payment_required',
  payment_required: 'payment_required',
  paid: 'paid',
  paid_agent_required: 'assignment_required',
  paid_assignment_required: 'assignment_required',
  assignment_required: 'assignment_required',
  agent_sourcing: 'assignment_required',
  agent_assigned: 'assigned',
  assigned: 'assigned',
  briefing_due: 'briefing_due',
  attendance_confirmed: 'attended',
  attended: 'attended',
  evidence_required: 'evidence_required',
  evidence_received: 'evidence_received',
  briefing_completed: 'evidence_received',
  report_pending: 'report_in_progress',
  report_in_progress: 'report_in_progress',
  report_ready: 'report_ready',
  delivered: 'delivered',
  completed: 'completed',
  fulfilment_completed: 'completed',
  closed: 'closed',
}

export function normalizeOpsStage(raw: unknown): OpsLifecycleStage | null {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  if (!key) return null
  return OPS_STAGE_ALIASES[key] || null
}

export const MANUAL_DOCUMENT_KINDS = ['rfq', 'loa', 'boq', 'other'] as const
export type ManualDocumentKind = (typeof MANUAL_DOCUMENT_KINDS)[number]

export const OPS_EVIDENCE_CATEGORIES = [
  'attendance_proof',
  'site_photos',
  'briefing_photos',
  'documents',
  'notes',
  'other',
] as const
export type OpsEvidenceCategory = (typeof OPS_EVIDENCE_CATEGORIES)[number]

/** Standard representative payout suggestion (cents). Override allowed. */
export const SUGGESTED_AGENT_PAYOUT_CENTS = 40000
export const MAX_AGENT_PAYOUT_CENTS = 60000
export const MIN_AGENT_PAYOUT_CENTS = 10000

type OpsInput = {
  opsStage?: string | null
  paymentStatus?: string | null
  status?: string | null
  assignedAgentId?: string | null
  agentId?: string | null
  representativeName?: string | null
  attended?: boolean | null
  attendedAt?: string | null
  completed?: boolean | null
  reportStatus?: string | null
  reportStage?: string | null
  reportApprovedAt?: string | null
  reportReadyAt?: string | null
  reportDeliveredAt?: string | null
  clientReportDeliveredAt?: string | null
  deliveredAt?: string | null
  closedAt?: string | null
  completedAt?: string | null
  fulfilmentStatus?: string | null
  availableForAssignment?: boolean | null
  sourcing?: boolean | null
  evidenceItems?: unknown[] | null
  evidenceCount?: number | null
  evidenceOverride?: boolean | null
  briefingDate?: string | null
  briefingTime?: string | null
  now?: Date | null
}

function hasRepresentative(request: OpsInput): boolean {
  return Boolean(
    request.assignedAgentId ||
      request.agentId ||
      String(request.representativeName || '').trim()
  )
}

function evidenceCountOf(request: OpsInput): number {
  if (Number.isFinite(Number(request.evidenceCount))) {
    return Math.max(0, Number(request.evidenceCount))
  }
  return Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0
}

function briefingMoment(request: OpsInput): Date | null {
  const dateRaw = String(request.briefingDate || '').trim()
  if (!dateRaw) return null
  const timeRaw = String(request.briefingTime || '12:00').trim() || '12:00'
  const iso = dateRaw.includes('T')
    ? dateRaw
    : `${dateRaw}T${/^\d{1,2}:\d{2}/.test(timeRaw) ? timeRaw.slice(0, 5) : '12:00'}:00`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Derive a single ops stage from payment + assignment + evidence + report fields.
 * Prefer explicit opsStage when present (and normalized). Never trusts browser payment state.
 */
export function deriveManualOpsStage(request: OpsInput): OpsLifecycleStage {
  const explicit = normalizeOpsStage(request.opsStage)
  if (explicit === 'closed' || request.closedAt) return 'closed'
  if (
    explicit === 'completed' ||
    request.completedAt ||
    String(request.fulfilmentStatus || '').toLowerCase() === 'completed'
  ) {
    return 'completed'
  }
  if (
    explicit === 'delivered' ||
    request.deliveredAt ||
    request.clientReportDeliveredAt ||
    request.reportDeliveredAt
  ) {
    return 'delivered'
  }

  const payment = String(request.paymentStatus || '').toLowerCase()
  const workflow = String(request.status || '').toLowerCase()
  const fulfilment = String(request.fulfilmentStatus || '').toLowerCase()
  const report = String(request.reportStatus || request.reportStage || '').toLowerCase()
  const hasRep = hasRepresentative(request)
  const evidenceN = evidenceCountOf(request)
  const hasEvidence = evidenceN > 0 || request.evidenceOverride === true

  if (workflow === 'closed') return 'closed'

  if (
    report === 'ready' ||
    report === 'approved' ||
    request.reportApprovedAt ||
    request.reportReadyAt ||
    explicit === 'report_ready'
  ) {
    return 'report_ready'
  }

  if (
    report === 'in_progress' ||
    report === 'pending' ||
    report === 'draft' ||
    report === 'submitted' ||
    explicit === 'report_in_progress' ||
    fulfilment === 'report_pending'
  ) {
    return 'report_in_progress'
  }

  if (explicit === 'evidence_received' || (hasEvidence && (request.attended === true || explicit === 'attended'))) {
    if (hasEvidence) return 'evidence_received'
  }

  if (
    request.attended === true ||
    request.attendedAt ||
    workflow === 'attended' ||
    fulfilment === 'confirmed' ||
    fulfilment === 'attendance_confirmed' ||
    explicit === 'attended' ||
    explicit === 'evidence_required'
  ) {
    if (!hasEvidence && request.evidenceOverride !== true) return 'evidence_required'
    return hasEvidence ? 'evidence_received' : 'attended'
  }

  if (hasRep || workflow === 'assigned' || fulfilment === 'assigned' || explicit === 'assigned') {
    const dueAt = briefingMoment(request)
    const now = request.now || new Date()
    if (dueAt && dueAt.getTime() <= now.getTime() + 48 * 60 * 60 * 1000) {
      // Within 48h of briefing (or past) → Briefing Due while assigned & not attended
      if (!request.attended && !request.attendedAt) return 'briefing_due'
    }
    return 'assigned'
  }

  if (payment === 'paid' || payment === 'not_required') {
    if (explicit === 'paid') return 'paid'
    return 'assignment_required'
  }

  return 'payment_required'
}

export function manualOpsLabel(stage: string): string {
  const normalized = normalizeOpsStage(stage) || (stage as OpsLifecycleStage)
  return OPS_LIFECYCLE_LABELS[normalized as OpsLifecycleStage] || String(stage)
}

export type UrgencyFlag =
  | 'payment_required'
  | 'assignment_required'
  | 'briefing_due'
  | 'evidence_required'
  | 'report_required'
  | 'report_ready'
  | 'briefing_within_24h'
  | 'briefing_within_48h'
  | 'paid_no_agent'
  | 'missing_loa'
  | 'venue_unconfirmed'

export function deriveUrgencyFlags(request: {
  paymentStatus?: string | null
  assignedAgentId?: string | null
  agentId?: string | null
  representativeName?: string | null
  briefingDate?: string | null
  briefingTime?: string | null
  briefingVenue?: string | null
  documents?: Array<{ kind?: string | null }> | null
  loaStatus?: string | null
  opsStage?: string | null
  attended?: boolean | null
  evidenceItems?: unknown[] | null
  evidenceCount?: number | null
  evidenceOverride?: boolean | null
  reportStatus?: string | null
  reportReadyAt?: string | null
  now?: Date
}): UrgencyFlag[] {
  const flags: UrgencyFlag[] = []
  const now = request.now || new Date()
  const stage = deriveManualOpsStage({ ...request, now })

  if (stage === 'payment_required') flags.push('payment_required')
  if (stage === 'assignment_required') {
    flags.push('assignment_required')
    flags.push('paid_no_agent')
  }
  if (stage === 'briefing_due') flags.push('briefing_due')
  if (stage === 'evidence_required') flags.push('evidence_required')
  if (stage === 'report_in_progress' || stage === 'evidence_received') {
    flags.push('report_required')
  }
  if (stage === 'report_ready') flags.push('report_ready')

  const docs = Array.isArray(request.documents) ? request.documents : []
  const hasLoa =
    String(request.loaStatus || '').toLowerCase() === 'received' ||
    docs.some((d) => String(d.kind || '').toLowerCase() === 'loa')
  if (!hasLoa) flags.push('missing_loa')

  const venue = String(request.briefingVenue || '').trim()
  if (!venue) flags.push('venue_unconfirmed')

  const dueAt = briefingMoment(request)
  if (dueAt) {
    const hours = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hours >= 0 && hours <= 24) flags.push('briefing_within_24h')
    else if (hours > 24 && hours <= 48) flags.push('briefing_within_48h')
  }

  return Array.from(new Set(flags))
}

export function nextRequiredAction(stage: OpsLifecycleStage): string {
  switch (stage) {
    case 'payment_required':
      return 'Collect payment / send invoice link'
    case 'paid':
    case 'assignment_required':
      return 'Assign representative'
    case 'assigned':
      return 'Monitor briefing date'
    case 'briefing_due':
      return 'Confirm attendance'
    case 'attended':
    case 'evidence_required':
      return 'Upload attendance evidence'
    case 'evidence_received':
      return 'Generate report draft'
    case 'report_in_progress':
      return 'Review, edit, and Approve Final Report'
    case 'report_ready':
      return 'Send report to client (delivery review)'
    case 'delivered':
      return 'Mark fulfilment completed'
    case 'completed':
      return 'Close when ops complete'
    case 'closed':
      return 'None'
    default:
      return 'Review request'
  }
}

export function clampAgentPayoutCents(value: unknown): number | null {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return null
  if (n < MIN_AGENT_PAYOUT_CENTS || n > MAX_AGENT_PAYOUT_CENTS) return null
  return n
}

/** Allowed transitions for explicit admin stage stamps (not payment ITN). */
export const OPS_ADMIN_TRANSITIONS: Partial<Record<OpsLifecycleStage, OpsLifecycleStage[]>> = {
  payment_required: [],
  paid: ['assignment_required'],
  assignment_required: ['assigned'],
  assigned: ['briefing_due', 'attended'],
  briefing_due: ['attended'],
  attended: ['evidence_required', 'evidence_received'],
  evidence_required: ['evidence_received', 'report_in_progress'],
  evidence_received: ['report_in_progress', 'report_ready'],
  report_in_progress: ['report_ready'],
  report_ready: ['delivered'],
  delivered: ['completed', 'closed'],
  completed: ['closed'],
  closed: [],
}
