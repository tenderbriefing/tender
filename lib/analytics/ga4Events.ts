import { analyticsService } from '@/lib/services/analyticsService'

/** TenderBriefing GA4 event names (NEXT_PUBLIC_GA_MEASUREMENT_ID required). */

export function trackTenderViewed(tenderId: string, tenderTitle?: string) {
  analyticsService.trackEvent({
    action: 'tender_viewed',
    category: 'procurement',
    label: tenderTitle,
    custom_parameters: { tender_id: tenderId },
  })
}

export function trackAttendanceRequested(requestId: string, tenderId: string) {
  analyticsService.trackEvent({
    action: 'attendance_requested',
    category: 'procurement',
    custom_parameters: { request_id: requestId, tender_id: tenderId },
  })
}

export function trackAgentAccepted(requestId: string, agentId: string) {
  analyticsService.trackEvent({
    action: 'agent_accepted',
    category: 'procurement',
    custom_parameters: { request_id: requestId, agent_id: agentId },
  })
}

export function trackReportUploaded(requestId: string, reportId: string) {
  analyticsService.trackEvent({
    action: 'report_uploaded',
    category: 'procurement',
    custom_parameters: { request_id: requestId, report_id: reportId },
  })
}
