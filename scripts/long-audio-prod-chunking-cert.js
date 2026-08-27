#!/usr/bin/env node
/**
 * Controlled production long-audio chunking certification (~65 min fixture).
 * Does NOT deliver to SME or alter Founder approval on customer jobs.
 *
 * Usage:
 *   LONG_AUDIO_PROD_CERT=1 node scripts/long-audio-prod-chunking-cert.js
 *
 * Optional: LONG_AUDIO_PROD_MINUTES=65 (default 65)
 */
const { execFileSync } = require('child_process')
const { mkdtempSync, readFileSync, rmSync, existsSync, statSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

process.chdir(join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

if (process.env.LONG_AUDIO_PROD_CERT !== '1') {
  console.error('Set LONG_AUDIO_PROD_CERT=1 to run production long-audio certification.')
  process.exit(1)
}

const PROD_BASE =
  process.env.PROD_BASE_URL || 'https://tenderbriefing-xzgs5uw5ta-bq.a.run.app'
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
const MINUTES = Number(process.env.LONG_AUDIO_PROD_MINUTES || '65')

function nowIso() {
  return new Date().toISOString()
}

function getSecret(name) {
  return execFileSync(
    'gcloud',
    ['secrets', 'versions', 'access', 'latest', `--secret=${name}`, `--project=${PROJECT}`],
    { encoding: 'utf8' }
  ).trim()
}

function makeLongMp3(minutes) {
  const cache = join(tmpdir(), `tb-long-prod-${minutes}min.mp3`)
  if (existsSync(cache)) {
    const buf = readFileSync(cache)
    return { dir: null, mp3: cache, buf, cached: true }
  }

  const dir = mkdtempSync(join(tmpdir(), 'tb-long-prod-build-'))
  const aiff = join(dir, 'segment.aiff')
  const segmentMp3 = join(dir, 'segment.mp3')
  const out = join(dir, `long-${minutes}min.mp3`)

  const text =
    'Section one. Tender reference E R F twenty twenty six dash zero one. ' +
    'Closing date fifteenth March twenty twenty six. Site meeting mandatory. ' +
    'Section two. Technical specifications for electrical installation. ' +
    'Section three. Returnable documents include tax clearance and B E E affidavit.'

  execFileSync('say', ['-r', '175', '-o', aiff, text], { stdio: 'pipe' })
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', aiff, '-ac', '1', '-ar', '16000', '-b:a', '64k', segmentMp3],
    { stdio: 'pipe' }
  )

  const segProbe = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', segmentMp3],
    { encoding: 'utf8' }
  )
  const segSec = parseFloat(segProbe.trim()) || 60
  const targetSec = minutes * 60
  const loops = Math.max(0, Math.ceil(targetSec / segSec) - 1)

  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-stream_loop',
      String(loops),
      '-i',
      segmentMp3,
      '-t',
      String(targetSec),
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k',
      out,
    ],
    { stdio: 'pipe' }
  )

  const buf = readFileSync(out)
  try {
    require('fs').writeFileSync(cache, buf)
  } catch {
    /* ignore cache write */
  }
  return { dir, mp3: out, buf, cached: false }
}

function probeDurationMs(localPath) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', localPath],
    { encoding: 'utf8' }
  )
  const sec = parseFloat(out.trim())
  return Number.isFinite(sec) ? Math.round(sec * 1000) : null
}

async function triggerWorker(syncSecret, jobId, reportId) {
  const res = await fetch(`${PROD_BASE}/api/briefing-intelligence/transcription/worker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sync-secret': syncSecret,
    },
    body: JSON.stringify({ jobId, reportId }),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function main() {
  const syncSecret = getSecret('tenderbriefing-sync-secret')
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || 'tenderbriefing-34679.firebasestorage.app'
  const bucket = admin.storage().bucket(bucketName)

  const suffix = Date.now().toString(36).toUpperCase().slice(-6)
  const reportId = `TB-BR-LA${suffix}`.slice(0, 12)
  const jobId = `tj-${reportId}`
  const requestId = `long-prod-${Date.now()}`
  const audioPath = `briefing-intelligence/${reportId}/audio/long-smoke.mp3`

  const started = Date.now()
  const result = {
    ok: false,
    reportId,
    jobId,
    sourceDurationMs: null,
    sourceSizeBytes: null,
    plannedChunks: null,
    extractedChunks: null,
    speechmaticsJobsSubmitted: null,
    speechmaticsJobsSucceeded: null,
    chunkRetries: null,
    failedChunks: null,
    transcriptionMode: null,
    transcriptProvider: null,
    transcriptWordCount: null,
    transcriptCharCount: null,
    whisperUsed: false,
    stitchCompleted: null,
    reportGenStatus: null,
    elapsedMs: null,
    error: null,
  }

  let buildDir = null
  try {
    const { dir, mp3, buf, cached } = makeLongMp3(MINUTES)
    buildDir = dir
    result.sourceSizeBytes = buf.length
    result.sourceDurationMs = probeDurationMs(mp3)

    const now = nowIso()
    await bucket.file(audioPath).save(buf, {
      contentType: 'audio/mpeg',
      resumable: false,
      metadata: { smoke: 'long-audio-prod-chunking', reportId, cached: String(cached) },
    })

    await db
      .collection('briefingIntelligenceReports')
      .doc(reportId)
      .set({
        id: reportId,
        reportId,
        requestId,
        tenderId: 'smoke-tender-long-audio',
        agentId: 'ops-smoke-agent',
        smeId: 'ops-smoke-sme',
        status: 'evidence_uploaded',
        evidenceSubmittedAt: now,
        audioFileRef: audioPath,
        audioFileName: 'long-smoke.mp3',
        audioFileSizeMb: Number((buf.length / (1024 * 1024)).toFixed(4)),
        attendanceEvidenceRefs: [],
        agentObservations: {
          shortNote: 'Long-audio production chunking cert — do not deliver',
        },
        smokeCertification: {
          kind: 'long_audio_prod_chunking',
          createdAt: now,
          doNotDeliver: true,
        },
        createdAt: now,
        updatedAt: now,
      })

    await db
      .collection('briefingTranscriptionJobs')
      .doc(jobId)
      .set({
        id: jobId,
        reportId,
        requestId,
        tenderId: 'smoke-tender-long-audio',
        agentId: 'ops-smoke-agent',
        smeId: 'ops-smoke-sme',
        audioStoragePath: audioPath,
        audioMimeType: 'audio/mpeg',
        audioSizeBytes: buf.length,
        provider: 'speechmatics',
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        createdAt: now,
        updatedAt: now,
      })

    await triggerWorker(syncSecret, jobId, reportId)

    // Poll up to ~45 min (540 x 5s) — worker continues via enqueue on needsContinuation
    let job = null
    let lastWorkerKick = Date.now()
    for (let i = 0; i < 540; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const snap = await db.collection('briefingTranscriptionJobs').doc(jobId).get()
      job = snap.data()
      if (!job) continue

      const bapId = `bap-${reportId}`
      const bapSnap = await db.collection('briefingAudioProcessing').doc(bapId).get()
      const bap = bapSnap.data() || null

      if (bap && job.status !== 'completed' && job.status !== 'failed') {
        // Nudge worker every 4 min if still processing (continuation safety)
        if (Date.now() - lastWorkerKick > 240_000) {
          await triggerWorker(syncSecret, jobId, reportId)
          lastWorkerKick = Date.now()
        }
      }

      if (job.status === 'completed' || job.status === 'failed') break
    }

    const bapId = `bap-${reportId}`
    const bapSnap = await db.collection('briefingAudioProcessing').doc(bapId).get()
    const bap = bapSnap.data() || null
    const chunksSnap = await db
      .collection('briefingAudioProcessing')
      .doc(bapId)
      .collection('chunks')
      .orderBy('index')
      .get()
    const chunks = chunksSnap.docs.map((d) => d.data())

    const reportSnap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
    const report = reportSnap.data() || {}
    const transcriptId = job?.transcriptId
    let transcript = null
    if (transcriptId) {
      const tSnap = await db.collection('briefingTranscripts').doc(transcriptId).get()
      transcript = tSnap.data() || null
    }

    const chunkStatuses = chunks.map((c) => ({
      index: c.index,
      status: c.status,
      attempts: c.attempts ?? 0,
      provider: c.provider || null,
    }))

    result.plannedChunks = bap?.chunkCount ?? chunks.length
    result.extractedChunks = chunks.filter((c) => c.storagePath).length
    result.speechmaticsJobsSubmitted = chunks.length
    result.speechmaticsJobsSucceeded = chunks.filter((c) => c.status === 'completed').length
    result.chunkRetries = chunkStatuses.reduce((sum, c) => sum + Math.max(0, (c.attempts || 1) - 1), 0)
    result.failedChunks = chunks.filter((c) => c.status === 'failed').length
    result.transcriptionMode =
      bap?.transcriptionMode || report?.pipelineDiagnostics?.transcriptionMode || null
    result.transcriptProvider = transcript?.provider || report?.transcription?.provider || null
    result.transcriptWordCount = transcript?.wordCount ?? report?.transcription?.transcriptWordCount ?? null
    const fullText = transcript?.fullText || report?.transcription?.transcriptPreview || ''
    result.transcriptCharCount = typeof fullText === 'string' ? fullText.length : null
    result.whisperUsed =
      String(result.transcriptProvider || '').includes('whisper') ||
      chunks.some((c) => String(c.provider || '').includes('whisper'))
    result.stitchCompleted = bap?.status === 'completed' && job?.status === 'completed'
    result.reportGenStatus = report?.reportGenerationStatus || null

    const indices = chunks.map((c) => c.index).sort((a, b) => a - b)
    const expectedIndices = Array.from({ length: chunks.length }, (_, i) => i)
    const orderingOk =
      indices.length === 0 ||
      (indices.every((v, i) => v === expectedIndices[i]) &&
        new Set(indices).size === indices.length)

    result.ok =
      job?.status === 'completed' &&
      result.transcriptionMode === 'chunked' &&
      result.transcriptProvider === 'speechmatics' &&
      !result.whisperUsed &&
      result.speechmaticsJobsSucceeded === result.plannedChunks &&
      result.failedChunks === 0 &&
      orderingOk &&
      (result.transcriptWordCount ?? 0) > 100

    await db
      .collection('briefingIntelligenceReports')
      .doc(reportId)
      .set(
        {
          smokeCertification: {
            kind: 'long_audio_prod_chunking',
            completedAt: nowIso(),
            ok: result.ok,
            doNotDeliver: true,
            metrics: {
              plannedChunks: result.plannedChunks,
              succeededChunks: result.speechmaticsJobsSucceeded,
              elapsedMs: Date.now() - started,
            },
          },
          updatedAt: nowIso(),
        },
        { merge: true }
      )

    if (job?.status === 'failed') {
      result.error = String(job.errorMessage || job.errorCode || 'job_failed').slice(0, 500)
    }

    result.elapsedMs = Date.now() - started
    console.log(JSON.stringify({ ...result, chunkStatuses, jobStatus: job?.status, bapStatus: bap?.status }, null, 2))
    process.exit(result.ok ? 0 : 2)
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    result.elapsedMs = Date.now() - started
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  } finally {
    if (buildDir) {
      try {
        rmSync(buildDir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

main()
