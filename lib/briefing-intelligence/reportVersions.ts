import type { Firestore } from 'firebase-admin/firestore'
import type {
  BriefingReportVersion,
  BriefingSummary,
  StructuredMeetingMinutesReport,
} from './meetingMinutesTypes'

const COLLECTION = 'briefingReportVersions'

function nowIso() {
  return new Date().toISOString()
}

export async function nextReportVersionNumber(
  db: Firestore,
  reportId: string
): Promise<number> {
  const snap = await db
    .collection(COLLECTION)
    .where('reportId', '==', reportId)
    .orderBy('version', 'desc')
    .limit(1)
    .get()
  if (snap.empty) return 1
  const prev = snap.docs[0].data() as BriefingReportVersion
  return (prev.version || 0) + 1
}

export async function saveReportVersion(params: {
  db: Firestore
  reportId: string
  requestId: string
  tenderId: string
  version: number
  structuredContent: StructuredMeetingMinutesReport
  summary: BriefingSummary | null
  pdfStoragePath: string | null
  promptVersion: string
  model: string | null
  transcriptId: string
}): Promise<BriefingReportVersion> {
  const id = `brv-${params.reportId}-v${params.version}`
  const now = nowIso()

  // Supersede previous draft_ready versions
  const prior = await params.db
    .collection(COLLECTION)
    .where('reportId', '==', params.reportId)
    .where('status', '==', 'draft_ready')
    .get()
  for (const doc of prior.docs) {
    await doc.ref.set({ status: 'superseded', updatedAt: now }, { merge: true })
  }

  const record: BriefingReportVersion = {
    id,
    reportId: params.reportId,
    requestId: params.requestId,
    tenderId: params.tenderId,
    version: params.version,
    status: 'draft_ready',
    structuredContent: params.structuredContent,
    summary: params.summary,
    pdfStoragePath: params.pdfStoragePath,
    promptVersion: params.promptVersion,
    model: params.model,
    transcriptId: params.transcriptId,
    createdAt: now,
    approvedAt: null,
    approvedBy: null,
  }
  await params.db.collection(COLLECTION).doc(id).set(record)
  return record
}

/**
 * Atomic approve. Idempotent when the same version is already approved.
 * Does not mutate superseded / already-approved historical drafts beyond this doc.
 */
export async function approveReportVersion(params: {
  db: Firestore
  versionId: string
  approvedBy: string
}): Promise<{ version: BriefingReportVersion; alreadyApproved: boolean } | null> {
  const ref = params.db.collection(COLLECTION).doc(params.versionId)
  return params.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const current = snap.data() as BriefingReportVersion
    if (current.status === 'approved' && current.approvedAt) {
      return { version: current, alreadyApproved: true }
    }
    if (current.status === 'superseded') {
      throw Object.assign(new Error('Cannot approve a superseded report version'), {
        code: 'superseded_version',
      })
    }
    const now = nowIso()
    const next: BriefingReportVersion = {
      ...current,
      status: 'approved',
      approvedAt: now,
      approvedBy: params.approvedBy,
    }
    tx.set(ref, { status: 'approved', approvedAt: now, approvedBy: params.approvedBy }, { merge: true })
    return { version: next, alreadyApproved: false }
  })
}

export async function getLatestReportVersion(
  db: Firestore,
  reportId: string
): Promise<BriefingReportVersion | null> {
  const snap = await db
    .collection(COLLECTION)
    .where('reportId', '==', reportId)
    .orderBy('version', 'desc')
    .limit(1)
    .get()
  if (snap.empty) return null
  return snap.docs[0].data() as BriefingReportVersion
}
