'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'

export default function NewProcurementTenderPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createDraft() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch('/api/procurement/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Failed to create draft')
        return
      }
      router.replace(`/procurement/tenders/${json.data.tender.id}`)
    } catch {
      setError('Failed to create draft')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 text-center">
      <h1 className="text-2xl font-bold text-brand-950">New tender</h1>
      <p className="text-sm text-slate-600">
        Create a draft in your organisation workspace. You can save and submit for Founder review when
        ready. Publishing is never automatic.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={createDraft}
        className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create draft'}
      </button>
    </div>
  )
}
