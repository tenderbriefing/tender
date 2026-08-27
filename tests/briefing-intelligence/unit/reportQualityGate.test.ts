import { describe, expect, it } from 'vitest'
import {
  applyAuthoritativeTenderFields,
  runMeetingMinutesQualityGate,
} from '@/lib/briefing-intelligence/reportQualityGate'
import { assessTranscriptQuality } from '@/lib/briefing-intelligence/transcriptQuality'
import type { StructuredMeetingMinutesReport } from '@/lib/briefing-intelligence/meetingMinutesTypes'

const official = {
  tenderTitle: 'Test Tender',
  tenderNumber: 'T-1',
  department: 'Dept',
  briefingDate: '2026-01-01',
  briefingVenue: 'Venue',
  closingDate: '2026-02-01',
}

function report(partial: Partial<StructuredMeetingMinutesReport> = {}): StructuredMeetingMinutesReport {
  return {
    cover: {
      tenderTitle: official.tenderTitle,
      tenderNumber: official.tenderNumber,
      department: official.department,
      briefingDate: official.briefingDate,
      briefingVenue: official.briefingVenue,
      preparedBy: 'TenderBriefing',
      reportDate: '2026-01-02',
    },
    purposeOfBriefing: 'Compulsory briefing.',
    whatDepartmentExplained: ['Bring tax clearance'],
    priorityDeliverables: [],
    scopeClarifications: [],
    workExpected: [],
    experienceRequired: '',
    keyRequirementsDiscussed: [],
    submissionRequirements: ['Not discussed in the recorded briefing.'],
    questionsAndClarifications: [],
    questionsAndAnswers: [],
    registrationAndCompliance: '',
    durationAndTimelines: '',
    importantDates: [],
    technicalObservations: [],
    risksAndWatchOuts: [],
    actionsForSme: [],
    verificationItems: [],
    mainPoints: [],
    amendments: [],
    amendmentsOrChanges: [],
    amendmentsNoneMessage: null,
    closingDate: official.closingDate,
    closingTime: null,
    attendanceNote: '',
    briefingCertificateNote: null,
    provenance: [],
    documentComparisonStatus: 'unavailable',
    ...partial,
  }
}

describe('reportQualityGate', () => {
  it('passes substantive reports with official cover', () => {
    const r = runMeetingMinutesQualityGate({ report: report(), official })
    expect(r.ok).toBe(true)
  })

  it('allows purpose-only limited briefings with a warning (not a hard fail)', () => {
    const r = runMeetingMinutesQualityGate({
      report: report({ whatDepartmentExplained: [], purposeOfBriefing: 'Short briefing overview.' }),
      official,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.warnings.some((w) => /Limited transcript content/i.test(w))).toBe(true)
    }
  })

  it('rejects empty purpose', () => {
    const r = runMeetingMinutesQualityGate({
      report: report({ purposeOfBriefing: '', whatDepartmentExplained: [] }),
      official,
    })
    expect(r.ok).toBe(false)
  })

  it('applyAuthoritativeTenderFields overwrites hallucinated numbers', () => {
    const out = applyAuthoritativeTenderFields(
      report({
        cover: { ...report().cover, tenderNumber: 'HALLUC' },
        closingDate: '2099-12-31',
      }),
      official
    )
    expect(out.cover.tenderNumber).toBe('T-1')
    expect(out.closingDate).toBe('2026-02-01')
  })
})

describe('transcriptQuality', () => {
  it('accepts tender-related transcript of sufficient length', () => {
    const r = assessTranscriptQuality({
      fullText:
        'Compulsory tender briefing opened. Closing date confirmed. Bid submission requires compliance documents and briefing certificate. The Department explained specification amendments and answered bidder questions on experience and eligibility for this tender. Officials also reviewed commercial pricing instructions and site conditions relevant to a compliant submission.',
      durationSeconds: 90,
      audioFileSizeMb: 1.2,
    })
    expect(r.ok).toBe(true)
  })
})
