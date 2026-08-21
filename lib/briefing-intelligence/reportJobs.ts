import {
  briefingReportPromptVersion,
  REPORT_GENERATION_MAX_ATTEMPTS,
} from './featureFlag'
import type {
  BriefingReportJob,
  BriefingReportJobStatus,
} from './meetingMinutesTypes'
import type { Firestore } from 'firebase-admin/firestore'

const COLLECTION = 'briefingReportJobs'

function nowIso() {
  return new Date().toISOString()
}

export function briefingReportJobIdForReport(reportId: string): string {
  return `rj-${reportId}`
}

export async function createOrResetReportJob(params: {
  db: Firestore
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  transcriptId: string
  force?: boolean
}): Promise<BriefingReportJob> {
  const id = briefingReportJobIdForReport(params.reportId)
  const now = nowIso()
  const ref = params.db.collection(COLLECTION).doc(id)
  const existing = await ref.get()

  if (existing.exists && !params.force) {
    const prev = existing.data() as BriefingReportJob
    if (prev.status === 'completed' && prev.transcriptId === params.transcriptId) {
      return prev
    }
    if (
      (prev.status === 'queued' || prev.status === 'processing') &&
      prev.transcriptId === params.transcriptId
    ) {
      return prev
    }
  }

  const job: BriefingReportJob = {
    id,
    reportId: params.reportId,
    requestId: params.requestId,
    tenderId: params.tenderId,
    agentId: params.agentId,
    smeId: params.smeId,
    transcriptId: params.transcriptId,
    status: 'queued',
    attempts: 0,
    maxAttempts: REPORT_GENERATION_MAX_ATTEMPTS,
    aiModel: process.env.BRIEFING_INTELLIGENCE_EXTRACT_MODEL || 'gpt-4o',
    promptVersion: briefingReportPromptVersion(),
    reportVersionId: null,
    pdfStoragePath: null,
    errorCode: null,
    errorMessage: null,
    createdAt: existing.exists
      ? String((existing.data() as BriefingReportJob).createdAt || now)
      : now,
    processingStartedAt: null,
    completedAt: null,
    updatedAt: now,
    nextAttemptAt: now,
  }

  await ref.set(job, { merge: false })
  return job
}

export async function getReportJob(
  db: Firestore,
  jobId: string
): Promise<BriefingReportJob | null> {
  const snap = await db.collection(COLLECTION).doc(jobId).get()
  if (!snap.exists) return null
  return snap.data() as BriefingReportJob
}

export async function getReportJobForReport(
  db: Firestore,
  reportId: string
): Promise<BriefingReportJob | null> {
  return getReportJob(db, briefingReportJobIdForReport(reportId))
}

export async function claimReportJob(
  db: Firestore,
  jobId: string
): Promise<BriefingReportJob | null> {
  const ref = db.collection(COLLECTION).doc(jobId)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const job = snap.data() as BriefingReportJob
    if (job.status === 'completed' || job.status === 'processing') return null
    if (job.status !== 'queued' && job.status !== 'retrying' && job.status !== 'failed') {
      return null
    }
    if (job.attempts >= job.maxAttempts && job.status === 'failed') return null

    const now = nowIso()
    const next: BriefingReportJob = {
      ...job,
      status: 'processing',
      attempts: job.attempts + 1,
      processingStartedAt: now,
      updatedAt: now,
      errorCode: null,
      errorMessage: null,
      nextAttemptAt: null,
    }
    tx.set(ref, next, { merge: true })
    return next
  })
}

export async function completeReportJob(params: {
  db: Firestore
  jobId: string
  reportVersionId: string
  pdfStoragePath: string | null
  aiModel: string | null
}): Promise<void> {
  const now = nowIso()
  await params.db.collection(COLLECTION).doc(params.jobId).set(
    {
      status: 'completed' satisfies BriefingReportJobStatus,
      reportVersionId: params.reportVersionId,
      pdfStoragePath: params.pdfStoragePath,
      aiModel: params.aiModel,
      completedAt: now,
      updatedAt: now,
      errorCode: null,
      errorMessage: null,
    },
    { merge: true }
  )
}

export async function failReportJob(params: {
  db: Firestore
  jobId: string
  errorCode: string
  errorMessage: string
  retry: boolean
}): Promise<BriefingReportJob | null> {
  const ref = params.db.collection(COLLECTION).doc(params.jobId)
  const snap = await ref.get()
  if (!snap.exists) return null
  const job = snap.data() as BriefingReportJob
  const now = nowIso()
  const canRetry = params.retry && job.attempts < job.maxAttempts
  const backoffMs = Math.min(60_000, 5_000 * Math.pow(2, Math.max(0, job.attempts - 1)))
  const next: Partial<BriefingReportJob> = {
    status: canRetry ? 'retrying' : 'failed',
    errorCode: params.errorCode.slice(0, 120),
    errorMessage: params.errorMessage.slice(0, 2000),
    updatedAt: now,
    nextAttemptAt: canRetry ? new Date(Date.now() + backoffMs).toISOString() : null,
  }
  await ref.set(next, { merge: true })
  return { ...job, ...next } as BriefingReportJob
}
