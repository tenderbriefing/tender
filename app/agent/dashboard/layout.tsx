import type { Metadata } from 'next'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'
import RequireCompletedOnboarding from '@/components/auth/RequireCompletedOnboarding'

export const metadata: Metadata = PRIVATE_ROUTE_ROBOTS

export default function AgentDashboardLayout({ children }: { children: React.ReactNode }) {
  return <RequireCompletedOnboarding>{children}</RequireCompletedOnboarding>
}
