/**
 * Transcript / audio quality checks before AI report generation.
 * Prefer requires_review / failed_quality_gate over polished junk drafts.
 */

import type { BriefingErrorCategory } from './pipelineTrace'

export type TranscriptQualityInput = {
  fullText: string
  durationSeconds: number | null
  audioFileSizeMb: number | null
  segmentCount?: number | null
}

export type TranscriptQualityResult =
  | { ok: true; warnings: string[] }
  | {
      ok: false
      category: BriefingErrorCategory
      reason: string
      founderMessage: string
    }

const MIN_DURATION_SECONDS = 20
const MIN_WORD_COUNT = 40
const MIN_AUDIO_MB = 0.01

const TENDER_SIGNAL =
  /\b(tender|briefing|closing|bid|bidder|compliance|specification|amendment|compulsory|submission|certificate|department|rfq|rfp|scm|cidb|bbbee|bbbeee)\b/i

export function assessTranscriptQuality(input: TranscriptQualityInput): TranscriptQualityResult {
  const text = String(input.fullText || '').trim()
  const words = text.split(/\s+/).filter(Boolean)
  const warnings: string[] = []

  if (!text || words.length < 8) {
    return {
      ok: false,
      category: 'empty_transcript',
      reason: 'empty_or_near_empty_transcript',
      founderMessage:
        'Transcription produced little or no usable text. Re-upload clearer audio or retry transcription before generating a report.',
    }
  }

  if (input.durationSeconds != null && input.durationSeconds > 0 && input.durationSeconds < MIN_DURATION_SECONDS) {
    return {
      ok: false,
      category: 'low_quality_transcript',
      reason: 'recording_too_short',
      founderMessage: `Recording duration (${Math.round(input.durationSeconds)}s) is too short for a reliable briefing report.`,
    }
  }

  if (input.audioFileSizeMb != null && input.audioFileSizeMb > 0 && input.audioFileSizeMb < MIN_AUDIO_MB) {
    return {
      ok: false,
      category: 'corrupt_audio',
      reason: 'audio_file_too_small',
      founderMessage: 'Uploaded audio file is too small to be a valid briefing recording.',
    }
  }

  if (words.length < MIN_WORD_COUNT) {
    return {
      ok: false,
      category: 'low_quality_transcript',
      reason: 'insufficient_transcript_length',
      founderMessage:
        'Transcript is too short to extract briefing intelligence. Founder review required before any draft report.',
    }
  }

  if (!TENDER_SIGNAL.test(text)) {
    return {
      ok: false,
      category: 'low_quality_transcript',
      reason: 'insufficient_tender_content',
      founderMessage:
        'Transcript does not appear to contain tender/briefing content. Possible wrong-file upload — do not auto-publish a polished report.',
    }
  }

  // Heuristic: mostly repeated filler
  const uniqueRatio = new Set(words.map((w) => w.toLowerCase())).size / words.length
  if (uniqueRatio < 0.15 && words.length > 80) {
    warnings.push('Transcript shows unusually low lexical diversity — review carefully.')
  }

  return { ok: true, warnings }
}
