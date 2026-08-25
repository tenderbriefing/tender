'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet } from '@/lib/agent/workspace/clientApi'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { YA_BANK_ACCOUNT_TYPES } from '@/lib/finance/youthAgentBankingTypes'

type Profile = {
  uid: string
  displayName: string
  email: string | null
  phone: string | null
  province: string | null
  verified: boolean
  verificationStatus: string
  transportAvailable?: boolean
  reliabilityScore: number | null
  userType: string
}

type BankingPublic = {
  accountHolderName: string
  bankName: string
  accountNumberMasked: string
  accountType: string
  branchCode: string
  bankAccountNickname?: string | null
  version: number
  updatedAt: string
  isComplete: boolean
}

const emptyForm = {
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  accountType: 'cheque',
  branchCode: '',
  bankAccountNickname: '',
}

export default function WorkspaceProfilePage() {
  const [data, setData] = useState<Profile | null>(null)
  const [banking, setBanking] = useState<BankingPublic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  const loadBanking = useCallback(async () => {
    const res = await authFetch('/api/agent/banking')
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to load banking details')
    }
    setBanking(json.data || null)
    if (!json.data) setEditing(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await workspaceGet<Profile>('/api/agent/workspace/profile')
        if (cancelled) return
        setData(d)
        try {
          await loadBanking()
        } catch (bankErr) {
          if (!cancelled) {
            setSaveError(bankErr instanceof Error ? bankErr.message : 'Banking load failed')
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadBanking])

  async function saveBanking(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const res = await authFetch('/api/agent/banking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountHolderName: form.accountHolderName,
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          accountType: form.accountType,
          branchCode: form.branchCode,
          bankAccountNickname: form.bankAccountNickname || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed')
      setBanking(json.data)
      setEditing(false)
      setForm(emptyForm)
      setSaveOk(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorkspaceShell title="Profile">
      {!data && !error && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {data && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xl font-bold text-slate-900">{data.displayName}</p>
            <p className="text-sm text-slate-600">{data.email}</p>
            <p className="mt-2 text-sm text-slate-600">
              {data.phone || 'No phone'} · {data.province || 'Province unset'}
            </p>
            <p className="mt-3 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              {data.verified ? 'Verified' : data.verificationStatus}
            </p>
            {data.reliabilityScore != null && (
              <p className="mt-2 text-xs text-slate-500">
                Reliability score {data.reliabilityScore}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Banking details
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Your saved banking details will be used for future TenderBriefing Youth Agent
                  payouts. Only update them if your banking information changes.
                </p>
              </div>
              {banking && !editing && (
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                  onClick={() => {
                    setEditing(true)
                    setForm({
                      accountHolderName: banking.accountHolderName,
                      bankName: banking.bankName,
                      accountNumber: '',
                      accountType: banking.accountType,
                      branchCode: banking.branchCode,
                      bankAccountNickname: banking.bankAccountNickname || '',
                    })
                    setSaveOk(false)
                  }}
                >
                  Update banking details
                </button>
              )}
            </div>

            {saveOk && (
              <p className="mt-3 text-sm text-emerald-700">Banking details saved.</p>
            )}
            {saveError && <p className="mt-3 text-sm text-red-700">{saveError}</p>}

            {!editing && banking && (
              <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                <div>
                  <dt className="text-xs text-slate-500">Account holder</dt>
                  <dd className="font-medium">{banking.accountHolderName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Bank</dt>
                  <dd className="font-medium">{banking.bankName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Account number</dt>
                  <dd className="font-mono font-medium">{banking.accountNumberMasked}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Account type</dt>
                  <dd className="font-medium capitalize">{banking.accountType}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Branch code</dt>
                  <dd className="font-mono font-medium">{banking.branchCode}</dd>
                </div>
                <p className="text-xs text-slate-400">
                  Last updated {banking.updatedAt?.slice(0, 10)} · version {banking.version}
                </p>
              </dl>
            )}

            {(editing || !banking) && (
              <form className="mt-4 space-y-3" onSubmit={saveBanking}>
                {!banking && (
                  <p className="text-sm font-semibold text-amber-800">Add banking details</p>
                )}
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">Account holder name</span>
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    value={form.accountHolderName}
                    onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">Bank name</span>
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    Account number {banking ? '(re-enter to update)' : ''}
                  </span>
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono"
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">Account type</span>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    value={form.accountType}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                  >
                    {YA_BANK_ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">Branch code</span>
                  <input
                    required
                    inputMode="numeric"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono"
                    value={form.branchCode}
                    onChange={(e) => setForm({ ...form, branchCode: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">Nickname (optional)</span>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    value={form.bankAccountNickname}
                    onChange={(e) => setForm({ ...form, bankAccountNickname: e.target.value })}
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[40px] rounded-md bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save banking details'}
                  </button>
                  {banking && (
                    <button
                      type="button"
                      className="min-h-[40px] rounded-md border border-slate-200 px-4 text-sm"
                      onClick={() => {
                        setEditing(false)
                        setForm(emptyForm)
                        setSaveError(null)
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          <div className="flex flex-col gap-2">
            <Link
              href="/agent/workspace/earnings"
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800"
            >
              Earnings
            </Link>
            <Link
              href="/settings"
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800"
            >
              Account settings
            </Link>
          </div>
        </div>
      )}
    </WorkspaceShell>
  )
}
