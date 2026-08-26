/**
 * Structural quality gate before a meeting-minutes draft is marked draft_ready.
 * Does not invent facts; rejects speaker labels and empty core sections.
 */

import type { StructuredMeetingMinutesReport } from './meetingMinutesTypes'
import { containsSpeakerLabels } from './meetingMinutesTypes'
import type { BriefingErrorCategory } from './pipelineTrace'

export type OfficialMetadataGate = {
  tenderTitle: string
  tenderNumber: string
  department: string
  briefingDate: string
  briefingVenue: string
  closingDate: string | null
  closingTime?: string | null
}

export type ReportQualityGateResult =
  | { ok: true; warnings: string[]; discrepancies: string[] }
  | {
      ok: false
      category: BriefingErrorCategory
      reason: string
      founderMessage: string
      warnings: string[]
      discrepancies: string[]
    }

const IRRELEVANT_MARKERS =
  /\b(coffee|tea break|lunch|how was your weekend|joke|microphone check|testing 1 2|can you hear me|small talk)\b/i

function norm(s: string | null | undefined): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function runMeetingMinutesQualityGate(params: {
  report: StructuredMeetingMinutesReport
  official: OfficialMetadataGate
  transcriptText?: string
}): ReportQualityGateResult {
  const { report, official } = params
  const warnings: string[] = []
  const discrepancies: string[] = []

  if (!report.purposeOfBriefing?.trim()) {
    return {
      ok: false,
      category: 'quality_gate',
      reason: 'missing_purpose',
      founderMessage: 'Generated report missing purpose of briefing.',
      warnings,
      discrepancies,
    }
  }

  if (containsSpeakerLabels(JSON.stringify(report))) {
    return {
      ok: false,
      category: 'ai_schema',
      reason: 'speaker_labels_present',
      founderMessage: 'Generated report contained speaker labels and was rejected.',
      warnings,
      discrepancies,
    }
  }

  // Authoritative cover fields must match official metadata when official values exist.
  if (official.tenderNumber && report.cover.tenderNumber && norm(report.cover.tenderNumber) !== norm(official.tenderNumber)) {
    discrepancies.push(
      `Tender number discrepancy: cover="${report.cover.tenderNumber}" vs official="${official.tenderNumber}" (official preserved).`
    )
  }
  if (official.closingDate && report.closingDate && norm(report.closingDate) !== norm(official.closingDate)) {
    discrepancies.push(
      `Closing date discrepancy: report="${report.closingDate}" vs official="${official.closingDate}" (official preserved; treat briefing statement as possible amendment).`
    )
  }

  // Ensure cover uses official values (caller should already overwrite; re-check).
  if (official.tenderNumber && norm(report.cover.tenderNumber) !== norm(official.tenderNumber)) {
    return {
      ok: false,
      category: 'hallucination_guard',
      reason: 'tender_number_overwritten',
      founderMessage: 'Report tender number does not match authoritative tender record.',
      warnings,
      discrepancies,
    }
  }

  const substantive =
    (report.whatDepartmentExplained?.length || 0) +
    (report.priorityDeliverables?.length || 0) +
    (report.scopeClarifications?.length || 0) +
    (report.mainPoints?.length || 0) +
    (report.amendments?.length || 0) +
    (report.questionsAndClarifications?.length || 0)

  if (substantive === 0) {
    return {
      ok: false,
      category: 'quality_gate',
      reason: 'no_substantive_content',
      founderMessage:
        'Generated report has no substantive briefing intelligence sections. Marked failed quality gate for Founder review.',
      warnings,
      discrepancies,
    }
  }

  const blob = JSON.stringify(report)
  if (IRRELEVANT_MARKERS.test(blob)) {
    warnings.push('Possible irrelevant conversational content detected — Founder should verify exclusions.')
  }

  if (discrepancies.length) {
    warnings.push(...discrepancies)
  }

  if (!report.cover.tenderTitle?.trim() && !official.tenderTitle) {
    warnings.push('Tender title missing from both report and official metadata.')
  }

  return { ok: true, warnings, discrepancies }
}

/**
 * Force authoritative cover + closing onto structured report (never silently overwrite official).
 */
export function applyAuthoritativeTenderFields(
  report: StructuredMeetingMinutesReport,
  official: OfficialMetadataGate
): StructuredMeetingMinutesReport {
  return {
    ...report,
    cover: {
      ...report.cover,
      tenderTitle: official.tenderTitle || report.cover.tenderTitle,
      tenderNumber: official.tenderNumber || report.cover.tenderNumber,
      department: official.department || report.cover.department,
      briefingDate: official.briefingDate || report.cover.briefingDate,
      briefingVenue: official.briefingVenue || report.cover.briefingVenue,
    },
    closingDate: official.closingDate ?? report.closingDate,
    closingTime: official.closingTime ?? report.closingTime,
  }
}
