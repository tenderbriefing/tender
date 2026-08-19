import type { UserProfile } from '@/lib/auth'
import { ADMIN_HEADER_NAV, getAdminHeaderNav } from '@/lib/admin/controlCentre'
import {
  evaluateFounderAccess,
  isFounderIntelligenceEnabled,
  isFounderIntelligenceEnabledClient,
} from '@/lib/founder/access'

export function dashboardPathForRole(userType?: UserProfile['userType']): string {
  switch (userType) {
    case 'youth-agent':
      return '/agent/dashboard'
    case 'admin':
      return '/admin/dashboard'
    case 'sme':
    default:
      return '/sme/dashboard'
  }
}

/** Signed-in home: founders land on /founder, everyone else on their role dashboard. */
export function homePathForProfile(profile?: {
  userType?: UserProfile['userType'] | string | null
  email?: string | null
  founderAccess?: boolean
} | null): string {
  const userType = (profile?.userType || undefined) as UserProfile['userType'] | undefined
  const founderOk = evaluateFounderAccess({
    enabled: isFounderIntelligenceEnabled() || isFounderIntelligenceEnabledClient(),
    authenticated: true,
    userType,
    email: profile?.email,
    founderAccess: profile?.founderAccess === true,
  }).ok
  if (founderOk) return '/founder'
  return dashboardPathForRole(userType)
}

export const SME_NAV = [
  { name: 'Tender Opportunities', href: '/tenders' },
  { name: 'My Requests', href: '/sme/requests' },
  { name: 'Verify reports', href: '/sme/verify' },
  { name: 'Profile', href: '/settings' },
] as const

export const AGENT_NAV = [
  { name: 'Workspace', href: '/agent/workspace/today' },
  { name: 'Available Assignments', href: '/jobs' },
  { name: 'Assigned Briefings', href: '/agent/dashboard' },
  { name: 'Field app', href: '/agent/mobile/dispatch' },
  { name: 'Profile', href: '/settings' },
] as const

/** Lean authenticated header nav — full catalogue lives in the operations console. */
export const ADMIN_NAV = ADMIN_HEADER_NAV

export function adminNavForUser(opts: { showFounder: boolean; founderV2?: boolean }) {
  return getAdminHeaderNav(opts)
}

export const PUBLIC_NAV = [
  { name: 'Home', href: '/' },
  { name: 'Tender Opportunities', href: '/tenders' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Support', href: '/support' },
] as const
