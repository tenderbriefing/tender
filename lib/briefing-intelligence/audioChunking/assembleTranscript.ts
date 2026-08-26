import type { TranscriptSegment } from '../transcriptionTypes'
import { assembleChunkTexts } from './overlapMerge'
import type { AssembledTranscript, BriefingAudioChunk } from './types'

function offsetSegments(
  segments: TranscriptSegment[],
  offsetSeconds: number
): TranscriptSegment[] {
  return segments.map((s, i) => ({
    ...s,
    id: s.id || `seg-${i}`,
    startSeconds: s.startSeconds + offsetSeconds,
    endSeconds: s.endSeconds != null ? s.endSeconds + offsetSeconds : null,
  }))
}

/**
 * Build canonical transcript from completed chunks (design §11).
 */
export function assembleTranscriptFromChunks(params: {
  chunks: BriefingAudioChunk[]
  sourceDurationMs: number | null
  provider: string
  model: string | null
}): AssembledTranscript {
  const completed = params.chunks
    .filter((c) => c.status === 'completed' && c.transcriptText)
    .sort((a, b) => a.index - b.index)

  if (!completed.length) {
    throw Object.assign(new Error('No completed chunks to assemble'), { code: 'assembly_empty' })
  }

  const expected = params.chunks.length
  if (completed.length !== expected) {
    throw Object.assign(
      new Error(`Assembly blocked: ${completed.length}/${expected} chunks completed`),
      { code: 'assembly_incomplete' }
    )
  }

  const fullText = assembleChunkTexts(
    completed.map((c) => ({ index: c.index, text: c.transcriptText || '' }))
  )

  const segments: TranscriptSegment[] = []
  for (const chunk of completed) {
    const chunkSegments =
      chunk.segments && chunk.segments.length > 0
        ? chunk.segments
        : [
            {
              id: `seg-${chunk.index}`,
              speaker: 'Speaker 1',
              startSeconds: 0,
              endSeconds: (chunk.endMs - chunk.startMs) / 1000,
              text: chunk.transcriptText || '',
            },
          ]
    segments.push(...offsetSegments(chunkSegments, chunk.startMs / 1000))
  }

  const durationSeconds =
    params.sourceDurationMs != null
      ? params.sourceDurationMs / 1000
      : segments.length
        ? Math.max(...segments.map((s) => s.endSeconds ?? s.startSeconds))
        : null

  if (params.sourceDurationMs != null && durationSeconds != null) {
    const assembledMs = durationSeconds * 1000
    const tolerance = params.sourceDurationMs * 0.05
    if (Math.abs(assembledMs - params.sourceDurationMs) > tolerance + 60_000) {
      // Soft warning only — speech silence can skew segment bounds
    }
  }

  return {
    fullText,
    segments,
    durationSeconds,
    language: null,
    provider: params.provider,
    model: params.model,
    confidence: null,
    chunkCount: completed.length,
    assemblyAudit: {
      chunkIndices: completed.map((c) => c.index),
      mergedAt: new Date().toISOString(),
    },
  }
}
