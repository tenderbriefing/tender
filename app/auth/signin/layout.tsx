import type { Metadata } from 'next'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_ROBOTS,
  title: 'Sign in',
  description: 'Sign in to your TenderBriefing SME or Youth Agent account.',
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
