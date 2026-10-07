/**
 * Founder operational email delivery observability (Resend).
 *
 * Correlates Resend lifecycle webhooks with founder-ops notification ledger docs.
 * Observational only — never mutates registration / payment / briefing authority.
 *
 * Collections (Admin SDK only):
 *   notifications/founder-ops-idem-*     — canonical ledger (authoritative)
 *   founderOpsEmailByProviderId/{id}    — O(1) correlation index
 *   resendWebhookEvents/{svix-id}       — webhook idempotency (TTL via expireAt)
 *   resendWebhookPending/{email_id}     — race buffer when ledger not yet correlated
 */

const { Resend } = require('resend')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const LOG_PREFIX = '[founderOpsEmailDelivery]'
const LEDGER_COLLECTION = 'notifications'
const INDEX_COLLECTION = 'founderOpsEmailByProviderId'
const WEBHOOK_EVENTS_COLLECTION = 'resendWebhookEvents'
const PENDING_COLLECTION = 'resendWebhookPending'

/** Bounded retention for temporary webhook processing docs (days). */
const WEBHOOK_RETENTION_DAYS = 30

const DELIVERY_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  SENT: 'sent',
  DELAYED: 'delayed',
  DELIVERED: 'delivered',
  BOUNCED: 'bounced',
  COMPLAINED: 'complained',
  FAILED: 'failed',
})

const STATUS_RANK = Object.freeze({
  [DELIVERY_STATUS.ACCEPTED]: 10,
  [DELIVERY_STATUS.SENT]: 20,
  [DELIVERY_STATUS.DELAYED]: 25,
  [DELIVERY_STATUS.DELIVERED]: 40,
  [DELIVERY_STATUS.BOUNCED]: 50,
  [DELIVERY_STATUS.FAILED]: 50,
  [DELIVERY_STATUS.COMPLAINED]: 55,
})

const TERMINAL_STATUSES = new Set([
  DELIVERY_STATUS.DELIVERED,
  DELIVERY_STATUS.BOUNCED,
  DELIVERY_STATUS.COMPLAINED,
  DELIVERY_STATUS.FAILED,
])

/** Official Resend email lifecycle events we process for Founder ops. */
const RESEND_EVENT_TO_STATUS = Object.freeze({
  'email.sent': DELIVERY_STATUS.SENT,
  'email.delivered': DELIVERY_STATUS.DELIVERED,
  'email.delivery_delayed': DELIVERY_STATUS.DELAYED,
  'email.bounced': DELIVERY_STATUS.BOUNCED,
  'email.complained': DELIVERY_STATUS.COMPLAINED,
  'email.failed': DELIVERY_STATUS.FAILED,
})

const FOUNDER_OPS_CHANNELS = Object.freeze([
  'founder_ops_registration',
  'founder_ops_attendance_created',
  'founder_ops_attendance_paid',
])

const EVENT_LABELS = Object.freeze({
  SME_REGISTERED: 'SME Registration',
  YOUTH_AGENT_REGISTERED: 'Youth Agent Registration',
  PAYMENT_CONFIRMED: 'Payment',
  BRIEFING_CONFIRMED: 'Briefing',
})

function sliceStr(value, max = 200) {
  return String(value || '').trim().slice(0, max)
}

function nowIso() {
  return new Date().toISOString()
}

function expireAtDate(days = WEBHOOK_RETENTION_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function safeDocId(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .slice(0, 150)
}

function defaultGetFirestore() {
  const { getFirestore } = require('../config/firebaseAdmin')
  return getFirestore()
}

function canTransition(fromStatus, toStatus) {
  if (!toStatus || !STATUS_RANK[toStatus]) return false
  if (!fromStatus) return true
  if (fromStatus === toStatus) return false
  if (TERMINAL_STATUSES.has(fromStatus)) return false
  return STATUS_RANK[toStatus] > (STATUS_RANK[fromStatus] || 0)
}

function mapResendEventToStatus(eventType) {
  return RESEND_EVENT_TO_STATUS[String(eventType || '').trim()] || null
}

function statusTimestampField(status) {
  switch (status) {
    case DELIVERY_STATUS.ACCEPTED:
      return 'emailAcceptedAt'
    case DELIVERY_STATUS.SENT:
      return 'emailSentAt'
    case DELIVERY_STATUS.DELIVERED:
      return 'emailDeliveredAt'
    case DELIVERY_STATUS.DELAYED:
      return 'emailDelayedAt'
    case DELIVERY_STATUS.BOUNCED:
      return 'emailBouncedAt'
    case DELIVERY_STATUS.COMPLAINED:
      return 'emailComplainedAt'
    case DELIVERY_STATUS.FAILED:
      return 'emailFailedAt'
    default:
      return null
  }
}

function buildAcceptanceFields({
  providerMessageId,
  recipients,
  subject,
  eventType,
  acceptedAt,
}) {
  const at = acceptedAt || nowIso()
  return {
    emailProvider: 'resend',
    providerMessageId: sliceStr(providerMessageId, 128),
    emailAcceptedAt: at,
    deliveryStatus: DELIVERY_STATUS.ACCEPTED,
    deliveryStatusUpdatedAt: at,
    founderOpsDelivery: true,
    recipient: sliceStr((recipients && recipients[0]) || '', 120),
    recipients: (recipients || []).map((r) => sliceStr(r, 120)).slice(0, 5),
    subject: sliceStr(subject, 180),
    eventType: sliceStr(eventType, 64) || null,
  }
}

/**
 * Persist Resend acceptance onto the ledger + correlation index.
 * Fail-soft: throws are caught by caller; never rolls back business events.
 */
async function recordResendAcceptance(ledgerRef, fields, deps = {}) {
  const getDb = deps.getFirestore || defaultGetFirestore
  const db = getDb()
  const providerMessageId = sliceStr(fields.providerMessageId, 128)
  if (!providerMessageId) {
    return { ok: false, error: 'missing_provider_message_id' }
  }

  const acceptance = buildAcceptanceFields(fields)
  await ledgerRef.set(sanitizeFirestoreData(acceptance), { merge: true })

  try {
    await db
      .collection(INDEX_COLLECTION)
      .doc(safeDocId(providerMessageId))
      .set(
        sanitizeFirestoreData({
          providerMessageId,
          ledgerDocId: ledgerRef.id,
          idempotencyKey: fields.idempotencyKey || null,
          eventType: acceptance.eventType,
          createdAt: acceptance.emailAcceptedAt,
        }),
        { merge: true }
      )
  } catch (err) {
    console.error(
      `${LOG_PREFIX} index write failed:`,
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
  }

  try {
    await reconcilePendingForMessage(providerMessageId, { getFirestore: () => db })
  } catch (err) {
    console.error(
      `${LOG_PREFIX} pending reconcile failed:`,
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
  }

  return { ok: true, providerMessageId, deliveryStatus: DELIVERY_STATUS.ACCEPTED }
}

async function findLedgerByProviderMessageId(db, providerMessageId) {
  const id = safeDocId(providerMessageId)
  if (!id) return null
  const idx = await db.collection(INDEX_COLLECTION).doc(id).get()
  if (idx.exists && idx.data()?.ledgerDocId) {
    const ref = db.collection(LEDGER_COLLECTION).doc(String(idx.data().ledgerDocId))
    const snap = await ref.get()
    if (snap.exists) return { ref, data: snap.data() || {}, id: snap.id }
  }
  // Fallback query (bounded) if index missing
  const q = await db
    .collection(LEDGER_COLLECTION)
    .where('providerMessageId', '==', sliceStr(providerMessageId, 128))
    .where('founderOpsDelivery', '==', true)
    .limit(1)
    .get()
  if (!q.empty) {
    const doc = q.docs[0]
    return { ref: doc.ref, data: doc.data() || {}, id: doc.id }
  }
  return null
}

async function applyStatusToLedger(ledgerRef, current, status, eventMeta = {}) {
  if (!canTransition(current.deliveryStatus, status)) {
    return { applied: false, reason: 'noop_or_blocked', deliveryStatus: current.deliveryStatus || null }
  }
  const at = eventMeta.occurredAt || nowIso()
  const tsField = statusTimestampField(status)
  const patch = {
    deliveryStatus: status,
    deliveryStatusUpdatedAt: at,
    lastWebhookEventType: sliceStr(eventMeta.eventType, 64) || null,
    lastWebhookEventId: sliceStr(eventMeta.providerEventId, 128) || null,
  }
  if (tsField) patch[tsField] = at
  await ledgerRef.set(sanitizeFirestoreData(patch), { merge: true })
  return { applied: true, deliveryStatus: status }
}

async function storePendingWebhook(db, providerMessageId, event) {
  const ref = db.collection(PENDING_COLLECTION).doc(safeDocId(providerMessageId))
  const existing = await ref.get()
  const prev = existing.exists ? existing.data() || {} : {}
  const nextStatus = event.status
  const prevBest = prev.bestStatus || null
  const shouldUpgrade = canTransition(prevBest, nextStatus) || !prevBest

  const payload = sanitizeFirestoreData({
    providerMessageId: sliceStr(providerMessageId, 128),
    bestStatus: shouldUpgrade ? nextStatus : prevBest,
    bestRank: shouldUpgrade ? STATUS_RANK[nextStatus] : prev.bestRank || 0,
    lastEventType: event.eventType,
    lastProviderEventId: event.providerEventId,
    lastOccurredAt: event.occurredAt,
    reconciled: false,
    updatedAt: nowIso(),
    createdAt: prev.createdAt || nowIso(),
    expireAt: expireAtDate(),
  })
  await ref.set(payload, { merge: true })
  return { pending: true, bestStatus: payload.bestStatus }
}

async function reconcilePendingForMessage(providerMessageId, deps = {}) {
  const getDb = deps.getFirestore || defaultGetFirestore
  const db = getDb()
  const pendingRef = db.collection(PENDING_COLLECTION).doc(safeDocId(providerMessageId))
  const pendingSnap = await pendingRef.get()
  if (!pendingSnap.exists) return { reconciled: false, reason: 'no_pending' }

  const pending = pendingSnap.data() || {}
  if (pending.reconciled) return { reconciled: false, reason: 'already_reconciled' }

  const ledger = await findLedgerByProviderMessageId(db, providerMessageId)
  if (!ledger) return { reconciled: false, reason: 'ledger_not_ready' }

  const status = pending.bestStatus
  if (status && STATUS_RANK[status]) {
    await applyStatusToLedger(ledger.ref, ledger.data, status, {
      eventType: pending.lastEventType,
      providerEventId: pending.lastProviderEventId,
      occurredAt: pending.lastOccurredAt || nowIso(),
    })
  }

  await pendingRef.set(
    sanitizeFirestoreData({
      reconciled: true,
      reconciledAt: nowIso(),
      ledgerDocId: ledger.id,
      expireAt: expireAtDate(),
    }),
    { merge: true }
  )
  return { reconciled: true, ledgerDocId: ledger.id, deliveryStatus: status || null }
}

/**
 * Verify Resend/Svix webhook using Resend SDK (Standard Webhooks).
 * Requires raw body string + svix headers + RESEND_WEBHOOK_SECRET.
 */
function verifyResendWebhook({
  rawBody,
  svixId,
  svixTimestamp,
  svixSignature,
  webhookSecret,
  ResendCtor = Resend,
}) {
  const secret = String(webhookSecret || '').trim()
  if (!secret) {
    return { ok: false, error: 'webhook_secret_missing', statusCode: 503 }
  }
  if (!rawBody || !svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, error: 'missing_signature_headers', statusCode: 400 }
  }
  try {
    const resend = new ResendCtor('re_verify_unused')
    const payload = resend.webhooks.verify({
      payload: String(rawBody),
      headers: {
        id: String(svixId),
        timestamp: String(svixTimestamp),
        signature: String(svixSignature),
      },
      webhookSecret: secret,
    })
    return { ok: true, payload }
  } catch {
    return { ok: false, error: 'invalid_signature', statusCode: 401 }
  }
}

async function claimWebhookEvent(db, providerEventId, meta = {}) {
  const ref = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(safeDocId(providerEventId))
  const existing = await ref.get()
  if (existing.exists) {
    return { claimed: false, duplicate: true, ref, data: existing.data() || {} }
  }
  const payload = sanitizeFirestoreData({
    providerEventId: sliceStr(providerEventId, 128),
    providerMessageId: sliceStr(meta.providerMessageId, 128) || null,
    eventType: sliceStr(meta.eventType, 64) || null,
    status: 'processing',
    createdAt: nowIso(),
    expireAt: expireAtDate(),
  })
  try {
    if (typeof ref.create === 'function') {
      await ref.create(payload)
    } else {
      await ref.set(payload)
    }
    return { claimed: true, duplicate: false, ref }
  } catch {
    return { claimed: false, duplicate: true, ref, data: {} }
  }
}

/**
 * Process a verified Resend webhook payload for Founder ops delivery tracking.
 */
async function processVerifiedResendWebhook(payload, { providerEventId, getFirestore } = {}) {
  const getDb = getFirestore || defaultGetFirestore
  const db = getDb()
  const eventType = String(payload?.type || '').trim()
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const providerMessageId = sliceStr(data.email_id || data.emailId, 128)
  const occurredAt = sliceStr(payload?.created_at || data.created_at, 40) || nowIso()
  const status = mapResendEventToStatus(eventType)

  if (!providerEventId) {
    return { ok: false, error: 'missing_provider_event_id' }
  }

  const claim = await claimWebhookEvent(db, providerEventId, {
    providerMessageId,
    eventType,
  })
  if (claim.duplicate) {
    return {
      ok: true,
      duplicate: true,
      eventType,
      providerMessageId: providerMessageId || null,
      deliveryStatus: claim.data?.deliveryStatus || null,
    }
  }

  if (!status) {
    await claim.ref.set(
      sanitizeFirestoreData({
        status: 'ignored',
        reason: 'unsupported_event',
        processedAt: nowIso(),
        expireAt: expireAtDate(),
      }),
      { merge: true }
    )
    return { ok: true, ignored: true, eventType, reason: 'unsupported_event' }
  }

  if (!providerMessageId) {
    await claim.ref.set(
      sanitizeFirestoreData({
        status: 'ignored',
        reason: 'missing_email_id',
        processedAt: nowIso(),
        expireAt: expireAtDate(),
      }),
      { merge: true }
    )
    return { ok: true, ignored: true, eventType, reason: 'missing_email_id' }
  }

  const ledger = await findLedgerByProviderMessageId(db, providerMessageId)
  if (!ledger) {
    await storePendingWebhook(db, providerMessageId, {
      status,
      eventType,
      providerEventId,
      occurredAt,
    })
    await claim.ref.set(
      sanitizeFirestoreData({
        status: 'pending_correlation',
        deliveryStatus: status,
        processedAt: nowIso(),
        expireAt: expireAtDate(),
      }),
      { merge: true }
    )
    return {
      ok: true,
      pending: true,
      eventType,
      providerMessageId,
      deliveryStatus: status,
    }
  }

  // Only correlate founder-ops ledger rows (ignore other Resend traffic)
  const channel = ledger.data.channel
  if (channel && !FOUNDER_OPS_CHANNELS.includes(channel) && !ledger.data.founderOpsDelivery) {
    await claim.ref.set(
      sanitizeFirestoreData({
        status: 'ignored',
        reason: 'not_founder_ops',
        processedAt: nowIso(),
        expireAt: expireAtDate(),
      }),
      { merge: true }
    )
    return { ok: true, ignored: true, eventType, reason: 'not_founder_ops' }
  }

  const applied = await applyStatusToLedger(ledger.ref, ledger.data, status, {
    eventType,
    providerEventId,
    occurredAt,
  })

  await claim.ref.set(
    sanitizeFirestoreData({
      status: applied.applied ? 'applied' : 'duplicate_state',
      deliveryStatus: applied.deliveryStatus,
      ledgerDocId: ledger.id,
      processedAt: nowIso(),
      expireAt: expireAtDate(),
    }),
    { merge: true }
  )

  return {
    ok: true,
    applied: Boolean(applied.applied),
    eventType,
    providerMessageId,
    deliveryStatus: applied.deliveryStatus,
    ledgerDocId: ledger.id,
  }
}

function eventLabel(eventType) {
  return EVENT_LABELS[eventType] || sliceStr(eventType, 40) || 'Founder notification'
}

function redactRecipient(email) {
  const e = sliceStr(email, 120).toLowerCase()
  if (!e) return null
  // Founder allowlist address is intentional to show; still avoid other PII.
  if (e.endsWith('@tenderbriefing.co.za')) return e
  const [user, domain] = e.split('@')
  if (!domain) return 'redacted'
  const u = user.slice(0, 2)
  return `${u}…@${domain}`
}

/**
 * Founder-facing delivery feed + 24h health (no SME/YA personal data).
 */
async function getFounderEmailDeliveryObservability(deps = {}) {
  const getDb = deps.getFirestore || defaultGetFirestore
  const db = getDb()
  const limit = Math.min(Math.max(Number(deps.limit) || 25, 1), 50)
  const sinceMs = Date.now() - 24 * 60 * 60 * 1000
  const sinceIso = new Date(sinceMs).toISOString()

  let recent = []
  try {
    const snap = await db
      .collection(LEDGER_COLLECTION)
      .where('founderOpsDelivery', '==', true)
      .orderBy('emailAcceptedAt', 'desc')
      .limit(limit)
      .get()
    recent = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
  } catch (err) {
    console.error(
      `${LOG_PREFIX} recent query failed:`,
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
    recent = []
  }

  const health = {
    windowHours: 24,
    delivered: 0,
    pending: 0,
    delayed: 0,
    failed: 0,
    total: 0,
  }

  for (const row of recent) {
    const at = row.emailAcceptedAt || row.deliveryStatusUpdatedAt || row.updatedAt
    if (!at || String(at) < sinceIso) continue
    health.total += 1
    const s = row.deliveryStatus || (row.emailSent ? DELIVERY_STATUS.ACCEPTED : null)
    if (s === DELIVERY_STATUS.DELIVERED) health.delivered += 1
    else if (s === DELIVERY_STATUS.DELAYED) health.delayed += 1
    else if (
      s === DELIVERY_STATUS.BOUNCED ||
      s === DELIVERY_STATUS.COMPLAINED ||
      s === DELIVERY_STATUS.FAILED
    ) {
      health.failed += 1
    } else if (s === DELIVERY_STATUS.ACCEPTED || s === DELIVERY_STATUS.SENT || !s) {
      health.pending += 1
    } else {
      health.pending += 1
    }
  }

  const warning =
    health.failed >= 3 || (health.total >= 5 && health.failed / health.total >= 0.4)
      ? 'Repeated Founder operational email delivery failures in the last 24 hours. Check Resend domain health and mailbox delivery.'
      : null

  const items = recent.map((row) => ({
    id: row.id,
    event: eventLabel(row.eventType),
    eventType: row.eventType || null,
    recipient: redactRecipient(row.recipient || (row.recipients && row.recipients[0])),
    subject: sliceStr(row.subject, 180) || null,
    createdAt: row.emailAcceptedAt || row.createdAt || row.updatedAt || null,
    deliveryStatus: row.deliveryStatus || (row.emailSent ? DELIVERY_STATUS.ACCEPTED : 'unknown'),
    providerMessageId: row.providerMessageId ? sliceStr(row.providerMessageId, 12) + '…' : null,
  }))

  return { health, warning, items }
}

module.exports = {
  DELIVERY_STATUS,
  STATUS_RANK,
  TERMINAL_STATUSES,
  RESEND_EVENT_TO_STATUS,
  FOUNDER_OPS_CHANNELS,
  WEBHOOK_RETENTION_DAYS,
  canTransition,
  mapResendEventToStatus,
  buildAcceptanceFields,
  recordResendAcceptance,
  verifyResendWebhook,
  processVerifiedResendWebhook,
  reconcilePendingForMessage,
  getFounderEmailDeliveryObservability,
  eventLabel,
  redactRecipient,
  findLedgerByProviderMessageId,
  applyStatusToLedger,
  storePendingWebhook,
}
