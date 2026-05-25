import type { UserProfile } from '@/lib/auth'

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
  { name: 'Briefing Reports', href: '/sme/requests' },
  { name: 'Profile', href: '/settings' },
] as const

export const AGENT_NAV = [
  { name: 'Available Assignments', href: '/jobs' },
  { name: 'Assigned Briefings', href: '/agent/dashboard' },
  { name: 'Completed Reports', href: '/agent/dashboard' },
  { name: 'Profile', href: '/settings' },
] as const

export const ADMIN_NAV = [
  { name: 'Dashboard', href: '/admin/dashboard' },
  { name: 'Operations', href: '/admin/operations' },
  { name: 'Executive', href: '/admin/executive' },
  { name: 'Pilot', href: '/admin/pilot' },
  { name: 'Sync Status', href: '/admin/dashboard' },
] as const

export const PUBLIC_NAV = [
  { name: 'Home', href: '/' },
  { name: 'Tender Opportunities', href: '/tenders' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Support', href: '/support' },
] as const
