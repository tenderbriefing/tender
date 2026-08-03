'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { toast } from 'react-hot-toast'

export default function SmeVerifyPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [requestId, setRequestId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) router.push('/auth/signin')
    else if (userProfile && userProfile.userType !== 'sme' && userProfile.userType !== 'admin') {
      router.push('/')
    }
  }, [user, userProfile, loading, router])

  async function decide(decision: 'verify' | 'reject') {
    if (!requestId.trim()) {
      toast.error('Enter assignment request ID')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/agent/workspace/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: requestId.trim(), decision, notes }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed')
      toast.success(decision === 'verify' ? 'Report verified' : 'Report rejected')
      setNotes('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Verify field reports</h1>
        <p className="mt-2 text-sm text-slate-600">
          Confirm or reject locked Youth Agent field reports for your attendance requests.
        </p>
        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <label className="block text-sm font-medium text-slate-700">
            Assignment request ID
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="attendance request id"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notes (optional)
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('verify')}
              className="min-h-[44px] flex-1 rounded-lg bg-brand-600 font-semibold text-white disabled:opacity-50"
            >
              Verify
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('reject')}
              className="min-h-[44px] flex-1 rounded-lg border border-slate-300 font-semibold text-slate-800 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
