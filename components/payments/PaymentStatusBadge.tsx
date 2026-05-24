'use client'

import type { AttendancePaymentStatus } from '@/lib/payments/attendanceFee'

const STYLES: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-900',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-700',
  refunded: 'bg-violet-100 text-violet-800',
  not_required: 'bg-slate-100 text-slate-600',
}

export default function PaymentStatusBadge({
  status,
}: {
  status?: AttendancePaymentStatus | string | null
}) {
  const key = status || 'pending'
  const label = key.replace(/_/g, ' ')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STYLES[key] || STYLES.pending}`}
    >
      Payment: {label}
    </span>
  )
}
