import type { Firestore } from 'firebase-admin/firestore'
import { PROCESSING_LEASE_MS, TRANSCRIPTION_VERSION_CHUNK } from './constants'
import type {
  AudioProcessingStatus,
  BriefingAudioChunk,
  BriefingAudioProcessing,
  ChunkPlanEntry,
  TranscriptionMode,
} from './types'

const COLLECTION = 'briefingAudioProcessing'

function nowIso() {
  return new Date().toISOString()
}

export function audioProcessingIdForReport(reportId: string): string {
  return `bap-${reportId}`
}

export function chunkIdFor(reportId: string, index: number): string {
  return `bac-${reportId}-${String(index).padStart(3, '0')}`
}

export function chunksCollection(db: Firestore, processingId: string) {
  return db.collection(COLLECTION).doc(processingId).collection('chunks')
}

export async function getAudioProcessing(
  db: Firestore,
  processingId: string
): Promise<BriefingAudioProcessing | null> {
  const snap = await db.collection(COLLECTION).doc(processingId).get()
  if (!snap.exists) return null
  return snap.data() as BriefingAudioProcessing
}

export async function createOrResetAudioProcessing(params: {
  db: Firestore
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  sourceStoragePath: string
  sourceHash: string
  sourceSizeBytes: number
  sourceDurationMs: number | null
  sourceCodec: string | null
  transcriptionMode: TranscriptionMode
  chunkingEnabled: boolean
  plannerSummary: Record<string, unknown> | null
  chunkCount: number
}): Promise<BriefingAudioProcessing> {
  const id = audioProcessingIdForReport(params.reportId)
  const now = nowIso()
  const ref = params.db.collection(COLLECTION).doc(id)
  const existing = await ref.get()

  if (existing.exists) {
    const prev = existing.data() as BriefingAudioProcessing
    if (
      prev.status === 'completed' &&
      prev.sourceHash === params.sourceHash &&
      prev.assembledTranscriptId
    ) {
      return prev
    }
    if (
      prev.sourceHash === params.sourceHash &&
      ['queued', 'analyzing', 'chunking', 'transcribing', 'assembling'].includes(prev.status)
    ) {
      return prev
    }
  }

  const doc: BriefingAudioProcessing = {
    id,
    reportId: params.reportId,
    requestId: params.requestId,
    tenderId: params.tenderId,
    agentId: params.agentId,
    smeId: params.smeId,
    sourceStoragePath: params.sourceStoragePath,
    sourceHash: params.sourceHash,
    sourceSizeBytes: params.sourceSizeBytes,
    sourceDurationMs: params.sourceDurationMs,
    sourceCodec: params.sourceCodec,
    transcriptionVersion: TRANSCRIPTION_VERSION_CHUNK,
    transcriptionMode: params.transcriptionMode,
    status: 'queued',
    chunkCount: params.chunkCount,
    completedChunkCount: 0,
    failedChunkCount: 0,
    nextChunkIndex: 0,
    assembledTranscriptId: null,
    chunkingEnabled: params.chunkingEnabled,
    plannerSummary: params.plannerSummary,
    errorCode: null,
    errorMessage: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    attempts: 0,
    maxAttempts: 3,
    createdAt: existing.exists
      ? String((existing.data() as BriefingAudioProcessing).createdAt || now)
      : now,
    updatedAt: now,
    completedAt: null,
  }

  await ref.set(doc, { merge: false })
  return doc
}

export async function claimAudioProcessingLease(
  db: Firestore,
  processingId: string,
  leaseOwner: string
): Promise<BriefingAudioProcessing | null> {
  const ref = db.collection(COLLECTION).doc(processingId)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const doc = snap.data() as BriefingAudioProcessing
    if (doc.status === 'completed') return null

    const now = Date.now()
    if (doc.leaseExpiresAt) {
      const exp = new Date(doc.leaseExpiresAt).getTime()
      if (Number.isFinite(exp) && exp > now && doc.leaseOwner && doc.leaseOwner !== leaseOwner) {
        return null
      }
    }

    const next: BriefingAudioProcessing = {
      ...doc,
      leaseOwner,
      leaseExpiresAt: new Date(now + PROCESSING_LEASE_MS).toISOString(),
      attempts: doc.attempts + 1,
      updatedAt: nowIso(),
    }
    tx.set(ref, next, { merge: true })
    return next
  })
}

export async function updateAudioProcessing(
  db: Firestore,
  processingId: string,
  patch: Partial<BriefingAudioProcessing>
): Promise<void> {
  await db
    .collection(COLLECTION)
    .doc(processingId)
    .set({ ...patch, updatedAt: nowIso() }, { merge: true })
}

export async function writeChunkPlan(
  db: Firestore,
  processingId: string,
  reportId: string,
  plan: ChunkPlanEntry[]
): Promise<BriefingAudioChunk[]> {
  const col = chunksCollection(db, processingId)
  const chunks: BriefingAudioChunk[] = []
  for (const entry of plan) {
    const id = chunkIdFor(reportId, entry.index)
    const chunk: BriefingAudioChunk = {
      id,
      index: entry.index,
      startMs: entry.startMs,
      endMs: entry.endMs,
      overlapStartMs: entry.overlapStartMs,
      storagePath: null,
      audioHash: null,
      sizeBytes: null,
      status: 'pending',
      transcriptText: null,
      segments: null,
      provider: null,
      providerRequestId: null,
      attempts: 0,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      updatedAt: nowIso(),
    }
    await col.doc(id).set(chunk, { merge: false })
    chunks.push(chunk)
  }
  return chunks
}

export async function listChunks(
  db: Firestore,
  processingId: string
): Promise<BriefingAudioChunk[]> {
  const snap = await chunksCollection(db, processingId).orderBy('index').get()
  return snap.docs.map((d) => d.data() as BriefingAudioChunk)
}

export async function getChunk(
  db: Firestore,
  processingId: string,
  chunkId: string
): Promise<BriefingAudioChunk | null> {
  const snap = await chunksCollection(db, processingId).doc(chunkId).get()
  if (!snap.exists) return null
  return snap.data() as BriefingAudioChunk
}

export async function updateChunk(
  db: Firestore,
  processingId: string,
  chunkId: string,
  patch: Partial<BriefingAudioChunk>
): Promise<void> {
  await chunksCollection(db, processingId)
    .doc(chunkId)
    .set({ ...patch, updatedAt: nowIso() }, { merge: true })
}

export async function setProcessingStatus(
  db: Firestore,
  processingId: string,
  status: AudioProcessingStatus,
  extra: Partial<BriefingAudioProcessing> = {}
): Promise<void> {
  await updateAudioProcessing(db, processingId, { status, ...extra })
}
