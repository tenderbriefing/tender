/** Fail-closed founder access — server and client helpers. */

export const FOUNDER_FEATURE_FLAG = 'founder_user_intelligence'
export const FOUNDER_DASHBOARD_V2_FLAG = 'founder_dashboard_v2'

function envFlagOn(value?: string | null): boolean {
  if (!value) return false
  const s = value.trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export function isFounderIntelligenceEnabled(): boolean {
  return envFlagOn(process.env.FOUNDER_USER_INTELLIGENCE_ENABLED)
}

/** Client-visible mirror; still fail-closed unless explicitly enabled. */
export function isFounderIntelligenceEnabledClient(): boolean {
  return envFlagOn(process.env.NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE)
}

/**
 * Founder Dashboard V2 shell. Defaults on so this branch delivers the executive UI.
 * Set FOUNDER_DASHBOARD_V2=false (and NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false) to restore
 * the previous Home + User Intelligence founder chrome without deleting V2 routes.
 */
export function isFounderDashboardV2Enabled(): boolean {
  const v = process.env.FOUNDER_DASHBOARD_V2
  if (v == null || v === '') return true
  return envFlagOn(v)
}

export function isFounderDashboardV2EnabledClient(): boolean {
  const v = process.env.NEXT_PUBLIC_FOUNDER_DASHBOARD_V2
  if (v == null || v === '') return isFounderDashboardV2Enabled()
  return envFlagOn(v)
}

export function founderEmailAllowlist(): string[] {
  const raw =
    process.env.FOUNDER_EMAIL_ALLOWLIST ||
    process.env.NEXT_PUBLIC_FOUNDER_EMAIL_ALLOWLIST ||
    'info@tenderbriefing.co.za'
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isFounderEmail(email?: string | null): boolean {
  if (!email) return false
  return founderEmailAllowlist().includes(email.trim().toLowerCase())
}

export type FounderAccessDenial =
  | 'flag_disabled'
  | 'unauthorized'
  | 'forbidden_not_admin'
  | 'forbidden_not_founder'

export function evaluateFounderAccess(input: {
  enabled: boolean
  authenticated: boolean
  userType?: string | null
  email?: string | null
  founderAccess?: boolean
}): { ok: true } | { ok: false; reason: FounderAccessDenial } {
  if (!input.enabled) return { ok: false, reason: 'flag_disabled' }
  if (!input.authenticated) return { ok: false, reason: 'unauthorized' }
  if (input.userType !== 'admin') return { ok: false, reason: 'forbidden_not_admin' }
  if (input.founderAccess === true || isFounderEmail(input.email)) {
    return { ok: true }
  }
  return { ok: false, reason: 'forbidden_not_founder' }
}
