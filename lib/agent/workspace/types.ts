/**
 * Youth Agent Workspace domain types.
 * Assignment states reuse attendance lifecycle terminology (no duplicate machine).
 */

import type { AttendanceWorkflowState } from '@/lib/domain/attendanceLifecycle'

/** Alias for product language — same as attendance workflow states. */
export type AssignmentState = AttendanceWorkflowState

export type FieldReportStatus = 'draft' | 'submitted' | 'locked' | 'verified' | 'rejected'

export type EarningsLedgerEntryType =
  | 'earned'
  | 'adjustment'
  | 'payout_pending'
  | 'payout_paid'
  | 'payout_failed'
  | 'clawback'

export type WorkspaceAuditEventType =
  | 'assignment_transition'
  | 'report_draft_saved'
  | 'report_submitted'
  | 'report_locked'
  | 'evidence_uploaded'
  | 'message_sent'
  | 'earnings_ledger_append'
  | 'sme_verification'
  | 'admin_override'
  | 'workspace_access'
  | 'notification_sent'

export interface WorkspaceAuditEvent {
  id?: string
  type: WorkspaceAuditEventType
  actorUid: string
  actorRole: 'youth-agent' | 'sme' | 'admin' | 'system'
  assignmentId?: string | null
  requestId?: string | null
  payload?: Record<string, unknown>
  createdAt: string
}

export interface FieldReportDraft {
  id?: string
  requestId: string
  agentId: string
  smeId: string
  status: FieldReportStatus
  notes?: string
  structuredNotes?: Record<string, unknown>
  attendanceProofUrl?: string | null
  photoUrls?: string[]
  documentUrls?: string[]
  audioUrl?: string | null
  lockedAt?: string | null
  lockedBy?: string | null
  submittedAt?: string | null
  verifiedAt?: string | null
  verifiedBy?: string | null
  verificationNotes?: string | null
  updatedAt: string
  createdAt: string
}

export interface AssignmentMessage {
  id?: string
  requestId: string
  senderId: string
  senderRole: 'youth-agent' | 'sme' | 'admin'
  recipientId: string
  body: string
  createdAt: string
  readAt?: string | null
}

export interface EarningsLedgerEntry {
  id?: string
  agentId: string
  requestId?: string | null
  type: EarningsLedgerEntryType
  amountCents: number
  currency: 'ZAR'
  description: string
  balanceAfterCents: number
  createdAt: string
  createdBy: string
  /** Immutable once written — never updated in place. */
  immutable: true
}

export interface PerformanceFactor {
  key: string
  label: string
  contribution: number
  detail: string
}

export interface ExplainablePerformance {
  score: number
  tier: string
  factors: PerformanceFactor[]
  computedAt: string
}

export const WORKSPACE_NAV = [
  { href: '/agent/workspace/today', label: 'Today', key: 'today' },
  { href: '/agent/workspace/assignments', label: 'Assignments', key: 'assignments' },
  { href: '/agent/workspace/messages', label: 'Messages', key: 'messages' },
  { href: '/agent/workspace/earnings', label: 'Earnings', key: 'earnings' },
  { href: '/agent/workspace/performance', label: 'Performance', key: 'performance' },
  { href: '/agent/workspace/profile', label: 'Profile', key: 'profile' },
] as const
