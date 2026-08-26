import {
  DIRECT_MAX_BYTES,
  DIRECT_MAX_DURATION_MS,
  MAX_SOURCE_DURATION_MS,
} from './constants'
import type { AudioProbeResult, TranscriptionMode } from './types'

export function shouldUseChunkedTranscription(params: {
  chunkingFlagEnabled: boolean
  probe: AudioProbeResult
}): { mode: TranscriptionMode; reason: string } {
  if (!params.chunkingFlagEnabled) {
    return { mode: 'direct', reason: 'chunking_flag_off' }
  }

  const { durationMs, sizeBytes } = params.probe

  if (durationMs > MAX_SOURCE_DURATION_MS) {
    throw Object.assign(
      new Error(
        `Recording exceeds maximum supported duration of ${MAX_SOURCE_DURATION_MS / 60_000} minutes`
      ),
      { code: 'audio_too_long' }
    )
  }

  const underSize = sizeBytes < DIRECT_MAX_BYTES
  const underDuration = durationMs < DIRECT_MAX_DURATION_MS

  if (underSize && underDuration) {
    return { mode: 'direct', reason: 'under_direct_thresholds' }
  }

  return { mode: 'chunked', reason: 'exceeds_direct_thresholds' }
}
