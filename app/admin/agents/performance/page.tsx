import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import AgentPerformanceOpsPanel from '@/components/admin/AgentPerformanceOpsPanel'

export default function AdminAgentPerformancePage() {
  return (
    <AdminOpsPageShell
      kicker="Agents"
      title="Performance & audits"
      description="Reliability tiers, lateness, missed briefings, and audit recommendations."
      breadcrumb={{ label: 'Operations', href: '/admin/operations' }}
    >
      <AgentPerformanceOpsPanel />
    </AdminOpsPageShell>
  )
}
