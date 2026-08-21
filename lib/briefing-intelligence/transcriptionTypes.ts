import type { ReportStatus } from './types'

/** Timestamped, speaker-neutral transcript segment (no fabricated names). */
export type TranscriptSegment = {
  id: string
  speaker: string
  startSeconds: number
  endSeconds: number | null
  text: string
}

export type TranscriptionJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'

export type BriefingTranscriptionJob = {
  id: string
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  audioStoragePath: string
  audioMimeType: string | null
  audioSizeBytes: number | null
  audioDurationSeconds: number | null
  provider: string
  providerJobId: string | null
  status: TranscriptionJobStatus
  attempts: number
  maxAttempts: number
  language: string | null
  detectedLanguage: string | null
  transcriptId: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  processingStartedAt: string | null
  completedAt: string | null
  updatedAt: string
  nextAttemptAt: string | null
}

export type BriefingTranscriptRecord = {
  id: string
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  transcriptionJobId: string
  sourceAudioPath: string
  language: string | null
  durationSeconds: number | null
  fullText: string
  segments: TranscriptSegment[]
  provider: string
  model: string | null
  confidence: number | null
  status: 'draft' | 'final'
  rawProviderResponseRef: string | null
  createdAt: string
  updatedAt: string
}

/** Simple Youth Agent–facing pipeline labels (no technical jargon). */
export type YouthFacingPipelineStatus =
  | 'Upload complete'
  | 'Transcribing briefing'
  | 'Preparing report'
  | 'Report ready'
  | 'Recording received. Our team is reviewing the transcription.'

export function youthFacingStatusFromReport(params: {
  reportStatus: ReportStatus
  transcriptionJobStatus?: TranscriptionJobStatus | null
  transcriptionEnabled: boolean
}): YouthFacingPipelineStatus {
  const { reportStatus, transcriptionJobStatus, transcriptionEnabled } = params

  if (reportStatus === 'final' || reportStatus === 'delivered') return 'Report ready'
  if (reportStatus === 'draft_report' || reportStatus === 'agent_review') return 'Preparing report'
  if (reportStatus === 'processing_failed') {
    return 'Recording received. Our team is reviewing the transcription.'
  }
  if (reportStatus === 'processing' || transcriptionJobStatus === 'processing') {
    return 'Transcribing briefing'
  }
  if (
    transcriptionEnabled &&
    (transcriptionJobStatus === 'queued' || transcriptionJobStatus === 'retrying')
  ) {
    return 'Transcribing briefing'
  }
  if (reportStatus === 'evidence_uploaded') return 'Upload complete'
  return 'Upload complete'
}
