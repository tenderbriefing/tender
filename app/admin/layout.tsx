import type { Metadata } from 'next'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'

export const metadata: Metadata = PRIVATE_ROUTE_ROBOTS

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGuard>{children}</AdminAuthGuard>
}
