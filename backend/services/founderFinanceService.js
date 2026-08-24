/**
 * Founder financial dashboard — booking revenue + Youth Agent payout ledger.
 * Revenue uses actual recorded payment amounts (never bookings × current price).
 */
const { getStorage } = require('./storageAdapter')
const youthAgentPayouts = require('./finance/youthAgentPayoutService')

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

async function getFounderFinanceDashboard({ period = '30', status = 'all', page = 1, pageSize = 25 } = {}) {
  const startMs = periodStartMs(period)
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()

  let bookingRevenueCents = 0
  let paidBookings = 0
  let missingAmountCount = 0

  for (const r of requests) {
    if (!isPaidBooking(r)) continue
    const paidAt = r.paidAt || r.updatedAt || r.createdAt
    if (!inPeriod(paidAt, startMs)) continue
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

  const totalPayoutLiabilityCents =
    payoutSummary.payoutsDueCents +
    payoutSummary.payoutsHeldCents +
    payoutSummary.payoutsPaidCents

  const grossContributionCents = bookingRevenueCents - totalPayoutLiabilityCents

  return {
    period,
    kpis: {
      bookingRevenueCents,
      paidBookings,
      agentPayoutsDueCents: payoutSummary.payoutsDueCents,
      agentPayoutsHeldCents: payoutSummary.payoutsHeldCents,
      agentPayoutsPaidCents: payoutSummary.payoutsPaidCents,
      grossContributionCents,
      grossContributionAccruedCents: payoutSummary.grossContributionAccruedCents,
      missingPaymentAmountCount: missingAmountCount,
    },
    payouts: payoutList,
    notes: {
      bookingRevenue:
        'Sum of paymentAmount (else briefingPriceCents, else quotedFee) on paid attendance requests in period.',
      agentPayoutsDue: 'Eligible Youth Agent payouts not yet settled (cash outstanding).',
      agentPayoutsPaid: 'Payouts marked paid by Founder with audit trail.',
      grossContribution:
        'Paid briefing revenue minus total payout liabilities (due + held + paid). Not profit — excludes operating costs.',
    },
  }
}

module.exports = {
  getFounderFinanceDashboard,
}
