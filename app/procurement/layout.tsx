import type { Metadata } from 'next'
import ProcurementShell from '@/components/procurement/ProcurementShell'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_ROBOTS,
  title: 'Procurement workspace',
  description: 'Private sector organisation tender management',
}

export default function ProcurementLayout({ children }: { children: React.ReactNode }) {
  return <ProcurementShell>{children}</ProcurementShell>
}
