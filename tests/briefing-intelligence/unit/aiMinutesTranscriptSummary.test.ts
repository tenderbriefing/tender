import { describe, it, expect } from 'vitest'
import {
  MockBriefingSummaryService,
  validateAndNormalizeBriefingMinutes,
} from '@/lib/briefing-intelligence/briefingSummaryService'
import { runMeetingMinutesQualityGate } from '@/lib/briefing-intelligence/reportQualityGate'
import { meetingMinutesToBriefingReportContent } from '@/lib/briefing-intelligence/mapMeetingMinutesToReportContent'
import { renderMeetingMinutesPdf } from '@/lib/briefing-intelligence/meetingMinutesPdf'
import { NOT_DISCUSSED_IN_BRIEFING } from '@/lib/briefing-intelligence/meetingMinutesTypes'
import {
  AI_MINUTES_CERT_METADATA,
  AI_MINUTES_CERT_SEGMENTS,
  AI_MINUTES_CERT_TRANSCRIPT,
} from '@/lib/briefing-intelligence/fixtures/aiMinutesCertificationTranscript'

const PROVENANCE_LEAK =
  /sourceStartSeconds|sourceEndSeconds|transcriptSegmentIds|"startSeconds"|"endSeconds"|seg-qa-|seg-tech-|"provenance"/i

const baseInput = {
  reportId: 'TB-BR-AICERT',
  transcriptText: AI_MINUTES_CERT_TRANSCRIPT,
  transcriptSegments: AI_MINUTES_CERT_SEGMENTS,
  tenderDocumentText: 'CIDB Grade 4GB. Closing 15 October 2026. Performance bond: see SBD.',
  documentComparisonStatus: 'full' as const,
  officialMetadata: AI_MINUTES_CERT_METADATA,
}

describe('simple AI tender briefing summary', () => {
  it('1. generates without timestamps', async () => {
    const result = await new MockBriefingSummaryService().summarize({
      ...baseInput,
      transcriptSegments: [],
    })
    const blob = JSON.stringify(result.structuredReport)
    expect(blob).not.toMatch(/sourceStartSeconds/)
    expect(result.structuredReport.purposeOfBriefing.length).toBeGreaterThan(10)
  })

  it('2. generates without transcript segment IDs', async () => {
    const result = await new MockBriefingSummaryService().summarize({
      ...baseInput,
      transcriptSegments: [],
    })
    const blob = JSON.stringify({
      summary: result.summary,
      report: result.structuredReport,
    })
    expect(blob).not.toMatch(/transcriptSegmentIds/)
    expect(blob).not.toMatch(/seg-qa-/)
    expect(result.summary.provenance).toBeUndefined()
  })

  it('3. Q&A extraction remains correct', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const qa = result.structuredReport.questionsAndAnswers
    expect(qa.length).toBeGreaterThanOrEqual(3)
    expect(qa.some((q) => /closing date/i.test(q.question) && /15 October 2026/i.test(q.answer))).toBe(
      true
    )
    const parking = qa.find((q) => /parking/i.test(q.question))
    expect(parking?.unresolved).toBe(true)
    expect(parking?.answer).toMatch(/No definitive answer was recorded/i)
    expect(parking).not.toHaveProperty('sourceStartSeconds')
  })

  it('4. dates remain accurate', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const dates = result.structuredReport.importantDates.map((d) => `${d.date} ${d.description}`).join(' ')
    expect(dates).toMatch(/15 October 2026/)
    expect(dates).toMatch(/20 September 2026/)
  })

  it('5. clarifications remain correctly classified', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    expect(result.structuredReport.amendments[0].kind).toBe('clarification_only')
    expect(result.structuredReport.amendments[0].briefingChange).toMatch(/16:00/)
  })

  it('6. unsupported facts remain suppressed', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const blob = JSON.stringify(result.structuredReport).toLowerCase()
    expect(blob).not.toMatch(/30%\s*local.?content/)
    expect(blob).not.toMatch(/b-bbee level 1 mandatory/)
  })

  it('7. uncertain statements appear under verification', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    expect(result.structuredReport.verificationItems.some((v) => /bond/i.test(v.item))).toBe(true)
  })

  it('8. actions remain grounded in transcript content', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const actions = result.structuredReport.actionsForSme.map((a) => a.action).join(' ')
    expect(actions).toMatch(/CIDB|COIDA|site inspection|bond/i)
  })

  it('9. short transcripts still follow quality gates', async () => {
    const result = await new MockBriefingSummaryService().summarize({
      ...baseInput,
      reportId: 'TB-BR-SHORT',
      transcriptText: 'Official: Welcome. The tender covers general building works. Meeting adjourned.',
      transcriptSegments: [],
    })
    expect(result.structuredReport.submissionRequirements).toContain(NOT_DISCUSSED_IN_BRIEFING)
    const gate = runMeetingMinutesQualityGate({
      report: result.structuredReport,
      official: AI_MINUTES_CERT_METADATA,
    })
    expect(gate.ok).toBe(true)
  })

  it('10. long stitched transcripts use the same simple summarisation path', async () => {
    const stitched = `${AI_MINUTES_CERT_TRANSCRIPT}\n\n[chunk-2]\nOfficial: Reminder — CIDB Grade 4GB remains mandatory.`
    const result = await new MockBriefingSummaryService().summarize({
      ...baseInput,
      transcriptText: stitched,
      transcriptSegments: [],
    })
    expect(result.provider).toBe('mock')
    expect(result.structuredReport.questionsAndAnswers.length).toBeGreaterThanOrEqual(3)
  })

  it('11. Founder review mapping remains unchanged (Q&A + verification + transcript notice)', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const mapped = meetingMinutesToBriefingReportContent(result.structuredReport, 'TB-BR-AICERT')
    expect(mapped.questionsAndAnswers.length).toBeGreaterThanOrEqual(3)
    expect(mapped.complianceRisks.some((r) => /Verification required/i.test(r.risk))).toBe(true)
    expect(mapped.importantNotice).toMatch(/transcript remains the source of truth/i)
  })

  it('12. PDF / structured report contain no timestamp or segment metadata', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const blob = JSON.stringify(result.structuredReport)
    expect(blob).not.toMatch(PROVENANCE_LEAK)
    const pdf = await renderMeetingMinutesPdf({
      report: result.structuredReport,
      logoBytes: null,
      attendanceImageBytes: null,
      reportId: 'TB-BR-AICERT',
    })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    // Raw PDF bytes should not embed segment id strings from structured content.
    expect(pdf.toString('latin1')).not.toMatch(/seg-qa-|sourceStartSeconds|transcriptSegmentIds/)
  })

  it('strips model-supplied provenance without failing validation', () => {
    const result = validateAndNormalizeBriefingMinutes(
      {
        purposeOfBriefing: 'Briefing covered facilities maintenance.',
        departmentExplanation: ['CIDB discussed.'],
        questionsAndAnswers: [
          {
            question: 'Closing date?',
            answer: '15 October 2026',
            sourceStartSeconds: 99,
            transcriptSegmentIds: ['seg-x'],
          },
        ],
        provenance: [
          {
            text: 'leak',
            sourceType: 'briefing_audio',
            startSeconds: 1,
            transcriptSegmentIds: ['seg-x'],
          },
        ],
        mainPointsToRemember: [{ matter: 'CIDB', detail: '4GB' }],
      },
      baseInput
    )
    expect(result.summary.provenance).toBeUndefined()
    expect(result.structuredReport.questionsAndAnswers[0]).not.toHaveProperty('sourceStartSeconds')
    expect(JSON.stringify(result.structuredReport)).not.toMatch(/seg-x|"provenance"/)
  })
})
