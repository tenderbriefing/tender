import type { UserProfile } from '@/lib/auth'
import { ADMIN_HEADER_NAV } from '@/lib/admin/controlCentre'

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

/** Lean authenticated header nav — full catalogue lives in control centre Modules. */
export const ADMIN_NAV = ADMIN_HEADER_NAV

export const PUBLIC_NAV = [
  { name: 'Home', href: '/' },
  { name: 'Tender Opportunities', href: '/tenders' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Support', href: '/support' },
] as const
