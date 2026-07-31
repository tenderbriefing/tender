import { redirect } from 'next/navigation'

/** Legacy connector bookings UI — attendance requests live under /sme/requests. */
export default function BookingsPage() {
  redirect('/sme/requests')
}
