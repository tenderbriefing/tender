import {
  CHUNK_OVERLAP_MS,
  HARD_MAX_CHUNK_BYTES,
  HARD_MAX_CHUNK_DURATION_MS,
  MAX_CHUNK_COUNT,
  MIN_CHUNK_DURATION_MS,
  TARGET_CHUNK_DURATION_MS,
  TARGET_MAX_CHUNK_BYTES,
} from './constants'
import type { AudioProbeResult, ChunkPlanEntry } from './types'

function bytesPerMs(probe: AudioProbeResult): number {
  if (probe.durationMs <= 0) return probe.sizeBytes / TARGET_CHUNK_DURATION_MS
  return probe.sizeBytes / probe.durationMs
}

/**
 * Hybrid time-and-size chunk planner (design §4).
 */
export function planAudioChunks(probe: AudioProbeResult): ChunkPlanEntry[] {
  const { durationMs, sizeBytes } = probe
  if (durationMs <= 0) {
    throw Object.assign(new Error('Unable to determine audio duration'), { code: 'invalid_audio' })
  }

  const bpm = bytesPerMs(probe)
  const durationFromTargetBytes = Math.floor(TARGET_MAX_CHUNK_BYTES / Math.max(bpm, 1))
  let segmentMs = Math.min(TARGET_CHUNK_DURATION_MS, durationFromTargetBytes)
  segmentMs = Math.max(MIN_CHUNK_DURATION_MS, Math.min(segmentMs, HARD_MAX_CHUNK_DURATION_MS))

  const entries: ChunkPlanEntry[] = []
  let cursor = 0
  let index = 0

  while (cursor < durationMs) {
    const endMs = Math.min(durationMs, cursor + segmentMs)
    const overlapStartMs = index > 0 ? Math.max(0, cursor - CHUNK_OVERLAP_MS) : null
    const spanMs = endMs - (overlapStartMs ?? cursor)
    entries.push({
      index,
      startMs: overlapStartMs ?? cursor,
      endMs,
      overlapStartMs,
      estimatedSizeBytes: Math.ceil(spanMs * bpm),
    })
    cursor = endMs
    index += 1
    if (entries.length > MAX_CHUNK_COUNT) {
      throw Object.assign(new Error(`Chunk count exceeds maximum of ${MAX_CHUNK_COUNT}`), {
        code: 'too_many_chunks',
      })
    }
    if (endMs >= durationMs) break
  }

  for (const e of entries) {
    if (e.estimatedSizeBytes > HARD_MAX_CHUNK_BYTES) {
      throw Object.assign(new Error('Planned chunk exceeds hard size limit'), {
        code: 'chunk_plan_oversize',
      })
    }
  }

  return entries
}
