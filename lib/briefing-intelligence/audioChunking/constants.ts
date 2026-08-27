/** Hybrid chunking parameters — PR #70 / BRIEFING_AUDIO_CHUNKING_DESIGN.md */

export const TRANSCRIPTION_VERSION_CHUNK = 'chunk-v1'

/** Target segment length (10 minutes). */
export const TARGET_CHUNK_DURATION_MS = 10 * 60 * 1000

/** Hard ceiling per chunk (15 minutes). */
export const HARD_MAX_CHUNK_DURATION_MS = 15 * 60 * 1000

/** Target max bytes per chunk (below typical STT provider ~25 MB request limits). */
export const TARGET_MAX_CHUNK_BYTES = 20 * 1024 * 1024

/** Never exceed provider limit. */
export const HARD_MAX_CHUNK_BYTES = 24 * 1024 * 1024

/** Minimum chunk duration. */
export const MIN_CHUNK_DURATION_MS = 30 * 1000

/** Overlap between adjacent chunks (10 seconds). */
export const CHUNK_OVERLAP_MS = 10 * 1000

/** Maximum supported source duration (120 minutes). */
export const MAX_SOURCE_DURATION_MS = 120 * 60 * 1000

/** Bound cost — ~12 chunks at 10 min target. */
export const MAX_CHUNK_COUNT = 15

/** Chunks transcribed per worker invocation (fits ~240s budget within 300s timeout). */
export const CHUNKS_PER_WORKER_INVOCATION = 1

/** Stale processing lease for transcription jobs and audio processing docs. */
export const PROCESSING_LEASE_MS = 5 * 60 * 1000

/** Direct path when below both thresholds (design §4). */
export const DIRECT_MAX_BYTES = TARGET_MAX_CHUNK_BYTES
export const DIRECT_MAX_DURATION_MS = HARD_MAX_CHUNK_DURATION_MS

/** Max chunk-level transcription attempts. */
export const CHUNK_MAX_ATTEMPTS = 3
