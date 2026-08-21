import type { Firestore } from 'firebase-admin/firestore'
import type { BriefingTranscriptRecord, TranscriptSegment } from './transcriptionTypes'

const COLLECTION = 'briefingTranscripts'

function nowIso() {
  return new Date().toISOString()
}

export function transcriptIdForJob(jobId: string): string {
  return `bt-${jobId}`
}

export async function saveBriefingTranscript(params: {
  db: Firestore
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  transcriptionJobId: string
  sourceAudioPath: string
  language: string | null
  durationSeconds: number | null
  fullText: string
  segments: TranscriptSegment[]
  provider: string
  model: string | null
  confidence: number | null
  rawProviderResponseRef: string | null
}): Promise<BriefingTranscriptRecord> {
  const id = transcriptIdForJob(params.transcriptionJobId)
  const now = nowIso()
  const ref = params.db.collection(COLLECTION).doc(id)
  const existing = await ref.get()

  const record: BriefingTranscriptRecord = {
    id,
    reportId: params.reportId,
    requestId: params.requestId,
    tenderId: params.tenderId,
    agentId: params.agentId,
    smeId: params.smeId,
    transcriptionJobId: params.transcriptionJobId,
    sourceAudioPath: params.sourceAudioPath,
    language: params.language,
    durationSeconds: params.durationSeconds,
    fullText: params.fullText,
    segments: params.segments,
    provider: params.provider,
    model: params.model,
    confidence: params.confidence,
    status: 'final',
    rawProviderResponseRef: params.rawProviderResponseRef,
    createdAt: existing.exists
      ? String((existing.data() as BriefingTranscriptRecord).createdAt || now)
      : now,
    updatedAt: now,
  }

  await ref.set(record, { merge: false })
  return record
}

export async function getBriefingTranscript(
  db: Firestore,
  transcriptId: string
): Promise<BriefingTranscriptRecord | null> {
  const snap = await db.collection(COLLECTION).doc(transcriptId).get()
  if (!snap.exists) return null
  return snap.data() as BriefingTranscriptRecord
}

export async function getBriefingTranscriptForReport(
  db: Firestore,
  reportId: string
): Promise<BriefingTranscriptRecord | null> {
  const snap = await db
    .collection(COLLECTION)
    .where('reportId', '==', reportId)
    .limit(1)
    .get()
  if (snap.empty) return null
  return snap.docs[0].data() as BriefingTranscriptRecord
}
