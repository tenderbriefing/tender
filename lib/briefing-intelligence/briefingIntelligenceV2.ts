/**
 * Briefing Intelligence v2 schema helpers (Phase 3E).
 * Distinguishes tender vs briefing-sourced information; never fabricates facts.
 * Activated only when BRIEFING_INTELLIGENCE_V2_ENABLED is truthy.
 */
import { isBriefingIntelligenceV2Enabled } from '@/lib/privateTenders/briefingOpsFlags'
import { stripSpeakerLabels } from '@/lib/briefing-intelligence/meetingMinutesTypes'

export const BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION = 'briefing-intel-v2-2026-08'

export type BriefingIntelligenceV2Sections = {
  tenderInformation: string[]
  briefingSpecificInformation: string[]
  amendmentsOrChanges: Array<{
    tenderRequirement: string
    briefingChange: string
    bidderImplication: string
  }>
  questionsAndAnswers: Array<{ question: string; answer: string; unresolved?: boolean }>
  submissionImplications: string[]
  keyDates: string[]
  mandatoryActions: string[]
  commercialOrTechnicalClarifications: string[]
  risksOrUncertainties: string[]
  clarityNotes: string[]
}

export function emptyBriefingIntelligenceV2(): BriefingIntelligenceV2Sections {
  return {
    tenderInformation: [],
    briefingSpecificInformation: [],
    amendmentsOrChanges: [],
    questionsAndAnswers: [],
    submissionImplications: [],
    keyDates: [],
    mandatoryActions: [],
    commercialOrTechnicalClarifications: [],
    risksOrUncertainties: [],
    clarityNotes: [],
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => stripSpeakerLabels(String(x || ''))).filter(Boolean).slice(0, 40)
}

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

  return {
    tenderInformation: asStringArray(raw.tenderInformation),
    briefingSpecificInformation: asStringArray(raw.briefingSpecificInformation),
    amendmentsOrChanges: amendmentsRaw
      .map((a: any) => ({
        tenderRequirement: stripSpeakerLabels(String(a?.tenderRequirement || '')),
        briefingChange: stripSpeakerLabels(String(a?.briefingChange || a || '')),
        bidderImplication: stripSpeakerLabels(String(a?.bidderImplication || '')),
      }))
      .filter((a: { briefingChange: string }) => a.briefingChange)
      .slice(0, 30),
    questionsAndAnswers: qaRaw
      .map((q: any) => ({
        question: stripSpeakerLabels(String(q?.question || q?.heading || '')),
        answer: stripSpeakerLabels(String(q?.answer || q?.summary || '')),
        unresolved: Boolean(q?.unresolved),
      }))
      .filter((q: { question: string; answer: string }) => q.question || q.answer)
      .slice(0, 40),
    submissionImplications: asStringArray(raw.submissionImplications),
    keyDates: asStringArray(raw.keyDates),
    mandatoryActions: asStringArray(raw.mandatoryActions),
    commercialOrTechnicalClarifications: asStringArray(raw.commercialOrTechnicalClarifications),
    risksOrUncertainties: asStringArray(raw.risksOrUncertainties),
    clarityNotes: asStringArray(raw.clarityNotes).concat(
      asStringArray(raw.unresolvedItems).map((x) =>
        typeof x === 'string' ? x : stripSpeakerLabels(JSON.stringify(x))
      )
    ),
  }
}

/** Extra system guidance appended when v2 flag is on. */
export function briefingIntelligenceV2SystemGuidance(): string {
  if (!isBriefingIntelligenceV2Enabled()) return ''
  return `
PHASE 3 — BRIEFING INTELLIGENCE V2 REQUIREMENTS:
- Separate tender-document facts from briefing-only verbal/physical information.
- List amendments/changes only when supported by transcript evidence.
- Capture Q&A with unresolved flags when answers were unclear.
- Call out submission implications and mandatory actions reinforced at the briefing.
- Prefer official metadata for tender number and closing date; never invent dates.
- If the transcript is unclear, state that explicitly in risksOrUncertainties / clarityNotes.
- Never fabricate commercial or technical clarifications.
`.trim()
}

export function attachV2SectionsIfEnabled<T extends Record<string, unknown>>(
  structured: T,
  rawModelOutput: any
): T & { briefingIntelligenceV2?: BriefingIntelligenceV2Sections; promptVersion?: string } {
  if (!isBriefingIntelligenceV2Enabled()) return structured
  const v2 =
    rawModelOutput?.briefingIntelligenceV2 ||
    rawModelOutput?.v2 ||
    rawModelOutput
  return {
    ...structured,
    briefingIntelligenceV2: normalizeBriefingIntelligenceV2(v2),
    promptVersion: BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION,
  }
}
