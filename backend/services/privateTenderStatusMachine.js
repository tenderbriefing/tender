/**
 * Status transition helpers for private tenders (shared by Admin SDK services).
 */

const TRANSITIONS = {
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

function canTransition(from, to) {
  const allowed = TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

function canOrganisationWithdraw(status) {
  return status === 'draft' || status === 'submitted' || status === 'changes_requested'
}

const STATUS_LABELS = {
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

module.exports = {
  TRANSITIONS,
  canTransition,
  canOrganisationWithdraw,
  STATUS_LABELS,
}
