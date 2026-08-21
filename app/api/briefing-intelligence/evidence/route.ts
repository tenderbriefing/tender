import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { generateBriefingIntelligenceReportId } from '@/lib/briefing-intelligence/reportId'
import { calculateSlaDeadlineISO } from '@/lib/briefing-intelligence/slaService'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'

export const dynamic = 'force-dynamic'

const MAX_AUDIO_BYTES = 100 * 1024 * 1024 // 100MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB each
const MAX_IMAGES = 10

const AUDIO_MIME = new Set([
  'audio/mpeg', // mp3
  'audio/mp4', // m4a/aac
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
])

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function safeExt(fileName: string) {
  const idx = fileName.lastIndexOf('.')
  if (idx < 0) return ''
  return fileName.slice(idx + 1).toLowerCase()
}

function sanitizeFileName(name: string) {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120)
}

function parseNullableString(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s ? s : null
}

function parseNullableNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v))
  return Number.isFinite(n) ? n : null
}

function parseNullableBoolean(v: unknown): boolean | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return null
}

function parseAgentObservations(input: unknown): BriefingIntelligenceReport['agentObservations'] {
  const obj = (input && typeof input === 'object' ? (input as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >

  return {
    arrivalTime: parseNullableString(obj.arrivalTime),
    briefingStartTime: parseNullableString(obj.briefingStartTime),
    briefingEndTime: parseNullableString(obj.briefingEndTime),
    approxAttendees: parseNullableNumber(obj.approxAttendees),
    siteInspection: parseNullableBoolean(obj.siteInspection),
    docsDistributed: parseNullableBoolean(obj.docsDistributed),
    importantAnnouncement: parseNullableBoolean(obj.importantAnnouncement),
    shortNote: parseNullableString(obj.shortNote),
  }
}

function nowIso() {
  return new Date().toISOString()
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
  if (!user) return unauthorizedResponse('Youth Agent sign-in required')

  const form = await request.formData()

  const requestId = String(form.get('requestId') || '')
  const observationsRaw = form.get('observations') // optional (Youth Agent no longer submits this)
  const tenderContextRaw = form.get('tenderContext') // optional; tolerated for backwards compatibility
  void tenderContextRaw

  const audioEntry = form.get('audio') || form.get('audioFile') || form.get('audio_file')
  const audioFile = audioEntry instanceof File ? audioEntry : null

  if (!requestId) {
    return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 })
  }
  if (!audioFile) {
    return NextResponse.json({ success: false, error: 'Audio file is required' }, { status: 400 })
  }
  if (audioFile.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ success: false, error: 'Audio file exceeds 100MB' }, { status: 413 })
  }

  const audioContentType = audioFile.type || ''
  const audioAllowed =
    AUDIO_MIME.has(audioContentType) || ['mp3', 'm4a', 'wav', 'aac'].includes(safeExt(audioFile.name))
  if (!audioAllowed) {
    return NextResponse.json({ success: false, error: 'Unsupported audio file type' }, { status: 415 })
  }

  const images: File[] = [
    ...form.getAll('attendanceImages'),
    ...form.getAll('images'),
    ...form.getAll('attendanceImage'),
  ].filter((v): v is File => v instanceof File)

  if (images.length < 1) {
    return NextResponse.json({ success: false, error: 'At least 1 attendance image/PDF is required' }, { status: 400 })
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json({ success: false, error: `At most ${MAX_IMAGES} attendance files allowed` }, { status: 400 })
  }

  for (const img of images) {
    if (img.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: `Image exceeds 10MB: ${img.name || 'file'}` }, { status: 413 })
    }
    const ct = img.type || ''
    const ext = safeExt(img.name)
    const ok = IMAGE_MIME.has(ct) || ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)
    if (!ok) {
      return NextResponse.json({ success: false, error: `Unsupported image type: ${img.name || 'file'}` }, { status: 415 })
    }
  }

  let observationsParsed: unknown = {}
  if (observationsRaw) {
    try {
      const rawStr = observationsRaw instanceof File ? '' : String(observationsRaw)
      observationsParsed = JSON.parse(rawStr)
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid observations JSON' }, { status: 400 })
    }
  }

  const admin = getFirebaseAdmin()
  const db = admin.firestore()

  const reqSnap = await db.collection('attendanceRequests').doc(requestId).get()
  if (!reqSnap.exists) {
    return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
  }
  const req = reqSnap.data() as any

  const agentId = user.uid
  const okAssigned =
    req.agentId === agentId ||
    req.assignedAgentId === agentId ||
    (Array.isArray(req.notifiedAgents) && req.notifiedAgents.includes(agentId))

  if (!okAssigned) return forbiddenResponse('You are not assigned to this briefing')

  const smeId = String(req.smeId || '')
  const tenderId = String(req.tenderId || '')
  if (!smeId || !tenderId) {
    return NextResponse.json(
      { success: false, error: 'Missing smeId/tenderId on assignment' },
      { status: 400 }
    )
  }

  const reportId = generateBriefingIntelligenceReportId({
    requestId,
    agentId,
    salt: tenderId,
  })

  const docRef = db.collection('briefingIntelligenceReports').doc(reportId)
  const existingSnap = await docRef.get()
  const existing = existingSnap.exists ? (existingSnap.data() as BriefingIntelligenceReport) : null

  if (existing?.status === 'final' || existing?.status === 'delivered') {
    return NextResponse.json(
      { success: false, error: 'Report is already finalized/delivered' },
      { status: 409 }
    )
  }

  const createdAt = existing?.createdAt || nowIso()
  const processingAttempts = existing?.processingAttempts || 0

  // Storage uploads (workspace-evidence/* as required).
  const bucket = admin.storage().bucket()
  const prefix = `workspace-evidence/${requestId}/${agentId}/briefing-intelligence/${reportId}`

  const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
  const audioSafeName = sanitizeFileName(audioFile.name || 'audio')
  const audioPath = `${prefix}/audio/${Date.now()}-${audioSafeName}`
  await bucket
    .file(audioPath)
    .save(audioBuffer, {
      contentType: audioFile.type || 'application/octet-stream',
      metadata: {
        uploadedBy: agentId,
        requestId,
        reportId,
      },
      resumable: false,
    })

  const attendanceEvidenceRefs: string[] = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const imgBuf = Buffer.from(await img.arrayBuffer())
    const imgSafeName = sanitizeFileName(img.name || `evidence-${i}`)
    const imgPath = `${prefix}/attendance/${i + 1}-${Date.now()}-${imgSafeName}`
    await bucket
      .file(imgPath)
      .save(imgBuf, {
        contentType: img.type || 'application/octet-stream',
        metadata: {
          uploadedBy: agentId,
          requestId,
          reportId,
        },
        resumable: false,
      })
    attendanceEvidenceRefs.push(imgPath)
  }

  const evidenceSubmittedAt = nowIso()
  const slaDeadline = calculateSlaDeadlineISO(evidenceSubmittedAt)

  // Reset downstream fields when re-uploading evidence (but keep attempt count).
  const agentObservations = parseAgentObservations(observationsParsed)

  const patch: Omit<BriefingIntelligenceReport, 'id'> & { id: string } = {
    id: reportId,
    reportId,
    requestId,
    tenderId,
    agentId,
    smeId,
    status: 'evidence_uploaded',
    evidenceSubmittedAt,
    processingStartedAt: null,
    draftReadyAt: null,
    agentReviewedAt: null,
    finalizedAt: null,
    deliveredAt: null,
    slaDeadline,
    slaBreached: Boolean(slaDeadline ? Date.now() > new Date(slaDeadline).getTime() : false),
    audioFileRef: audioPath,
    audioFileName: audioFile.name || null,
    audioFileSizeMb:
      audioFile.size > 0 ? Number((audioFile.size / (1024 * 1024)).toFixed(3)) : null,
    attendanceEvidenceRefs,
    agentObservations,
    transcription: null,
    reportContent: null,
    agentReviewNotes: null,
    pdfStorageRef: null,
    deliveryEmailId: null,
    createdAt,
    updatedAt: evidenceSubmittedAt,
    processingAttempts,
    lastError: null,
  }

  await docRef.set(patch, { merge: true })

  await logBriefingIntelligenceAuditEvent({
    db,
    eventType: 'evidence_submitted',
    reportId,
    requestId,
    agentId,
    smeId,
    actorUid: user.uid,
    actorRole: 'youth-agent',
    nextStatus: 'evidence_uploaded',
    meta: {
      audioFileRef: audioPath,
      attendanceFileCount: attendanceEvidenceRefs.length,
    },
  })

  // Async transcription: create job + enqueue worker (never blocks on Whisper).
  let transcriptionJobId: string | null = null
  try {
    const { isBriefingAudioTranscriptionEnabled } = await import(
      '@/lib/briefing-intelligence/featureFlag'
    )
    if (isBriefingAudioTranscriptionEnabled()) {
      const { createOrResetTranscriptionJob } = await import(
        '@/lib/briefing-intelligence/transcriptionJobs'
      )
      const { enqueueTranscriptionWorker } = await import(
        '@/lib/briefing-intelligence/enqueueTranscription'
      )
      const job = await createOrResetTranscriptionJob({
        db,
        reportId,
        requestId,
        tenderId,
        agentId,
        smeId,
        audioStoragePath: audioPath,
        audioMimeType: audioFile.type || null,
        audioSizeBytes: audioFile.size || null,
        provider: process.env.BRIEFING_INTELLIGENCE_PROVIDER || 'openai',
      })
      transcriptionJobId = job.id
      await enqueueTranscriptionWorker({
        jobId: job.id,
        reportId,
        requestId,
        tenderId,
      })
    }
  } catch (enqueueErr) {
    // Evidence remains valid even if job enqueue fails.
    console.error('[transcription] job create/enqueue failed after evidence', {
      requestId,
      reportId,
      tenderId,
      error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
    })
  }

  return NextResponse.json({
    success: true,
    data: { reportId, transcriptionJobId },
  })
}

