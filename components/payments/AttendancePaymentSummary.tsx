'use client'

import PaymentStatusBadge from '@/components/payments/PaymentStatusBadge'
import RetryPaymentButton from '@/components/payments/RetryPaymentButton'
import { ATTENDANCE_FEE_LABEL, formatAttendanceFeeZar } from '@/lib/payments/attendanceFee'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'

export default function AttendancePaymentSummary({
  request,
  showRetry = true,
}: {
  request: EnrichedAttendanceRequest
  showRetry?: boolean
}) {
  const amount =
    request.paymentAmount != null
      ? formatAttendanceFeeZar(request.paymentAmount)
      : ATTENDANCE_FEE_LABEL
  const needsPayment =
    request.paymentStatus === 'pending' ||
    request.paymentStatus === 'failed' ||
    request.paymentStatus === 'cancelled'

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <PaymentStatusBadge status={request.paymentStatus} />
        {request.paymentProvider && request.paymentProvider !== 'none' && (
          <span className="text-xs text-slate-600">via {request.paymentProvider}</span>
        )}
      </div>
      <p className="mt-2 text-slate-700">
        <span className="font-semibold text-slate-900">Amount:</span> {amount}
      </p>
      {request.paymentReference && (
        <p className="mt-1 text-xs text-slate-500">Ref: {request.paymentReference}</p>
      )}
      {request.paidAt && (
        <p className="mt-1 text-xs text-slate-500">
          Paid: {new Date(request.paidAt).toLocaleString()}
        </p>
      )}
      {request.paymentFailureReason && (
        <p className="mt-2 text-xs text-red-700">{request.paymentFailureReason}</p>
      )}
      {showRetry && needsPayment && (
        <div className="mt-3">
          <RetryPaymentButton requestId={request.id} />
        </div>
      )}
    </div>
  )
}
