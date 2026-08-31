import { dashboardPathForRole, homePathForProfile } from '@/lib/auth/redirects'
import type { UserProfile } from '@/lib/auth'

export type PlatformRole = 'sme' | 'youth-agent' | 'admin'
export type RegistrationJourney = 'sme' | 'youth-agent' | 'signin'

/** Roles that Google registration may create — never admin. */
export const GOOGLE_BOOTSTRAP_ROLES = ['sme', 'youth-agent'] as const
export type GoogleBootstrapRole = (typeof GOOGLE_BOOTSTRAP_ROLES)[number]

export const APPROVED_GOOGLE_AUTH_ERROR_CODES = [
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/account-exists-with-different-credential',
  'auth/network-request-failed',
  'auth/user-disabled',
  'auth/unauthorized-domain',
  'auth/operation-not-allowed',
  'auth/internal-error',
  'unknown',
] as const

export type ApprovedGoogleAuthErrorCode = (typeof APPROVED_GOOGLE_AUTH_ERROR_CODES)[number]

export function isGoogleBootstrapRole(value: unknown): value is GoogleBootstrapRole {
  return value === 'sme' || value === 'youth-agent'
}

/**
 * Existing profiles keep their role. New profiles may only receive sme | youth-agent.
 * Client-supplied admin is rejected.
 */
export function resolveBootstrapRole(input: {
  existingUserType?: string | null
  intendedRole?: string | null
}): { role: PlatformRole | null; createdFromIntent: boolean; rejectedAdminIntent: boolean } {
  const existing = input.existingUserType
  if (existing === 'sme' || existing === 'youth-agent' || existing === 'admin') {
    return { role: existing, createdFromIntent: false, rejectedAdminIntent: false }
  }
  if (input.intendedRole === 'admin') {
    return { role: null, createdFromIntent: false, rejectedAdminIntent: true }
  }
  if (isGoogleBootstrapRole(input.intendedRole)) {
    return { role: input.intendedRole, createdFromIntent: true, rejectedAdminIntent: false }
  }
  return { role: null, createdFromIntent: false, rejectedAdminIntent: false }
}

export function isProfileSuspended(profile: Partial<UserProfile> | null | undefined): boolean {
  if (!profile) return false
  if ((profile as { suspended?: boolean }).suspended === true) return true
  if (profile.verificationStatus === 'suspended') return true
  return false
}

export function onboardingPathForRole(userType: PlatformRole): string {
  if (userType === 'youth-agent') return '/agent/onboarding'
  if (userType === 'sme') return '/sme/onboarding'
  return dashboardPathForRole(userType)
}

export function resolvePostAuthDestination(profile: UserProfile): {
  blocked: boolean
  blockReason?: string
  path: string
  onboardingRequired: boolean
} {
  if (isProfileSuspended(profile)) {
    return {
      blocked: true,
      blockReason: 'This account is suspended. Contact support.',
      path: '/auth/signin',
      onboardingRequired: false,
    }
  }
  if (!profile.userType) {
    return {
      blocked: false,
      path: '/auth/role-selection?recover=1',
      onboardingRequired: true,
    }
  }
  if (profile.onboardingCompleted !== true && (profile.userType === 'sme' || profile.userType === 'youth-agent')) {
    return {
      blocked: false,
      path: onboardingPathForRole(profile.userType),
      onboardingRequired: true,
    }
  }
  return {
    blocked: false,
    path: homePathForProfile(profile),
    onboardingRequired: false,
  }
}

export function sanitizeAuthErrorCode(code: unknown): ApprovedGoogleAuthErrorCode {
  if (typeof code === 'string' && (APPROVED_GOOGLE_AUTH_ERROR_CODES as readonly string[]).includes(code)) {
    return code as ApprovedGoogleAuthErrorCode
  }
  return 'unknown'
}

/** Privileged fields clients must never set or escalate. */
export const PRIVILEGED_USER_FIELDS = [
  'userType',
  'role',
  'founderAccess',
  'verificationStatus',
  'verified',
  'suspended',
  'reliabilityScore',
  'missedBriefingCount',
  'completedBriefingCount',
  'acceptedBriefingCount',
  'rating',
  'totalJobs',
  'isTestAccount',
  'testAccountKind',
] as const

export function stripPrivilegedFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  const out: Record<string, unknown> = { ...data }
  for (const key of PRIVILEGED_USER_FIELDS) {
    delete out[key]
  }
  return out as Partial<T>
}
