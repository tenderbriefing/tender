import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isBriefingAudioTranscriptionEnabled,
  TRANSCRIPTION_MAX_ATTEMPTS,
} from '@/lib/briefing-intelligence/featureFlag'
import {
  createOrResetTranscriptionJob,
  claimTranscriptionJob,
  completeTranscriptionJob,
  failTranscriptionJob,
  transcriptionJobIdForReport,
} from '@/lib/briefing-intelligence/transcriptionJobs'
import { youthFacingStatusFromReport } from '@/lib/briefing-intelligence/transcriptionTypes'
import { saveBriefingTranscript, transcriptIdForJob } from '@/lib/briefing-intelligence/transcriptStore'

function memoryDb() {
  const store = new Map<string, any>()
  const collection = (name: string) => ({
    doc: (id: string) => {
      const key = `${name}/${id}`
      return {
        id,
        get: async () => ({
          exists: store.has(key),
          data: () => store.get(key),
        }),
        set: async (data: any, opts?: { merge?: boolean }) => {
          if (opts?.merge && store.has(key)) {
            store.set(key, { ...store.get(key), ...data })
          } else {
            store.set(key, { ...data })
          }
        },
      }
    },
  })

  return {
    store,
    collection,
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (ref: any) => ref.get(),
        set: async (ref: any, data: any, opts?: any) => ref.set(data, opts),
      }
      return fn(tx)
    },
  }
}

describe('briefing audio transcription jobs', () => {
  const prev = process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED

  afterEach(() => {
    if (prev === undefined) delete process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED
    else process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = prev
  })

  it('feature flag is fail-closed', () => {
    delete process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED
    expect(isBriefingAudioTranscriptionEnabled()).toBe(false)
    expect(isBriefingAudioTranscriptionEnabled('true')).toBe(true)
    expect(isBriefingAudioTranscriptionEnabled('0')).toBe(false)
  })

  it('creates deterministic job id and is idempotent for same audio', async () => {
    const db = memoryDb() as any
    const reportId = 'TB-BR-TEST01'
    const a = await createOrResetTranscriptionJob({
      db,
      reportId,
      requestId: 'req-1',
      tenderId: 't-1',
      agentId: 'a-1',
      smeId: 's-1',
      audioStoragePath: 'path/audio.mp3',
      audioMimeType: 'audio/mpeg',
      audioSizeBytes: 1000,
      provider: 'mock',
    })
    expect(a.id).toBe(transcriptionJobIdForReport(reportId))
    expect(a.status).toBe('queued')
    expect(a.maxAttempts).toBe(TRANSCRIPTION_MAX_ATTEMPTS)

    await completeTranscriptionJob({
      db,
      jobId: a.id,
      transcriptId: 'bt-x',
      detectedLanguage: 'en',
      audioDurationSeconds: 12,
    })

    const b = await createOrResetTranscriptionJob({
      db,
      reportId,
      requestId: 'req-1',
      tenderId: 't-1',
      agentId: 'a-1',
      smeId: 's-1',
      audioStoragePath: 'path/audio.mp3',
      audioMimeType: 'audio/mpeg',
      audioSizeBytes: 1000,
      provider: 'mock',
    })
    expect(b.status).toBe('completed')
    expect(b.transcriptId).toBe('bt-x')
  })

  it('claim is exclusive; duplicate claim returns null', async () => {
    const db = memoryDb() as any
    const job = await createOrResetTranscriptionJob({
      db,
      reportId: 'TB-BR-TEST02',
      requestId: 'req-2',
      tenderId: 't-2',
      agentId: 'a-2',
      smeId: 's-2',
      audioStoragePath: 'path/a.mp3',
      audioMimeType: null,
      audioSizeBytes: null,
      provider: 'mock',
    })
    const first = await claimTranscriptionJob(db, job.id)
    expect(first?.status).toBe('processing')
    expect(first?.attempts).toBe(1)
    const second = await claimTranscriptionJob(db, job.id)
    expect(second).toBeNull()
  })

  it('allows reclaim when processing lease is stale', async () => {
    const db = memoryDb() as any
    const job = await createOrResetTranscriptionJob({
      db,
      reportId: 'TB-BR-TEST02B',
      requestId: 'req-2b',
      tenderId: 't-2b',
      agentId: 'a-2b',
      smeId: 's-2b',
      audioStoragePath: 'path/a.mp3',
      audioMimeType: null,
      audioSizeBytes: null,
      provider: 'mock',
    })
    const first = await claimTranscriptionJob(db, job.id)
    expect(first?.status).toBe('processing')
    await db.collection('briefingTranscriptionJobs').doc(job.id).set({
      ...first,
      processingLeaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    const reclaimed = await claimTranscriptionJob(db, job.id)
    expect(reclaimed?.status).toBe('processing')
  })

  it('retries then permanently fails after max attempts', async () => {
    const db = memoryDb() as any
    const job = await createOrResetTranscriptionJob({
      db,
      reportId: 'TB-BR-TEST03',
      requestId: 'req-3',
      tenderId: 't-3',
      agentId: 'a-3',
      smeId: 's-3',
      audioStoragePath: 'path/a.mp3',
      audioMimeType: null,
      audioSizeBytes: null,
      provider: 'mock',
    })

    for (let i = 0; i < TRANSCRIPTION_MAX_ATTEMPTS; i++) {
      const claimed = await claimTranscriptionJob(db, job.id)
      expect(claimed).not.toBeNull()
      const failed = await failTranscriptionJob({
        db,
        jobId: job.id,
        errorCode: 'timeout',
        errorMessage: 'provider timeout',
        retry: true,
      })
      if (i < TRANSCRIPTION_MAX_ATTEMPTS - 1) {
        expect(failed?.status).toBe('retrying')
      } else {
        expect(failed?.status).toBe('failed')
      }
    }
  })

  it('stores transcript with timestamps, speakers, and relationships', async () => {
    const db = memoryDb() as any
    // Extend memory db with where/limit for getBriefingTranscriptForReport if needed — save only
    const jobId = transcriptionJobIdForReport('TB-BR-TEST04')
    const record = await saveBriefingTranscript({
      db,
      reportId: 'TB-BR-TEST04',
      requestId: 'req-4',
      tenderId: 't-4',
      agentId: 'a-4',
      smeId: 's-4',
      transcriptionJobId: jobId,
      sourceAudioPath: 'path/audio.mp3',
      language: 'en',
      durationSeconds: 40,
      fullText: 'Full transcript text',
      segments: [
        {
          id: 'seg-1',
          speaker: 'Speaker 1',
          startSeconds: 0,
          endSeconds: 12.4,
          text: 'Hello',
        },
      ],
      provider: 'mock-provider',
      model: 'mock',
      confidence: null,
      rawProviderResponseRef: 'briefing-intelligence/TB-BR-TEST04/transcripts/raw.json',
    })
    expect(record.id).toBe(transcriptIdForJob(jobId))
    expect(record.fullText).toBe('Full transcript text')
    expect(record.segments[0].startSeconds).toBe(0)
    expect(record.segments[0].speaker).toBe('Speaker 1')
    expect(record.requestId).toBe('req-4')
    expect(record.tenderId).toBe('t-4')
    expect(record.sourceAudioPath).toContain('audio.mp3')
  })

  it('youth-facing labels stay non-technical', () => {
    expect(
      youthFacingStatusFromReport({
        reportStatus: 'evidence_uploaded',
        transcriptionJobStatus: 'queued',
        transcriptionEnabled: true,
      })
    ).toBe('Transcribing briefing')
    expect(
      youthFacingStatusFromReport({
        reportStatus: 'processing_failed',
        transcriptionEnabled: true,
      })
    ).toMatch(/reviewing the transcription/i)
    expect(
      youthFacingStatusFromReport({
        reportStatus: 'final',
        transcriptionEnabled: true,
      })
    ).toBe('Report ready')
  })
})
