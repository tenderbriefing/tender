import {
  briefingReportPromptVersion,
} from './featureFlag'
import type {
  BriefingSummary,
  ProvenanceRef,
  StructuredMeetingMinutesReport,
} from './meetingMinutesTypes'
import { stripSpeakerLabels } from './meetingMinutesTypes'
import {
  attachV2SectionsIfEnabled,
  BRIEFING_INTELLIGENCE_V2_OUTPUT_SCHEMA,
  BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION,
  briefingIntelligenceV2SystemGuidance,
} from './briefingIntelligenceV2'
import { isBriefingIntelligenceV2Enabled } from '@/lib/privateTenders/briefingOpsFlags'

export type BriefingSummaryInput = {
  reportId: string
  transcriptText: string
  transcriptSegments: Array<{
    id: string
    startSeconds: number
    endSeconds: number | null
    text: string
  }>
  tenderDocumentText: string
  /** Whether full tender PDF text was available for comparison */
  documentComparisonStatus?: 'full' | 'metadata_only' | 'unavailable'
  officialMetadata: {
    tenderTitle: string
    tenderNumber: string
    department: string
    briefingDate: string
    briefingVenue: string
    closingDate: string | null
    closingTime: string | null
    requiresBriefingCertificate?: boolean
  }
}

export type BriefingSummaryResult = {
  summary: BriefingSummary
  structuredReport: StructuredMeetingMinutesReport
  model: string
  promptVersion: string
  provider: string
}

export interface BriefingSummaryService {
  summarize(input: BriefingSummaryInput): Promise<BriefingSummaryResult>
}

function nowIso() {
  return new Date().toISOString()
}

function getOpenAIApiKey(): string {
  return (process.env.OPENAI_API_KEY || '').trim()
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => stripSpeakerLabels(String(x || ''))).filter(Boolean)
}

function validateAndNormalize(raw: any, input: BriefingSummaryInput): BriefingSummaryResult {
  const meta = input.officialMetadata
  const purpose = stripSpeakerLabels(String(raw?.purposeOfBriefing || raw?.purpose || ''))
  if (!purpose) throw new Error('Meeting minutes missing purposeOfBriefing')

  const questionsRaw = Array.isArray(raw?.questionsAndClarifications)
    ? raw.questionsAndClarifications
    : []
  const questionsAndClarifications = questionsRaw
    .map((q: any) => ({
      heading: stripSpeakerLabels(String(q?.heading || '')),
      summary: stripSpeakerLabels(String(q?.summary || '')),
      unresolved: Boolean(q?.unresolved),
    }))
    .filter((q: { heading: string; summary: string }) => q.heading || q.summary)

  const mainPointsRaw = Array.isArray(raw?.mainPointsToRemember)
    ? raw.mainPointsToRemember
    : Array.isArray(raw?.mainPoints)
      ? raw.mainPoints
      : []
  const mainPointsToRemember = mainPointsRaw
    .map((p: any) => ({
      matter: stripSpeakerLabels(String(p?.matter || '')),
      detail: stripSpeakerLabels(String(p?.detail || '')),
    }))
    .filter((p: { matter: string; detail: string }) => p.matter || p.detail)

  const unresolvedItems = (Array.isArray(raw?.unresolvedItems) ? raw.unresolvedItems : [])
    .map((u: any) => ({
      topic: stripSpeakerLabels(String(u?.topic || '')),
      reason: stripSpeakerLabels(String(u?.reason || 'No clear answer captured in audio')),
    }))
    .filter((u: { topic: string }) => u.topic)

  const provenance: ProvenanceRef[] = (Array.isArray(raw?.provenance) ? raw.provenance : [])
    .map((p: any) => ({
      text: stripSpeakerLabels(String(p?.text || '')),
      sourceType: (['briefing_audio', 'tender_document', 'combined', 'official_metadata'].includes(
        p?.sourceType
      )
        ? p.sourceType
        : 'briefing_audio') as ProvenanceRef['sourceType'],
      transcriptSegmentIds: Array.isArray(p?.transcriptSegmentIds)
        ? p.transcriptSegmentIds.map(String)
        : undefined,
      startSeconds: typeof p?.startSeconds === 'number' ? p.startSeconds : null,
      tenderDocumentChunkIds: Array.isArray(p?.tenderDocumentChunkIds)
        ? p.tenderDocumentChunkIds.map(String)
        : undefined,
      page: typeof p?.page === 'number' ? p.page : null,
    }))
    .filter((p: ProvenanceRef) => p.text)

  const summary: BriefingSummary = {
    purposeOfBriefing: purpose,
    departmentExplanation: asStringArray(raw?.departmentExplanation || raw?.whatDepartmentExplained),
    priorityDeliverables: asStringArray(raw?.priorityDeliverables),
    scopeClarifications: asStringArray(raw?.scopeClarifications),
    questionsAndClarifications,
    experienceRequirements: asStringArray(raw?.experienceRequirements),
    complianceClarifications: asStringArray(raw?.complianceClarifications),
    durationAndTimelines: asStringArray(raw?.durationAndTimelines),
    importantDates: asStringArray(raw?.importantDates),
    amendments: (Array.isArray(raw?.amendments) ? raw.amendments : [])
      .map((a: any) => ({
        tenderRequirement: stripSpeakerLabels(String(a?.tenderRequirement || '')),
        briefingChange: stripSpeakerLabels(String(a?.briefingChange || a?.briefingClarification || '')),
        bidderImplication: stripSpeakerLabels(String(a?.bidderImplication || '')),
      }))
      .filter(
        (a: { tenderRequirement: string; briefingChange: string }) =>
          a.tenderRequirement || a.briefingChange
      ),
    amendmentsOrChanges: asStringArray(raw?.amendmentsOrChanges),
    workExpected: asStringArray(raw?.workExpected),
    mainPointsToRemember,
    unresolvedItems,
    provenance,
    documentComparisonStatus: input.documentComparisonStatus || 'metadata_only',
  }

  // Official metadata wins for cover + closing fields (never hallucinated).
  const structuredReport: StructuredMeetingMinutesReport = {
    cover: {
      tenderTitle: meta.tenderTitle || 'Tender',
      tenderNumber: meta.tenderNumber || '',
      department: meta.department || '',
      briefingDate: meta.briefingDate || '',
      briefingVenue: meta.briefingVenue || '',
      preparedBy: 'TenderBriefing',
      reportDate: nowIso().slice(0, 10),
    },
    purposeOfBriefing: summary.purposeOfBriefing,
    whatDepartmentExplained: summary.departmentExplanation,
    priorityDeliverables: summary.priorityDeliverables,
    scopeClarifications: summary.scopeClarifications,
    workExpected: summary.workExpected,
    experienceRequired: summary.experienceRequirements.join(' ') || stripSpeakerLabels(String(raw?.experienceRequired || '')),
    questionsAndClarifications: summary.questionsAndClarifications.map((q) => ({
      heading: q.heading,
      summary: q.unresolved
        ? `${q.summary} The issue was raised during the session, but a clear final response was not captured in the recording.`
        : q.summary,
    })),
    registrationAndCompliance:
      summary.complianceClarifications.join(' ') ||
      stripSpeakerLabels(String(raw?.registrationAndCompliance || '')),
    durationAndTimelines:
      summary.durationAndTimelines.join(' ') ||
      stripSpeakerLabels(String(raw?.durationAndTimelinesText || '')),
    mainPoints: summary.mainPointsToRemember,
    amendments: summary.amendments,
    amendmentsOrChanges: summary.amendmentsOrChanges,
    amendmentsNoneMessage:
      summary.amendments.length === 0 && summary.amendmentsOrChanges.length === 0
        ? 'No material amendments or changes were identified from the briefing recording reviewed.'
        : null,
    closingDate: meta.closingDate,
    closingTime: meta.closingTime,
    attendanceNote: 'Attendance evidence is included below as recorded by the Youth Agent.',
    briefingCertificateNote: meta.requiresBriefingCertificate
      ? 'The bidder should ensure that the officially required briefing certificate is included in the final bid submission where applicable.'
      : null,
    provenance: summary.provenance,
    documentComparisonStatus: input.documentComparisonStatus || 'metadata_only',
  }

  // Reject speaker labels leaking into client fields.
  const blob = JSON.stringify(structuredReport)
  if (/\bSpeaker\s+\d+\b/i.test(blob)) {
    throw new Error('Meeting minutes contained speaker labels — rejected')
  }

  let promptVersion = briefingReportPromptVersion()
  let finalStructured = structuredReport
  const withV2 = attachV2SectionsIfEnabled(structuredReport as Record<string, unknown>, raw)
  if (withV2.briefingIntelligenceV2) {
    finalStructured = withV2 as typeof structuredReport
    promptVersion = `${promptVersion}+${BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION}`
  }

  return {
    summary,
    structuredReport: finalStructured,
    model: process.env.BRIEFING_INTELLIGENCE_EXTRACT_MODEL || 'gpt-4o',
    promptVersion,
    provider: 'openai',
  }
}

export class OpenAIBriefingSummaryService implements BriefingSummaryService {
  private apiKey: string
  private model: string

  constructor(opts?: { apiKey?: string }) {
    this.apiKey = opts?.apiKey?.trim() || getOpenAIApiKey()
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is required for briefing summary generation')
    this.model = process.env.BRIEFING_INTELLIGENCE_EXTRACT_MODEL || 'gpt-4o'
  }

  async summarize(input: BriefingSummaryInput): Promise<BriefingSummaryResult> {
    const system = [
      'You write professional compulsory briefing session meeting minutes for South African public tenders.',
      'Write in clear third-person meeting-minutes style: "The Department explained…", "An attendee asked…", "The Department clarified…".',
      'NEVER use speaker labels such as Speaker 1, Speaker 2, or Speaker 3.',
      'Do not invent facts. Do not invent answers to unanswered questions.',
      'Remove filler, repetition, and conversational noise while preserving dates, deadlines, requirements, amendments, warnings, and bid-relevant clarifications.',
      'Distinguish: (A) already in tender document, (B) emphasised/clarified at briefing, (C) new/materially different at briefing — focus the narrative on the meeting.',
      'Amendments are high priority. Only list material clarifications/changes that affect bid preparation. Never invent differences from mere wording variance.',
      'For each amendment use: tenderRequirement, briefingChange, bidderImplication. If none, return amendments: [].',
      'Official metadata fields (tender number, department, briefing date/venue, closing date/time) are authoritative — do not contradict them.',
      'Never include speaker labels, confidence scores, AI commentary, or internal processing metadata in the output.',
      'Return STRICT JSON only.',
    ]
    // Phase 3E — append v2 guidance only when flag is enabled (fail-closed).
    const v2Guidance = briefingIntelligenceV2SystemGuidance()
    if (v2Guidance) system.push(v2Guidance)
    const systemPrompt = system.filter(Boolean).join(' ')

    const user = {
      officialMetadata: input.officialMetadata,
      tenderDocumentText: input.tenderDocumentText.slice(0, 40_000),
      briefingTranscript: input.transcriptText.slice(0, 50_000),
      segmentHints: input.transcriptSegments.slice(0, 80).map((s) => ({
        id: s.id,
        startSeconds: s.startSeconds,
        text: s.text.slice(0, 240),
      })),
      outputSchema: {
        purposeOfBriefing: 'string',
        departmentExplanation: ['string'],
        priorityDeliverables: ['string'],
        scopeClarifications: ['string'],
        workExpected: ['string'],
        experienceRequirements: ['string'],
        questionsAndClarifications: [{ heading: 'string', summary: 'string', unresolved: 'boolean?' }],
        complianceClarifications: ['string'],
        durationAndTimelines: ['string'],
        importantDates: ['string'],
        amendments: [
          {
            tenderRequirement: 'string',
            briefingChange: 'string',
            bidderImplication: 'string',
          },
        ],
        amendmentsOrChanges: ['string'],
        mainPointsToRemember: [{ matter: 'string', detail: 'string' }],
        unresolvedItems: [{ topic: 'string', reason: 'string' }],
        registrationAndCompliance: 'string',
        provenance: [
          {
            text: 'string',
            sourceType: 'briefing_audio|tender_document|combined|official_metadata',
            transcriptSegmentIds: ['string'],
            startSeconds: 'number|null',
          },
        ],
        ...(isBriefingIntelligenceV2Enabled()
          ? { briefingIntelligenceV2: BRIEFING_INTELLIGENCE_V2_OUTPUT_SCHEMA }
          : {}),
      },
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 3500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI summary failed: ${res.status} ${text}`.slice(0, 2000))
    }

    const data: any = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      throw new Error('OpenAI summary returned no content')
    }
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('OpenAI summary returned invalid JSON')
    }

    const result = validateAndNormalize(parsed, input)
    result.model = this.model
    result.provider = 'openai'
    return result
  }
}

/** Deterministic fixture for DPSA-style smoke / unit tests (no paid API). */
export class MockBriefingSummaryService implements BriefingSummaryService {
  async summarize(input: BriefingSummaryInput): Promise<BriefingSummaryResult> {
    const t = input.transcriptText.toLowerCase()
    const isDpsa =
      t.includes('public service regulation') ||
      t.includes('pama') ||
      t.includes('amendment act') ||
      t.includes('closingdate-extended') ||
      input.officialMetadata.tenderTitle.toLowerCase().includes('dpsa')

    const raw = isDpsa
      ? {
          purposeOfBriefing:
            'The session was held to clarify the scope of work for developing regulations required by recent Amendment Acts, and to answer bidder questions on experience, eligibility and timelines.',
          departmentExplanation: [
            'The Department explained that the assignment is not a total overhaul of all regulations, but focused drafting work required by Amendment Acts.',
            'The Department emphasised that the Public Service Regulations are the immediate priority.',
            'It was indicated that the first draft is expected during October 2026.',
            'PAMA-related regulations may require a longer consultation process.',
          ],
          priorityDeliverables: [
            'Public Service Regulations (priority)',
            'Related regulatory drafting aligned to Amendment Acts',
          ],
          scopeClarifications: [
            'The work is scoped to required regulatory updates rather than a wholesale rewrite of the regulatory framework.',
          ],
          workExpected: [
            'Produce high-quality draft regulations on priority timelines',
            'Demonstrate strong public-service knowledge and hit the ground running',
          ],
          experienceRequirements: [
            'The successful service provider must demonstrate strong public-service knowledge and relevant experience, and be able to start work immediately.',
          ],
          questionsAndClarifications: [
            {
              heading: 'Can a Consultant or Company Bid?',
              summary:
                'A question was raised regarding whether the tender was restricted to traditional law firms. The Department clarified that appropriately qualified consultants or companies may participate, provided the required capacity, qualifications and relevant experience can be demonstrated.',
            },
            {
              heading: 'Legal Practitioner Clarification',
              summary:
                'Clarification was sought on the meaning of legal practitioner wording in the tender. The Department responded in terms of the capacity, qualifications and experience required rather than restricting participation to a single practice form.',
            },
          ],
          complianceClarifications: [
            'State supplier compliance requirements remain applicable as set out in the tender documentation.',
          ],
          durationAndTimelines: [
            'The Department confirmed that the project is expected to run for six months and may be extended by a further three months if circumstances require it.',
            'First draft of the Public Service Regulations is expected in October 2026.',
          ],
          importantDates: ['First draft expected October 2026'],
          amendments: [
            {
              tenderRequirement: 'Project duration stated as six months in the tender documentation.',
              briefingChange:
                'The Department confirmed a possible further three-month extension if circumstances require it.',
              bidderImplication:
                'Bidders should plan resourcing for a potential nine-month engagement and confirm extension terms in the bid response where relevant.',
            },
            {
              tenderRequirement: 'Public Service Regulations work referenced in the tender scope.',
              briefingChange:
                'The Department emphasised that these regulations are the immediate priority and indicated that the first draft is expected during October 2026.',
              bidderImplication:
                'Prioritise Public Service Regulations capacity and October draft timing in the proposed work plan.',
            },
          ],
          amendmentsOrChanges: [],
          mainPointsToRemember: [
            { matter: 'Main priority', detail: 'Public Service Regulations' },
            { matter: 'Draft timing', detail: 'First draft expected October 2026' },
            { matter: 'Duration', detail: 'Six months, with possible three-month extension' },
            { matter: 'Eligibility', detail: 'Qualified consultants or companies may participate if requirements are met' },
          ],
          unresolvedItems: [],
          registrationAndCompliance:
            'Bidders must meet State supplier compliance requirements as published in the tender documentation.',
          provenance: [
            {
              text: 'The first draft is expected in October 2026.',
              sourceType: 'briefing_audio',
              transcriptSegmentIds: input.transcriptSegments[0] ? [input.transcriptSegments[0].id] : [],
              startSeconds: input.transcriptSegments[0]?.startSeconds ?? 0,
            },
            {
              text: 'The project duration is six months.',
              sourceType: 'combined',
              transcriptSegmentIds: [],
              tenderDocumentChunkIds: ['meta-duration'],
            },
          ],
        }
      : {
          purposeOfBriefing:
            'The briefing session clarified tender requirements and answered questions from prospective bidders.',
          departmentExplanation: [
            stripSpeakerLabels(input.transcriptText).slice(0, 400) ||
              'The Department provided an overview of the tender requirements.',
          ],
          priorityDeliverables: [],
          scopeClarifications: [],
          workExpected: [],
          experienceRequirements: [],
          questionsAndClarifications: [],
          complianceClarifications: [],
          durationAndTimelines: [],
          importantDates: [],
          amendments: [],
          amendmentsOrChanges: [],
          mainPointsToRemember: [
            {
              matter: 'Briefing held',
              detail: 'Key points from the compulsory briefing were captured for the client.',
            },
          ],
          unresolvedItems: [],
          registrationAndCompliance: '',
          provenance: [],
        }

    const result = validateAndNormalize(raw, input)
    result.provider = 'mock'
    result.model = 'mock'
    return result
  }
}

export function getBriefingSummaryService(): BriefingSummaryService {
  const provider = (process.env.BRIEFING_INTELLIGENCE_PROVIDER || 'speechmatics').toLowerCase()
  if (provider === 'mock') return new MockBriefingSummaryService()
  return new OpenAIBriefingSummaryService()
}
