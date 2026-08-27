import type { BriefingReportContent } from './types'
import type { StructuredMeetingMinutesReport } from './meetingMinutesTypes'
import { NOT_DISCUSSED_IN_BRIEFING } from './meetingMinutesTypes'

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
      ? minutes.amendments.map((a) => {
          const kind = a.kind ? ` [${a.kind}]` : ''
          return `${a.tenderRequirement} → ${a.briefingChange} (Implication: ${a.bidderImplication})${kind}`
        })
      : minutes.amendmentsOrChanges || []

  const qa =
    minutes.questionsAndAnswers?.length > 0
      ? minutes.questionsAndAnswers.map((q) => ({
          question: q.question,
          answer: q.answer,
          askedBy: null as string | null,
        }))
      : minutes.questionsAndClarifications.map((q) => ({
          question: q.heading,
          answer: q.summary,
          askedBy: null as string | null,
        }))

  const keyReqs = (
    minutes.keyRequirementsDiscussed?.length
      ? minutes.keyRequirementsDiscussed
      : minutes.workExpected
  ).map((requirement) => ({
    requirement,
    source: 'stated' as const,
  }))

  const keyDates = [
    ...(minutes.closingDate
      ? [{ date: minutes.closingDate, description: 'Tender closing date (official metadata)' }]
      : []),
    ...(minutes.importantDates || []).map((d) => ({
      date: d.date,
      description: d.uncertain ? `${d.description} (uncertain — verify)` : d.description,
    })),
  ]

  const actions =
    minutes.actionsForSme?.length > 0
      ? minutes.actionsForSme.map((a) => ({
          action: a.action,
          priority: 'high' as const,
          deadline: a.deadline,
        }))
      : minutes.mainPoints.map((p) => ({
          action: `${p.matter}: ${p.detail}`,
          priority: 'medium' as const,
          deadline: null as string | null,
        }))

  const complianceRisks = [
    ...(minutes.risksAndWatchOuts || []).map((r) => ({
      risk: r,
      severity: 'medium' as const,
      mitigation: null as string | null,
    })),
    ...(minutes.verificationItems || []).map((v) => ({
      risk: `Verification required: ${v.item} — ${v.reason}`,
      severity: 'high' as const,
      mitigation: null as string | null,
    })),
  ]

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
    keyRequirements: keyReqs,
    clarifications: [
      ...minutes.scopeClarifications.map((c) => ({
        question: 'Scope clarification',
        answer: c,
        source: 'stated' as const,
      })),
      ...(minutes.submissionRequirements || [])
        .filter((s) => s && s !== NOT_DISCUSSED_IN_BRIEFING)
        .map((s) => ({
          question: 'Submission requirement',
          answer: s,
          source: 'stated' as const,
        })),
    ],
    questionsAndAnswers: qa,
    changesAndAddenda: amendmentLines.map((change) => ({
      change,
      impact: null,
    })),
    complianceRisks,
    keyDates,
    recommendedActions: actions,
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
      siteInspection: minutes.technicalObservations?.length ? true : null,
      docsDistributed: null,
      importantAnnouncement: null,
      generalNotes: minutes.technicalObservations?.length
        ? minutes.technicalObservations.join(' ')
        : null,
    },
    sourceAndVerification: {
      audioRecorded: true,
      transcriptionProvider: null,
      aiModel: null,
      processingDate: minutes.cover.reportDate,
      confidenceScore: null,
    },
    importantNotice:
      'This is a TenderBriefing compulsory briefing session report summarised from the completed transcript. Always verify facts against the official tender documents. The transcript remains the source of truth.',
    reportCertification: {
      certifiedBy: 'TenderBriefing',
      certificationDate: minutes.cover.reportDate,
      reportVersion: 'meeting-minutes-v2-transcript-summary',
    },
  }
}
