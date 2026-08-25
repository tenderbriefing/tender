'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'

function OrganisationForm() {
  const search = useSearchParams()
  const onboarding = search.get('onboarding') === '1'
  const [form, setForm] = useState({
    legalName: '',
    tradingName: '',
    registrationNumber: '',
    website: '',
    organisationType: 'private_company',
    industry: '',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
  })
  const [exists, setExists] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const res = await authFetch('/api/procurement/organisation')
      const json = await res.json()
      if (json?.data?.organisation) {
        const o = json.data.organisation
        setExists(true)
        setForm({
          legalName: o.legalName || '',
          tradingName: o.tradingName || '',
          registrationNumber: o.registrationNumber || '',
          website: o.website || '',
          organisationType: o.organisationType || 'private_company',
          industry: o.industry || '',
          primaryContactName: o.primaryContactName || '',
          primaryContactEmail: o.primaryContactEmail || '',
          primaryContactPhone: o.primaryContactPhone || '',
        })
      }
    })()
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (!exists) {
        const res = await authFetch('/api/procurement/organisation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json?.error || 'Create failed')
          return
        }
        setExists(true)
        setMessage('Organisation created')
        if (onboarding) window.location.href = '/procurement'
        return
      }
      const res = await authFetch('/api/procurement/organisation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Update failed')
        return
      }
      setMessage('Organisation updated')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-950">Organisation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Company profile used for private tender submissions. Verification is Founder-controlled.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        {(
          [
            ['legalName', 'Legal name'],
            ['tradingName', 'Trading name'],
            ['registrationNumber', 'Registration number'],
            ['website', 'Website'],
            ['industry', 'Industry'],
            ['primaryContactName', 'Primary contact'],
            ['primaryContactEmail', 'Contact email'],
            ['primaryContactPhone', 'Contact phone'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="font-semibold text-slate-700">{label}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">Organisation type</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={form.organisationType}
            onChange={(e) => setForm((f) => ({ ...f, organisationType: e.target.value }))}
          >
            <option value="private_company">Private company</option>
            <option value="nonprofit">Nonprofit</option>
            <option value="soe">State-owned enterprise</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {exists ? 'Save changes' : 'Create organisation'}
      </button>
    </div>
  )
}

export default function ProcurementOrganisationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <OrganisationForm />
    </Suspense>
  )
}
