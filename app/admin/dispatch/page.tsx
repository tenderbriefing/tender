import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import DispatchOpsPanel from '@/components/admin/DispatchOpsPanel'

export default function AdminDispatchPage() {
  return (
    <AdminOpsPageShell
      kicker="Dispatch"
      title="National dispatch operations"
      description="Live briefings, congestion by province, and active field assignments."
    >
      <DispatchOpsPanel />
    </AdminOpsPageShell>
  )
}
