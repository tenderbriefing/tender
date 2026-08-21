import type { BriefingReportContent } from './types'
import type { StructuredMeetingMinutesReport } from './meetingMinutesTypes'

/**
 * Map meeting-minutes structured content onto the existing BriefingReportContent
 * so legacy UI renderers and delivery paths remain compatible.
 */
export function meetingMinutesToBriefingReportContent(
  minutes: StructuredMeetingMinutesReport,
  reportId: string,
  opts?: { hasAttendanceEvidence?: boolean }
): BriefingReportContent {
  const hasAttendance = opts?.hasAttendanceEvidence !== false
  const amendmentLines =
    minutes.amendments?.length > 0
      ? minutes.amendments.map(
          (a) =>
            `${a.tenderRequirement} → ${a.briefingChange} (Implication: ${a.bidderImplication})`
        )
      : minutes.amendmentsOrChanges || []

  return {
    coverHeader: {
      reportId,
      tenderTitle: minutes.cover.tenderTitle,
      tenderReference: minutes.cover.tenderNumber,
      issuingEntity: minutes.cover.department,
      briefingDate: minutes.cover.briefingDate,
      briefingVenue: minutes.cover.briefingVenue,
      reportDate: minutes.cover.reportDate,
    },
    tenderDetails: {
      description: minutes.purposeOfBriefing,
      closingDate: minutes.closingDate,
      estimatedValue: null,
      category: null,
      province: null,
    },
    executiveSummary: {
      summary: minutes.purposeOfBriefing,
      keyTakeaway: minutes.mainPoints[0]
        ? `${minutes.mainPoints[0].matter}: ${minutes.mainPoints[0].detail}`
        : minutes.whatDepartmentExplained[0] || minutes.purposeOfBriefing,
    },
    keyRequirements: minutes.workExpected.map((requirement) => ({
      requirement,
      source: 'stated' as const,
    })),
    clarifications: minutes.scopeClarifications.map((c) => ({
      question: 'Scope clarification',
      answer: c,
      source: 'stated' as const,
    })),
    questionsAndAnswers: minutes.questionsAndClarifications.map((q) => ({
      question: q.heading,
      answer: q.summary,
      askedBy: null,
    })),
    changesAndAddenda: amendmentLines.map((change) => ({
      change,
      impact: null,
    })),
    complianceRisks: [],
    keyDates: [
      ...(minutes.closingDate
        ? [{ date: minutes.closingDate, description: 'Tender closing date' }]
        : []),
    ],
    recommendedActions: minutes.mainPoints.map((p) => ({
      action: `${p.matter}: ${p.detail}`,
      priority: 'medium' as const,
      deadline: null,
    })),
    attendanceInfo: {
      estimatedAttendees: null,
      agentArrivalTime: null,
      briefingDuration: null,
    },
    attendanceVerification: hasAttendance
      ? {
          verified: true,
          method: 'attendance_proof_uploaded',
          notes: minutes.attendanceNote,
          redactedAttendeeCount: null,
        }
      : {
          verified: false,
          method: 'attendance_proof_missing',
          notes: null,
          redactedAttendeeCount: null,
        },
    agentFieldObservations: {
      siteInspection: null,
      docsDistributed: null,
      importantAnnouncement: null,
      generalNotes: null,
    },
    sourceAndVerification: {
      audioRecorded: true,
      transcriptionProvider: null,
      aiModel: null,
      processingDate: minutes.cover.reportDate,
      confidenceScore: null,
    },
    importantNotice:
      'This is a TenderBriefing compulsory briefing session report. Always verify facts against the official tender documents.',
    reportCertification: {
      certifiedBy: 'TenderBriefing',
      certificationDate: minutes.cover.reportDate,
      reportVersion: 'meeting-minutes-v1',
    },
  }
}
