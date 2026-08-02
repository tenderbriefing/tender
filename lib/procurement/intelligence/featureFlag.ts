/**
 * Fail-closed feature flag for Procurement Intelligence Phase 1.
 * Enable with PROCUREMENT_INTELLIGENCE_ENABLED=true (server) and
 * NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED=true (client UI).
 */

function truthy(v: string | undefined | null): boolean {
  if (!v) return false
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/** Server-side authoritative gate. */
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
 * Fail-closed: empty list means no SME is authorised (admins may still use API).
 * Add approved UIDs via PROCUREMENT_INTELLIGENCE_PILOT_UIDS in Secret Manager / Cloud Run env.
 */
export function isProcurementIntelligencePilotUser(uid: string | null | undefined): boolean {
  if (!isProcurementIntelligenceEnabled()) return false
  const raw = process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS || ''
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (list.length === 0) return false
  if (!uid) return false
  return list.includes(uid)
}
