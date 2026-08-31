/**
 * Founder financial dashboard — booking revenue + Youth Agent payout ledger.
 * Revenue uses actual recorded payment amounts (never bookings × current price).
 * Test/smoke SME bookings (isTestData or owner isTestAccount) are excluded by default.
 */
const { getStorage } = require('./storageAdapter')
const { getFirestore } = require('../config/firebaseAdmin')
const { isEffectiveTestAccount } = require('../../lib/domain/testAccount')
const youthAgentPayouts = require('./finance/youthAgentPayoutService')
const youthAgentPayoutBatches = require('./finance/youthAgentPayoutBatchService')

const PERIOD_DAYS = { '7': 7, '30': 30, '90': 90, all: null }

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function periodStartMs(period, now = Date.now()) {
  const days = PERIOD_DAYS[period]
  if (!days) return null
  return now - days * 86400000
}

function inPeriod(iso, startMs) {
  if (startMs == null) return true
  const d = parseDate(iso)
  if (!d) return false
  return d.getTime() >= startMs
}

function paidAmountCents(request) {
  const amount = Number(request.paymentAmount)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  const snap = Number(request.briefingPriceCents)
  if (Number.isFinite(snap) && snap > 0) return Math.round(snap)
  const quoted = Number(request.quotedFee)
  if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
  return null
}

function isPaidBooking(request) {
  return request && request.paymentStatus === 'paid'
}

async function loadSmeUsersById() {
  const db = getFirestore()
  const snap = await db.collection('users').where('userType', '==', 'sme').limit(800).get()
  return new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
}

function isCommercialBooking(request, usersById) {
  if (request?.isTestData === true) return false
  const sme = request?.smeId ? usersById.get(request.smeId) : null
  if (sme && isEffectiveTestAccount(sme)) return false
  return true
}

async function getFounderFinanceDashboard({
  period = '30',
  status = 'all',
  page = 1,
  pageSize = 25,
  batchPeriodKey = null,
  batchStatus = 'all',
} = {}) {
  const startMs = periodStartMs(period)
  const storage = getStorage()
  const [requests, usersById] = await Promise.all([
    storage.getAttendanceRequests(),
    loadSmeUsersById(),
  ])

  let bookingRevenueCents = 0
  let paidBookings = 0
  let missingAmountCount = 0
  let excludedTestPaidBookings = 0

  for (const r of requests) {
    if (!isPaidBooking(r)) continue
    const paidAt = r.paidAt || r.updatedAt || r.createdAt
    if (!inPeriod(paidAt, startMs)) continue
    if (!isCommercialBooking(r, usersById)) {
      excludedTestPaidBookings += 1
      continue
    }
    paidBookings += 1
    const cents = paidAmountCents(r)
    if (cents != null) {
      bookingRevenueCents += cents
    } else {
      missingAmountCount += 1
    }
  }

  const payoutSummary = await youthAgentPayouts.getFinanceSummary({ periodStartMs: startMs })
  const payoutList = await youthAgentPayouts.listPayouts({ status, page, pageSize })
  const batchList = await youthAgentPayoutBatches.listBatchesForFounder({
    periodKey: batchPeriodKey || null,
    status: batchStatus === 'all' ? null : batchStatus,
    pageSize: 100,
  })

  const outstandingYaLiabilityCents = payoutSummary.outstandingYaLiabilityCents
  const totalYaShareCents =
    payoutSummary.accruedUnsettledCents +
    payoutSummary.batchedAwaitingEftCents +
    payoutSummary.settledCents +
    payoutSummary.payoutsHeldCents
  const grossContributionCents = bookingRevenueCents - totalYaShareCents

  return {
    period,
    batchPeriodKey,
    kpis: {
      bookingRevenueCents,
      paidBookings,
      yaEarningsAccruedCents: payoutSummary.accruedUnsettledCents,
      yaBatchedAwaitingEftCents: payoutSummary.batchedAwaitingEftCents,
      yaPayoutsSettledCents: payoutSummary.settledCents,
      outstandingYaLiabilityCents,
      agentPayoutsHeldCents: payoutSummary.payoutsHeldCents,
      /** @deprecated */
      agentPayoutsDueCents: payoutSummary.accruedUnsettledCents,
      /** @deprecated */
      agentPayoutsPaidCents: payoutSummary.settledCents,
      grossContributionCents,
      grossContributionAccruedCents: payoutSummary.grossContributionAccruedCents,
      batchesReadyCents: payoutSummary.batchSummary?.batchesReadyCents || 0,
      batchesPaidCents: payoutSummary.batchSummary?.batchesPaidCents || 0,
      missingPaymentAmountCount: missingAmountCount,
      excludedTestPaidBookings,
    },
    payouts: payoutList,
    monthlyBatches: batchList,
    notes: {
      bookingRevenue:
        'Sum of paymentAmount (else briefingPriceCents, else quotedFee) on paid attendance requests in period, excluding test/smoke SME bookings (isTestData / isTestAccount).',
      yaEarningsAccrued:
        'Eligible R200 job liabilities not yet included in a monthly batch (unsettled accrual).',
      yaBatchedAwaitingEft:
        'Jobs included in a generated monthly batch awaiting external EFT settlement.',
      yaPayoutsSettled:
        'Job liabilities settled via monthly EFT batch (or legacy per-job paid records).',
      outstandingYaLiability:
        'Accrued + batched earnings not yet settled — cash still owed to Youth Agents.',
      grossContribution:
        'Paid briefing revenue minus settled YA payouts and outstanding YA liability. Not profit — excludes operating costs.',
      monthlyInclusion:
        'Jobs belong to the calendar month containing eligibleAt (UTC). See lib/finance/youthAgentPayoutBatchTypes.ts.',
    },
  }
}

module.exports = {
  getFounderFinanceDashboard,
  isCommercialBooking,
}
