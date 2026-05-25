import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import FraudOpsPanel from '@/components/admin/FraudOpsPanel'

export default function AdminFraudPage() {
  return (
    <AdminOpsPageShell
      kicker="Trust"
      title="Fraud & integrity"
      description="GPS anomalies, duplicate attendance, and suspicious agent activity."
    >
      <FraudOpsPanel />
    </AdminOpsPageShell>
  )
}
