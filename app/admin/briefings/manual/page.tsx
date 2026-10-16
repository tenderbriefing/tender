import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import ManualPaymentsPanel from '@/components/admin/ManualPaymentsPanel'

export default function AdminCreateManualBriefingRequestPage() {
  return (
    <AdminOpsPageShell
      kicker="Briefings"
      title="Create Manual Request"
      description="Sell briefing attendance for emailed RFQs that are not in the TenderBriefing catalogue. Server-authoritative R750 × briefings, certified invoice, and PayFast payment link."
    >
      <ManualPaymentsPanel />
    </AdminOpsPageShell>
  )
}
