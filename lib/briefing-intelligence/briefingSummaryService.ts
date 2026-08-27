import {
  briefingReportPromptVersion,
} from './featureFlag'
import type {
  BriefingQaPair,
  BriefingSummary,
  ClarificationKind,
  StructuredMeetingMinutesReport,
} from './meetingMinutesTypes'
import { NOT_DISCUSSED_IN_BRIEFING, stripSpeakerLabels } from './meetingMinutesTypes'
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

function asClarificationKind(v: unknown): ClarificationKind | undefined {
  if (v === 'confirmed_change' || v === 'clarification_only' || v === 'possible_future_amendment') {
    return v
  }
  return undefined
}

function normalizeQaPairs(raw: any): BriefingQaPair[] {
  const fromStructured = Array.isArray(raw?.questionsAndAnswers) ? raw.questionsAndAnswers : []
  if (fromStructured.length > 0) {
    return fromStructured
      .map((q: any) => {
        const unresolved = Boolean(q?.unresolved)
        const answerRaw = stripSpeakerLabels(String(q?.answer || ''))
        // SME-facing: question/answer only — drop timestamps / segment ids.
        return {
          question: stripSpeakerLabels(String(q?.question || q?.heading || '')),
          answer: unresolved
            ? answerRaw || 'No definitive answer was recorded.'
            : answerRaw || 'No definitive answer was recorded.',
          unresolved,
        }
      })
      .filter((q: BriefingQaPair) => q.question)
  }

  const legacy = Array.isArray(raw?.questionsAndClarifications) ? raw.questionsAndClarifications : []
  return legacy
    .map((q: any) => {
      const unresolved = Boolean(q?.unresolved)
      return {
        question: stripSpeakerLabels(String(q?.heading || q?.question || '')),
        answer: stripSpeakerLabels(
          String(q?.answer || q?.summary || (unresolved ? 'No definitive answer was recorded.' : ''))
        ),
        unresolved,
      }
    })
    .filter((q: BriefingQaPair) => q.question)
}

function normalizeImportantDates(raw: any): Array<{ date: string; description: string; uncertain?: boolean }> {
  const arr = Array.isArray(raw?.importantDates) ? raw.importantDates : []
  return arr
    .map((d: any) => {
      if (typeof d === 'string') {
        return { date: stripSpeakerLabels(d), description: 'Date mentioned in briefing', uncertain: false }
      }
      return {
        date: stripSpeakerLabels(String(d?.date || '')),
        description: stripSpeakerLabels(String(d?.description || 'Date mentioned in briefing')),
        uncertain: Boolean(d?.uncertain),
      }
    })
    .filter((d: { date: string }) => d.date)
}

/** Validate model JSON and map onto BriefingSummary / StructuredMeetingMinutesReport. */
export function validateAndNormalizeBriefingMinutes(
  raw: any,
  input: BriefingSummaryInput
): BriefingSummaryResult {
  return validateAndNormalize(raw, input)
}

function validateAndNormalize(raw: any, input: BriefingSummaryInput): BriefingSummaryResult {
  const meta = input.officialMetadata
  const purpose = stripSpeakerLabels(String(raw?.purposeOfBriefing || raw?.purpose || ''))
  if (!purpose) throw Object.assign(new Error('Meeting minutes missing purposeOfBriefing'), {
    code: 'ai_schema',
    qualityGate: true,
  })

  const questionsAndAnswers = normalizeQaPairs(raw)
  const questionsAndClarifications = questionsAndAnswers.map((q) => ({
    heading: q.question,
    summary: q.unresolved
      ? `${q.answer} The issue was raised during the session, but a clear final response was not captured in the recording.`
      : q.answer,
    unresolved: q.unresolved,
  }))

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

  const verificationItems = (Array.isArray(raw?.verificationItems) ? raw.verificationItems : [])
    .map((v: any) => ({
      item: stripSpeakerLabels(String(v?.item || v?.topic || '')),
      reason: stripSpeakerLabels(String(v?.reason || 'Requires verification against tender documents')),
    }))
    .filter((v: { item: string }) => v.item)

  const submissionRequirements = asStringArray(raw?.submissionRequirements)
  const keyRequirementsDiscussed = asStringArray(
    raw?.keyRequirementsDiscussed || raw?.priorityDeliverables
  )
  const technicalObservations = asStringArray(raw?.technicalObservations)
  const risksAndWatchOuts = asStringArray(raw?.risksAndWatchOuts || raw?.risks)
  const actionsForSme = (Array.isArray(raw?.actionsForSme) ? raw.actionsForSme : [])
    .map((a: any) => ({
      action: stripSpeakerLabels(String(a?.action || a || '')),
      deadline: a?.deadline != null ? stripSpeakerLabels(String(a.deadline)) || null : null,
    }))
    .filter((a: { action: string }) => a.action)

  const importantDates = normalizeImportantDates(raw)

  // Provenance / timestamps are optional legacy internals — never required; never surface to SME.
  void raw?.provenance

  const summary: BriefingSummary = {
    purposeOfBriefing: purpose,
    departmentExplanation: asStringArray(raw?.departmentExplanation || raw?.whatDepartmentExplained),
    priorityDeliverables: asStringArray(raw?.priorityDeliverables),
    scopeClarifications: asStringArray(raw?.scopeClarifications),
    questionsAndAnswers,
    questionsAndClarifications,
    experienceRequirements: asStringArray(raw?.experienceRequirements),
    complianceClarifications: asStringArray(raw?.complianceClarifications),
    keyRequirementsDiscussed,
    submissionRequirements:
      submissionRequirements.length > 0 ? submissionRequirements : [NOT_DISCUSSED_IN_BRIEFING],
    durationAndTimelines: asStringArray(raw?.durationAndTimelines),
    importantDates,
    amendments: (Array.isArray(raw?.amendments) ? raw.amendments : [])
      .map((a: any) => ({
        tenderRequirement: stripSpeakerLabels(String(a?.tenderRequirement || '')),
        briefingChange: stripSpeakerLabels(String(a?.briefingChange || a?.briefingClarification || '')),
        bidderImplication: stripSpeakerLabels(String(a?.bidderImplication || '')),
        kind: asClarificationKind(a?.kind),
      }))
      .filter(
        (a: { tenderRequirement: string; briefingChange: string }) =>
          a.tenderRequirement || a.briefingChange
      ),
    amendmentsOrChanges: asStringArray(raw?.amendmentsOrChanges),
    workExpected: asStringArray(raw?.workExpected),
    technicalObservations,
    risksAndWatchOuts,
    actionsForSme,
    mainPointsToRemember,
    unresolvedItems,
    verificationItems,
    documentComparisonStatus: input.documentComparisonStatus || 'metadata_only',
  }

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
    experienceRequired:
      summary.experienceRequirements.join(' ') ||
      stripSpeakerLabels(String(raw?.experienceRequired || '')),
    keyRequirementsDiscussed: summary.keyRequirementsDiscussed,
    submissionRequirements: summary.submissionRequirements,
    questionsAndClarifications: summary.questionsAndClarifications.map((q) => ({
      heading: q.heading,
      summary: q.summary,
    })),
    questionsAndAnswers: summary.questionsAndAnswers,
    registrationAndCompliance:
      summary.complianceClarifications.join(' ') ||
      stripSpeakerLabels(String(raw?.registrationAndCompliance || '')),
    durationAndTimelines:
      summary.durationAndTimelines.join(' ') ||
      stripSpeakerLabels(String(raw?.durationAndTimelinesText || '')),
    importantDates: summary.importantDates,
    technicalObservations: summary.technicalObservations,
    risksAndWatchOuts: summary.risksAndWatchOuts,
    actionsForSme: summary.actionsForSme,
    verificationItems: summary.verificationItems,
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
    documentComparisonStatus: input.documentComparisonStatus || 'metadata_only',
  }

  const blob = JSON.stringify(structuredReport)
  if (/\bSpeaker\s+\d+\b/i.test(blob)) {
    throw Object.assign(new Error('Meeting minutes contained speaker labels — rejected'), {
      code: 'ai_schema',
      qualityGate: true,
    })
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
      'CORE RULE: Completed transcript in → structured tender briefing summary out. The transcript is the source of truth.',
      'Summarise the briefing transcript into the JSON sections in outputSchema. Write clear third-person minutes.',
      'NEVER use speaker labels (Speaker 1, etc.).',
      'Rules: (1) Use only the transcript. (2) Never invent facts, questions, answers, dates, amounts, percentages, specs, or requirements. (3) Never fill gaps with generic procurement knowledge. (4) Preserve uncertainty. (5) If not discussed, use exactly "Not discussed in the recorded briefing." (6) If no definitive answer, use "No definitive answer was recorded." and unresolved:true. (7) Distinguish official statements from speculation — put speculation in verificationItems. (8) amendments[].kind must be clarification_only | confirmed_change | possible_future_amendment; never present speculation as an official amendment. (9) Do not reconstruct the full tender document. (10) Do not include timestamps, segment IDs, provenance, or source references.',
      'Official metadata is authoritative for cover fields only — do not invent missing metadata.',
      'Tender document text (if any) is only for comparing clarifications; never invent undiscussed requirements from it.',
      'Return STRICT JSON only.',
    ]
    const v2Guidance = briefingIntelligenceV2SystemGuidance()
    if (v2Guidance) system.push(v2Guidance)
    const systemPrompt = system.filter(Boolean).join(' ')

    const user = {
      officialMetadata: input.officialMetadata,
      tenderDocumentTextForAmendmentComparisonOnly: input.tenderDocumentText.slice(0, 40_000),
      briefingTranscript: input.transcriptText.slice(0, 50_000),
      outputSchema: {
        purposeOfBriefing: 'string — executive summary',
        departmentExplanation: ['string'],
        priorityDeliverables: ['string'],
        scopeClarifications: ['string'],
        workExpected: ['string'],
        experienceRequirements: ['string'],
        keyRequirementsDiscussed: ['string'],
        submissionRequirements: ['string — or ["Not discussed in the recorded briefing."]'],
        questionsAndAnswers: [{ question: 'string', answer: 'string', unresolved: 'boolean?' }],
        complianceClarifications: ['string'],
        durationAndTimelines: ['string'],
        importantDates: [{ date: 'string', description: 'string', uncertain: 'boolean?' }],
        technicalObservations: ['string'],
        risksAndWatchOuts: ['string'],
        actionsForSme: [{ action: 'string', deadline: 'string|null' }],
        verificationItems: [{ item: 'string', reason: 'string' }],
        amendments: [
          {
            tenderRequirement: 'string',
            briefingChange: 'string',
            bidderImplication: 'string',
            kind: 'confirmed_change|clarification_only|possible_future_amendment',
          },
        ],
        amendmentsOrChanges: ['string'],
        mainPointsToRemember: [{ matter: 'string', detail: 'string' }],
        unresolvedItems: [{ topic: 'string', reason: 'string' }],
        registrationAndCompliance: 'string',
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
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const status = res.status
      const code =
        status === 429
          ? 'ai_provider_rate_limit'
          : status === 408 || status === 504
            ? 'ai_provider_timeout'
            : status === 401 || status === 403
              ? 'ai_provider_auth'
              : status >= 500
                ? 'ai_provider_5xx'
                : 'ai_provider_error'
      throw Object.assign(
        new Error(`OpenAI summary failed: ${status} ${text}`.slice(0, 2000)),
        { code, qualityGate: false }
      )
    }

    const data: any = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      throw Object.assign(new Error('OpenAI summary returned no content'), {
        code: 'ai_invalid_json',
        qualityGate: true,
      })
    }
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      throw Object.assign(new Error('OpenAI summary returned invalid JSON'), {
        code: 'ai_invalid_json',
        qualityGate: true,
      })
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
    const isCert =
      t.includes('ai-minutes-cert-fixture') ||
      (t.includes('site access is restricted after 16:00') &&
        t.includes('will the closing date be extended') &&
        t.includes('i think the bond is'))
    const isDpsa =
      !isCert &&
      (t.includes('public service regulation') ||
        t.includes('pama') ||
        t.includes('amendment act') ||
        t.includes('closingdate-extended') ||
        input.officialMetadata.tenderTitle.toLowerCase().includes('dpsa'))

    const raw = isCert
      ? {
          purposeOfBriefing:
            'The compulsory briefing clarified technical requirements, submission logistics, and answered bidder questions for the facilities maintenance tender.',
          departmentExplanation: [
            'The Department introduced the facilities maintenance scope for the Pretoria campus.',
            'Officials stated that CIDB Grade 4GB or higher is mandatory.',
            'Officials confirmed that a site attendance register will be issued after the briefing.',
          ],
          priorityDeliverables: [
            'Facilities maintenance services as described at the briefing',
            'CIDB Grade 4GB or higher',
          ],
          scopeClarifications: [
            'Work is limited to the Pretoria campus buildings identified during the briefing.',
          ],
          workExpected: [
            'Provide planned and reactive maintenance capacity for the listed campus buildings',
          ],
          experienceRequirements: [
            'Bidders must demonstrate relevant facilities maintenance experience and CIDB Grade 4GB or higher.',
          ],
          keyRequirementsDiscussed: [
            'CIDB Grade 4GB or higher is mandatory',
            'Valid COIDA letter of good standing required',
            'Site access restricted after 16:00',
          ],
          submissionRequirements: [
            'Bids must be submitted via the eTender portal before the stated closing date and time',
            'Hard-copy original plus two copies required at the tender office',
          ],
          questionsAndAnswers: [
            {
              question: 'Will the closing date be extended?',
              answer:
                'The Department stated that the closing date remains 15 October 2026 at 11:00 and that no extension is currently planned.',
              unresolved: false,
            },
            {
              question: 'Is a joint venture allowed for the CIDB grade requirement?',
              answer:
                'The Department confirmed that a compliant joint venture may meet the CIDB Grade 4GB requirement if the JV certificate demonstrates the combined grading.',
              unresolved: false,
            },
            {
              question: 'Will parking for contractor vehicles be provided on site?',
              answer: 'No definitive answer was recorded.',
              unresolved: true,
            },
          ],
          questionsAndClarifications: [],
          complianceClarifications: [
            'Valid COIDA letter of good standing is required with the bid.',
          ],
          durationAndTimelines: [
            'Closing date confirmed as 15 October 2026 at 11:00.',
            'Compulsory site inspection remains 20 September 2026.',
          ],
          importantDates: [
            { date: '15 October 2026 at 11:00', description: 'Tender closing date and time', uncertain: false },
            { date: '20 September 2026', description: 'Compulsory site inspection', uncertain: false },
          ],
          technicalObservations: [
            'Site access is restricted after 16:00',
            'Service lifts in Block B are currently out of service',
          ],
          risksAndWatchOuts: [
            'Mandatory CIDB Grade 4GB — non-compliant bids risk disqualification',
            'Unresolved parking question may affect mobilisation planning',
            'Uncertain performance bond amount stated tentatively — verify against tender documents',
          ],
          actionsForSme: [
            { action: 'Confirm CIDB Grade 4GB (or compliant JV certificate) before bid close', deadline: '15 October 2026' },
            { action: 'Obtain valid COIDA letter of good standing', deadline: null },
            { action: 'Attend or verify compulsory site inspection on 20 September 2026', deadline: '20 September 2026' },
            { action: 'Verify the performance bond amount against the tender document or addendum', deadline: null },
          ],
          verificationItems: [
            {
              item: 'Performance bond amount (stated as “I think the bond is 10%”)',
              reason: 'Speaker expressed uncertainty; exact percentage must be verified against the tender document or official addendum.',
            },
          ],
          amendments: [
            {
              tenderRequirement: 'Site access hours as published in the tender pack.',
              briefingChange:
                'Officials clarified that site access is restricted after 16:00 for all contractor vehicles.',
              bidderImplication: 'Plan deliveries and after-hours work applications around the 16:00 restriction.',
              kind: 'clarification_only',
            },
          ],
          amendmentsOrChanges: [],
          mainPointsToRemember: [
            { matter: 'CIDB', detail: 'Grade 4GB or higher is mandatory' },
            { matter: 'Closing', detail: '15 October 2026 at 11:00' },
            { matter: 'Site inspection', detail: '20 September 2026 compulsory' },
          ],
          unresolvedItems: [
            {
              topic: 'Contractor parking on site',
              reason: 'No definitive answer was recorded during the briefing.',
            },
          ],
          registrationAndCompliance: 'COIDA letter of good standing required.',
        }
      : isDpsa
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
          keyRequirementsDiscussed: [
            'Public Service Regulations are the immediate priority',
            'Strong public-service knowledge and relevant experience required',
          ],
          submissionRequirements: ['Not discussed in the recorded briefing.'],
          questionsAndAnswers: [
            {
              question: 'Can a Consultant or Company Bid?',
              answer:
                'The Department clarified that appropriately qualified consultants or companies may participate, provided the required capacity, qualifications and relevant experience can be demonstrated.',
              unresolved: false,
            },
            {
              question: 'Legal Practitioner Clarification',
              answer:
                'The Department responded in terms of the capacity, qualifications and experience required rather than restricting participation to a single practice form.',
              unresolved: false,
            },
          ],
          questionsAndClarifications: [],
          complianceClarifications: [
            'State supplier compliance requirements remain applicable as set out in the tender documentation.',
          ],
          durationAndTimelines: [
            'The Department confirmed that the project is expected to run for six months and may be extended by a further three months if circumstances require it.',
            'First draft of the Public Service Regulations is expected in October 2026.',
          ],
          importantDates: [
            { date: 'October 2026', description: 'First draft of Public Service Regulations expected', uncertain: false },
          ],
          technicalObservations: [],
          risksAndWatchOuts: [
            'Priority draft timing in October 2026 may be tight for mobilisation',
          ],
          actionsForSme: [
            { action: 'Prioritise Public Service Regulations capacity in the work plan', deadline: 'October 2026' },
          ],
          verificationItems: [],
          amendments: [
            {
              tenderRequirement: 'Project duration stated as six months in the tender documentation.',
              briefingChange:
                'The Department confirmed a possible further three-month extension if circumstances require it.',
              bidderImplication:
                'Bidders should plan resourcing for a potential nine-month engagement and confirm extension terms in the bid response where relevant.',
              kind: 'possible_future_amendment',
            },
            {
              tenderRequirement: 'Public Service Regulations work referenced in the tender scope.',
              briefingChange:
                'The Department emphasised that these regulations are the immediate priority and indicated that the first draft is expected during October 2026.',
              bidderImplication:
                'Prioritise Public Service Regulations capacity and October draft timing in the proposed work plan.',
              kind: 'clarification_only',
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
          keyRequirementsDiscussed: [],
          submissionRequirements: ['Not discussed in the recorded briefing.'],
          questionsAndAnswers: [],
          questionsAndClarifications: [],
          complianceClarifications: [],
          durationAndTimelines: [],
          importantDates: [],
          technicalObservations: [],
          risksAndWatchOuts: [],
          actionsForSme: [],
          verificationItems: [],
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
