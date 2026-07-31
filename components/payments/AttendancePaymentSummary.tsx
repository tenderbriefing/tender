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
  const isPaid =
    request.paymentStatus === 'paid' || request.paymentStatus === 'not_required'

  if (needsPayment) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <PaymentStatusBadge status={request.paymentStatus} />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Action needed
          </span>
        </div>
        <h3 className="mt-3 text-base font-bold text-brand-900">
          Complete payment to dispatch your agent
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Youth Agents are only notified after you pay{' '}
          <span className="font-semibold text-brand-900">{amount}</span>. This takes about a
          minute on PayFast.
        </p>
        {request.paymentReference && (
          <p className="mt-2 text-xs text-slate-500">Ref: {request.paymentReference}</p>
        )}
        {request.paymentFailureReason && (
          <p className="mt-2 text-xs text-red-700">{request.paymentFailureReason}</p>
        )}
        {showRetry && (
          <div className="mt-4">
            <RetryPaymentButton
              requestId={request.id}
              className="inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-accent-500 px-4 py-3 text-sm font-bold text-brand-900 shadow-gold hover:bg-accent-400 disabled:opacity-50 sm:w-auto"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <PaymentStatusBadge status={request.paymentStatus} />
        {request.paymentProvider && request.paymentProvider !== 'none' && (
          <span className="text-xs text-slate-600">via {request.paymentProvider}</span>
        )}
        {isPaid && (
          <span className="text-xs font-semibold text-emerald-700">Agents can accept</span>
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
    </div>
  )
}
