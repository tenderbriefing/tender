'use client'

import AdminOpsPageShell from '@/components/admin/AdminOpsPageShell'
import ProcurementInboxPanel from '@/components/admin/ProcurementInboxPanel'

export default function AdminProcurementInboxPage() {
  return (
    <AdminOpsPageShell
      kicker="RFQ inbox"
      title="Procurement inbox"
      description="Review forwarded RFQ emails, run AI extraction, and convert approved opportunities to private dispatch-ready briefings."
      breadcrumb={{ label: 'Procurement intel', href: '/admin/procurement-intelligence' }}
    >
      <ProcurementInboxPanel />
    </AdminOpsPageShell>
  )
}
