import type { TranscriptSegment } from '../transcriptionTypes'

export type AudioProcessingStatus =
  | 'queued'
  | 'analyzing'
  | 'chunking'
  | 'transcribing'
  | 'assembling'
  | 'completed'
  | 'partial_failure'
  | 'failed'

export type ChunkStatus = 'pending' | 'transcribing' | 'completed' | 'failed'

export type TranscriptionMode = 'direct' | 'chunked'

export type AudioProbeResult = {
  durationMs: number
  sizeBytes: number
  codec: string | null
  bitrateKbps: number | null
}

export type ChunkPlanEntry = {
  index: number
  startMs: number
  endMs: number
  overlapStartMs: number | null
  estimatedSizeBytes: number
}

export type BriefingAudioProcessing = {
  id: string
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  sourceStoragePath: string
  sourceHash: string
  sourceSizeBytes: number
  sourceDurationMs: number | null
  sourceCodec: string | null
  transcriptionVersion: string
  transcriptionMode: TranscriptionMode
  status: AudioProcessingStatus
  chunkCount: number
  completedChunkCount: number
  failedChunkCount: number
  nextChunkIndex: number
  assembledTranscriptId: string | null
  chunkingEnabled: boolean
  plannerSummary: Record<string, unknown> | null
  errorCode: string | null
  errorMessage: string | null
  leaseOwner: string | null
  leaseExpiresAt: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type BriefingAudioChunk = {
  id: string
  index: number
  startMs: number
  endMs: number
  overlapStartMs: number | null
  storagePath: string | null
  audioHash: string | null
  sizeBytes: number | null
  status: ChunkStatus
  transcriptText: string | null
  segments: TranscriptSegment[] | null
  provider: string | null
  providerRequestId: string | null
  attempts: number
  errorCode: string | null
  errorMessage: string | null
  completedAt: string | null
  updatedAt: string
}

export type AssembledTranscript = {
  fullText: string
  segments: TranscriptSegment[]
  durationSeconds: number | null
  language: string | null
  provider: string
  model: string | null
  confidence: number | null
  chunkCount: number
  assemblyAudit: Record<string, unknown>
}
