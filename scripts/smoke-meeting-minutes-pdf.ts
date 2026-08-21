/**
 * Local controlled smoke (non-sensitive mock). Not part of production runtime.
 * Run: npx tsx scripts/smoke-meeting-minutes-pdf.ts
 */
import { writeFileSync } from 'fs'
import { MockBriefingSummaryService } from '../lib/briefing-intelligence/briefingSummaryService'
import {
  renderMeetingMinutesPdf,
  loadDefaultLogoBytes,
} from '../lib/briefing-intelligence/meetingMinutesPdf'
import { containsSpeakerLabels } from '../lib/briefing-intelligence/meetingMinutesTypes'

async function main() {
  const svc = new MockBriefingSummaryService()
  const result = await svc.summarize({
    reportId: 'TB-BR-SMOKE1',
    transcriptText: [
      'Public Service Regulations are the priority.',
      'First draft expected in October 2026.',
      'Can a consultant bid?',
      'Yes, suitably qualified consultants or companies may participate.',
      'Project may be extended by three months.',
      'How was the coffee today? Fine thanks.',
    ].join('\n'),
    transcriptSegments: [
      {
        id: 'seg-1',
        startSeconds: 0,
        endSeconds: 10,
        text: 'Public Service Regulations are the priority.',
      },
      {
        id: 'seg-2',
        startSeconds: 40,
        endSeconds: 55,
        text: 'Project may be extended by three months.',
      },
    ],
    tenderDocumentText:
      'Project duration: 6 months. Public Service Regulations must be completed within three months.',
    documentComparisonStatus: 'full',
    officialMetadata: {
      tenderTitle: 'DPSA Regulatory Support (SMOKE)',
      tenderNumber: 'SCM002-2026',
      department: 'DPSA',
      briefingDate: '2026-08-01',
      briefingVenue: 'Pretoria',
      closingDate: '2026-09-30',
      closingTime: '11:00',
      requiresBriefingCertificate: true,
    },
  })

  const logo = await loadDefaultLogoBytes()
  const pdf = await renderMeetingMinutesPdf({
    report: result.structuredReport,
    logoBytes: logo,
    attendanceImageBytes: null,
    reportId: 'TB-BR-SMOKE1',
  })
  const out = '/tmp/TenderBriefing_SCM002_2026_Briefing_Report_SMOKE.pdf'
  writeFileSync(out, pdf)

  const blob = JSON.stringify(result.structuredReport)
  console.log(
    JSON.stringify(
      {
        out,
        bytes: pdf.length,
        logoLoaded: Boolean(logo),
        amendments: result.structuredReport.amendments.length,
        hasSpeakerLabels: containsSpeakerLabels(blob),
        closingDate: result.structuredReport.closingDate,
        tenderNumber: result.structuredReport.cover.tenderNumber,
        purposeOk: result.structuredReport.purposeOfBriefing.length > 20,
        qas: result.structuredReport.questionsAndClarifications.length,
        irrelevantCoffeeExcluded: !/coffee/i.test(blob),
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
