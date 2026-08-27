import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  MockBriefingSummaryService,
} from '@/lib/briefing-intelligence/briefingSummaryService'
import {
  containsSpeakerLabels,
  stripSpeakerLabels,
} from '@/lib/briefing-intelligence/meetingMinutesTypes'
import { renderMeetingMinutesPdf, sanitizeReportFileName } from '@/lib/briefing-intelligence/meetingMinutesPdf'
import {
  isBriefingAiReportGenerationEnabled,
  briefingReportPromptVersion,
} from '@/lib/briefing-intelligence/featureFlag'
import {
  createOrResetReportJob,
  claimReportJob,
  failReportJob,
  briefingReportJobIdForReport,
} from '@/lib/briefing-intelligence/reportJobs'
import { REPORT_GENERATION_MAX_ATTEMPTS } from '@/lib/briefing-intelligence/featureFlag'

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

describe('meeting minutes summary + PDF', () => {
  const prevReport = process.env.BRIEFING_AI_REPORT_GENERATION_ENABLED
  const prevProvider = process.env.BRIEFING_INTELLIGENCE_PROVIDER

  afterEach(() => {
    if (prevReport === undefined) delete process.env.BRIEFING_AI_REPORT_GENERATION_ENABLED
    else process.env.BRIEFING_AI_REPORT_GENERATION_ENABLED = prevReport
    if (prevProvider === undefined) delete process.env.BRIEFING_INTELLIGENCE_PROVIDER
    else process.env.BRIEFING_INTELLIGENCE_PROVIDER = prevProvider
  })

  it('feature flag is fail-closed and independent', () => {
    delete process.env.BRIEFING_AI_REPORT_GENERATION_ENABLED
    expect(isBriefingAiReportGenerationEnabled()).toBe(false)
    expect(isBriefingAiReportGenerationEnabled('true')).toBe(true)
    expect(briefingReportPromptVersion('v2')).toBe('v2')
  })

  it('strips speaker labels and rejects them in client text helpers', () => {
    expect(stripSpeakerLabels('Speaker 1 said hello')).toBe('said hello')
    expect(containsSpeakerLabels('Speaker 2: question')).toBe(true)
    expect(containsSpeakerLabels('The Department clarified.')).toBe(false)
  })

  it('mock DPSA-style summary has no speaker labels and preserves key themes', async () => {
    const svc = new MockBriefingSummaryService()
    const result = await svc.summarize({
      reportId: 'TB-BR-DPSA1',
      transcriptText: [
        'Speaker 1: Public Service Regulations are the priority.',
        'Speaker 2: Can a consultant bid?',
        'The first draft is expected in October 2026.',
        'PAMA regulations may need longer consultation.',
        'Six months with possible three month extension.',
        'Amendment Act requirements.',
      ].join('\n'),
      transcriptSegments: [
        { id: 'seg-1', startSeconds: 0, endSeconds: 10, text: 'Public Service Regulations are the priority.' },
        { id: 'seg-2', startSeconds: 10, endSeconds: 20, text: 'Can a consultant bid?' },
      ],
      tenderDocumentText: 'Project duration: 6 months. Public Service Regulations within three months.',
      officialMetadata: {
        tenderTitle: 'DPSA Regulatory Support',
        tenderNumber: 'SCM002-2026',
        department: 'DPSA',
        briefingDate: '2026-08-01',
        briefingVenue: 'Pretoria',
        closingDate: '2026-09-30',
        closingTime: '11:00',
        requiresBriefingCertificate: true,
      },
    })

    const blob = JSON.stringify(result.structuredReport)
    expect(containsSpeakerLabels(blob)).toBe(false)
    expect(result.structuredReport.purposeOfBriefing.length).toBeGreaterThan(20)
    expect(result.structuredReport.cover.tenderNumber).toBe('SCM002-2026')
    expect(result.structuredReport.closingDate).toBe('2026-09-30')
    expect(result.structuredReport.whatDepartmentExplained.join(' ')).toMatch(/Public Service Regulations/i)
    expect(result.structuredReport.questionsAndClarifications.some((q) => /consultant/i.test(q.heading))).toBe(
      true
    )
    expect(result.structuredReport.durationAndTimelines).toMatch(/six months/i)
    expect(result.structuredReport.briefingCertificateNote).toBeTruthy()
    expect(result.promptVersion).toBeTruthy()
    expect(result.structuredReport.amendments.length).toBeGreaterThanOrEqual(1)
    expect(result.structuredReport.amendments[0].tenderRequirement).toBeTruthy()
    expect(result.structuredReport.amendments[0].briefingChange).toBeTruthy()
    expect(result.structuredReport.amendments[0].bidderImplication).toBeTruthy()
    expect(result.structuredReport.amendmentsNoneMessage).toBeNull()
  })

  it('states no material amendments when none supported', async () => {
    const svc = new MockBriefingSummaryService()
    const result = await svc.summarize({
      reportId: 'TB-BR-NONE',
      transcriptText: 'General overview of the tender requirements was provided.',
      transcriptSegments: [],
      tenderDocumentText: 'Duration 6 months',
      documentComparisonStatus: 'metadata_only',
      officialMetadata: {
        tenderTitle: 'General Tender',
        tenderNumber: 'GEN-1',
        department: 'Dept',
        briefingDate: '2026-01-01',
        briefingVenue: 'JHB',
        closingDate: null,
        closingTime: null,
      },
    })
    expect(result.structuredReport.amendments).toEqual([])
    expect(result.structuredReport.amendmentsNoneMessage).toMatch(/No material amendments/i)
    expect(result.structuredReport.documentComparisonStatus).toBe('metadata_only')
  })

  it('official metadata wins over contradictory model cover fields', async () => {
    const svc = new MockBriefingSummaryService()
    const result = await svc.summarize({
      reportId: 'TB-BR-META',
      transcriptText: 'Public Service Regulations priority October draft PAMA amendment',
      transcriptSegments: [],
      tenderDocumentText: '',
      officialMetadata: {
        tenderTitle: 'Official Title',
        tenderNumber: 'OFF-1',
        department: 'Official Dept',
        briefingDate: '2026-01-15',
        briefingVenue: 'Cape Town',
        closingDate: '2026-02-01',
        closingTime: '10:00',
      },
    })
    expect(result.structuredReport.cover.tenderTitle).toBe('Official Title')
    expect(result.structuredReport.cover.department).toBe('Official Dept')
    expect(result.structuredReport.closingDate).toBe('2026-02-01')
  })

  it('renders PDF with branding footer and no speaker labels', async () => {
    const svc = new MockBriefingSummaryService()
    const result = await svc.summarize({
      reportId: 'TB-BR-PDF1',
      transcriptText: 'Public Service Regulations are the priority. First draft October. PAMA.',
      transcriptSegments: [],
      tenderDocumentText: 'Duration 6 months',
      officialMetadata: {
        tenderTitle: 'Demo Tender',
        tenderNumber: 'SCM002_2026',
        department: 'DPSA',
        briefingDate: '2026-08-01',
        briefingVenue: 'Pretoria',
        closingDate: '2026-09-30',
        closingTime: null,
      },
    })
    const pdf = await renderMeetingMinutesPdf({
      report: result.structuredReport,
      logoBytes: null,
      attendanceImageBytes: null,
      reportId: 'TB-BR-PDF1',
    })
    expect(pdf.length).toBeGreaterThan(500)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    const { PDFDocument } = await import('pdf-lib')
    const loaded = await PDFDocument.load(pdf)
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(loaded.getPageCount()).toBeLessThanOrEqual(8)
    expect(containsSpeakerLabels(JSON.stringify(result.structuredReport))).toBe(false)
    expect(sanitizeReportFileName({ tenderNumber: 'SCM002/2026', reportId: 'x' })).toBe(
      'TenderBriefing_SCM002_2026_Briefing_Report.pdf'
    )
  })

  it('report job retries then fails after max attempts', async () => {
    const db = memoryDb() as any
    const reportId = 'TB-BR-JOB1'
    const job = await createOrResetReportJob({
      db,
      reportId,
      requestId: 'req-1',
      tenderId: 't-1',
      agentId: 'a-1',
      smeId: 's-1',
      transcriptId: 'bt-1',
    })
    expect(job.id).toBe(briefingReportJobIdForReport(reportId))

    for (let i = 0; i < REPORT_GENERATION_MAX_ATTEMPTS; i++) {
      const claimed = await claimReportJob(db, job.id)
      expect(claimed).not.toBeNull()
      const failed = await failReportJob({
        db,
        jobId: job.id,
        errorCode: 'timeout',
        errorMessage: 'temporary',
        retry: true,
      })
      if (i < REPORT_GENERATION_MAX_ATTEMPTS - 1) expect(failed?.status).toBe('retrying')
      else expect(failed?.status).toBe('failed')
    }
  })

  it('idempotent job create for same transcript when completed', async () => {
    const db = memoryDb() as any
    const a = await createOrResetReportJob({
      db,
      reportId: 'TB-BR-JOB2',
      requestId: 'req-2',
      tenderId: 't-2',
      agentId: 'a-2',
      smeId: 's-2',
      transcriptId: 'bt-2',
    })
    await claimReportJob(db, a.id)
    await db.collection('briefingReportJobs').doc(a.id).set(
      { status: 'completed', transcriptId: 'bt-2', reportVersionId: 'v1' },
      { merge: true }
    )
    const b = await createOrResetReportJob({
      db,
      reportId: 'TB-BR-JOB2',
      requestId: 'req-2',
      tenderId: 't-2',
      agentId: 'a-2',
      smeId: 's-2',
      transcriptId: 'bt-2',
    })
    expect(b.status).toBe('completed')
  })
})
