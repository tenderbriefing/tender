import type { Metadata } from 'next'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'

export const metadata: Metadata = PRIVATE_ROUTE_ROBOTS

export default function AgentDashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
