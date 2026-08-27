/**
 * Feature flag: briefing audio transcription (async Speechmatics + transcript storage).
 * Fail-closed: unset/false disables job creation; evidence upload still succeeds.
 */
export function isBriefingAudioTranscriptionEnabled(
  raw: string | undefined | null = process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED
): boolean {
  if (raw == null) return false
  const v = String(raw).trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/**
 * Feature flag: AI meeting-minutes report generation after transcript completes.
 * Fail-closed and independent of transcription — can roll back without losing transcripts.
 */
export function isBriefingAiReportGenerationEnabled(
  raw: string | undefined | null = process.env.BRIEFING_AI_REPORT_GENERATION_ENABLED
): boolean {
  if (raw == null) return false
  const v = String(raw).trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/**
 * Feature flag: hybrid long-audio chunking (ffmpeg + sequential Speechmatics).
 * Fail-closed: requires BRIEFING_AUDIO_TRANSCRIPTION_ENABLED.
 */
export function isBriefingAudioChunkingEnabled(
  raw: string | undefined | null = process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
): boolean {
  if (!isBriefingAudioTranscriptionEnabled()) return false
  if (raw == null) return false
  const v = String(raw).trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export const BRIEFING_AUDIO_TRANSCRIPTION_FLAG_KEY = 'briefing_audio_transcription' as const
export const BRIEFING_AUDIO_CHUNKING_FLAG_KEY = 'briefing_audio_chunking' as const
export const BRIEFING_AI_REPORT_GENERATION_FLAG_KEY = 'briefing_ai_report_generation' as const

export const TRANSCRIPTION_MAX_ATTEMPTS = 3
export const REPORT_GENERATION_MAX_ATTEMPTS = 3

export function briefingReportPromptVersion(
  raw: string | undefined | null = process.env.BRIEFING_REPORT_PROMPT_VERSION
): string {
  const v = String(raw || 'v1').trim()
  return v || 'v1'
}
