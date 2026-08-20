import type { BriefingReportContent } from './types'
import { FormData } from 'undici'

// Note: The task requirement defines the provider abstraction inline.
// We implement it here with strong runtime validation and explicit "no inventing" logic.

export interface TenderContext {
  reportId: string
  tenderTitle: string
  tenderReference: string
  issuingEntity: string
  briefingDate: string
  briefingVenue: string

  description: string | null
  closingDate: string | null
  estimatedValue: string | null
  category: string | null
  province: string | null
}

export interface TranscriptionResult {
  provider: string
  transcriptText: string
  transcriptWordCount: number | null
  language: string | null
  confidence: number | null
  completedAt: string
}

export interface TranscriptionProvider {
  transcribe(audioUrl: string): Promise<TranscriptionResult>
  extractIntelligence(
    transcript: string,
    tenderContext: TenderContext
  ): Promise<BriefingReportContent>
}

function nowIso() {
  return new Date().toISOString()
}

function countWords(text: string): number | null {
  const t = String(text || '').trim()
  if (!t) return null
  return t.split(/\s+/).filter(Boolean).length
}

function getOpenAIApiKey(): string {
  const fromEnv = (process.env.OPENAI_API_KEY || '').trim()
  if (fromEnv) return fromEnv
  // Keep this as a fallback only; the task requirement explicitly calls out OPENAI_API_KEY.
  // If secret manager fails, we throw a clear error.
  return ''
}

function isAllowedSeverity(value: unknown): value is 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'medium' || value === 'low'
}

function isAllowedSource(value: unknown): value is 'stated' | 'inferred' | 'not_discussed' {
  return value === 'stated' || value === 'inferred' || value === 'not_discussed'
}

function isAllowedRequirementSource(value: unknown): value is 'stated' | 'inferred' {
  return value === 'stated' || value === 'inferred'
}

function validateBriefingReportContent(data: unknown): data is BriefingReportContent {
  const obj = data as any
  if (!obj || typeof obj !== 'object') return false

  // coverHeader
  const cover = obj.coverHeader
  if (!cover || typeof cover !== 'object') return false
  if (!['string'].includes(typeof cover.reportId) && typeof cover.reportId !== 'string') return false
  const coverKeys: Array<keyof BriefingReportContent['coverHeader']> = [
    'reportId',
    'tenderTitle',
    'tenderReference',
    'issuingEntity',
    'briefingDate',
    'briefingVenue',
    // reportDate is required by the interface
    'reportDate',
  ]
  for (const k of coverKeys) {
    if (typeof (cover as any)[k] !== 'string') return false
  }

  // tenderDetails
  const details = obj.tenderDetails
  if (!details || typeof details !== 'object') return false
  const detailKeys: Array<keyof BriefingReportContent['tenderDetails']> = [
    'description',
    'closingDate',
    'estimatedValue',
    'category',
    'province',
  ]
  for (const k of detailKeys) {
    const v = (details as any)[k]
    if (v !== null && typeof v !== 'string') return false
  }

  // executiveSummary
  const exec = obj.executiveSummary
  if (!exec || typeof exec !== 'object') return false
  if (typeof exec.summary !== 'string') return false
  if (typeof exec.keyTakeaway !== 'string') return false

  // arrays
  const keyRequirements = obj.keyRequirements
  if (!Array.isArray(keyRequirements)) return false
  for (const item of keyRequirements) {
    if (!item || typeof item !== 'object') return false
    if (typeof item.requirement !== 'string') return false
    if (!isAllowedRequirementSource(item.source)) return false
  }

  const clarifications = obj.clarifications
  if (!Array.isArray(clarifications)) return false
  for (const item of clarifications) {
    if (!item || typeof item !== 'object') return false
    if (typeof item.question !== 'string') return false
    if (typeof item.answer !== 'string') return false
    if (!isAllowedSource(item.source)) return false
  }

  const qas = obj.questionsAndAnswers
  if (!Array.isArray(qas)) return false
  for (const item of qas) {
    if (!item || typeof item !== 'object') return false
    if (typeof item.question !== 'string') return false
    if (typeof item.answer !== 'string') return false
    if (item.askedBy !== null && typeof item.askedBy !== 'string') return false
  }

  const changes = obj.changesAndAddenda
  if (!Array.isArray(changes)) return false
  for (const item of changes) {
    if (!item || typeof item !== 'object') return false
    if (typeof item.change !== 'string') return false
    if (item.impact !== null && typeof item.impact !== 'string') return false
  }

  const risks = obj.complianceRisks
  if (!Array.isArray(risks)) return false
  for (const item of risks) {
    if (!item || typeof item !== 'object') return false
    if (typeof item.risk !== 'string') return false
    if (!isAllowedSeverity(item.severity)) return false
    if (item.mitigation !== null && typeof item.mitigation !== 'string') return false
  }

  const dates = obj.keyDates
  if (!Array.isArray(dates)) return false
  for (const item of dates) {
    if (!item || typeof item !== 'object') return false
    if (typeof item.date !== 'string') return false
    if (typeof item.description !== 'string') return false
  }

  const actions = obj.recommendedActions
  if (!Array.isArray(actions)) return false
  for (const item of actions) {
    if (!item || typeof item !== 'object') return false
    if (typeof item.action !== 'string') return false
    if (!['high', 'medium', 'low'].includes(item.priority)) return false
    if (item.deadline !== null && typeof item.deadline !== 'string') return false
  }

  // attendanceInfo
  const att = obj.attendanceInfo
  if (!att || typeof att !== 'object') return false
  if (att.estimatedAttendees !== null && typeof att.estimatedAttendees !== 'number') return false
  if (att.agentArrivalTime !== null && typeof att.agentArrivalTime !== 'string') return false
  if (att.briefingDuration !== null && typeof att.briefingDuration !== 'string') return false

  // attendanceVerification
  const ver = obj.attendanceVerification
  if (!ver || typeof ver !== 'object') return false
  if (typeof ver.verified !== 'boolean') return false
  if (typeof ver.method !== 'string') return false
  if (ver.notes !== null && typeof ver.notes !== 'string') return false
  if (ver.redactedAttendeeCount !== null && typeof ver.redactedAttendeeCount !== 'number') return false

  // agentFieldObservations
  const obs = obj.agentFieldObservations
  if (!obs || typeof obs !== 'object') return false
  if (obs.siteInspection !== null && typeof obs.siteInspection !== 'boolean') return false
  if (obs.docsDistributed !== null && typeof obs.docsDistributed !== 'boolean') return false
  if (obs.importantAnnouncement !== null && typeof obs.importantAnnouncement !== 'boolean') return false
  if (obs.generalNotes !== null && typeof obs.generalNotes !== 'string') return false

  // sourceAndVerification
  const sourceVer = obj.sourceAndVerification
  if (!sourceVer || typeof sourceVer !== 'object') return false
  if (typeof sourceVer.audioRecorded !== 'boolean') return false
  if (sourceVer.transcriptionProvider !== null && typeof sourceVer.transcriptionProvider !== 'string') return false
  if (sourceVer.aiModel !== null && typeof sourceVer.aiModel !== 'string') return false
  if (sourceVer.processingDate !== null && typeof sourceVer.processingDate !== 'string') return false
  if (sourceVer.confidenceScore !== null && typeof sourceVer.confidenceScore !== 'number') return false

  // importantNotice
  if (typeof obj.importantNotice !== 'string') return false

  // reportCertification
  const cert = obj.reportCertification
  if (!cert || typeof cert !== 'object') return false
  if (typeof cert.certifiedBy !== 'string') return false
  if (typeof cert.certificationDate !== 'string') return false
  if (typeof cert.reportVersion !== 'string') return false

  return true
}

function extractJson(text: string): unknown {
  const str = String(text || '').trim()
  if (!str) return null

  // Prefer direct JSON.
  try {
    return JSON.parse(str)
  } catch {
    /* continue */
  }

  // Handle fenced blocks.
  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (match?.[1]) {
    const inner = match[1].trim()
    return JSON.parse(inner)
  }

  // Best-effort: extract the first {...} block.
  const start = str.indexOf('{')
  const end = str.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const jsonCandidate = str.slice(start, end + 1)
    return JSON.parse(jsonCandidate)
  }

  return null
}

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  private apiKey: string
  private baseUrl = 'https://api.openai.com/v1'
  private modelTranscribe: string
  private modelExtract: string

  constructor(opts?: { apiKey?: string }) {
    const apiKey = opts?.apiKey?.trim() || getOpenAIApiKey().trim()
    if (!apiKey) {
      // Try secret manager only as a last resort.
      // Since this is sync, we just throw with a clear message.
      // (Routes should surface 500 with lastError.)
      throw new Error('OPENAI_API_KEY is required for briefing intelligence extraction')
    }
    this.apiKey = apiKey
    this.modelTranscribe = process.env.BRIEFING_INTELLIGENCE_TRANSCRIBE_MODEL || 'whisper-1'
    this.modelExtract = process.env.BRIEFING_INTELLIGENCE_EXTRACT_MODEL || 'gpt-4o'
  }

  private async makeJsonRequest(endpoint: string, payload: unknown): Promise<any> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI request failed: ${res.status} ${text}`.slice(0, 2000))
    }

    return res.json()
  }

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio for transcription: ${audioRes.status}`)
    }

    const contentType =
      audioRes.headers.get('content-type') || 'application/octet-stream'
    const arrayBuffer = await audioRes.arrayBuffer()
    const blob = new Blob([arrayBuffer as any], { type: contentType })

    const fd = new FormData()
    fd.append('model', this.modelTranscribe)
    // OpenAI expects `file` to be a form file. undici Blob works in Node fetch.
    fd.append('file', blob, 'audio')
    fd.append('response_format', 'json')

    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: fd as any,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI transcription failed: ${res.status} ${text}`.slice(0, 2000))
    }

    const data: any = await res.json()
    const transcriptText = String(data?.text || '').trim()

    if (!transcriptText) {
      throw new Error('Transcription returned empty text')
    }

    return {
      provider: 'openai-whisper',
      transcriptText,
      transcriptWordCount: countWords(transcriptText),
      language: typeof data?.language === 'string' ? data.language : null,
      confidence: null, // Whisper does not reliably provide confidence.
      completedAt: nowIso(),
    }
  }

  async extractIntelligence(
    transcript: string,
    tenderContext: TenderContext
  ): Promise<BriefingReportContent> {
    const systemPrompt = [
      'You are an expert intelligence extractor for TenderBriefing Intelligence Reports in South Africa.',
      'You MUST NOT invent any facts.',
      'You MUST only use information present in the transcript and the provided tender context.',
      'If something is not explicitly stated in the transcript, use the provided schema\'s "not_discussed" or null/empty arrays as appropriate.',
      'Return STRICT JSON only. No prose.',
    ].join(' ')

    // The tender context is trusted (from the system); transcript content is not.
    const userPrompt = {
      tenderContext,
      transcript,
      schema: {
        // We include the minimal shape to guide the model.
        // (Runtime schema validation will enforce exact keys/types.)
        coverHeader: {
          reportId: 'TB-BR-XXXXXX',
          tenderTitle: 'string',
          tenderReference: 'string',
          issuingEntity: 'string',
          briefingDate: 'string',
          briefingVenue: 'string',
          reportDate: 'string',
        },
        tenderDetails: {
          description: 'string | null',
          closingDate: 'string | null',
          estimatedValue: 'string | null',
          category: 'string | null',
          province: 'string | null',
        },
        executiveSummary: { summary: 'string', keyTakeaway: 'string' },
        keyRequirements: [{ requirement: 'string', source: 'stated | inferred' }],
        clarifications: [
          { question: 'string', answer: 'string', source: 'stated | inferred | not_discussed' },
        ],
        questionsAndAnswers: [{ question: 'string', answer: 'string', askedBy: 'string | null' }],
        changesAndAddenda: [{ change: 'string', impact: 'string | null' }],
        complianceRisks: [{ risk: 'string', severity: 'high | medium | low', mitigation: 'string | null' }],
        keyDates: [{ date: 'string', description: 'string' }],
        recommendedActions: [{ action: 'string', priority: 'high | medium | low', deadline: 'string | null' }],
        attendanceInfo: { estimatedAttendees: 'number | null', agentArrivalTime: 'string | null', briefingDuration: 'string | null' },
        attendanceVerification: { verified: 'boolean', method: 'string', notes: 'string | null', redactedAttendeeCount: 'number | null' },
        agentFieldObservations: { siteInspection: 'boolean | null', docsDistributed: 'boolean | null', importantAnnouncement: 'boolean | null', generalNotes: 'string | null' },
        sourceAndVerification: { audioRecorded: 'boolean', transcriptionProvider: 'string | null', aiModel: 'string | null', processingDate: 'string | null', confidenceScore: 'number | null' },
        importantNotice: 'string',
        reportCertification: { certifiedBy: 'string', certificationDate: 'string', reportVersion: 'string' },
      },
    }

    const data = await this.makeJsonRequest('/chat/completions', {
      model: this.modelExtract,
      temperature: 0.2,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPrompt) },
      ],
    })

    const content = data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      throw new Error('OpenAI extraction returned no content')
    }

    const parsed = extractJson(content)
    if (!parsed) {
      throw new Error('OpenAI extraction returned invalid JSON')
    }

    if (!validateBriefingReportContent(parsed)) {
      throw new Error('OpenAI extraction failed schema validation')
    }

    return parsed
  }
}

export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    // Clearly marked mock transcript.
    // For certain test fixtures we embed deterministic statements so extraction
    // can be asserted without calling external AI providers.
    const audio = String(audioUrl || '').toLowerCase()
    if (audio.includes('closingdate-extended-12-19')) {
      return {
        provider: 'mock-provider',
        transcriptText: [
          'OFFICIAL: The closing date has been extended from 12 September 2026 to 19 September 2026.',
          'OFFICIAL: Submission requirements remain aligned with the published tender, subject to verifying the formal written addendum.',
          'BIDDER: Can you confirm the final closing date for submissions?',
          'OFFICIAL: Yes. Submissions close on 19 September 2026.',
        ].join('\n'),
        transcriptWordCount: null,
        language: null,
        confidence: null,
        completedAt: nowIso(),
      }
    }

    return {
      provider: 'mock-provider',
      transcriptText: `MOCK_TRANSCRIPT: transcription not executed for ${audioUrl}`,
      transcriptWordCount: null,
      language: null,
      confidence: null,
      completedAt: nowIso(),
    }
  }

  async extractIntelligence(
    transcript: string,
    tenderContext: TenderContext
  ): Promise<BriefingReportContent> {
    const processingDate = nowIso()

    // Deterministic, test-only extraction based on fixture transcript markers.
    // In production, the mock provider should only be used in test/dev environments.
    const t = String(transcript || '')
    const closingMatch = t.match(
      /extended\s+from\s+(\d{1,2}\s+[a-zA-Z]+\s+\d{4})\s+to\s+(\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i
    )

    const changesAndAddenda: BriefingReportContent['changesAndAddenda'] = []
    const keyDates: BriefingReportContent['keyDates'] = []
    const questionsAndAnswers: BriefingReportContent['questionsAndAnswers'] = []

    if (closingMatch) {
      const original = closingMatch[1]
      const revised = closingMatch[2]

      changesAndAddenda.push({
        change: `Closing date extended from ${original} to ${revised}`,
        impact:
          'Plan the SME submission against the revised closing date, but confirm any formal written addendum issued by the procuring entity before submission.',
      })

      keyDates.push({
        date: revised,
        description: `Closing date extended to ${revised} (announcement at briefing).`,
      })

      questionsAndAnswers.push({
        question: 'Can you confirm the final closing date for submissions?',
        answer: `Submissions close on ${revised}.`,
        askedBy: 'Bidder',
      })
    }

    return {
      coverHeader: {
        reportId: tenderContext.reportId,
        tenderTitle: tenderContext.tenderTitle,
        tenderReference: tenderContext.tenderReference,
        issuingEntity: tenderContext.issuingEntity,
        briefingDate: tenderContext.briefingDate,
        briefingVenue: tenderContext.briefingVenue,
        reportDate: processingDate,
      },
      tenderDetails: {
        description: tenderContext.description,
        closingDate: tenderContext.closingDate,
        estimatedValue: tenderContext.estimatedValue,
        category: tenderContext.category,
        province: tenderContext.province,
      },
      executiveSummary: {
        summary: 'MOCK DRAFT: Intelligence extraction disabled (mock provider).',
        keyTakeaway: 'Replace this draft with real extraction once OpenAI is enabled.',
      },
      keyRequirements: [],
      clarifications: [],
      questionsAndAnswers,
      changesAndAddenda,
      complianceRisks: [],
      keyDates,
      recommendedActions: [],
      attendanceInfo: {
        estimatedAttendees: null,
        agentArrivalTime: null,
        briefingDuration: null,
      },
      attendanceVerification: {
        verified: false,
        method: 'mock',
        notes: 'MOCK DRAFT — not derived from a real transcript.',
        redactedAttendeeCount: null,
      },
      agentFieldObservations: {
        siteInspection: null,
        docsDistributed: null,
        importantAnnouncement: null,
        generalNotes: null,
      },
      sourceAndVerification: {
        audioRecorded: false,
        transcriptionProvider: 'mock-provider',
        aiModel: null,
        processingDate,
        confidenceScore: null,
      },
      importantNotice:
        'Standard disclaimer: This is a system-generated draft. Always verify facts against the official tender documents.',
      reportCertification: {
        certifiedBy: 'TenderBriefing Intelligence System (mock)',
        certificationDate: processingDate,
        reportVersion: 'mock-1.0',
      },
    }
  }
}

export function getTranscriptionProvider(): TranscriptionProvider {
  const mode = String(process.env.BRIEFING_INTELLIGENCE_PROVIDER || 'openai').toLowerCase()
  if (mode === 'mock') return new MockTranscriptionProvider()
  // Default to OpenAI.
  return new OpenAITranscriptionProvider()
}

