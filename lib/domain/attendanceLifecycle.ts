/**
 * Attendance request workflow lifecycle (assignment / field ops).
 * Payment gating is enforced separately via paymentLifecycle.
 */

export const ATTENDANCE_WORKFLOW_STATES = [
  'pending',
  'assigned',
  'accepted',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'closed',
  'cancelled',
  'disputed',
] as const

export type AttendanceWorkflowState = (typeof ATTENDANCE_WORKFLOW_STATES)[number]

export type TransitionActorRole = 'sme' | 'youth-agent' | 'admin' | 'system'

export function normalizeWorkflowState(raw?: string | null): AttendanceWorkflowState {
  if (!raw) return 'pending'
  if (raw === 'accepted') return 'accepted'
  if ((ATTENDANCE_WORKFLOW_STATES as readonly string[]).includes(raw)) {
    return raw as AttendanceWorkflowState
  }
  return 'pending'
}

const ALLOWED: Record<
  AttendanceWorkflowState,
  Partial<Record<AttendanceWorkflowState, TransitionActorRole[]>>
> = {
  pending: {
    assigned: ['admin', 'system', 'youth-agent'],
    cancelled: ['sme', 'admin'],
  },
  assigned: {
    accepted: ['youth-agent', 'admin'],
    pending: ['admin'],
    cancelled: ['sme', 'admin'],
  },
  accepted: {
    en_route: ['youth-agent', 'admin'],
    cancelled: ['admin'],
    completed: ['youth-agent', 'admin'],
  },
  en_route: {
    arrived: ['youth-agent', 'admin'],
    cancelled: ['admin'],
  },
  arrived: {
    in_progress: ['youth-agent', 'admin'],
    completed: ['youth-agent', 'admin'],
  },
  in_progress: {
    completed: ['youth-agent', 'admin'],
    disputed: ['sme', 'admin', 'youth-agent'],
  },
  completed: {
    closed: ['admin', 'system'],
    disputed: ['sme', 'admin'],
  },
  closed: {},
  cancelled: {},
  disputed: {
    closed: ['admin'],
    completed: ['admin'],
  },
}

export interface TransitionResult {
  ok: boolean
  reason?: string
  from: AttendanceWorkflowState
  to: AttendanceWorkflowState
}

export function canTransitionAttendance(
  fromRaw: string | null | undefined,
  to: AttendanceWorkflowState,
  role: TransitionActorRole
): TransitionResult {
  const from = normalizeWorkflowState(fromRaw)
  if (from === to) return { ok: true, from, to }
  const allowedRoles = ALLOWED[from]?.[to]
  if (!allowedRoles) {
    return { ok: false, reason: `Transition ${from} → ${to} is not allowed`, from, to }
  }
  if (!allowedRoles.includes(role)) {
    return {
      ok: false,
      reason: `Role ${role} cannot transition ${from} → ${to}`,
      from,
      to,
    }
  }
  return { ok: true, from, to }
}

export function assertAttendanceTransition(
  fromRaw: string | null | undefined,
  to: AttendanceWorkflowState,
  role: TransitionActorRole
): void {
  const result = canTransitionAttendance(fromRaw, to, role)
  if (!result.ok) throw new Error(result.reason || 'Invalid attendance transition')
}

/** Dispatch / accept requires paid (or legacy not_required). */
export function requiresPaidBeforeAgentAccept(): true {
  return true
}
