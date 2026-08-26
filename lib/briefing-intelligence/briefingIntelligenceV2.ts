/**
 * Briefing Intelligence v2 schema helpers (Phase 3E).
 * Distinguishes tender vs briefing-sourced information; never fabricates facts.
 * Activated only when BRIEFING_INTELLIGENCE_V2_ENABLED is truthy.
 */
import { isBriefingIntelligenceV2Enabled } from '@/lib/privateTenders/briefingOpsFlags'
import { stripSpeakerLabels } from '@/lib/briefing-intelligence/meetingMinutesTypes'

export const BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION = 'briefing-intel-v2-2026-08-cert'

export type BriefingIntelligenceV2Sections = {
  executiveSummary: string
  tenderInformation: string[]
  briefingSpecificInformation: string[]
  amendmentsOrChanges: Array<{
    tenderRequirement: string
    briefingChange: string
    bidderImplication: string
    confirmationStatus?: 'announced_at_briefing' | 'confirmed' | 'uncertain'
  }>
  mandatoryRequirements: string[]
  documentsAndReturnables: string[]
  technicalRequirements: string[]
  commercialRequirements: string[]
  siteSpecificRequirements: string[]
  attendanceRequirements: string[]
  questionsAndAnswers: Array<{ question: string; answer: string; unresolved?: boolean }>
  outstandingQuestions: string[]
  submissionImplications: string[]
  keyDates: string[]
  mandatoryActions: string[]
  recommendedSmeActions: string[]
  commercialOrTechnicalClarifications: string[]
  risksOrUncertainties: string[]
  clarityNotes: string[]
  qualityWarnings: string[]
}

export function emptyBriefingIntelligenceV2(): BriefingIntelligenceV2Sections {
  return {
    executiveSummary: '',
    tenderInformation: [],
    briefingSpecificInformation: [],
    amendmentsOrChanges: [],
    mandatoryRequirements: [],
    documentsAndReturnables: [],
    technicalRequirements: [],
    commercialRequirements: [],
    siteSpecificRequirements: [],
    attendanceRequirements: [],
    questionsAndAnswers: [],
    outstandingQuestions: [],
    submissionImplications: [],
    keyDates: [],
    mandatoryActions: [],
    recommendedSmeActions: [],
    commercialOrTechnicalClarifications: [],
    risksOrUncertainties: [],
    clarityNotes: [],
    qualityWarnings: [],
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => stripSpeakerLabels(String(x || ''))).filter(Boolean).slice(0, 40)
}

export const BRIEFING_INTELLIGENCE_V2_OUTPUT_SCHEMA = {
  executiveSummary: 'string — concise operational summary; empty if evidence insufficient',
  tenderInformation: ['string — facts already in tender documents'],
  briefingSpecificInformation: ['string — verbal/physical briefing-only facts'],
  amendmentsOrChanges: [
    {
      tenderRequirement: 'string',
      briefingChange: 'string',
      bidderImplication: 'string',
      confirmationStatus: 'announced_at_briefing|confirmed|uncertain',
    },
  ],
  mandatoryRequirements: ['string'],
  documentsAndReturnables: ['string'],
  technicalRequirements: ['string'],
  commercialRequirements: ['string'],
  siteSpecificRequirements: ['string'],
  attendanceRequirements: ['string'],
  questionsAndAnswers: [{ question: 'string', answer: 'string', unresolved: 'boolean?' }],
  outstandingQuestions: ['string'],
  submissionImplications: ['string'],
  keyDates: ['string — do not invent closing dates; prefer official metadata'],
  mandatoryActions: ['string'],
  recommendedSmeActions: ['string'],
  commercialOrTechnicalClarifications: ['string'],
  risksOrUncertainties: ['string'],
  clarityNotes: ['string — explicit uncertainty / unclear transcript'],
  qualityWarnings: ['string — Founder-facing warnings'],
} as const

export function normalizeBriefingIntelligenceV2(raw: any): BriefingIntelligenceV2Sections {
  const base = emptyBriefingIntelligenceV2()
  if (!raw || typeof raw !== 'object') return base

  const amendmentsRaw = Array.isArray(raw.amendmentsOrChanges)
    ? raw.amendmentsOrChanges
    : Array.isArray(raw.amendments)
      ? raw.amendments
      : []
  const qaRaw = Array.isArray(raw.questionsAndAnswers)
    ? raw.questionsAndAnswers
    : Array.isArray(raw.questionsAndClarifications)
      ? raw.questionsAndClarifications
      : []

  const questionsAndAnswers = qaRaw
    .map((q: any) => ({
      question: stripSpeakerLabels(String(q?.question || q?.heading || '')),
      answer: stripSpeakerLabels(String(q?.answer || q?.summary || '')),
      unresolved: Boolean(q?.unresolved),
    }))
    .filter((q: { question: string; answer: string }) => q.question || q.answer)
    .slice(0, 40)

  const outstandingFromQa = questionsAndAnswers
    .filter((q: { unresolved?: boolean; answer: string }) => q.unresolved || !q.answer)
    .map((q: { question: string }) => q.question)
    .filter(Boolean)

  return {
    executiveSummary: stripSpeakerLabels(String(raw.executiveSummary || raw.purposeOfBriefing || '')),
    tenderInformation: asStringArray(raw.tenderInformation),
    briefingSpecificInformation: asStringArray(raw.briefingSpecificInformation),
    amendmentsOrChanges: amendmentsRaw
      .map((a: any) => ({
        tenderRequirement: stripSpeakerLabels(String(a?.tenderRequirement || '')),
        briefingChange: stripSpeakerLabels(String(a?.briefingChange || a || '')),
        bidderImplication: stripSpeakerLabels(String(a?.bidderImplication || '')),
        confirmationStatus: (['announced_at_briefing', 'confirmed', 'uncertain'].includes(
          String(a?.confirmationStatus || '')
        )
          ? a.confirmationStatus
          : 'announced_at_briefing') as 'announced_at_briefing' | 'confirmed' | 'uncertain',
      }))
      .filter((a: { briefingChange: string }) => a.briefingChange)
      .slice(0, 30),
    mandatoryRequirements: asStringArray(raw.mandatoryRequirements || raw.mandatoryActions),
    documentsAndReturnables: asStringArray(raw.documentsAndReturnables || raw.returnables),
    technicalRequirements: asStringArray(raw.technicalRequirements),
    commercialRequirements: asStringArray(raw.commercialRequirements),
    siteSpecificRequirements: asStringArray(raw.siteSpecificRequirements),
    attendanceRequirements: asStringArray(raw.attendanceRequirements),
    questionsAndAnswers,
    outstandingQuestions: asStringArray(raw.outstandingQuestions).length
      ? asStringArray(raw.outstandingQuestions)
      : outstandingFromQa.slice(0, 20),
    submissionImplications: asStringArray(raw.submissionImplications),
    keyDates: asStringArray(raw.keyDates),
    mandatoryActions: asStringArray(raw.mandatoryActions),
    recommendedSmeActions: asStringArray(raw.recommendedSmeActions || raw.recommendedActions),
    commercialOrTechnicalClarifications: asStringArray(raw.commercialOrTechnicalClarifications),
    risksOrUncertainties: asStringArray(raw.risksOrUncertainties),
    clarityNotes: asStringArray(raw.clarityNotes).concat(
      asStringArray(raw.unresolvedItems).map((x) =>
        typeof x === 'string' ? x : stripSpeakerLabels(JSON.stringify(x))
      )
    ),
    qualityWarnings: asStringArray(raw.qualityWarnings),
  }
}

/** Extra system guidance appended when v2 flag is on. */
export function briefingIntelligenceV2SystemGuidance(): string {
  if (!isBriefingIntelligenceV2Enabled()) return ''
  return `
PHASE 3 — BRIEFING INTELLIGENCE V2 REQUIREMENTS:
- Populate nested JSON field briefingIntelligenceV2 with the v2 schema keys.
- Separate tender-document facts from briefing-only verbal/physical information.
- List amendments/changes only when supported by transcript evidence; mark confirmationStatus=announced_at_briefing until Founder confirms.
- Capture Q&A with unresolved=true when answers were unclear; also list outstandingQuestions.
- Include documents/returnables, technical, commercial, site-specific, and attendance requirements only when evidenced.
- Prefer official metadata for tender number, title, venue, briefing date, closing date; never invent these.
- If the transcript is unclear, state that explicitly in risksOrUncertainties / clarityNotes / qualityWarnings.
- Never fabricate attendees, speaker names, quotations, tender numbers, or closing dates.
- Do not dump the transcript. Exclude irrelevant chatter.
- Leave arrays empty when evidence does not support content — do not invent filler.
`.trim()
}

/**
 * Attach v2 only from nested model output — never fall back to the whole raw v1 blob.
 */
export function attachV2SectionsIfEnabled<T extends Record<string, unknown>>(
  structured: T,
  rawModelOutput: any
): T & { briefingIntelligenceV2?: BriefingIntelligenceV2Sections; promptVersion?: string } {
  if (!isBriefingIntelligenceV2Enabled()) return structured
  const nested = rawModelOutput?.briefingIntelligenceV2 || rawModelOutput?.v2
  if (!nested || typeof nested !== 'object') {
    const empty = emptyBriefingIntelligenceV2()
    empty.clarityNotes = ['v2 sections not returned by model']
    empty.qualityWarnings = ['AI did not return nested briefingIntelligenceV2 — Founder should regenerate or review v1 minutes carefully.']
    return {
      ...structured,
      briefingIntelligenceV2: empty,
      promptVersion: BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION,
    }
  }
  const v2 = normalizeBriefingIntelligenceV2(nested)
  if (!v2.executiveSummary && typeof structured.purposeOfBriefing === 'string') {
    v2.executiveSummary = stripSpeakerLabels(String(structured.purposeOfBriefing))
  }
  return {
    ...structured,
    briefingIntelligenceV2: v2,
    promptVersion: BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION,
  }
}

/** Soft quality signal for Founder when flag on. */
export function assessBriefingIntelligenceV2Quality(v2: BriefingIntelligenceV2Sections | null | undefined): {
  ok: boolean
  warnings: string[]
} {
  if (!isBriefingIntelligenceV2Enabled()) return { ok: true, warnings: [] }
  if (!v2) return { ok: false, warnings: ['Missing briefingIntelligenceV2 sections'] }
  const warnings = [...(v2.qualityWarnings || [])]
  const hasSubstance =
    Boolean(v2.executiveSummary) ||
    v2.briefingSpecificInformation.length > 0 ||
    v2.amendmentsOrChanges.length > 0 ||
    v2.questionsAndAnswers.length > 0 ||
    v2.mandatoryActions.length > 0 ||
    v2.recommendedSmeActions.length > 0 ||
    v2.risksOrUncertainties.length > 0
  if (!hasSubstance) {
    warnings.push('V2 sections are empty — draft may lack briefing intelligence value')
  }
  if (v2.clarityNotes.some((n) => /v2 sections not returned/i.test(n))) {
    warnings.push('Model omitted nested v2 payload')
  }
  return { ok: true, warnings }
}
