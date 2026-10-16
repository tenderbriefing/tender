import { redirect } from 'next/navigation'

/** Index without request id — send ops back to the command centre. */
export default function AdminDeliveryIndexPage() {
  redirect('/admin/operations')
}
