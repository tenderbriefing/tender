/**
 * Central access-control helpers for attendance / briefing resources.
 * Server-side only — never trust client role or ownership claims.
 */

export type Role = 'sme' | 'youth-agent' | 'admin'

export interface Actor {
  uid: string
  userType: Role
}

export interface AttendanceLike {
  smeId?: string | null
  agentId?: string | null
  assignedAgentId?: string | null
  notifiedAgents?: string[] | null
}

export interface BriefingLike {
  smeId?: string | null
  agentId?: string | null
}

export function isAdmin(actor: Actor): boolean {
  return actor.userType === 'admin'
}

export function canReadAttendance(actor: Actor, request: AttendanceLike): boolean {
  if (isAdmin(actor)) return true
  if (actor.userType === 'sme') return request.smeId === actor.uid
  if (actor.userType === 'youth-agent') {
    return (
      request.agentId === actor.uid ||
      request.assignedAgentId === actor.uid ||
      Boolean(request.notifiedAgents?.includes(actor.uid))
    )
  }
  return false
}

export function canMutateAttendanceAsOwner(actor: Actor, request: AttendanceLike): boolean {
  if (isAdmin(actor)) return true
  if (actor.userType === 'sme') return request.smeId === actor.uid
  return false
}

export function canAgentActOnAttendance(actor: Actor, request: AttendanceLike): boolean {
  if (isAdmin(actor)) return true
  if (actor.userType !== 'youth-agent') return false
  return (
    request.agentId === actor.uid ||
    request.assignedAgentId === actor.uid ||
    Boolean(request.notifiedAgents?.includes(actor.uid))
  )
}

export function canReadBriefing(actor: Actor, report: BriefingLike): boolean {
  if (isAdmin(actor)) return true
  if (actor.userType === 'sme') return report.smeId === actor.uid
  if (actor.userType === 'youth-agent') return report.agentId === actor.uid
  return false
}

/** Privileged attendance fields — must not be client-writable via Firestore. */
export const ATTENDANCE_PRIVILEGED_FIELDS = [
  'paymentStatus',
  'paymentProvider',
  'paymentAmount',
  'quotedFee',
  'paymentReference',
  'payfastPaymentId',
  'paidAt',
  'paymentFailureReason',
  'agentId',
  'assignedAgentId',
  'agentName',
  'status',
  'smeId',
  'notifiedAgents',
  'acceptedAt',
] as const
