/**
 * Phase 20 — SME Connect funnel metrics.
 */
const store = require('./smeConnectRecommendationStore')
const { SME_CONNECT_STATUS } = require('../domain/ocdsDayReconciliation')
const { MATCH_BAND } = require('./smeConnectMatchingService')

function rate(num, den) {
  if (!den) return null
  return Number((num / den).toFixed(4))
}

async function computeFunnel({ limit = 2000 } = {}) {
  const rows = await store.listRecommendations({ limit })
  const all = rows || []

  const counts = {
    candidateMatches: all.length,
    highConfidence: all.filter((r) => r.matchBand === MATCH_BAND.HIGH_CONFIDENCE).length,
    review: all.filter((r) => r.matchBand === MATCH_BAND.REVIEW).length,
    approved: all.filter((r) =>
      [
        SME_CONNECT_STATUS.HUMAN_APPROVED,
        SME_CONNECT_STATUS.READY_FOR_OUTREACH,
        SME_CONNECT_STATUS.QUEUED,
        SME_CONNECT_STATUS.SENT,
        SME_CONNECT_STATUS.DELIVERED,
        SME_CONNECT_STATUS.CLICKED,
        SME_CONNECT_STATUS.CONVERTED,
        SME_CONNECT_STATUS.PAID,
      ].includes(r.status)
    ).length,
    rejected: all.filter((r) => r.status === SME_CONNECT_STATUS.REJECTED).length,
    badMatches: all.filter((r) => r.badMatch === true).length,
    sent: all.filter((r) =>
      [
        SME_CONNECT_STATUS.SENT,
        SME_CONNECT_STATUS.DELIVERED,
        SME_CONNECT_STATUS.CLICKED,
        SME_CONNECT_STATUS.CONVERTED,
        SME_CONNECT_STATUS.PAID,
      ].includes(r.status) || r.outreachStatus === 'sent'
    ).length,
    delivered: all.filter(
      (r) =>
        r.providerDeliveryStatus === 'delivered' || r.status === SME_CONNECT_STATUS.DELIVERED
    ).length,
    clicked: all.filter((r) =>
      [
        SME_CONNECT_STATUS.CLICKED,
        SME_CONNECT_STATUS.CONVERTED,
        SME_CONNECT_STATUS.PAID,
      ].includes(r.status)
    ).length,
    checkoutStarted: all.filter((r) => r.checkoutStartedAt || r.convertedRequestId).length,
    paid: all.filter((r) => r.status === SME_CONNECT_STATUS.PAID).length,
  }

  return {
    ...counts,
    rates: {
      approvalRate: rate(counts.approved, counts.candidateMatches),
      deliveryRate: rate(counts.delivered, counts.sent),
      ctr: rate(counts.clicked, counts.delivered || counts.sent),
      clickToCheckout: rate(counts.checkoutStarted, counts.clicked),
      checkoutToPaid: rate(counts.paid, counts.checkoutStarted),
      candidateToPaid: rate(counts.paid, counts.candidateMatches),
    },
  }
}

module.exports = {
  computeFunnel,
  rate,
}
