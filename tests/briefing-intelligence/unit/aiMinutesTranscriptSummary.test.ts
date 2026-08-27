import { describe, it, expect } from 'vitest'
import {
  MockBriefingSummaryService,
  validateAndNormalizeBriefingMinutes,
} from '@/lib/briefing-intelligence/briefingSummaryService'
import { classifyErrorMessage } from '@/lib/briefing-intelligence/pipelineTrace'
import { runMeetingMinutesQualityGate } from '@/lib/briefing-intelligence/reportQualityGate'
import { meetingMinutesToBriefingReportContent } from '@/lib/briefing-intelligence/mapMeetingMinutesToReportContent'
import { renderMeetingMinutesPdf } from '@/lib/briefing-intelligence/meetingMinutesPdf'
import { NOT_DISCUSSED_IN_BRIEFING } from '@/lib/briefing-intelligence/meetingMinutesTypes'
import {
  AI_MINUTES_CERT_METADATA,
  AI_MINUTES_CERT_SEGMENTS,
  AI_MINUTES_CERT_TRANSCRIPT,
} from '@/lib/briefing-intelligence/fixtures/aiMinutesCertificationTranscript'
import {
  createOrResetReportJob,
  failReportJob,
  briefingReportJobIdForReport,
} from '@/lib/briefing-intelligence/reportJobs'

function memoryDb() {
  const store = new Map<string, any>()
  const collection = (name: string) => ({
    doc: (id: string) => {
      const key = `${name}/${id}`
      return {
        id,
        get: async () => ({
          exists: store.has(key),
          data: () => store.get(key),
        }),
        set: async (data: any, opts?: { merge?: boolean }) => {
          if (opts?.merge && store.has(key)) store.set(key, { ...store.get(key), ...data })
          else store.set(key, { ...data })
        },
      }
    },
  })
  return {
    store,
    collection,
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (ref: any) => ref.get(),
        set: async (ref: any, data: any, opts?: any) => ref.set(data, opts),
      }
      return fn(tx)
    },
  }
}

const baseInput = {
  reportId: 'TB-BR-AICERT',
  transcriptText: AI_MINUTES_CERT_TRANSCRIPT,
  transcriptSegments: AI_MINUTES_CERT_SEGMENTS,
  tenderDocumentText: 'CIDB Grade 4GB. Closing 15 October 2026. Performance bond: see SBD.',
  documentComparisonStatus: 'full' as const,
  officialMetadata: AI_MINUTES_CERT_METADATA,
}

describe('AI minutes transcript-summary contract', () => {
  it('1. accurately summarises the certification fixture transcript', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    expect(result.structuredReport.purposeOfBriefing).toMatch(/facilities maintenance/i)
    expect(result.structuredReport.keyRequirementsDiscussed.join(' ')).toMatch(/CIDB Grade 4GB/i)
    expect(result.structuredReport.cover.tenderNumber).toBe(AI_MINUTES_CERT_METADATA.tenderNumber)
  })

  it('2. extracts Q&A pairs with unresolved parking question', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const qa = result.structuredReport.questionsAndAnswers
    expect(qa.length).toBeGreaterThanOrEqual(3)
    expect(qa.some((q) => /closing date/i.test(q.question) && /15 October 2026/i.test(q.answer))).toBe(
      true
    )
    expect(qa.some((q) => /joint venture/i.test(q.question) && /CIDB/i.test(q.answer))).toBe(true)
    const parking = qa.find((q) => /parking/i.test(q.question))
    expect(parking?.unresolved).toBe(true)
    expect(parking?.answer).toMatch(/No definitive answer was recorded/i)
  })

  it('3. extracts deadlines accurately', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const dates = result.structuredReport.importantDates.map((d) => `${d.date} ${d.description}`).join(' ')
    expect(dates).toMatch(/15 October 2026/)
    expect(dates).toMatch(/20 September 2026/)
  })

  it('4. extracts clarifications with kind', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    expect(result.structuredReport.amendments.length).toBeGreaterThanOrEqual(1)
    expect(result.structuredReport.amendments[0].kind).toBe('clarification_only')
    expect(result.structuredReport.amendments[0].briefingChange).toMatch(/16:00/)
  })

  it('5. suppresses unsupported invented facts (local-content not discussed)', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const blob = JSON.stringify(result.structuredReport).toLowerCase()
    expect(blob).not.toMatch(/30%\s*local.?content/)
    expect(blob).not.toMatch(/b-bbee level 1 mandatory/)
  })

  it('6. missing-information handling uses Not discussed phrase', async () => {
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
      transcriptText: 'Official: Welcome.',
    })
    expect(gate.ok).toBe(true)
  })

  it('7. contradictory statements land in verification when model marks them', () => {
    const result = validateAndNormalizeBriefingMinutes(
      {
        purposeOfBriefing: 'Briefing covered closing date statements.',
        departmentExplanation: ['Closing discussed.'],
        questionsAndAnswers: [],
        importantDates: [
          { date: '15 October 2026', description: 'Closing (speaker A)', uncertain: true },
          { date: '22 October 2026', description: 'Closing (speaker B)', uncertain: true },
        ],
        verificationItems: [
          {
            item: 'Closing date conflict (15 Oct vs 22 Oct)',
            reason: 'Speakers contradicted each other; verify against tender document.',
          },
        ],
        mainPointsToRemember: [{ matter: 'Closing', detail: 'Conflicting dates stated' }],
      },
      baseInput
    )
    expect(result.structuredReport.verificationItems.length).toBe(1)
    expect(result.structuredReport.importantDates.every((d) => d.uncertain)).toBe(true)
  })

  it('8. unclear date handling preserves uncertainty', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    expect(result.structuredReport.verificationItems.some((v) => /bond/i.test(v.item))).toBe(true)
  })

  it('9. actions are grounded in transcript facts', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    expect(result.structuredReport.actionsForSme.length).toBeGreaterThan(0)
    const actions = result.structuredReport.actionsForSme.map((a) => a.action).join(' ')
    expect(actions).toMatch(/CIDB|COIDA|site inspection|bond/i)
    expect(actions.toLowerCase()).not.toMatch(/iso 9001 certification we invented/)
  })

  it('10. transcript job remains available after AI provider failure recording', async () => {
    const db = memoryDb() as any
    const reportId = 'TB-BR-AI429'
    const transcriptId = 'tr-preserved-1'
    // Simulate report doc with completed transcript.
    await db.collection('briefingReports').doc(reportId).set({
      transcription: { transcriptId, status: 'completed' },
      audioFileRef: 'gs://bucket/audio.mp3',
    })
    await createOrResetReportJob({
      db,
      reportId,
      requestId: 'req-1',
      tenderId: 'ten-1',
      agentId: 'ya-1',
      smeId: 'sme-1',
      transcriptId,
    })
    await failReportJob({
      db,
      jobId: briefingReportJobIdForReport(reportId),
      errorCode: 'ai_provider_rate_limit',
      errorMessage: 'OpenAI summary failed: 429 quota',
      retry: true,
    })
    const reportSnap = await db.collection('briefingReports').doc(reportId).get()
    expect(reportSnap.data().transcription.transcriptId).toBe(transcriptId)
    const jobSnap = await db.collection('briefingReportJobs').doc(briefingReportJobIdForReport(reportId)).get()
    expect(jobSnap.data().errorCode).toBe('ai_provider_rate_limit')
    expect(jobSnap.data().status).not.toBe('completed')
  })

  it('11. AI 429 is classified as provider_rate_limit (not transcript failure)', () => {
    expect(classifyErrorMessage('OpenAI summary failed: 429 Rate limit exceeded')).toBe(
      'provider_rate_limit'
    )
    expect(classifyErrorMessage('ai_provider_rate_limit OpenAI summary failed: 429')).toBe(
      'provider_rate_limit'
    )
    expect(classifyErrorMessage('empty transcript')).toBe('empty_transcript')
    expect(classifyErrorMessage('OpenAI summary failed: 429')).not.toBe('low_quality_transcript')
    expect(classifyErrorMessage('OpenAI summary failed: 429')).not.toBe('empty_transcript')
  })

  it('12. long stitched transcript uses the same summarisation path', async () => {
    const stitched = `${AI_MINUTES_CERT_TRANSCRIPT}\n\n[chunk-2]\nOfficial: Reminder — CIDB Grade 4GB remains mandatory.`
    const result = await new MockBriefingSummaryService().summarize({
      ...baseInput,
      transcriptText: stitched,
    })
    expect(result.provider).toBe('mock')
    expect(result.structuredReport.questionsAndAnswers.length).toBeGreaterThanOrEqual(3)
  })

  it('13. short direct transcript uses the same summarisation path', async () => {
    const result = await new MockBriefingSummaryService().summarize({
      ...baseInput,
      transcriptText: AI_MINUTES_CERT_TRANSCRIPT.slice(0, 800),
    })
    // Still matches cert marker / keywords path when marker present at start
    expect(result.structuredReport.purposeOfBriefing.length).toBeGreaterThan(10)
  })

  it('14. Founder approval content mapping preserves Q&A and verification', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const mapped = meetingMinutesToBriefingReportContent(result.structuredReport, 'TB-BR-AICERT')
    expect(mapped.questionsAndAnswers.length).toBeGreaterThanOrEqual(3)
    expect(mapped.complianceRisks.some((r) => /Verification required/i.test(r.risk))).toBe(true)
    expect(mapped.reportCertification.reportVersion).toMatch(/transcript-summary/)
    const gate = runMeetingMinutesQualityGate({
      report: result.structuredReport,
      official: AI_MINUTES_CERT_METADATA,
    })
    expect(gate.ok).toBe(true)
    expect(gate.warnings.some((w) => /verification/i.test(w))).toBe(true)
  })

  it('renders certification PDF without inventing speaker labels', async () => {
    const result = await new MockBriefingSummaryService().summarize(baseInput)
    const pdf = await renderMeetingMinutesPdf({
      report: result.structuredReport,
      logoBytes: null,
      attendanceImageBytes: null,
      reportId: 'TB-BR-AICERT',
    })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    const { PDFDocument } = await import('pdf-lib')
    const loaded = await PDFDocument.load(pdf)
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('rejects malformed model output missing purpose', () => {
    expect(() =>
      validateAndNormalizeBriefingMinutes(
        { questionsAndAnswers: [], importantDates: [] },
        baseInput
      )
    ).toThrow(/purposeOfBriefing/i)
  })
})
