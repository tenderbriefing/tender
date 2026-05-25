import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import AiInsightsPanel from '@/components/admin/AiInsightsPanel'

export default function AdminAiInsightsPage() {
  return (
    <AdminOpsPageShell
      kicker="AI"
      title="Procurement intelligence"
      description="Opportunity scoring, province demand, sector trends, and pricing intelligence."
    >
      <AiInsightsPanel />
    </AdminOpsPageShell>
  )
}
