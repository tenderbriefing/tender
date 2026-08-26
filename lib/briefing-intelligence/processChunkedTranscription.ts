import type { Firestore, DocumentReference } from 'firebase-admin/firestore'
import type { Bucket } from '@google-cloud/storage'
import type { BriefingIntelligenceReport } from './types'
import type { BriefingTranscriptionJob } from './transcriptionTypes'
import {
  completeTranscriptionJob,
} from './transcriptionJobs'
import { saveBriefingTranscript } from './transcriptStore'
import {
  handoffAfterTranscriptSaved,
  type TranscriptionMeta,
} from './transcriptionHandoff'
import { getTranscriptionProvider } from './transcriptionService'
import { CHUNK_MAX_ATTEMPTS, CHUNKS_PER_WORKER_INVOCATION } from './audioChunking/constants'
import { shouldUseChunkedTranscription } from './audioChunking/decision'
import { planAudioChunks } from './audioChunking/planner'
import { assembleTranscriptFromChunks } from './audioChunking/assembleTranscript'
import {
  audioProcessingIdForReport,
  claimAudioProcessingLease,
  createOrResetAudioProcessing,
  getAudioProcessing,
  listChunks,
  setProcessingStatus,
  updateAudioProcessing,
  updateChunk,
  writeChunkPlan,
} from './audioChunking/processingStore'
import {
  downloadGcsToTemp,
  extractAudioChunk,
  probeAudioFile,
  sha256Buffer,
  withTempDir,
} from './audioChunking/ffmpegMedia'
import { isBriefingAudioChunkingEnabled } from './featureFlag'
import type { ProcessReportResult } from './processReport'

function nowIso() {
  return new Date().toISOString()
}

function computeWordCount(text: string): number | null {
  const t = String(text || '').trim()
  if (!t) return null
  return t.split(/\s+/).filter(Boolean).length
}

export type ChunkedProcessResult = ProcessReportResult & {
  needsContinuation?: boolean
}

/**
 * Chunked transcription with sequential worker continuation (design §7).
 */
export async function processChunkedTranscription(params: {
  db: Firestore
  bucket: Bucket
  docRef: DocumentReference
  report: BriefingIntelligenceReport
  reportId: string
  job: BriefingTranscriptionJob
  jobId: string
  actorUid: string
  actorRole: 'admin' | 'system'
  nextAttempts: number
  sourceSizeBytes: number
  leaseOwner: string
}): Promise<ChunkedProcessResult> {
  const {
    db,
    bucket,
    docRef,
    report,
    reportId,
    job,
    jobId,
    actorUid,
    actorRole,
    nextAttempts,
    sourceSizeBytes,
    leaseOwner,
  } = params

  const processingId = audioProcessingIdForReport(reportId)
  const chunkingEnabled = isBriefingAudioChunkingEnabled()

  console.info('[transcription] long-audio chunked path', {
    reportId,
    requestId: report.requestId,
    transcriptionJobId: jobId,
  })

  return withTempDir('bap-', async (tempDir) => {
    const localSource = await downloadGcsToTemp({
      bucket,
      storagePath: report.audioFileRef!,
      tempDir,
      fileName: 'source-audio',
    })

    const sourceBuf = await import('fs/promises').then((fs) => fs.readFile(localSource))
    const sourceHash = sha256Buffer(sourceBuf)
    const probe = await probeAudioFile(localSource, sourceSizeBytes)

    const decision = shouldUseChunkedTranscription({ chunkingFlagEnabled: true, probe })
    const plan = planAudioChunks(probe)

    let processing = await getAudioProcessing(db, processingId)
    if (!processing || processing.sourceHash !== sourceHash) {
      processing = await createOrResetAudioProcessing({
        db,
        reportId,
        requestId: report.requestId,
        tenderId: report.tenderId,
        agentId: report.agentId,
        smeId: report.smeId,
        sourceStoragePath: report.audioFileRef!,
        sourceHash,
        sourceSizeBytes,
        sourceDurationMs: probe.durationMs,
        sourceCodec: probe.codec,
        transcriptionMode: 'chunked',
        chunkingEnabled,
        plannerSummary: {
          segmentCount: plan.length,
          probeDurationMs: probe.durationMs,
          probeSizeBytes: probe.sizeBytes,
          decisionReason: decision.reason,
        },
        chunkCount: plan.length,
      })
      await writeChunkPlan(db, processingId, reportId, plan)
      console.info('[transcription] chunking started', {
        reportId,
        chunkCount: plan.length,
      })
    }

    if (processing.status === 'completed' && processing.assembledTranscriptId) {
      return { ok: true, reportId, skipped: true, transcriptId: processing.assembledTranscriptId }
    }

    const leased = await claimAudioProcessingLease(db, processingId, leaseOwner)
    if (!leased) {
      return { ok: true, reportId, skipped: true, needsContinuation: true }
    }

    await setProcessingStatus(db, processingId, 'chunking')

    let chunks = await listChunks(db, processingId)
    const pendingExtract = chunks.filter((c) => !c.storagePath)
    if (pendingExtract.length > 0) {
      for (const chunk of pendingExtract) {
        const outPath = `${tempDir}/chunk-${chunk.index}.mp3`
        const extracted = await extractAudioChunk({
          sourcePath: localSource,
          outputPath: outPath,
          startMs: chunk.startMs,
          endMs: chunk.endMs,
        })
        const gcsPath = `briefing-intelligence/${reportId}/audio-chunks/${processingId}/${chunk.index}.mp3`
        const chunkBuf = await import('fs/promises').then((fs) => fs.readFile(outPath))
        await bucket.file(gcsPath).save(chunkBuf, {
          contentType: 'audio/mpeg',
          metadata: { reportId, chunkIndex: String(chunk.index) },
          resumable: false,
        })
        await updateChunk(db, processingId, chunk.id, {
          storagePath: gcsPath,
          audioHash: extracted.hash,
          sizeBytes: extracted.sizeBytes,
        })
      }
      chunks = await listChunks(db, processingId)
    }

    await setProcessingStatus(db, processingId, 'transcribing')

    const provider = getTranscriptionProvider()
    let processedThisRun = 0
    let nextIndex = leased.nextChunkIndex

    while (processedThisRun < CHUNKS_PER_WORKER_INVOCATION && nextIndex < chunks.length) {
      const chunk = chunks.find((c) => c.index === nextIndex)
      if (!chunk) break

      if (chunk.status === 'completed') {
        nextIndex += 1
        continue
      }

      if (chunk.status === 'failed' && chunk.attempts >= CHUNK_MAX_ATTEMPTS) {
        await setProcessingStatus(db, processingId, 'partial_failure', {
          failedChunkCount: (leased.failedChunkCount || 0) + 1,
          errorCode: chunk.errorCode,
          errorMessage: chunk.errorMessage,
        })
        throw Object.assign(new Error(chunk.errorMessage || 'Chunk transcription failed'), {
          code: 'chunk_failed',
        })
      }

      if (!chunk.storagePath) {
        throw Object.assign(new Error('Chunk audio not prepared'), { code: 'chunk_missing' })
      }

      try {
        await updateChunk(db, processingId, chunk.id, {
          status: 'transcribing',
          attempts: chunk.attempts + 1,
        })

        console.info('[transcription] chunk transcribe started', {
          reportId,
          chunkIndex: chunk.index,
        })

        const [audioUrl] = await bucket.file(chunk.storagePath).getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000,
        })

        const transcription = await provider.transcribe(audioUrl)
        const segments =
          Array.isArray(transcription.segments) && transcription.segments.length > 0
            ? transcription.segments
            : [
                {
                  id: `seg-${chunk.index}`,
                  speaker: 'Speaker 1',
                  startSeconds: 0,
                  endSeconds: transcription.durationSeconds ?? null,
                  text: transcription.transcriptText,
                },
              ]

        const chunkRawPath = `briefing-intelligence/${reportId}/transcripts/chunks/${chunk.index}-raw.json`
        await bucket.file(chunkRawPath).save(
          Buffer.from(
            JSON.stringify({
              text: transcription.transcriptText,
              segments,
              chunkIndex: chunk.index,
            })
          ),
          { contentType: 'application/json', resumable: false }
        )

        await updateChunk(db, processingId, chunk.id, {
          status: 'completed',
          transcriptText: transcription.transcriptText,
          segments,
          provider: transcription.provider,
          providerRequestId: null,
          completedAt: nowIso(),
          errorCode: null,
          errorMessage: null,
        })

        console.info('[transcription] chunk transcribe completed', {
          reportId,
          chunkIndex: chunk.index,
        })

        leased.completedChunkCount = (leased.completedChunkCount || 0) + 1
        await updateAudioProcessing(db, processingId, {
          completedChunkCount: leased.completedChunkCount,
          nextChunkIndex: nextIndex + 1,
        })

        processedThisRun += 1
        nextIndex += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const canRetry = chunk.attempts + 1 < CHUNK_MAX_ATTEMPTS
        await updateChunk(db, processingId, chunk.id, {
          status: canRetry ? 'pending' : 'failed',
          errorCode: 'chunk_transcribe_failed',
          errorMessage: message.slice(0, 2000),
        })
        if (!canRetry) {
          await setProcessingStatus(db, processingId, 'partial_failure')
        }
        throw Object.assign(new Error(message), {
          code: canRetry ? 'chunk_retry' : 'chunk_failed',
          retryable: canRetry,
        })
      }
    }

    chunks = await listChunks(db, processingId)
    const completedCount = chunks.filter((c) => c.status === 'completed').length

    if (completedCount < chunks.length) {
      await updateAudioProcessing(db, processingId, {
        nextChunkIndex: nextIndex,
        status: 'transcribing',
      })
      console.info('[transcription] chunked continuation required', {
        reportId,
        completedCount,
        chunkCount: chunks.length,
        nextChunkIndex: nextIndex,
      })
      return {
        ok: true,
        reportId,
        needsContinuation: true,
      }
    }

    await setProcessingStatus(db, processingId, 'assembling')
    console.info('[transcription] reconstruction started', { reportId, chunkCount: chunks.length })

    const assembled = assembleTranscriptFromChunks({
      chunks,
      sourceDurationMs: probe.durationMs,
      provider: 'openai-whisper-chunked',
      model: null,
    })

    const assembledPath = `briefing-intelligence/${reportId}/transcripts/assembled-${Date.now()}.json`
    await bucket.file(assembledPath).save(
      Buffer.from(
        JSON.stringify({
          fullText: assembled.fullText,
          segments: assembled.segments,
          chunkCount: assembled.chunkCount,
          assemblyAudit: assembled.assemblyAudit,
        })
      ),
      { contentType: 'application/json', resumable: false }
    )

    const transcriptRecord = await saveBriefingTranscript({
      db,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      agentId: report.agentId,
      smeId: report.smeId,
      transcriptionJobId: jobId,
      sourceAudioPath: report.audioFileRef!,
      language: assembled.language,
      durationSeconds: assembled.durationSeconds,
      fullText: assembled.fullText,
      segments: assembled.segments,
      provider: assembled.provider,
      model: assembled.model,
      confidence: assembled.confidence,
      rawProviderResponseRef: assembledPath,
    })

    await completeTranscriptionJob({
      db,
      jobId,
      transcriptId: transcriptRecord.id,
      detectedLanguage: assembled.language,
      audioDurationSeconds: assembled.durationSeconds,
    })

    const transcriptionMeta: TranscriptionMeta = {
      provider: assembled.provider,
      rawTranscriptRef: assembledPath,
      transcriptWordCount: computeWordCount(assembled.fullText),
      language: assembled.language,
      confidence: assembled.confidence,
      completedAt: nowIso(),
      transcriptId: transcriptRecord.id,
      segmentCount: assembled.segments.length,
      durationSeconds: assembled.durationSeconds,
      transcriptionMode: 'chunked',
      chunkCount: assembled.chunkCount,
    }

    await docRef.set(
      {
        pipelineDiagnostics: {
          currentStage: 'transcription_complete',
          assembly: assembled.assemblyAudit,
          transcriptionMode: 'chunked',
          chunkCount: assembled.chunkCount,
          updatedAt: nowIso(),
        },
      },
      { merge: true }
    )

    await setProcessingStatus(db, processingId, 'completed', {
      assembledTranscriptId: transcriptRecord.id,
      completedAt: nowIso(),
      completedChunkCount: chunks.length,
    })

    console.info('[transcription] final transcript completed', {
      reportId,
      transcriptId: transcriptRecord.id,
      chunkCount: assembled.chunkCount,
    })

    await handoffAfterTranscriptSaved({
      db,
      docRef,
      report,
      reportId,
      jobId,
      actorUid,
      actorRole,
      nextAttempts,
      transcriptRecord,
      transcriptionMeta,
      fullText: assembled.fullText,
      segments: assembled.segments,
      durationSeconds: assembled.durationSeconds,
      provider: assembled.provider,
      model: assembled.model,
    })

    return { ok: true, reportId, transcriptId: transcriptRecord.id }
  })
}
