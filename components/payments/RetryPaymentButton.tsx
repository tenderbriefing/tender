'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'

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
      const res = await authFetch('/api/payments/yoco/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ attendanceRequestId: requestId }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || 'Could not start payment')
      }
      const url = json.data?.redirectUrl
      if (!url) throw new Error('No payment URL returned')
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally {
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
      {loading ? 'Redirecting…' : 'Pay R249.00 with Yoco'}
    </button>
  )
}
