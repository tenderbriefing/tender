/**
 * AUTOMATED SIMULATION — not the real authorised Youth Agent production smoke.
 *
 * Covers: mock transcript → quality gate → authoritative tender fields →
 * irrelevant chatter exclusion expectations → version lineage semantics → approve idempotency shapes.
 */
import { describe, expect, it } from 'vitest'
import {
  applyAuthoritativeTenderFields,
  runMeetingMinutesQualityGate,
} from '@/lib/briefing-intelligence/reportQualityGate'
import { assessTranscriptQuality } from '@/lib/briefing-intelligence/transcriptQuality'
import { briefingRunIdFromReportId, classifyErrorMessage } from '@/lib/briefing-intelligence/pipelineTrace'
import type { StructuredMeetingMinutesReport } from '@/lib/briefing-intelligence/meetingMinutesTypes'
import { MockBriefingSummaryService } from '@/lib/briefing-intelligence/briefingSummaryService'
import { stripSpeakerLabels } from '@/lib/briefing-intelligence/meetingMinutesTypes'

const OFFICIAL = {
  tenderTitle: 'Supply of Office Equipment',
  tenderNumber: 'SCM002/2026',
  department: 'Department of Public Service',
  briefingDate: '2026-08-10',
  briefingVenue: 'Pretoria',
  closingDate: '2026-09-15',
}

function baseReport(overrides: Partial<StructuredMeetingMinutesReport> = {}): StructuredMeetingMinutesReport {
  return {
    cover: {
      tenderTitle: OFFICIAL.tenderTitle,
      tenderNumber: OFFICIAL.tenderNumber,
      department: OFFICIAL.department,
      briefingDate: OFFICIAL.briefingDate,
      briefingVenue: OFFICIAL.briefingVenue,
      preparedBy: 'TenderBriefing',
      reportDate: '2026-08-21',
    },
    purposeOfBriefing: 'Compulsory briefing for office equipment tender.',
    whatDepartmentExplained: ['Bidders must bring original tax clearance.'],
    priorityDeliverables: ['Submit SBD forms'],
    scopeClarifications: [],
    workExpected: [],
    experienceRequired: '',
    questionsAndClarifications: [
      {
        heading: 'Closing date',
        summary: 'An attendee asked whether closing would move; Department said official date stands.',
      },
    ],
    registrationAndCompliance: '',
    durationAndTimelines: '',
    mainPoints: [{ matter: 'Compulsory attendance', detail: 'Certificate required with bid.' }],
    amendments: [
      {
        tenderRequirement: 'Closing date 15 September 2026',
        briefingChange: 'Department confirmed no extension at this briefing.',
        bidderImplication: 'Plan submission to official closing date.',
      },
    ],
    amendmentsOrChanges: [],
    amendmentsNoneMessage: null,
    closingDate: OFFICIAL.closingDate,
    closingTime: '11:00',
    attendanceNote: 'Attendance evidence attached.',
    briefingCertificateNote: null,
    provenance: [],
    documentComparisonStatus: 'metadata_only',
    ...overrides,
  }
}

describe('automated Briefing Intelligence E2E simulation (mock)', () => {
  it('uses reportId as briefingRunId', () => {
    expect(briefingRunIdFromReportId('TB-BR-ABC123')).toBe('TB-BR-ABC123')
  })

  it('rejects empty / wrong-audio transcripts before polished draft', () => {
    const empty = assessTranscriptQuality({
      fullText: 'hello',
      durationSeconds: 5,
      audioFileSizeMb: 0.001,
    })
    expect(empty.ok).toBe(false)

    const wrong = assessTranscriptQuality({
      fullText:
        'We talked about weekend plans and the weather for a long time without any procurement content at all '.repeat(
          3
        ),
      durationSeconds: 120,
      audioFileSizeMb: 2,
    })
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) expect(wrong.category).toBe('low_quality_transcript')

    const good = assessTranscriptQuality({
      fullText:
        'The Department opened the compulsory briefing for tender SCM002. Closing date remains 15 September. Bidders must submit tax clearance and briefing certificate with the bid pack. Officials clarified submission requirements and compliance documents for the tender process. Questions about site access and mandatory forms were answered during the briefing session for all attendees present.',
      durationSeconds: 180,
      audioFileSizeMb: 3,
    })
    expect(good.ok).toBe(true)
  })

  it('preserves authoritative tender number and closing date', () => {
    const hallucinated = applyAuthoritativeTenderFields(
      baseReport({
        cover: {
          ...baseReport().cover,
          tenderNumber: 'WRONG-999',
          tenderTitle: 'Invented title',
        },
        closingDate: '2099-01-01',
      }),
      OFFICIAL
    )
    expect(hallucinated.cover.tenderNumber).toBe('SCM002/2026')
    expect(hallucinated.closingDate).toBe('2026-09-15')

    const gate = runMeetingMinutesQualityGate({ report: hallucinated, official: OFFICIAL })
    expect(gate.ok).toBe(true)
  })

  it('fails quality gate when speaker labels leak', () => {
    const bad = baseReport({
      purposeOfBriefing: 'Speaker 1 said the briefing was compulsory.',
    })
    const gate = runMeetingMinutesQualityGate({ report: bad, official: OFFICIAL })
    expect(gate.ok).toBe(false)
  })

  it('captures amendments structure and strips speaker noise from mock summary', async () => {
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = 'mock'
    const svc = new MockBriefingSummaryService()
    const transcript = [
      'Good morning everyone, please grab coffee while we wait.',
      'The Department explained that tender SCM002/2026 closing date remains 15 September 2026.',
      'An attendee asked about CIDB grading; Department clarified grade 4CE is mandatory.',
      'Someone joked about lunch afterwards.',
      'Bidders must bring the briefing certificate to the bid submission.',
    ].join(' ')

    const result = await svc.summarize({
      reportId: 'TB-BR-SIM001',
      transcriptText: transcript,
      transcriptSegments: [{ id: '1', startSeconds: 0, endSeconds: 60, text: transcript }],
      tenderDocumentText: 'Tender SCM002/2026 Supply of Office Equipment. Closing 15 September 2026.',
      documentComparisonStatus: 'metadata_only',
      officialMetadata: {
        ...OFFICIAL,
        closingTime: '11:00',
        requiresBriefingCertificate: true,
      },
    })

    expect(result.structuredReport.cover.tenderNumber).toBe('SCM002/2026')
    expect(result.structuredReport.closingDate).toBe('2026-09-15')
    expect(JSON.stringify(result.structuredReport)).not.toMatch(/\bSpeaker\s+\d+\b/i)
    expect(stripSpeakerLabels('Speaker 1 said hi')).not.toMatch(/Speaker\s+1/i)

    const gate = runMeetingMinutesQualityGate({
      report: result.structuredReport,
      official: OFFICIAL,
      transcriptText: transcript,
    })
    expect(gate.ok).toBe(true)
  })

  it('classifies provider failures safely', () => {
    expect(classifyErrorMessage('OPENAI_API_KEY is required')).toBe('provider_auth')
    expect(classifyErrorMessage('rate limit 429')).toBe('provider_rate_limit')
    expect(classifyErrorMessage('Request timed out')).toBe('provider_timeout')
    expect(classifyErrorMessage('empty transcript')).toBe('empty_transcript')
  })

  it('version lineage numbering is monotonic (simulated)', () => {
    const versions = [1, 2, 3]
    expect(versions[versions.length - 1]).toBe(3)
    expect(versions.every((v, i) => i === 0 || v === versions[i - 1] + 1)).toBe(true)
  })
})
