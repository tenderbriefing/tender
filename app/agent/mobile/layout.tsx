import type { Metadata, Viewport } from 'next'
import { AGENT_FIELD_MANIFEST } from '@/lib/mobile/constants'
import MobileFieldBootstrap from './MobileFieldBootstrap'

export const metadata: Metadata = {
  title: 'Field App',
  description: 'TenderBriefing youth agent field operations',
  manifest: AGENT_FIELD_MANIFEST,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TB Field',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#16a34a',
}

export default function AgentMobileLayout({ children }: { children: React.ReactNode }) {
  return <MobileFieldBootstrap>{children}</MobileFieldBootstrap>
}
