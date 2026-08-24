/**
 * Youth Agent payout ledger — server-authoritative, idempotent, auditable.
 *
 * One payout liability per assignment/request. Eligibility is driven by evidence
 * submission (attendance + audio) — not Whisper, AI, or Founder approval.
 *
 * Monthly EFT: eligible jobs accrue until batched; batches settle via EFT.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const auditLogService = require('../auditLogService')
const {
  resolveYouthAgentPayoutCents,
  grossContributionForRevenueCents,
  resolveRequestChargeCents,
  PRICING_VERSION,
  PAYOUT_VERSION,
  BRIEFING_PRICE_CURRENCY,
} = require('../../constants/briefingPricing')
const batchService = require('./youthAgentPayoutBatchService')

const COL = 'youthAgentPayouts'

const PAYOUT_TRANSITIONS = {
  pending: ['eligible', 'cancelled'],
  eligible: ['held', 'batched', 'paid', 'cancelled'],
  held: ['eligible', 'cancelled'],
  batched: ['settled'],
  settled: [],
  paid: [],
  cancelled: [],
}

function nowIso() {
  return new Date().toISOString()
}

function canTransition(from, to) {
  if (from === to) return true
  return (PAYOUT_TRANSITIONS[from] || []).includes(to)
}

function isSettledStatus(status) {
  return status === 'settled' || status === 'paid'
}

function isTerminalStatus(status) {
  return isSettledStatus(status) || status === 'cancelled'
}

/** Deterministic payout id — one liability per request/assignment. */
function buildPayoutId(requestId) {
  return `ya-payout-${String(requestId).trim()}`
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid payout transition: ${from} → ${to}`)
  }
}

function periodKeyFromIso(iso) {
  return String(iso || '').slice(0, 7)
}

async function logPayoutAudit(event) {
  await auditLogService.logEvent({
    type: 'youth_agent_payout',
    ...event,
    timestamp: nowIso(),
  })
}

async function agentHasPaidBatchForPeriod(youthAgentUid, periodKey) {
  const batchId = batchService.buildBatchId(youthAgentUid, periodKey)
  const batch = await batchService.getBatchById(batchId)
  return batch?.status === 'paid'
}

/**
 * Ensure a payout record exists after valid evidence submission.
 * Idempotent — safe under retries and concurrent requests.
 */
async function ensurePayoutOnEvidenceSubmitted({
  requestId,
  assignmentId,
  tenderId,
  youthAgentUid,
  reportId,
  attendanceVerified,
  evidenceSubmitted,
  briefingRevenueCents,
  completedAt,
  actorUid,
} = {}) {
  if (!requestId || !youthAgentUid) {
    return { ok: false, reason: 'requestId and youthAgentUid are required' }
  }

  const db = getFirestore()
  const payoutId = buildPayoutId(requestId)
  const ref = db.collection(COL).doc(payoutId)
  const payoutAmountCents = resolveYouthAgentPayoutCents()
  const revenueCents = Math.round(Number(briefingRevenueCents) || 0)
  const grossContributionCents = grossContributionForRevenueCents(revenueCents)
  const ts = nowIso()

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists) {
      const existing = snap.data()
      if (isTerminalStatus(existing.status)) {
        return { payout: { payoutId, ...existing }, created: false, duplicate: true }
      }
      if (existing.status === 'held') {
        return { payout: { payoutId, ...existing }, created: false, held: true }
      }
      if (existing.status === 'batched') {
        return { payout: { payoutId, ...existing }, created: false, batched: true }
      }
      const patch = sanitizeFirestoreData({
        attendanceVerified: Boolean(attendanceVerified),
        evidenceSubmitted: Boolean(evidenceSubmitted),
        reportId: reportId || existing.reportId || null,
        updatedAt: ts,
        eligibilityStatus: 'eligible',
        eligibilityReason: 'Evidence submitted and verified',
        status: existing.status === 'pending' ? 'eligible' : existing.status,
        eligibleAt: existing.eligibleAt || ts,
        completedAt: completedAt || existing.completedAt || ts,
      })
      tx.set(ref, patch, { merge: true })
      return { payout: { payoutId, ...existing, ...patch }, created: false, updated: true }
    }

    if (!attendanceVerified || !evidenceSubmitted) {
      return { ok: false, reason: 'Incomplete evidence — payout not created' }
    }

    const record = sanitizeFirestoreData({
      payoutId,
      assignmentId: assignmentId || requestId,
      requestId,
      tenderId: String(tenderId || ''),
      youthAgentUid,
      currency: BRIEFING_PRICE_CURRENCY,
      briefingRevenueCents: revenueCents,
      payoutAmountCents,
      grossContributionCents,
      status: 'eligible',
      eligibilityStatus: 'eligible',
      eligibilityReason: 'Evidence submitted and verified',
      attendanceVerified: true,
      evidenceSubmitted: true,
      reportId: reportId || null,
      completedAt: completedAt || ts,
      eligibleAt: ts,
      settlementBatchId: null,
      batchedAt: null,
      settledAt: null,
      settledBy: null,
      paidAt: null,
      paidBy: null,
      paymentReference: null,
      paymentMethod: null,
      holdReason: null,
      heldBy: null,
      heldAt: null,
      createdAt: ts,
      updatedAt: ts,
      pricingVersion: PRICING_VERSION,
      payoutVersion: PAYOUT_VERSION,
    })

    tx.set(ref, record)
    return { payout: record, created: true }
  })

  if (result.created) {
    await logPayoutAudit({
      action: 'payout_created_eligible',
      entityId: payoutId,
      requestId,
      youthAgentUid,
      actorUid: actorUid || youthAgentUid,
      amountCents: payoutAmountCents,
      previousStatus: null,
      newStatus: 'eligible',
    })
  }

  return { ok: true, ...result }
}

async function getPayoutById(payoutId) {
  const db = getFirestore()
  const snap = await db.collection(COL).doc(payoutId).get()
  if (!snap.exists) return null
  return { payoutId: snap.id, ...snap.data() }
}

async function listPayouts({
  status,
  youthAgentUid,
  page = 1,
  pageSize = 25,
} = {}) {
  const db = getFirestore()
  const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit

  let q = db.collection(COL).orderBy('createdAt', 'desc')
  if (status && status !== 'all') {
    q = db.collection(COL).where('status', '==', status).orderBy('createdAt', 'desc')
  }
  if (youthAgentUid) {
    q = db.collection(COL).where('youthAgentUid', '==', youthAgentUid).orderBy('createdAt', 'desc')
  }

  const snap = await q.limit(limit + offset).get()
  const all = snap.docs.map((d) => ({ payoutId: d.id, ...d.data() }))
  const items = all.slice(offset, offset + limit)

  return { items, page: Number(page) || 1, pageSize: limit, total: all.length }
}

async function getFinanceSummary({ periodStartMs = null } = {}) {
  const db = getFirestore()
  const snap = await db.collection(COL).limit(500).get()
  const payouts = snap.docs.map((d) => d.data())

  let accruedUnsettledCents = 0
  let batchedAwaitingEftCents = 0
  let settledCents = 0
  let payoutsHeldCents = 0
  let grossContributionAccruedCents = 0

  for (const p of payouts) {
    const eligibleAt = p.eligibleAt || p.createdAt
    if (periodStartMs != null && eligibleAt) {
      const t = new Date(eligibleAt).getTime()
      if (Number.isFinite(t) && t < periodStartMs) continue
    }
    const amount = Math.round(Number(p.payoutAmountCents) || 0)
    if (p.status === 'eligible' && !p.settlementBatchId) accruedUnsettledCents += amount
    if (p.status === 'batched') batchedAwaitingEftCents += amount
    if (isSettledStatus(p.status)) settledCents += amount
    if (p.status === 'held') payoutsHeldCents += amount
    if (['eligible', 'held', 'batched', 'settled', 'paid'].includes(p.status)) {
      grossContributionAccruedCents += Math.round(Number(p.grossContributionCents) || 0)
    }
  }

  const batchSummary = await batchService.getBatchFinanceSummary({ periodStartMs })

  return {
    /** @deprecated use accruedUnsettledCents */
    payoutsDueCents: accruedUnsettledCents,
    accruedUnsettledCents,
    batchedAwaitingEftCents,
    /** @deprecated use settledCents */
    payoutsPaidCents: settledCents,
    settledCents,
    payoutsHeldCents,
    outstandingYaLiabilityCents: accruedUnsettledCents + batchedAwaitingEftCents,
    grossContributionAccruedCents,
    payoutCount: payouts.length,
    batchSummary,
  }
}

async function holdPayout(payoutId, { actorUid, reason } = {}) {
  const db = getFirestore()
  const ref = db.collection(COL).doc(payoutId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Payout not found')
  const existing = snap.data()
  if (existing.status === 'batched') {
    throw new Error('Cannot hold a payout already included in a monthly batch')
  }
  assertTransition(existing.status, 'held')
  if (isSettledStatus(existing.status)) throw new Error('Cannot hold a settled payout')

  const ts = nowIso()
  const patch = sanitizeFirestoreData({
    status: 'held',
    eligibilityStatus: 'held',
    holdReason: reason || 'Administrative hold',
    heldBy: actorUid || null,
    heldAt: ts,
    updatedAt: ts,
  })
  await ref.set(patch, { merge: true })

  await logPayoutAudit({
    action: 'payout_held',
    entityId: payoutId,
    requestId: existing.requestId,
    youthAgentUid: existing.youthAgentUid,
    actorUid,
    amountCents: existing.payoutAmountCents,
    previousStatus: existing.status,
    newStatus: 'held',
    reason,
  })

  return { payoutId, ...existing, ...patch }
}

async function releasePayoutHold(payoutId, { actorUid } = {}) {
  const db = getFirestore()
  const ref = db.collection(COL).doc(payoutId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Payout not found')
  const existing = snap.data()
  if (existing.status !== 'held') throw new Error('Payout is not on hold')
  assertTransition('held', 'eligible')

  const ts = nowIso()
  let eligibleAt = existing.eligibleAt || ts
  const originalPeriod = periodKeyFromIso(eligibleAt)
  const paidBatchExists = await agentHasPaidBatchForPeriod(
    existing.youthAgentUid,
    originalPeriod
  )
  let rolledForward = false
  if (paidBatchExists) {
    eligibleAt = ts
    rolledForward = true
  }

  const patch = sanitizeFirestoreData({
    status: 'eligible',
    eligibilityStatus: 'eligible',
    eligibleAt,
    holdReason: null,
    heldBy: null,
    heldAt: null,
    updatedAt: ts,
  })
  await ref.set(patch, { merge: true })

  await logPayoutAudit({
    action: 'payout_released',
    entityId: payoutId,
    requestId: existing.requestId,
    youthAgentUid: existing.youthAgentUid,
    actorUid,
    amountCents: existing.payoutAmountCents,
    previousStatus: 'held',
    newStatus: 'eligible',
    rolledForward,
    originalPeriod: rolledForward ? originalPeriod : null,
  })

  return { payoutId, ...existing, ...patch, rolledForward }
}

/** Legacy per-job settlement — prefer monthly batch markBatchPaid. */
async function markPayoutPaid(
  payoutId,
  { actorUid, paymentReference, paymentMethod } = {}
) {
  const db = getFirestore()
  const ref = db.collection(COL).doc(payoutId)

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('Payout not found')
    const existing = snap.data()
    if (isSettledStatus(existing.status)) {
      return { payout: { payoutId, ...existing }, alreadyPaid: true }
    }
    if (existing.status === 'batched') {
      throw new Error('Payout is in a monthly batch — mark the batch paid instead')
    }
    assertTransition(existing.status, 'paid')
    if (existing.status !== 'eligible' && existing.status !== 'held') {
      throw new Error(`Cannot mark payout paid from status: ${existing.status}`)
    }

    const ts = nowIso()
    const patch = sanitizeFirestoreData({
      status: 'paid',
      eligibilityStatus: 'paid',
      paidAt: ts,
      settledAt: ts,
      paidBy: actorUid || null,
      settledBy: actorUid || null,
      paymentReference: paymentReference || null,
      paymentMethod: paymentMethod || 'manual',
      updatedAt: ts,
    })
    tx.set(ref, patch, { merge: true })
    return { payout: { payoutId, ...existing, ...patch }, alreadyPaid: false }
  })

  if (!result.alreadyPaid) {
    await logPayoutAudit({
      action: 'payout_marked_paid',
      entityId: payoutId,
      requestId: result.payout.requestId,
      youthAgentUid: result.payout.youthAgentUid,
      actorUid,
      amountCents: result.payout.payoutAmountCents,
      previousStatus: 'eligible',
      newStatus: 'paid',
      paymentReference,
      paymentMethod,
      legacy: true,
    })
  }

  return result
}

async function getAgentEarningsSummary(agentId) {
  const db = getFirestore()
  const snap = await db
    .collection(COL)
    .where('youthAgentUid', '==', agentId)
    .limit(100)
    .get()
    .catch(() => ({ docs: [] }))

  const payouts = snap.docs.map((d) => ({ payoutId: d.id, ...d.data() }))
  const completedBriefings = payouts.filter((p) =>
    ['eligible', 'held', 'batched', 'settled', 'paid'].includes(p.status)
  ).length

  const accruedCents = payouts
    .filter((p) => p.status === 'eligible' && !p.settlementBatchId)
    .reduce((s, p) => s + (Number(p.payoutAmountCents) || 0), 0)
  const batchedCents = payouts
    .filter((p) => p.status === 'batched')
    .reduce((s, p) => s + (Number(p.payoutAmountCents) || 0), 0)
  const heldCents = payouts
    .filter((p) => p.status === 'held')
    .reduce((s, p) => s + (Number(p.payoutAmountCents) || 0), 0)
  const settledCents = payouts
    .filter((p) => isSettledStatus(p.status))
    .reduce((s, p) => s + (Number(p.payoutAmountCents) || 0), 0)

  const currentMonth = nowIso().slice(0, 7)
  const currentMonthEligible = payouts.filter(
    (p) =>
      ['eligible', 'batched'].includes(p.status) &&
      periodKeyFromIso(p.eligibleAt) === currentMonth
  )
  const currentMonthJobCount = currentMonthEligible.length
  const currentMonthAccruedCents = currentMonthEligible.reduce(
    (s, p) => s + (Number(p.payoutAmountCents) || 0),
    0
  )

  const batchSnap = await db
    .collection(batchService.BATCH_COL)
    .where('youthAgentUid', '==', agentId)
    .limit(24)
    .get()
    .catch(() => ({ docs: [] }))

  const monthlyHistory = batchSnap.docs
    .map((d) => ({ batchId: d.id, ...d.data() }))
    .sort((a, b) => String(b.periodKey).localeCompare(String(a.periodKey)))
    .map((b) => ({
      periodKey: b.periodKey,
      eligibleJobCount: b.eligibleJobCount,
      grossEarningsCents: b.grossEarningsCents,
      status: b.status,
      paidAt: b.paidAt || null,
      paymentReference: b.paymentReference || null,
    }))

  return {
    completedBriefings,
    /** Accrued, not yet in a monthly batch */
    pendingPayoutCents: accruedCents + batchedCents,
    accruedCents,
    batchedCents,
    heldCents,
    paidEarningsCents: settledCents,
    settledEarningsCents: settledCents,
    currentMonthJobCount,
    currentMonthAccruedCents,
    monthEarningsCents: currentMonthAccruedCents,
    monthlyHistory,
    payouts: payouts.slice(0, 50),
  }
}

function briefingRevenueFromRequest(request) {
  return resolveRequestChargeCents(request)
}

module.exports = {
  COL,
  buildPayoutId,
  ensurePayoutOnEvidenceSubmitted,
  getPayoutById,
  listPayouts,
  getFinanceSummary,
  holdPayout,
  releasePayoutHold,
  markPayoutPaid,
  getAgentEarningsSummary,
  briefingRevenueFromRequest,
  canTransition,
  isSettledStatus,
}
