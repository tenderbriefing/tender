/**
 * Access helpers for Youth Agent Workspace resources (IDOR prevention).
 */

import type { Actor, AttendanceLike } from '@/lib/security/accessControl'
import { canAgentActOnAttendance, canReadAttendance, isAdmin } from '@/lib/security/accessControl'
import { canAccessYouthAgentWorkspace } from './featureFlag'

export function assertWorkspaceAccess(actor: {
  uid: string
  userType?: string | null
}): boolean {
  return canAccessYouthAgentWorkspace({ uid: actor.uid, userType: actor.userType })
}

export function canReadAssignmentMessage(
  actor: Actor,
  msg: { senderId?: string; recipientId?: string },
  attendance: AttendanceLike
): boolean {
  if (isAdmin(actor)) return true
  if (msg.senderId === actor.uid || msg.recipientId === actor.uid) {
    return canReadAttendance(actor, attendance)
  }
  return false
}

export function canSendAssignmentMessage(actor: Actor, attendance: AttendanceLike): boolean {
  if (isAdmin(actor)) return true
  if (actor.userType === 'sme') return attendance.smeId === actor.uid
  if (actor.userType === 'youth-agent') return canAgentActOnAttendance(actor, attendance)
  return false
}

export function canEditFieldReportDraft(
  actor: Actor,
  draft: { agentId?: string; status?: string },
  attendance: AttendanceLike
): boolean {
  if (isAdmin(actor)) return true
  if (actor.userType !== 'youth-agent') return false
  if (draft.agentId !== actor.uid) return false
  if (!canAgentActOnAttendance(actor, attendance)) return false
  const status = draft.status || 'draft'
  return status === 'draft' || status === 'rejected'
}

export function canVerifyFieldReport(actor: Actor, attendance: AttendanceLike): boolean {
  if (isAdmin(actor)) return true
  if (actor.userType === 'sme') return attendance.smeId === actor.uid
  return false
}

export function canReadEarningsLedger(actor: Actor, agentId: string): boolean {
  if (isAdmin(actor)) return true
  return actor.userType === 'youth-agent' && actor.uid === agentId
}
