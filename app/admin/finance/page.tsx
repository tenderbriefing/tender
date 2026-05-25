import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import FinanceOpsPanel from '@/components/admin/FinanceOpsPanel'

export default function AdminFinancePage() {
  return (
    <AdminOpsPageShell
      kicker="Finance"
      title="Financial operations"
      description="Commissions, payouts, reconciliation, and enterprise billing."
    >
      <FinanceOpsPanel />
    </AdminOpsPageShell>
  )
}
