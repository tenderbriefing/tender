#!/usr/bin/env node
/**
 * Controlled production smoke: Speechmatics STT via Cloud Run worker.
 * Does NOT enable chunking. Does NOT Founder-approve or deliver to SME.
 * Does NOT print transcript text or secrets.
 *
 * Usage:
 *   SPEECHMATICS_PROD_SMOKE=1 node scripts/speechmatics-prod-transcription-smoke.js
 */
const { execFileSync } = require('child_process')
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

process.chdir(join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

if (process.env.SPEECHMATICS_PROD_SMOKE !== '1') {
  console.error('Set SPEECHMATICS_PROD_SMOKE=1 to run this production smoke.')
  process.exit(1)
}

const PROD_BASE =
  process.env.PROD_BASE_URL || 'https://tenderbriefing-xzgs5uw5ta-bq.a.run.app'
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

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

function makeShortMp3() {
  const dir = mkdtempSync(join(tmpdir(), 'tb-sm-prod-'))
  const aiff = join(dir, 'short.aiff')
  const mp3 = join(dir, 'short.mp3')
  execFileSync(
    'say',
    [
      '-r',
      '180',
      '-o',
      aiff,
      'Production Speechmatics smoke. Tender closing date fifteenth March twenty twenty six.',
    ],
    { stdio: 'pipe' }
  )
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      aiff,
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k',
      mp3,
    ],
    { stdio: 'pipe' }
  )
  return { dir, mp3, buf: readFileSync(mp3) }
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
  const reportId = `TB-BR-SM${suffix}`.slice(0, 12)
  const jobId = `tj-${reportId}`
  const requestId = `smoke-sm-${Date.now()}`
  const audioPath = `briefing-intelligence/${reportId}/audio/smoke-short.mp3`
  const { dir, buf } = makeShortMp3()

  const started = Date.now()
  const result = {
    ok: false,
    reportId,
    jobId,
    provider: null,
    jobStatus: null,
    transcriptProvider: null,
    transcriptModel: null,
    wordCount: null,
    chunkingInvoked: null,
    whisperUsed: null,
    reportGenStatus: null,
    elapsedMs: null,
    error: null,
  }

  try {
    await bucket.file(audioPath).save(buf, {
      contentType: 'audio/mpeg',
      resumable: false,
      metadata: { smoke: 'speechmatics-prod', reportId },
    })

    const now = nowIso()
    await db
      .collection('briefingIntelligenceReports')
      .doc(reportId)
      .set({
        id: reportId,
        reportId,
        requestId,
        tenderId: 'smoke-tender-speechmatics',
        agentId: 'ops-smoke-agent',
        smeId: 'ops-smoke-sme',
        status: 'evidence_uploaded',
        evidenceSubmittedAt: now,
        processingStartedAt: null,
        draftReadyAt: null,
        agentReviewedAt: null,
        finalizedAt: null,
        deliveredAt: null,
        slaDeadline: null,
        slaBreached: false,
        audioFileRef: audioPath,
        audioFileName: 'smoke-short.mp3',
        audioFileSizeMb: Number((buf.length / (1024 * 1024)).toFixed(4)),
        attendanceEvidenceRefs: [],
        agentObservations: {
          arrivalTime: null,
          briefingStartTime: null,
          briefingEndTime: null,
          approxAttendees: null,
          siteInspection: null,
          docsDistributed: null,
          importantAnnouncement: null,
          shortNote: 'Speechmatics production smoke — non-customer',
        },
        transcription: null,
        reportContent: null,
        smokeCertification: {
          kind: 'speechmatics_prod_transcription',
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
        tenderId: 'smoke-tender-speechmatics',
        agentId: 'ops-smoke-agent',
        smeId: 'ops-smoke-sme',
        audioStoragePath: audioPath,
        audioMimeType: 'audio/mpeg',
        audioSizeBytes: buf.length,
        audioDurationSeconds: null,
        provider: 'speechmatics',
        providerJobId: null,
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        language: null,
        detectedLanguage: null,
        transcriptId: null,
        errorCode: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
        nextAttemptAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      })

    const workerRes = await fetch(`${PROD_BASE}/api/briefing-intelligence/transcription/worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': syncSecret,
      },
      body: JSON.stringify({ jobId, reportId }),
    })
    const workerJson = await workerRes.json().catch(() => ({}))
    if (!workerRes.ok && workerRes.status !== 202) {
      throw new Error(
        `worker HTTP ${workerRes.status}: ${String(workerJson.error || workerJson.message || '').slice(0, 300)}`
      )
    }

    // Poll job (up to ~4 min)
    let job = null
    for (let i = 0; i < 48; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const snap = await db.collection('briefingTranscriptionJobs').doc(jobId).get()
      job = snap.data()
      if (!job) continue
      if (job.status === 'completed' || job.status === 'failed') break
    }

    const reportSnap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
    const report = reportSnap.data() || {}
    const transcriptId = job?.transcriptId
    let transcript = null
    if (transcriptId) {
      const tSnap = await db.collection('briefingTranscripts').doc(transcriptId).get()
      transcript = tSnap.data() || null
    }

    const bap = await db.collection('briefingAudioProcessing').doc(`bap-${reportId}`).get()

    result.jobStatus = job?.status || null
    result.provider = job?.provider || null
    result.transcriptProvider = transcript?.provider || report?.transcription?.provider || null
    result.transcriptModel = transcript?.model || null
    result.wordCount = transcript?.wordCount ?? report?.transcription?.transcriptWordCount ?? null
    result.chunkingInvoked = bap.exists
    result.whisperUsed =
      String(result.transcriptProvider || '').includes('whisper') ||
      String(result.transcriptProvider || '') === 'openai-whisper'
    result.reportGenStatus = report?.reportGenerationStatus || report?.status || null
    result.elapsedMs = Date.now() - started
    result.ok =
      job?.status === 'completed' &&
      result.transcriptProvider === 'speechmatics' &&
      !result.whisperUsed &&
      result.chunkingInvoked === false

    await db
      .collection('briefingIntelligenceReports')
      .doc(reportId)
      .set(
        {
          smokeCertification: {
            kind: 'speechmatics_prod_transcription',
            completedAt: nowIso(),
            ok: result.ok,
            doNotDeliver: true,
          },
          updatedAt: nowIso(),
        },
        { merge: true }
      )

    if (job?.status === 'failed') {
      result.error = String(job.errorMessage || job.errorCode || 'job_failed').slice(0, 500)
    }

    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ok ? 0 : 2)
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    result.elapsedMs = Date.now() - started
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

main()
