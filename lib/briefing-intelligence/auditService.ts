import type { Firestore } from 'firebase-admin/firestore'
import type { ReportStatus } from './types'

const { sanitizeFirestoreData } = require('../../backend/utils/sanitizeFirestoreData')

export type BriefingIntelligenceAuditEventType =
  | 'evidence_submitted'
  | 'processing_started'
  | 'draft_ready'
  | 'reviewed'
  | 'delivered'
  | 'failed'

function nowIso() {
  return new Date().toISOString()
}

function safeStr(s: unknown, max = 5000): string {
  if (s == null) return ''
  const str = String(s)
  return str.length > max ? `${str.slice(0, max)}…` : str
}

/**
 * Audit trail uses the existing `workflowEvents` collection pattern:
 * server-side-only writes via Firebase Admin SDK.
 *
 * Important: never logs raw audio/transcript content.
 */
export async function logBriefingIntelligenceAuditEvent(params: {
  db: Firestore
  eventType: BriefingIntelligenceAuditEventType
  reportId: string
  requestId: string
  agentId: string
  smeId: string
  actorUid: string
  actorRole: 'youth-agent' | 'sme' | 'admin' | 'system'
  nextStatus?: ReportStatus
  error?: string | null
  meta?: Record<string, unknown>
}): Promise<{ id: string }> {
  const {
    db,
    eventType,
    reportId,
    requestId,
    agentId,
    smeId,
    actorUid,
    actorRole,
    nextStatus,
    error = null,
    meta = {},
  } = params

  const id = `bi-${eventType}-${reportId}-${actorUid}`.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 150)
  const payload = sanitizeFirestoreData({
    reportId,
    requestId,
    agentId,
    smeId,
    actorUid,
    actorRole,
    nextStatus: nextStatus ?? null,
    // Never log content; only log safe metadata.
    error: error ? safeStr(error, 3000) : null,
    ...meta,
  })

  const startedAt = nowIso()
  await db
    .collection('workflowEvents')
    .doc(id)
    .set(
      sanitizeFirestoreData({
        id,
        type: eventType,
        status: 'completed',
        payload,
        startedAt,
        completedAt: startedAt,
        retryCount: 0,
        error: payload.error,
        notificationChannels: [],
        recipients: [],
        updatedAt: startedAt,
      }),
      { merge: true }
    )

  return { id }
}

