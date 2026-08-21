import type { Firestore } from 'firebase-admin/firestore'
import {
  TRANSCRIPTION_MAX_ATTEMPTS,
} from './featureFlag'
import type {
  BriefingTranscriptionJob,
  TranscriptionJobStatus,
} from './transcriptionTypes'

const COLLECTION = 'briefingTranscriptionJobs'

function nowIso() {
  return new Date().toISOString()
}

/** Deterministic job id: one active job per report (idempotent). */
export function transcriptionJobIdForReport(reportId: string): string {
  return `tj-${reportId}`
}

export async function createOrResetTranscriptionJob(params: {
  db: Firestore
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  audioStoragePath: string
  audioMimeType: string | null
  audioSizeBytes: number | null
  provider: string
}): Promise<BriefingTranscriptionJob> {
  const id = transcriptionJobIdForReport(params.reportId)
  const now = nowIso()
  const ref = params.db.collection(COLLECTION).doc(id)
  const existing = await ref.get()

  if (existing.exists) {
    const prev = existing.data() as BriefingTranscriptionJob
    // Idempotent: if already completed for the same audio path, return as-is.
    if (
      prev.status === 'completed' &&
      prev.audioStoragePath === params.audioStoragePath &&
      prev.transcriptId
    ) {
      return prev
    }
    // If currently processing same audio, do not reset (avoid duplicate billing).
    if (
      (prev.status === 'processing' || prev.status === 'queued') &&
      prev.audioStoragePath === params.audioStoragePath
    ) {
      return prev
    }
  }

  const job: BriefingTranscriptionJob = {
    id,
    reportId: params.reportId,
    requestId: params.requestId,
    tenderId: params.tenderId,
    agentId: params.agentId,
    smeId: params.smeId,
    audioStoragePath: params.audioStoragePath,
    audioMimeType: params.audioMimeType,
    audioSizeBytes: params.audioSizeBytes,
    audioDurationSeconds: null,
    provider: params.provider,
    providerJobId: null,
    status: 'queued',
    attempts: 0,
    maxAttempts: TRANSCRIPTION_MAX_ATTEMPTS,
    language: null,
    detectedLanguage: null,
    transcriptId: null,
    errorCode: null,
    errorMessage: null,
    createdAt: existing.exists
      ? String((existing.data() as BriefingTranscriptionJob).createdAt || now)
      : now,
    processingStartedAt: null,
    completedAt: null,
    updatedAt: now,
    nextAttemptAt: now,
  }

  await ref.set(job, { merge: false })
  return job
}

export async function getTranscriptionJob(
  db: Firestore,
  jobId: string
): Promise<BriefingTranscriptionJob | null> {
  const snap = await db.collection(COLLECTION).doc(jobId).get()
  if (!snap.exists) return null
  return snap.data() as BriefingTranscriptionJob
}

export async function getTranscriptionJobForReport(
  db: Firestore,
  reportId: string
): Promise<BriefingTranscriptionJob | null> {
  return getTranscriptionJob(db, transcriptionJobIdForReport(reportId))
}

/**
 * Atomically claim a queued/retrying job for processing.
 * Returns null if another worker already claimed it or max attempts reached.
 */
export async function claimTranscriptionJob(
  db: Firestore,
  jobId: string
): Promise<BriefingTranscriptionJob | null> {
  const ref = db.collection(COLLECTION).doc(jobId)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const job = snap.data() as BriefingTranscriptionJob
    if (job.status === 'completed') return null
    if (job.status === 'processing') return null
    if (job.attempts >= job.maxAttempts && job.status === 'failed') return null
    if (job.status !== 'queued' && job.status !== 'retrying' && job.status !== 'failed') {
      return null
    }

    const now = nowIso()
    const next: BriefingTranscriptionJob = {
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

export async function completeTranscriptionJob(params: {
  db: Firestore
  jobId: string
  transcriptId: string
  detectedLanguage: string | null
  audioDurationSeconds: number | null
}): Promise<void> {
  const now = nowIso()
  await params.db
    .collection(COLLECTION)
    .doc(params.jobId)
    .set(
      {
        status: 'completed' satisfies TranscriptionJobStatus,
        transcriptId: params.transcriptId,
        detectedLanguage: params.detectedLanguage,
        language: params.detectedLanguage,
        audioDurationSeconds: params.audioDurationSeconds,
        completedAt: now,
        updatedAt: now,
        errorCode: null,
        errorMessage: null,
      },
      { merge: true }
    )
}

export async function failTranscriptionJob(params: {
  db: Firestore
  jobId: string
  errorCode: string
  errorMessage: string
  retry: boolean
}): Promise<BriefingTranscriptionJob | null> {
  const ref = params.db.collection(COLLECTION).doc(params.jobId)
  const snap = await ref.get()
  if (!snap.exists) return null
  const job = snap.data() as BriefingTranscriptionJob
  const now = nowIso()
  const canRetry = params.retry && job.attempts < job.maxAttempts
  const backoffMs = Math.min(60_000, 5_000 * Math.pow(2, Math.max(0, job.attempts - 1)))
  const next: Partial<BriefingTranscriptionJob> = {
    status: canRetry ? 'retrying' : 'failed',
    errorCode: params.errorCode.slice(0, 120),
    errorMessage: params.errorMessage.slice(0, 2000),
    updatedAt: now,
    nextAttemptAt: canRetry ? new Date(Date.now() + backoffMs).toISOString() : null,
  }
  await ref.set(next, { merge: true })
  return { ...job, ...next } as BriefingTranscriptionJob
}
