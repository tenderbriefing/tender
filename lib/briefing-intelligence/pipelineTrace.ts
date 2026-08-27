/**
 * Pipeline correlation + safe structured logging for Briefing Intelligence.
 * briefingRunId is the durable correlation id and equals reportId (TB-BR-…).
 * Never log secrets, full transcripts, prompts, reports, or evidence bytes.
 */

export type BriefingPipelineStage =
  | 'evidence_uploaded'
  | 'transcription_queued'
  | 'transcribing'
  | 'transcription_complete'
  | 'report_generating'
  | 'draft_ready'
  | 'founder_review'
  | 'approved'
  | 'failed_quality_gate'
  | 'failed'

export type BriefingErrorCategory =
  | 'auth'
  | 'validation'
  | 'storage'
  | 'missing_audio'
  | 'missing_transcript'
  | 'provider_auth'
  | 'provider_rate_limit'
  | 'provider_timeout'
  | 'provider_5xx'
  | 'corrupt_audio'
  | 'empty_transcript'
  | 'low_quality_transcript'
  | 'ai_invalid_json'
  | 'ai_schema'
  | 'quality_gate'
  | 'hallucination_guard'
  | 'pdf'
  | 'persistence'
  | 'disabled'
  | 'unknown'

export type PipelineLogFields = {
  briefingRunId: string
  reportId: string
  requestId?: string | null
  tenderId?: string | null
  jobId?: string | null
  stage: BriefingPipelineStage
  status: 'ok' | 'error' | 'skipped' | 'retry'
  provider?: string | null
  attempt?: number | null
  durationMs?: number | null
  errorCategory?: BriefingErrorCategory | null
  /** Safe, short, non-sensitive detail only */
  detail?: string | null
}

export function briefingRunIdFromReportId(reportId: string): string {
  return String(reportId || '').trim()
}

export function logBriefingPipeline(fields: PipelineLogFields): void {
  const payload = {
    briefingRunId: fields.briefingRunId,
    reportId: fields.reportId,
    requestId: fields.requestId || null,
    tenderId: fields.tenderId || null,
    jobId: fields.jobId || null,
    stage: fields.stage,
    status: fields.status,
    provider: fields.provider || null,
    attempt: fields.attempt ?? null,
    durationMs: fields.durationMs ?? null,
    errorCategory: fields.errorCategory || null,
    detail: fields.detail ? String(fields.detail).slice(0, 240) : null,
    at: new Date().toISOString(),
  }
  if (fields.status === 'error') {
    console.warn('[briefing-pipeline]', payload)
  } else {
    console.info('[briefing-pipeline]', payload)
  }
}

export function classifyProviderHttpStatus(status: number): BriefingErrorCategory {
  if (status === 401 || status === 403) return 'provider_auth'
  if (status === 429) return 'provider_rate_limit'
  if (status >= 500) return 'provider_5xx'
  if (status === 408 || status === 504) return 'provider_timeout'
  return 'unknown'
}

export function classifyErrorMessage(message: string): BriefingErrorCategory {
  const m = String(message || '').toLowerCase()
  if (!m) return 'unknown'
  // AI-minutes failures (must not be misclassified as transcription failures).
  if (
    m.includes('openai summary') ||
    m.includes('ai_provider') ||
    m.includes('ai minutes') ||
    m.includes('meeting minutes missing')
  ) {
    if (m.includes('rate limit') || m.includes('429') || m.includes('ai_provider_rate_limit')) {
      return 'provider_rate_limit'
    }
    if (m.includes('timeout') || m.includes('timed out') || m.includes('ai_provider_timeout')) {
      return 'provider_timeout'
    }
    if (m.includes('unauthorized') || m.includes('api key') || m.includes('ai_provider_auth')) {
      return 'provider_auth'
    }
    if (m.includes('invalid json') || m.includes('no content')) return 'ai_invalid_json'
    if (m.includes('schema') || m.includes('speaker labels') || m.includes('purposeofbriefing')) {
      return 'ai_schema'
    }
    if (m.includes('5xx') || /\b5\d\d\b/.test(m)) return 'provider_5xx'
    return 'unknown'
  }
  if (m.includes('openai_api_key') || m.includes('api key') || m.includes('unauthorized')) {
    return 'provider_auth'
  }
  if (m.includes('rate limit') || m.includes('429')) return 'provider_rate_limit'
  if (m.includes('timeout') || m.includes('timed out') || m.includes('aborted')) {
    return 'provider_timeout'
  }
  if (m.includes('missing audio') || m.includes('missing_audio')) return 'missing_audio'
  if (m.includes('missing transcript') || m.includes('empty transcript')) {
    return m.includes('empty') ? 'empty_transcript' : 'missing_transcript'
  }
  if (m.includes('quality') || m.includes('unintelligible') || m.includes('too short')) {
    return 'low_quality_transcript'
  }
  if (m.includes('invalid json') || m.includes('json')) return 'ai_invalid_json'
  if (m.includes('schema') || m.includes('speaker labels') || m.includes('purposeofbriefing')) {
    return 'ai_schema'
  }
  if (m.includes('hallucin') || m.includes('authoritative')) return 'hallucination_guard'
  if (m.includes('pdf')) return 'pdf'
  if (m.includes('disabled')) return 'disabled'
  if (m.includes('corrupt') || m.includes('unsupported')) return 'corrupt_audio'
  return 'unknown'
}

export type PipelineDiagnostics = {
  briefingRunId: string
  currentStage: BriefingPipelineStage
  lastSuccessfulStage: BriefingPipelineStage | null
  failureStage: BriefingPipelineStage | null
  retryEligible: boolean
  lastErrorCategory: BriefingErrorCategory | null
  attemptCount: number
  evidenceIntact: boolean
  transcriptIntact: boolean
  draftAvailable: boolean
  currentVersion: number | null
  approvedVersion: number | null
  qualityWarnings: string[]
  updatedAt: string
}
