/**
 * Client-readable mirror of FOUNDER_SME_OUTREACH_ENABLED (NEXT_PUBLIC_ optional).
 * Server still enforces the private flag — UI hide alone is insufficient.
 */
export function isFounderSmeOutreachEnabledClient(): boolean {
  const pub = process.env.NEXT_PUBLIC_FOUNDER_SME_OUTREACH_ENABLED
  const raw = pub != null && String(pub).trim() !== '' ? pub : process.env.FOUNDER_SME_OUTREACH_ENABLED
  if (raw == null) return false
  const v = String(raw).trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}
