/**
 * Canonical commercial pricing (JS mirror of lib/domain/briefingPricing.ts).
 * Backend services must import from here — never trust client amounts.
 */

const BRIEFING_PRICE_CENTS = 75000
const YOUTH_AGENT_PAYOUT_CENTS = 20000
const GROSS_CONTRIBUTION_CENTS = BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS
const BRIEFING_PRICE_CURRENCY = 'ZAR'
const PRICING_VERSION = '2026-10-v750'
const PAYOUT_VERSION = '2026-08-fixed-200'

function isAttendanceFree(cents) {
  const value = cents == null ? resolveBriefingPriceCents() : Number(cents)
  return !Number.isFinite(value) || value <= 0
}

function resolveBriefingPriceCents() {
  const server = process.env.ATTENDANCE_FEE_CENTS
  if (server != null && server !== '') {
    const n = Number(server)
    if (Number.isFinite(n) && n >= 0) return Math.round(n)
  }
  return BRIEFING_PRICE_CENTS
}

function resolveYouthAgentPayoutCents() {
  const env = process.env.YOUTH_AGENT_PAYOUT_CENTS
  if (env != null && env !== '') {
    const n = Number(env)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return YOUTH_AGENT_PAYOUT_CENTS
}

function formatBriefingPriceZar(cents = BRIEFING_PRICE_CENTS) {
  if (isAttendanceFree(cents)) return 'Free'
  return `R${(cents / 100).toFixed(2)}`
}

function grossContributionForRevenueCents(briefingRevenueCents) {
  const revenue = Math.round(Number(briefingRevenueCents) || 0)
  const payout = resolveYouthAgentPayoutCents()
  return Math.max(0, revenue - payout)
}

function briefingPriceSnapshotFields() {
  const cents = resolveBriefingPriceCents()
  return {
    briefingPriceCents: cents,
    paymentAmount: cents,
    quotedFee: cents,
    currency: BRIEFING_PRICE_CURRENCY,
    pricingVersion: PRICING_VERSION,
  }
}

/** Order-level snapshot for N briefings × unit price (server-calculated). */
function multiBriefingPriceSnapshotFields(briefingCount) {
  const unit = resolveBriefingPriceCents()
  const count = Math.max(1, Math.round(Number(briefingCount) || 1))
  const total = count * unit
  return {
    unitPriceCents: unit,
    briefingCount: count,
    briefingPriceCents: total,
    paymentAmount: total,
    quotedFee: total,
    currency: BRIEFING_PRICE_CURRENCY,
    pricingVersion: PRICING_VERSION,
  }
}

/**
 * Count structured briefing lines on an order.
 * Returns null when the document has no briefingLines array (legacy single-unit).
 * Never trusts client-supplied briefingCount without matching lines.
 */
function countStructuredBriefingLines(request) {
  if (!request || !Array.isArray(request.briefingLines)) return null
  if (request.briefingLines.length < 1) return null
  return request.briefingLines.length
}

/** TOTAL = briefingCount × unit price (server unit only). */
function chargeCentsForBriefingCount(briefingCount) {
  const unit = resolveBriefingPriceCents()
  if (isAttendanceFree(unit)) return 0
  const count = Math.max(0, Math.round(Number(briefingCount) || 0))
  return count * unit
}

/** Founder-only live PayFast pipeline certification amount — never commercial price. */
const LIVE_CERTIFICATION_AMOUNT_CENTS = 7500
const LIVE_CERTIFICATION_PURPOSE = 'payfast_live_certification'
const LIVE_CERTIFICATION_SOURCE = 'payfast_live_certification'

/**
 * Server-authorized R75 certification booking only.
 * Client-forged purpose/amount fields without serverAuthorizedCertification are ignored.
 */
function resolveLiveCertificationChargeCents(request) {
  if (!request || request.serverAuthorizedCertification !== true) return null
  if (request.purpose !== LIVE_CERTIFICATION_PURPOSE) return null
  if (request.source !== LIVE_CERTIFICATION_SOURCE) return null
  if (request.singleUse !== true) return null
  const expected = Number(request.expectedAmountCents)
  const locked = Number(request.certificationAmountCents)
  if (expected !== LIVE_CERTIFICATION_AMOUNT_CENTS) return null
  if (locked !== LIVE_CERTIFICATION_AMOUNT_CENTS) return null
  return LIVE_CERTIFICATION_AMOUNT_CENTS
}

/**
 * Resolve the amount PayFast must charge / ITN must verify.
 * Free mode (0 cents) always returns 0 — never start a checkout.
 * Multi-briefing unpaid orders charge count(briefingLines) × unit price.
 * Legacy documents without briefingLines charge one unit (canonical R750).
 */
function resolveRequestChargeCents(request) {
  const canonical = resolveBriefingPriceCents()
  if (isAttendanceFree(canonical)) return 0
  if (!request) return canonical

  const certificationCents = resolveLiveCertificationChargeCents(request)
  if (certificationCents != null) return certificationCents

  if (request.paymentStatus === 'paid') {
    const snap = Number(request.briefingPriceCents)
    if (Number.isFinite(snap) && snap > 0) return Math.round(snap)
    const quoted = Number(request.quotedFee)
    if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
    const amount = Number(request.paymentAmount)
    if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  }

  const lineCount = countStructuredBriefingLines(request)
  if (lineCount != null) {
    return chargeCentsForBriefingCount(lineCount)
  }

  return canonical
}

module.exports = {
  BRIEFING_PRICE_CENTS,
  YOUTH_AGENT_PAYOUT_CENTS,
  GROSS_CONTRIBUTION_CENTS,
  BRIEFING_PRICE_CURRENCY,
  PRICING_VERSION,
  PAYOUT_VERSION,
  LIVE_CERTIFICATION_AMOUNT_CENTS,
  LIVE_CERTIFICATION_PURPOSE,
  LIVE_CERTIFICATION_SOURCE,
  isAttendanceFree,
  resolveBriefingPriceCents,
  resolveYouthAgentPayoutCents,
  formatBriefingPriceZar,
  grossContributionForRevenueCents,
  briefingPriceSnapshotFields,
  multiBriefingPriceSnapshotFields,
  countStructuredBriefingLines,
  chargeCentsForBriefingCount,
  resolveLiveCertificationChargeCents,
  resolveRequestChargeCents,
}
