import type { Metadata, Viewport } from 'next'
import WorkspaceGate from '@/components/agent/workspace/WorkspaceGate'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_ROBOTS,
  title: 'Agent Workspace',
  description: 'TenderBriefing Youth Agent field operations workspace',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TB Workspace',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#16a34a',
}

export default function AgentWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceGate>{children}</WorkspaceGate>
}
