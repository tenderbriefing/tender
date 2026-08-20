import type { Metadata } from 'next'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_ROBOTS,
  title: 'Settings',
  description: 'Manage your TenderBriefing account settings.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
