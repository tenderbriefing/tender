/**
 * Private tender submission status machine (Phase 1 + Phase 2).
 * All privileged transitions must be enforced server-side.
 */

export const PRIVATE_TENDER_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'published',
  'withdrawn',
  'rejected',
  'closed',
  'archived',
] as const

export type PrivateTenderStatus = (typeof PRIVATE_TENDER_STATUSES)[number]

/** Allowed from → to transitions. Client cannot invent others. */
export const PRIVATE_TENDER_TRANSITIONS: Record<PrivateTenderStatus, readonly PrivateTenderStatus[]> =
  {
    draft: ['submitted', 'withdrawn'],
    submitted: ['under_review', 'withdrawn', 'changes_requested', 'approved', 'rejected', 'published'],
    under_review: ['changes_requested', 'approved', 'rejected', 'published'],
    changes_requested: ['submitted', 'withdrawn'],
    approved: ['published', 'archived'],
    published: ['closed', 'archived'],
    withdrawn: ['archived'],
    rejected: ['archived'],
    closed: ['archived'],
    archived: [],
  }

export const PRIVATE_TENDER_STATUS_LABELS: Record<PrivateTenderStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  published: 'Published',
  withdrawn: 'Withdrawn',
  rejected: 'Rejected',
  closed: 'Closed',
  archived: 'Archived',
}

export function canTransitionStatus(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  if (!from || !to) return false
  const allowed = PRIVATE_TENDER_TRANSITIONS[from as PrivateTenderStatus]
  if (!allowed) return false
  return allowed.includes(to as PrivateTenderStatus)
}

/** Organisation-user withdraw eligibility (Founder handles published cancellation). */
export function canOrganisationWithdraw(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'submitted' || status === 'changes_requested'
}

export const CHANGE_REQUEST_ISSUE_CATEGORIES = [
  'missing_document',
  'incorrect_closing_date',
  'tender_reference_issue',
  'briefing_details_incomplete',
  'contact_details_incomplete',
  'formatting_data_quality',
  'other',
] as const

export type ChangeRequestIssueCategory = (typeof CHANGE_REQUEST_ISSUE_CATEGORIES)[number]
