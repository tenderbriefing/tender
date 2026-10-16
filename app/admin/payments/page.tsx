import { redirect } from 'next/navigation'

/** /admin/payments has no index — manual bookings live under /manual. */
export default function AdminPaymentsIndexPage() {
  redirect('/admin/payments/manual')
}
