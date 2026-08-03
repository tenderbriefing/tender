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

export const ADMIN_NAV = [
  { name: 'Dashboard', href: '/admin/dashboard' },
  { name: 'Registrations', href: '/admin/registrations' },
  { name: 'Operations', href: '/admin/operations' },
  { name: 'Dispatch', href: '/admin/dispatch' },
  { name: 'Agent Workspace', href: '/admin/agent-workspace' },
  { name: 'AI Insights', href: '/admin/ai-insights' },
  { name: 'Procurement Intel', href: '/admin/procurement-intelligence' },
  { name: 'RFQ Inbox', href: '/admin/procurement-inbox' },
  { name: 'Pilot', href: '/admin/pilot' },
] as const

export const PUBLIC_NAV = [
  { name: 'Home', href: '/' },
  { name: 'Tender Opportunities', href: '/tenders' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Support', href: '/support' },
] as const
