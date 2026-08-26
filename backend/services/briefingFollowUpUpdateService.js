/**
 * Post-briefing clarifications / addenda (Phase 3F).
 * Never mutates an approved briefing report — append-only updates with Founder review.
 */
const crypto = require('crypto')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const COLLECTION = 'briefingFollowUpUpdates'

  const UPDATE_TYPES = new Set([
  'correction',
  'clarification',
  'clarification_request',
  'site_visit_instruction',
  'revised_closing_date',
  'follow_up_note',
  'tender_addendum',
  'other',
])

const REVIEW_STATUSES = new Set(['draft', 'pending_review', 'approved', 'rejected'])

function getDb(deps = {}) {
  if (deps.db) return deps.db
  const { getFirestore } = require('../config/firebaseAdmin')
  return getFirestore()
}

function nowIso(now) {
  return (now || new Date()).toISOString()
}

function sliceStr(v, max) {
  return String(v ?? '')
    .trim()
    .slice(0, max)
}

function assertFollowUpsEnabled() {
  const { isBriefingFollowUpUpdatesEnabled } = require('../constants/briefingOpsFlags')
  if (!isBriefingFollowUpUpdatesEnabled()) {
    const err = new Error('Briefing follow-up updates are not enabled')
    err.status = 404
    throw err
  }
}

async function createFollowUpUpdate(input = {}, meta = {}, deps = {}) {
  assertFollowUpsEnabled()
  const db = getDb(deps)
  const updateType = UPDATE_TYPES.has(input.updateType) ? input.updateType : 'clarification'
  const title = sliceStr(input.title, 200)
  const content = sliceStr(input.content, 8000)
  if (!title || !content) {
    const err = new Error('title and content are required')
    err.status = 400
    throw err
  }

  const id = `bfu-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
  const ts = nowIso(meta.now)
  const record = sanitizeFirestoreData({
    id,
    privateTenderId: sliceStr(input.privateTenderId, 120) || null,
    privateSubmissionId: sliceStr(input.privateSubmissionId, 120) || null,
    briefingRequestId: sliceStr(input.briefingRequestId, 120) || null,
    organisationId: sliceStr(input.organisationId, 120) || null,
    smeId: sliceStr(input.smeId, 128) || null,
    updateType,
    title,
    content,
    attachments: Array.isArray(input.attachments) ? input.attachments.slice(0, 10) : [],
    reviewStatus: 'pending_review',
    createdByUid: sliceStr(meta.actorUid, 128) || null,
    createdByEmail: sliceStr(meta.actorEmail, 320) || null,
    createdByType: sliceStr(meta.actorType || 'founder', 40),
    createdAt: ts,
    updatedAt: ts,
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByEmail: null,
    rejectionReason: null,
    deliveredAt: null,
  })

  await db.collection(COLLECTION).doc(id).set(record)

  try {
    const { writeAuditEvent } = require('./privateTenderAuditService')
    await writeAuditEvent(
      {
        submissionId: record.privateSubmissionId || record.privateTenderId || id,
        organisationId: record.organisationId,
        actorUid: meta.actorUid || null,
        actorType: meta.actorType || 'founder',
        eventType: 'briefing_clarification_created',
        metadata: { updateId: id, updateType, briefingRequestId: record.briefingRequestId },
      },
      deps
    )
  } catch {
    /* fail-soft */
  }

  try {
    const lifeNotify = require('./briefingLifecycleNotificationService')
    if (record.createdByType === 'sme' || updateType === 'clarification_request') {
      await lifeNotify.notifyClarificationRequestedSafe(record)
    } else {
      await lifeNotify.notifyClarificationResponseSafe(record)
    }
  } catch {
    /* fail-soft */
  }

  return record
}

async function reviewFollowUpUpdate(id, action, meta = {}, deps = {}) {
  assertFollowUpsEnabled()
  const db = getDb(deps)
  const ref = db.collection(COLLECTION).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) {
    const err = new Error('Follow-up update not found')
    err.status = 404
    throw err
  }
  const current = { id: snap.id, ...snap.data() }
  const ts = nowIso(meta.now)
  let nextStatus = current.reviewStatus
  if (action === 'approve') nextStatus = 'approved'
  else if (action === 'reject') nextStatus = 'rejected'
  else {
    const err = new Error('Invalid review action')
    err.status = 400
    throw err
  }
  if (!REVIEW_STATUSES.has(nextStatus)) {
    const err = new Error('Invalid review status')
    err.status = 400
    throw err
  }

  const patch = sanitizeFirestoreData({
    reviewStatus: nextStatus,
    reviewedAt: ts,
    reviewedByUid: sliceStr(meta.actorUid, 128) || null,
    reviewedByEmail: sliceStr(meta.actorEmail, 320) || null,
    rejectionReason: action === 'reject' ? sliceStr(meta.note || meta.rejectionReason, 1000) : null,
    updatedAt: ts,
    deliveredAt: action === 'approve' ? ts : current.deliveredAt || null,
  })
  await ref.set(patch, { merge: true })

  try {
    const { writeAuditEvent } = require('./privateTenderAuditService')
    await writeAuditEvent(
      {
        submissionId: current.privateSubmissionId || current.privateTenderId || id,
        organisationId: current.organisationId,
        actorUid: meta.actorUid || null,
        actorType: 'founder',
        eventType:
          action === 'approve' ? 'briefing_clarification_approved' : 'briefing_clarification_rejected',
        metadata: { updateId: id },
      },
      deps
    )
  } catch {
    /* fail-soft */
  }

  if (action === 'approve') {
    try {
      const lifeNotify = require('./briefingLifecycleNotificationService')
      await lifeNotify.notifyFounderOpsSafe(
        lifeNotify.buildOpsSummary({
          eventType: 'clarification_resolved',
          headline: 'Clarification resolved / delivered',
          subject: `[Resolved] ${current.title || id}`,
          entityId: id,
          requestId: current.briefingRequestId,
          tenderTitle: current.title,
          detail: 'Approved clarification is available to the SME as a subsequent update.',
          idempotencyKey: lifeNotify.IdempotencyKeys.clarificationResolved(id),
        })
      )
      const txEmail = require('./transactionalEmailService')
      let request = {}
      if (current.briefingRequestId) {
        try {
          const { getStorage } = require('./storageAdapter')
          request = (await getStorage().getAttendanceRequestById?.(current.briefingRequestId)) || {}
          if (!request?.id) {
            const all = await getStorage().getAttendanceRequests({})
            request = (all || []).find((r) => r.id === current.briefingRequestId) || {}
          }
        } catch {
          request = { smeId: current.smeId, id: current.briefingRequestId }
        }
      }
      await txEmail.sendSmeClarificationAvailableEmailSafe(
        { ...current, ...patch },
        { ...request, smeId: current.smeId || request.smeId }
      )
    } catch {
      /* fail-soft */
    }
  }

  return { ...current, ...patch }
}

async function listFollowUpUpdates(filters = {}, deps = {}) {
  assertFollowUpsEnabled()
  const db = getDb(deps)
  let query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(50)
  if (filters.briefingRequestId) {
    query = db
      .collection(COLLECTION)
      .where('briefingRequestId', '==', String(filters.briefingRequestId))
      .orderBy('createdAt', 'desc')
      .limit(50)
  } else if (filters.privateTenderId) {
    query = db
      .collection(COLLECTION)
      .where('privateTenderId', '==', String(filters.privateTenderId))
      .orderBy('createdAt', 'desc')
      .limit(50)
  } else if (filters.smeId) {
    query = db
      .collection(COLLECTION)
      .where('smeId', '==', String(filters.smeId))
      .orderBy('createdAt', 'desc')
      .limit(50)
  }
  const snap = await query.get()
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (filters.reviewStatus) {
    items = items.filter((i) => i.reviewStatus === filters.reviewStatus)
  }
  if (filters.approvedOnly) {
    items = items.filter((i) => i.reviewStatus === 'approved')
  }
  return items
}

async function getFollowUpUpdateById(id, deps = {}) {
  const db = getDb(deps)
  const snap = await db.collection(COLLECTION).doc(String(id)).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() }
}

module.exports = {
  COLLECTION,
  UPDATE_TYPES,
  createFollowUpUpdate,
  reviewFollowUpUpdate,
  listFollowUpUpdates,
  getFollowUpUpdateById,
}
