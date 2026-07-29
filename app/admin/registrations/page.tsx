import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import RegistrationsPanel from '@/components/admin/RegistrationsPanel'

export default function AdminRegistrationsPage() {
  return (
    <AdminOpsPageShell
      kicker="People"
      title="Registrations"
      description="Full directory of SMEs and Youth Agents who registered on TenderBriefing."
      breadcrumb={{ label: 'Admin dashboard', href: '/admin/dashboard' }}
    >
      <RegistrationsPanel compact={false} showHeaderLink={false} />
    </AdminOpsPageShell>
  )
}
