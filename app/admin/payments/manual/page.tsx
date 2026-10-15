import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import ManualPaymentsPanel from '@/components/admin/ManualPaymentsPanel'

export default function AdminManualPaymentsPage() {
  return (
    <AdminOpsPageShell
      kicker="Payments"
      title="Manual bookings"
      description="Create R750 invoices and secure PayFast payment links for emailed RFQs that are not in the tender catalogue."
    >
      <ManualPaymentsPanel />
    </AdminOpsPageShell>
  )
}
