'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { startPayFastFromApiPayload } from '@/lib/payments/payfastClient'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'

export default function RetryPaymentButton({
  requestId,
  className = '',
}: {
  requestId: string
  className?: string
}) {
  const [loading, setLoading] = useState(false)

  const handleRetry = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/payments/payfast/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ attendanceRequestId: requestId }),
      })
      const json = await res.json()
      if (!json.success) {
        if (json.code === 'PAYFAST_NOT_CONFIGURED' || json.code === 'YOCO_NOT_CONFIGURED') {
          throw new Error(
            json.error ||
              'Online payments are not configured yet. Your request stays pending until payment is enabled.'
          )
        }
        throw new Error(json.error || 'Could not start payment')
      }
      startPayFastFromApiPayload(json.data || {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={loading}
      className={
        className ||
        'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50'
      }
    >
      {loading ? 'Redirecting…' : `Pay ${ATTENDANCE_FEE_LABEL} with PayFast`}
    </button>
  )
}
