/**
 * Fail-closed feature flag for Procurement Intelligence Phase 1.
 *
 * Semantics (authenticated pilot mandate):
 * - `PROCUREMENT_INTELLIGENCE_ENABLED=false` means **not globally enabled**.
 * - Non-empty `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` grants access to those exact
 *   Firebase Auth UIDs only (pilot path), even while the global flag is false.
 * - Empty allow-list + global flag false ⇒ deny everyone.
 * - When globally enabled: admins may access; SMEs still require the allow-list.
 * - `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` is advisory UI only and must
 *   never authorize data. Prefer server API probe for pilot visibility.
 */

function truthy(v: string | undefined | null): boolean {
  if (!v) return false
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/** Parse comma-separated pilot UIDs (trimmed, non-empty). */
export function parseProcurementIntelligencePilotUids(
  raw: string | undefined | null = process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS
): string[] {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Server-side global enablement gate (not the only path to access). */
export function isProcurementIntelligenceEnabled(): boolean {
  return truthy(process.env.PROCUREMENT_INTELLIGENCE_ENABLED)
}

/** Client-safe mirror — must not alone authorize sensitive data. */
export function isProcurementIntelligenceUiEnabled(): boolean {
  return (
    truthy(process.env.NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED) &&
    // Prefer also requiring server flag when both present in SSR; client-only is advisory.
    (typeof window === 'undefined'
      ? isProcurementIntelligenceEnabled() ||
        truthy(process.env.NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED)
      : truthy(process.env.NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED))
  )
}

/**
 * Pilot allow-list (comma-separated UIDs).
 * Independent of the global ENABLED flag so pilots can be activated while
 * both public/server global flags remain false.
 * Fail-closed: empty list means no UID matches.
 */
export function isProcurementIntelligencePilotUser(uid: string | null | undefined): boolean {
  if (!uid) return false
  const list = parseProcurementIntelligencePilotUids()
  if (list.length === 0) return false
  return list.includes(uid)
}

/**
 * Authoritative access decision for the intelligence API.
 * Pilot UID match wins even when globally disabled.
 */
export function canAccessProcurementIntelligence(opts: {
  uid: string | null | undefined
  userType?: string | null
}): boolean {
  if (isProcurementIntelligencePilotUser(opts.uid)) return true
  if (!isProcurementIntelligenceEnabled()) return false
  // Global enablement: admins allowed; SMEs must be on the allow-list (checked above).
  return opts.userType === 'admin'
}
