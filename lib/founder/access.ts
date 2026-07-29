/** Fail-closed founder access — server and client helpers. */

export const FOUNDER_FEATURE_FLAG = 'founder_user_intelligence'

export function isFounderIntelligenceEnabled(): boolean {
  const v = process.env.FOUNDER_USER_INTELLIGENCE_ENABLED
  return v === '1' || v === 'true' || v === 'yes'
}

/** Client-visible mirror; still fail-closed unless explicitly enabled. */
export function isFounderIntelligenceEnabledClient(): boolean {
  const v = process.env.NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE
  return v === '1' || v === 'true' || v === 'yes'
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
