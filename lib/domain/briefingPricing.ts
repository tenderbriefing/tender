/**
 * Canonical commercial pricing — server-authoritative, integer cents only.
 * Do not duplicate these constants elsewhere; import from this module.
 */

/** Current SME briefing attendance price — R750.00 */
export const BRIEFING_PRICE_CENTS = 75000

/** Fixed Youth Agent payout per successfully completed briefing — R200.00 */
export const YOUTH_AGENT_PAYOUT_CENTS = 20000

/** Platform gross contribution before other costs — R550.00 */
export const GROSS_CONTRIBUTION_CENTS = BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS

export const BRIEFING_PRICE_CURRENCY = 'ZAR'

/** Bump when commercial pricing changes; stored on new bookings/payouts. */
export const PRICING_VERSION = '2026-10-v750'

export const PAYOUT_VERSION = '2026-08-fixed-200'

/** @deprecated Use BRIEFING_PRICE_CENTS */
export const CANONICAL_ATTENDANCE_FEE_CENTS = BRIEFING_PRICE_CENTS

export function isAttendanceFree(cents = resolveBriefingPriceCents()): boolean {
  return !Number.isFinite(cents) || cents <= 0
}

export function formatBriefingPriceZar(cents = BRIEFING_PRICE_CENTS): string {
  if (isAttendanceFree(cents)) return 'Free'
  return `R${(cents / 100).toFixed(2)}`
}

export function formatYouthAgentPayoutZar(cents = YOUTH_AGENT_PAYOUT_CENTS): string {
  return `R${(cents / 100).toFixed(2)}`
}

export const BRIEFING_PRICE_LABEL = formatBriefingPriceZar()

/** Whole-rand label for SEO/marketing copy — derived from canonical cents. */
export const BRIEFING_PRICE_SHORT_LABEL = isAttendanceFree()
  ? 'Free'
  : `R${Math.round(BRIEFING_PRICE_CENTS / 100)}`

export function resolveBriefingPriceCents(): number {
  const server = process.env.ATTENDANCE_FEE_CENTS
  if (server != null && server !== '') {
    const n = Number(server)
    if (Number.isFinite(n) && n >= 0) return Math.round(n)
  }
  return BRIEFING_PRICE_CENTS
}

/**
 * Youth Agent payout (cents). Prefer per-assignment override on the request,
 * then env, then default constant. Never exposed on SME invoices.
 */
export function resolveYouthAgentPayoutCents(
  request?: {
    agentPayoutCents?: unknown
    agentPayoutCentsOverride?: unknown
  } | null
): number {
  if (request && typeof request === 'object') {
    const override = Number(
      request.agentPayoutCents != null
        ? request.agentPayoutCents
        : request.agentPayoutCentsOverride
    )
    if (Number.isFinite(override) && override > 0) return Math.round(override)
  }
  const env = process.env.YOUTH_AGENT_PAYOUT_CENTS
  if (env != null && env !== '') {
    const n = Number(env)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return YOUTH_AGENT_PAYOUT_CENTS
}

export function grossContributionForRevenueCents(
  briefingRevenueCents: number,
  request?: { agentPayoutCents?: unknown; agentPayoutCentsOverride?: unknown } | null
): number {
  const revenue = Math.round(Number(briefingRevenueCents) || 0)
  const payout = resolveYouthAgentPayoutCents(request)
  return Math.max(0, revenue - payout)
}

export function briefingPriceSnapshotFields() {
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
export function multiBriefingPriceSnapshotFields(briefingCount: number) {
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

/** Founder-only live PayFast pipeline certification amount — never commercial price. */
export const LIVE_CERTIFICATION_AMOUNT_CENTS = 7500
export const LIVE_CERTIFICATION_PURPOSE = 'payfast_live_certification'
export const LIVE_CERTIFICATION_SOURCE = 'payfast_live_certification'

export type BriefingLineShape = {
  tenderNumber?: string | null
  tenderDescription?: string | null
  description?: string | null
  [key: string]: unknown
}

export type ChargeRequestShape = {
  paymentStatus?: string | null
  briefingPriceCents?: number | null
  quotedFee?: number | null
  paymentAmount?: number | null
  purpose?: string | null
  source?: string | null
  singleUse?: boolean | null
  expectedAmountCents?: number | null
  certificationAmountCents?: number | null
  serverAuthorizedCertification?: boolean | null
  /** Structured child briefing lines — never trust client quantity alone. */
  briefingLines?: BriefingLineShape[] | null
  briefingCount?: number | null
}

/**
 * Count structured briefing lines on an order.
 * Returns null when the document has no briefingLines array (legacy single-unit).
 * Never trusts client-supplied briefingCount without matching lines.
 */
export function countStructuredBriefingLines(
  request?: ChargeRequestShape | null
): number | null {
  if (!request || !Array.isArray(request.briefingLines)) return null
  if (request.briefingLines.length < 1) return null
  return request.briefingLines.length
}

/** TOTAL = briefingCount × unit price (server unit only). */
export function chargeCentsForBriefingCount(briefingCount: number): number {
  const unit = resolveBriefingPriceCents()
  if (isAttendanceFree(unit)) return 0
  const count = Math.max(0, Math.round(Number(briefingCount) || 0))
  return count * unit
}

/**
 * Server-authorized R75 certification booking only.
 * Client-forged purpose/amount fields without serverAuthorizedCertification are ignored.
 */
export function resolveLiveCertificationChargeCents(
  request?: ChargeRequestShape | null
): number | null {
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
 * Resolve PayFast charge / ITN expected amount.
 * Unpaid fee snapshots are ignored — only structured briefingLines drive multi-briefing
 * totals (count × unit). Paid snapshots are trusted for historical accounting.
 * Server-authorized live-certification bookings charge the locked certification amount.
 */
export function resolveRequestChargeCents(
  request?: ChargeRequestShape | null
): number {
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
    // Recalculate from stored lines × unit — ignore client/stored totals & quantity claims.
    return chargeCentsForBriefingCount(lineCount)
  }

  return canonical
}
