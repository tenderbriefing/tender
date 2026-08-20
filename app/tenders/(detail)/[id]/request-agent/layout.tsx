import type { Metadata } from 'next'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_ROBOTS,
  title: 'Request Youth Agent',
  description: 'Request a Youth Agent to attend a compulsory tender briefing on your behalf.',
}

export default function RequestAgentLayout({ children }: { children: React.ReactNode }) {
  return children
}
