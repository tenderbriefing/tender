/**
 * Monthly Youth Agent EFT settlement batches.
 *
 * Job-level liabilities live in youthAgentPayouts. Batches group eligible jobs
 * for one agent + calendar month. Inclusion rule: eligibleAt within period bounds.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const auditLogService = require('../auditLogService')
const { resolveYouthAgentPayoutCents, BRIEFING_PRICE_CURRENCY } = require('../../constants/briefingPricing')
const bankingService = require('./youthAgentBankingService')

const BATCH_COL = 'youthAgentPayoutBatches'
const PAYOUT_COL = 'youthAgentPayouts'

function nowIso() {
  return new Date().toISOString()
}

function parsePeriodKey(periodKey) {
  const match = String(periodKey || '').match(/^(\d{4})-(\d{2})$/)
  if (!match) throw new Error('periodKey must be YYYY-MM')
  const periodYear = Number(match[1])
  const periodMonth = Number(match[2])
  if (periodMonth < 1 || periodMonth > 12) throw new Error('Invalid month in periodKey')
  const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1)).toISOString()
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1)).toISOString()
  return { periodKey, periodYear, periodMonth, periodStart, periodEnd }
}

function buildBatchId(youthAgentUid, periodKey) {
  return `ya-batch-${youthAgentUid}-${periodKey}`
}

function eligibleAtInPeriod(eligibleAt, periodStart, periodEnd) {
  if (!eligibleAt) return false
  const t = new Date(eligibleAt).getTime()
  const start = new Date(periodStart).getTime()
  const end = new Date(periodEnd).getTime()
  return Number.isFinite(t) && t >= start && t < end
}

async function logBatchAudit(event) {
  await auditLogService.logEvent({
    type: 'youth_agent_payout_batch',
    ...event,
    timestamp: nowIso(),
  })
}

function isUnsettledEligiblePayout(p) {
  return p.status === 'eligible' && !p.settlementBatchId
}

async function listEligiblePayoutsForPeriod({ periodKey, youthAgentUid = null } = {}) {
  const { periodStart, periodEnd } = parsePeriodKey(periodKey)
  const db = getFirestore()
  let q = db.collection(PAYOUT_COL).where('status', '==', 'eligible')
  if (youthAgentUid) {
    q = db.collection(PAYOUT_COL).where('youthAgentUid', '==', youthAgentUid).where('status', '==', 'eligible')
  }
  const snap = await q.limit(500).get()
  return snap.docs
    .map((d) => ({ payoutId: d.id, ...d.data() }))
    .filter(
      (p) =>
        isUnsettledEligiblePayout(p) && eligibleAtInPeriod(p.eligibleAt, periodStart, periodEnd)
    )
}

async function getBatchById(batchId) {
  const db = getFirestore()
  const snap = await db.collection(BATCH_COL).doc(batchId).get()
  if (!snap.exists) return null
  return { batchId: snap.id, ...snap.data() }
}

async function listBatches({
  periodKey = null,
  status = null,
  youthAgentUid = null,
  page = 1,
  pageSize = 50,
} = {}) {
  const db = getFirestore()
  const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 100)
  let q = db.collection(BATCH_COL).orderBy('createdAt', 'desc')
  if (periodKey) {
    q = db.collection(BATCH_COL).where('periodKey', '==', periodKey).orderBy('createdAt', 'desc')
  }
  if (status && status !== 'all') {
    q = db.collection(BATCH_COL).where('status', '==', status).orderBy('createdAt', 'desc')
  }
  if (youthAgentUid) {
    q = db
      .collection(BATCH_COL)
      .where('youthAgentUid', '==', youthAgentUid)
      .orderBy('createdAt', 'desc')
  }
  const snap = await q.limit(limit).get()
  const items = snap.docs.map((d) => ({ batchId: d.id, ...d.data() }))
  return { items, page: Number(page) || 1, pageSize: limit, total: items.length }
}

async function getBatchWithPayouts(batchId, { includeFullAccount = true } = {}) {
  const batch = await getBatchById(batchId)
  if (!batch) return null
  const db = getFirestore()
  const payouts = []
  for (const payoutId of batch.payoutIds || []) {
    const snap = await db.collection(PAYOUT_COL).doc(payoutId).get()
    if (snap.exists) payouts.push({ payoutId: snap.id, ...snap.data() })
  }

  let agentDisplayName = null
  try {
    const userSnap = await db.collection('users').doc(batch.youthAgentUid).get()
    const agentSnap = await db.collection('agents').doc(batch.youthAgentUid).get()
    agentDisplayName =
      userSnap.data()?.displayName ||
      agentSnap.data()?.name ||
      agentSnap.data()?.fullName ||
      null
  } catch {
    /* non-blocking */
  }

  // Live profile for "missing bank details" guidance (does not mutate snapshot).
  let liveBanking = null
  try {
    const profile = await bankingService.getBankingProfile(batch.youthAgentUid)
    liveBanking = bankingService.toPublic(profile)
  } catch {
    liveBanking = null
  }

  return {
    batch: presentBatchForFounder(batch, { includeFullAccount }),
    payouts,
    agent: {
      uid: batch.youthAgentUid,
      displayName: agentDisplayName,
    },
    liveBanking,
  }
}

async function listBatchesForFounder(opts = {}) {
  const listed = await listBatches(opts)
  return {
    ...listed,
    items: listed.items.map((b) => presentBatchForFounder(b, { includeFullAccount: false })),
  }
}

/**
 * Idempotent monthly batch generation for a calendar period.
 * Creates one batch per agent with eligible unsettled jobs in that period.
 */
async function generateMonthlyBatches({ periodKey, actorUid } = {}) {
  const period = parsePeriodKey(periodKey)
  const eligible = await listEligiblePayoutsForPeriod({ periodKey })
  const byAgent = new Map()
  for (const p of eligible) {
    const uid = p.youthAgentUid
    if (!uid) continue
    if (!byAgent.has(uid)) byAgent.set(uid, [])
    byAgent.get(uid).push(p)
  }

  const db = getFirestore()
  const perJobCents = resolveYouthAgentPayoutCents()
  const results = []

  for (const [youthAgentUid, payouts] of byAgent.entries()) {
    const batchId = buildBatchId(youthAgentUid, period.periodKey)
    const batchRef = db.collection(BATCH_COL).doc(batchId)

    // Snapshot banking outside the payout transaction (read-only profile).
    const bankingProfile = await bankingService.getBankingProfile(youthAgentUid)
    const bankingSnapshot = bankingService.buildSnapshot(bankingProfile)
    const bankingDetailsPresent = Boolean(bankingSnapshot)

    const result = await db.runTransaction(async (tx) => {
      const batchSnap = await tx.get(batchRef)
      if (batchSnap.exists) {
        const existing = batchSnap.data()
        if (existing.status === 'paid') {
          return { batch: { batchId, ...existing }, created: false, alreadyPaid: true }
        }
        return { batch: { batchId, ...existing }, created: false, alreadyExists: true }
      }

      const payoutIds = []
      const requestIds = []
      let grossEarningsCents = 0

      for (const p of payouts) {
        const payoutRef = db.collection(PAYOUT_COL).doc(p.payoutId)
        const payoutSnap = await tx.get(payoutRef)
        if (!payoutSnap.exists) continue
        const row = payoutSnap.data()
        if (row.status !== 'eligible' || row.settlementBatchId) continue
        if (!eligibleAtInPeriod(row.eligibleAt, period.periodStart, period.periodEnd)) continue

        const ts = nowIso()
        const payoutPatch = sanitizeFirestoreData({
          status: 'batched',
          eligibilityStatus: 'batched',
          settlementBatchId: batchId,
          batchedAt: ts,
          updatedAt: ts,
        })
        tx.set(payoutRef, payoutPatch, { merge: true })
        payoutIds.push(p.payoutId)
        requestIds.push(row.requestId)
        grossEarningsCents += Math.round(Number(row.payoutAmountCents) || perJobCents)
      }

      if (payoutIds.length === 0) {
        return { skipped: true, reason: 'No eligible payouts for agent in period' }
      }

      const ts = nowIso()
      const batch = sanitizeFirestoreData({
        batchId,
        youthAgentUid,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        periodKey: period.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        currency: BRIEFING_PRICE_CURRENCY,
        eligibleJobCount: payoutIds.length,
        grossEarningsCents,
        payoutIds,
        requestIds,
        status: 'ready',
        bankingSnapshot: bankingSnapshot || null,
        bankingDetailsPresent,
        createdAt: ts,
        createdBy: actorUid || null,
        approvedAt: null,
        approvedBy: null,
        paidAt: null,
        paidBy: null,
        paymentMethod: null,
        paymentReference: null,
        paidAmountCents: null,
        paymentDate: null,
        paymentNote: null,
        proofOfPaymentRef: null,
        updatedAt: ts,
      })
      tx.set(batchRef, batch)
      return { batch, created: true }
    })

    if (result.created) {
      await logBatchAudit({
        action: 'batch_generated',
        entityId: batchId,
        youthAgentUid,
        actorUid,
        periodKey: period.periodKey,
        eligibleJobCount: result.batch.eligibleJobCount,
        grossEarningsCents: result.batch.grossEarningsCents,
        bankingDetailsPresent,
        bankingProfileVersion: bankingSnapshot?.bankingProfileVersion || null,
        accountNumberMasked: bankingSnapshot?.accountNumberMasked || null,
      })
    }
    results.push({ youthAgentUid, batchId, ...result })
  }

  const existingForPeriod = await listBatches({ periodKey: period.periodKey, pageSize: 100 })
  for (const existing of existingForPeriod.items) {
    const already = results.some((r) => r.batchId === existing.batchId)
    if (!already) {
      results.push({
        youthAgentUid: existing.youthAgentUid,
        batchId: existing.batchId,
        batch: existing,
        created: false,
        alreadyExists: true,
      })
    }
  }

  return {
    periodKey: period.periodKey,
    agentsProcessed: results.length,
    batches: results.filter((r) => r.batch),
    skippedAgents: results.filter((r) => r.skipped).length,
  }
}

function batchOperationalStatus(batch) {
  if (!batch) return 'unknown'
  if (batch.status === 'paid') return 'already_paid'
  if (batch.status === 'cancelled') return 'cancelled'
  if (batch.status !== 'ready') return String(batch.status || 'unknown')
  if (batch.bankingDetailsPresent === false) return 'missing_bank_details'
  if (batch.bankingSnapshot) return 'ready_for_eft'
  // Pre-banking-feature batches
  return 'legacy_no_snapshot'
}

/**
 * Record external EFT and settle all included job liabilities atomically.
 * amountPaidCents must match batch.grossEarningsCents (fail closed).
 */
async function markBatchPaid(
  batchId,
  {
    actorUid,
    paymentReference,
    paymentMethod = 'EFT',
    amountPaidCents,
    paymentDate,
    paymentNote,
    proofOfPaymentRef,
  } = {}
) {
  if (!paymentReference) throw new Error('paymentReference is required')
  const db = getFirestore()
  const batchRef = db.collection(BATCH_COL).doc(batchId)

  // Pre-read: attach live banking snapshot if batch was generated without one.
  const preSnap = await batchRef.get()
  if (!preSnap.exists) throw new Error('Batch not found')
  const preBatch = preSnap.data()
  let snapshotToAttach = null
  if (preBatch.status === 'ready' && !preBatch.bankingSnapshot) {
    const live = await bankingService.getBankingProfile(preBatch.youthAgentUid)
    snapshotToAttach = bankingService.buildSnapshot(live)
    if (!snapshotToAttach && preBatch.bankingDetailsPresent === false) {
      throw new Error('Bank details required before recording EFT')
    }
    // Legacy batches (no bankingDetailsPresent field) may settle without snapshot.
  }

  const result = await db.runTransaction(async (tx) => {
    const batchSnap = await tx.get(batchRef)
    if (!batchSnap.exists) throw new Error('Batch not found')
    const batch = batchSnap.data()
    if (batch.status === 'paid') {
      return { batch: { batchId, ...batch }, alreadyPaid: true }
    }
    if (batch.status !== 'ready') {
      throw new Error(`Cannot mark batch paid from status: ${batch.status}`)
    }

    const expectedCents = Math.round(Number(batch.grossEarningsCents) || 0)
    if (amountPaidCents == null || amountPaidCents === '') {
      throw new Error('amountPaidCents is required and must match the batch total')
    }
    const paidCents = Math.round(Number(amountPaidCents))
    if (!Number.isFinite(paidCents) || paidCents !== expectedCents) {
      throw new Error(
        `Amount mismatch: expected ${expectedCents} cents, received ${paidCents}`
      )
    }

    const bankingSnapshot = batch.bankingSnapshot || snapshotToAttach || null
    if (!bankingSnapshot && batch.bankingDetailsPresent === false) {
      throw new Error('Bank details required before recording EFT')
    }

    const ts = nowIso()
    const payoutIds = batch.payoutIds || []

    for (const payoutId of payoutIds) {
      const payoutRef = db.collection(PAYOUT_COL).doc(payoutId)
      const payoutSnap = await tx.get(payoutRef)
      if (!payoutSnap.exists) throw new Error(`Linked payout missing: ${payoutId}`)
      const row = payoutSnap.data()
      if (row.settlementBatchId !== batchId) {
        throw new Error(`Payout ${payoutId} is not linked to batch ${batchId}`)
      }
      if (row.status === 'settled' || row.status === 'paid') continue
      if (row.status !== 'batched') {
        throw new Error(`Payout ${payoutId} cannot settle from status ${row.status}`)
      }
      tx.set(
        payoutRef,
        sanitizeFirestoreData({
          status: 'settled',
          eligibilityStatus: 'settled',
          settledAt: ts,
          settledBy: actorUid || null,
          paymentReference,
          paymentMethod,
          updatedAt: ts,
        }),
        { merge: true }
      )
    }

    const batchPatch = sanitizeFirestoreData({
      status: 'paid',
      paidAt: ts,
      paidBy: actorUid || null,
      paymentMethod: paymentMethod || 'EFT',
      paymentReference: String(paymentReference).trim().slice(0, 120),
      paidAmountCents: paidCents,
      paymentDate: paymentDate ? String(paymentDate).slice(0, 32) : ts.slice(0, 10),
      paymentNote: paymentNote ? String(paymentNote).slice(0, 1000) : null,
      proofOfPaymentRef: proofOfPaymentRef ? String(proofOfPaymentRef).slice(0, 500) : null,
      ...(bankingSnapshot && !batch.bankingSnapshot
        ? {
            bankingSnapshot,
            bankingDetailsPresent: true,
          }
        : {}),
      updatedAt: ts,
    })
    tx.set(batchRef, batchPatch, { merge: true })
    return { batch: { batchId, ...batch, ...batchPatch }, alreadyPaid: false }
  })

  if (!result.alreadyPaid) {
    await logBatchAudit({
      action: 'batch_marked_paid',
      entityId: batchId,
      actorUid,
      paymentReference,
      paymentMethod,
      paidAmountCents: result.batch.paidAmountCents,
      grossEarningsCents: result.batch.grossEarningsCents,
      bankingProfileVersion: result.batch.bankingSnapshot?.bankingProfileVersion || null,
      accountNumberMasked: result.batch.bankingSnapshot?.accountNumberMasked || null,
    })
  } else {
    await logBatchAudit({
      action: 'batch_mark_paid_retry',
      entityId: batchId,
      actorUid,
      alreadyPaid: true,
    })
  }

  return result
}

/**
 * Enrich batch list/detail for Founder Finance (masked bank summary).
 */
function presentBatchForFounder(batch, { includeFullAccount = false } = {}) {
  if (!batch) return null
  const snap = batch.bankingSnapshot || null
  const operationalStatus = batchOperationalStatus(batch)
  const bankSummary = snap
    ? {
        bankName: snap.bankName,
        accountHolderName: snap.accountHolderName,
        accountNumberMasked: snap.accountNumberMasked,
        accountType: snap.accountType,
        branchCode: snap.branchCode,
        bankingProfileVersion: snap.bankingProfileVersion,
        snapshottedAt: snap.snapshottedAt,
        ...(includeFullAccount
          ? {
              accountNumber: snap.accountNumber,
            }
          : {}),
      }
    : null

  return {
    ...batch,
    // Strip full account from list payloads unless explicitly requested.
    bankingSnapshot: includeFullAccount
      ? snap
      : snap
        ? {
            bankingProfileVersion: snap.bankingProfileVersion,
            accountHolderName: snap.accountHolderName,
            bankName: snap.bankName,
            accountNumberMasked: snap.accountNumberMasked,
            accountType: snap.accountType,
            branchCode: snap.branchCode,
            snapshottedAt: snap.snapshottedAt,
          }
        : null,
    bankSummary,
    operationalStatus,
    operationalStatusLabel:
      operationalStatus === 'ready_for_eft'
        ? 'Ready for EFT'
        : operationalStatus === 'missing_bank_details'
          ? 'Missing bank details'
          : operationalStatus === 'already_paid'
            ? 'Already paid'
            : operationalStatus === 'legacy_no_snapshot'
              ? 'Ready (legacy — no bank snapshot)'
              : operationalStatus,
  }
}

async function getBatchFinanceSummary({ periodStartMs = null } = {}) {
  const db = getFirestore()
  const [batchSnap, payoutSnap] = await Promise.all([
    db.collection(BATCH_COL).limit(500).get(),
    db.collection(PAYOUT_COL).limit(500).get(),
  ])

  let batchesReadyCents = 0
  let batchesPaidCents = 0
  let batchesReadyCount = 0
  let batchesPaidCount = 0

  for (const doc of batchSnap.docs) {
    const b = doc.data()
    const createdAt = b.createdAt
    if (periodStartMs != null && createdAt) {
      const t = new Date(createdAt).getTime()
      if (Number.isFinite(t) && t < periodStartMs) continue
    }
    const amount = Math.round(Number(b.grossEarningsCents) || 0)
    if (b.status === 'ready') {
      batchesReadyCents += amount
      batchesReadyCount += 1
    }
    if (b.status === 'paid') {
      batchesPaidCents += amount
      batchesPaidCount += 1
    }
  }

  let accruedUnsettledCents = 0
  let batchedAwaitingEftCents = 0
  let settledJobCents = 0
  let heldCents = 0

  for (const doc of payoutSnap.docs) {
    const p = doc.data()
    const amount = Math.round(Number(p.payoutAmountCents) || 0)
    if (p.status === 'eligible' && !p.settlementBatchId) accruedUnsettledCents += amount
    if (p.status === 'batched') batchedAwaitingEftCents += amount
    if (p.status === 'settled' || p.status === 'paid') settledJobCents += amount
    if (p.status === 'held') heldCents += amount
  }

  return {
    batchesReadyCents,
    batchesPaidCents,
    batchesReadyCount,
    batchesPaidCount,
    accruedUnsettledCents,
    batchedAwaitingEftCents,
    settledJobCents,
    heldCents,
    outstandingYaLiabilityCents: accruedUnsettledCents + batchedAwaitingEftCents,
  }
}

module.exports = {
  BATCH_COL,
  buildBatchId,
  parsePeriodKey,
  listEligiblePayoutsForPeriod,
  getBatchById,
  getBatchWithPayouts,
  listBatches,
  listBatchesForFounder,
  generateMonthlyBatches,
  markBatchPaid,
  getBatchFinanceSummary,
  eligibleAtInPeriod,
  batchOperationalStatus,
  presentBatchForFounder,
}
