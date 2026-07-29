import type { Metadata } from 'next'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'
import FounderAuthGuard from '@/components/founder/FounderAuthGuard'

export const metadata: Metadata = PRIVATE_ROUTE_ROBOTS

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return <FounderAuthGuard>{children}</FounderAuthGuard>
}
