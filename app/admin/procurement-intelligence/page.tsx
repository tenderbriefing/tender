'use client'

import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import ProcurementIntelligencePanel from '@/components/admin/ProcurementIntelligencePanel'

export default function ProcurementIntelligencePage() {
  return (
    <AdminOpsPageShell
      kicker="Procurement intelligence"
      title="Multi-source aggregation"
      description="National procurement sources, AI briefing detection, PDF extraction, and deduplication across eTenders, SOEs, and municipalities."
      breadcrumb={{ label: 'Operations', href: '/admin/operations' }}
    >
      <ProcurementIntelligencePanel />
    </AdminOpsPageShell>
  )
}
