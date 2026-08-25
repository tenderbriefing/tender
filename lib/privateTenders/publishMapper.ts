import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { PRIVATE_TENDER_SOURCE } from './constants'
import type { PrivateTenderSubmission } from './types'

/**
 * Map an approved private submission into the canonical tenderBriefings shape.
 * visibility stays public so catalogue/SEO work; sourceType distinguishes sector.
 */
export function mapSubmissionToCanonicalTender(
  submission: PrivateTenderSubmission,
  options: { publishedTenderId?: string; now?: Date } = {}
): TenderBriefing {
  const now = (options.now || new Date()).toISOString()
  const id =
    options.publishedTenderId ||
    submission.publishedTenderId ||
    `priv-${submission.id}`

  const documents = [
    ...(submission.tenderDocument
      ? [
          {
            id: 'tender-document',
            title: submission.tenderDocument.fileName || 'Tender document',
            url: `/api/tenders/${id}/documents/tender-document`,
            format: submission.tenderDocument.contentType,
            datePublished: submission.submittedAt || now,
          },
        ]
      : []),
    ...(submission.supportingDocuments || []).map((doc, index) => ({
      id: `supporting-${index + 1}`,
      title: doc.fileName || `Supporting document ${index + 1}`,
      url: `/api/tenders/${id}/documents/supporting-${index + 1}`,
      format: doc.contentType,
      datePublished: doc.uploadedAt || now,
    })),
  ]

  const requirements: string[] = []
  if (submission.eligibilityRequirements) requirements.push(submission.eligibilityRequirements)
  if (submission.submissionInstructions) {
    requirements.push(`Submission instructions: ${submission.submissionInstructions}`)
  }
  if (submission.briefingInstructions) {
    requirements.push(`Briefing instructions: ${submission.briefingInstructions}`)
  }

  return {
    id,
    ocid: `private-${submission.id}`,
    tenderNumber: submission.tenderReference,
    title: submission.title,
    description: submission.description,
    department: submission.companyName,
    buyer: submission.companyName,
    province: submission.province,
    category: submission.category,
    industrySector: submission.category,
    industryConfidence: 1,
    procurementMethod: 'private_sector',
    status: 'active',
    publishedDate: now.slice(0, 10),
    closingDate: submission.closingDate,
    briefingDate: submission.briefingDate,
    briefingTime: submission.briefingTime,
    briefingVenue: submission.briefingVenue,
    briefingCompulsory: true,
    briefingConfidence: 1,
    matchedBriefingTerms: ['compulsory', 'private sector'],
    contactPerson:
      submission.procurementContactName || submission.contactPersonName || '',
    contactEmail:
      submission.procurementContactEmail || submission.contactEmail || '',
    contactPhone:
      submission.procurementContactPhone || submission.contactPhone || '',
    meetingLink: submission.meetingLink || '',
    documents,
    detailUrl: `/tenders/${id}`,
    summary: submission.description.slice(0, 280),
    requirements,
    risks: [],
    keyDates: [
      {
        label: 'Compulsory briefing',
        date: submission.briefingDate,
        time: submission.briefingTime,
      },
      {
        label: 'Closing',
        date: submission.closingDate,
        time: submission.closingTime || undefined,
      },
    ],
    recommendedFor: [],
    opportunityScore: 0,
    calendarEvents: [],
    history: [
      {
        field: 'published',
        from: null,
        to: 'private_sector',
        changedAt: now,
      },
    ],
    source: PRIVATE_TENDER_SOURCE,
    sourceType: 'private',
    visibility: 'public',
    privateSubmissionId: submission.id,
    lastSyncedAt: now,
    scrapedAt: now,
    deliveryLocation: submission.municipality || submission.briefingVenue || '',
  } as TenderBriefing
}

export function isPrivateSectorTender(
  tender: Pick<TenderBriefing, 'sourceType' | 'source'> | null | undefined
): boolean {
  if (!tender) return false
  if (tender.sourceType === 'private') return true
  return tender.source === PRIVATE_TENDER_SOURCE
}
