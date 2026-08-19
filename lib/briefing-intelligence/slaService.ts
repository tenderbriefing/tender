import type { Firestore } from 'firebase-admin/firestore'
import type { BriefingIntelligenceReport } from './types'

const SLA_HOURS = 24

function toIso(d: Date) {
  return d.toISOString()
}

export function calculateSlaDeadlineISO(
  evidenceSubmittedAt: string,
  now = new Date()
): string | null {
  // evidenceSubmittedAt is stored as ISO; validate the date.
  const submitted = new Date(evidenceSubmittedAt)
  if (Number.isNaN(submitted.getTime())) {
    return null
  }
  const deadline = new Date(submitted.getTime() + SLA_HOURS * 60 * 60 * 1000)
  return toIso(deadline)
}

export function computeSlaBreached(
  evidenceSubmittedAt: string | null,
  now = new Date()
): boolean {
  if (!evidenceSubmittedAt) return false
  const submitted = new Date(evidenceSubmittedAt)
  if (Number.isNaN(submitted.getTime())) return false
  return now.getTime() > submitted.getTime() + SLA_HOURS * 60 * 60 * 1000
}

export function applySlaToReport(
  report: BriefingIntelligenceReport,
  now = new Date()
): Pick<BriefingIntelligenceReport, 'slaDeadline' | 'slaBreached'> {
  const slaDeadline = report.evidenceSubmittedAt
    ? calculateSlaDeadlineISO(report.evidenceSubmittedAt, now)
    : null
  const slaBreached = computeSlaBreached(report.evidenceSubmittedAt, now)
  return { slaDeadline, slaBreached }
}

/**
 * Integration point for ops/founder views:
 * - Updates `slaDeadline` and `slaBreached` on the report
 * - Creates a doc in `slaBreaches` when a report first becomes overdue
 */
export async function syncSlaForReport(params: {
  db: Firestore
  reportId: string
  now?: Date
}): Promise<{
  slaDeadline: string | null
  slaBreached: boolean
  createdBreachLog: boolean
}> {
  const { db, reportId, now = new Date() } = params

  const ref = db.collection('briefingIntelligenceReports').doc(reportId)
  const snap = await ref.get()
  if (!snap.exists) {
    return { slaDeadline: null, slaBreached: false, createdBreachLog: false }
  }

  const existing = snap.data() as BriefingIntelligenceReport
  const updated = applySlaToReport(existing, now)

  const prevBreached = Boolean(existing.slaBreached)
  const becameBreached = updated.slaBreached && !prevBreached

  await ref.set(
    {
      slaDeadline: updated.slaDeadline,
      slaBreached: updated.slaBreached,
      updatedAt: toIso(now),
    },
    { merge: true }
  )

  if (!becameBreached) {
    return { slaDeadline: updated.slaDeadline, slaBreached: updated.slaBreached, createdBreachLog: false }
  }

  // Avoid writing secrets/content; only SLA metadata.
  const breachRef = db.collection('slaBreaches').doc(reportId)
  const breachSnap = await breachRef.get()
  if (breachSnap.exists) {
    return { slaDeadline: updated.slaDeadline, slaBreached: updated.slaBreached, createdBreachLog: false }
  }

  await breachRef.set(
    {
      reportId,
      requestId: existing.requestId,
      agentId: existing.agentId,
      smeId: existing.smeId,
      evidenceSubmittedAt: existing.evidenceSubmittedAt,
      slaDeadline: updated.slaDeadline,
      breachedAt: toIso(now),
      createdAt: toIso(now),
    },
    { merge: true }
  )

  return { slaDeadline: updated.slaDeadline, slaBreached: updated.slaBreached, createdBreachLog: true }
}

