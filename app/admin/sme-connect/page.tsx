'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'

type Rec = {
  id: string
  status?: string
  tenderNumber?: string
  tenderTitle?: string
  briefingDate?: string | null
  smeName?: string | null
  smeCompany?: string | null
  previousTenderTitle?: string | null
  previousTenderNumber?: string | null
  similarity?: number
  reasons?: string[]
  customerNotified?: boolean
}

export default function AdminSmeConnectPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Rec[]>([])

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/sme-connect?limit=200')
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || 'Failed to load recommendations')
      return
    }
    setRows(json.data || [])
  }, [])

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (user && userProfile?.userType === 'admin') {
      load().catch(() => toast.error('Load failed'))
    }
  }, [user, userProfile, load])

  async function runAction(action: string, body: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await authFetch('/api/admin/sme-connect', {
        method: 'POST',
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Action failed')
        return
      }
      toast.success(`${action} OK`)
      await load()
    } catch {
      toast.error('Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user || userProfile?.userType !== 'admin') return null

  return (
    <div className="procurement-shell">
      <Header />
      <ProcurementPageHeader
        kicker="Operations"
        title="SME Connect"
        description="Recommendation-only matching of new compulsory briefings to historically paid requests. No customer emails in Phase 19."
        breadcrumb={{ label: 'eTenders mirror', href: '/admin/etenders-mirror' }}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => runAction('run_matching', { limit: 50 })}
          >
            Run matching
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
            onClick={() => load()}
          >
            Refresh
          </button>
          <Link
            href="/admin/etenders-mirror"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Mirror days
          </Link>
        </div>

        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Send / notify is intentionally unavailable. Approve or reject only; outreach is a later
          phase after human approval.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">New tender</th>
                <th className="px-3 py-2">Briefing</th>
                <th className="px-3 py-2">SME</th>
                <th className="px-3 py-2">Previous</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Reasons</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="max-w-[12rem] px-3 py-2">
                    <div className="font-mono text-xs">{r.tenderNumber || '—'}</div>
                    <div className="truncate text-xs text-slate-600">{r.tenderTitle || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.briefingDate || '—'}</td>
                  <td className="px-3 py-2 text-xs">{r.smeCompany || r.smeName || '—'}</td>
                  <td className="max-w-[12rem] px-3 py-2">
                    <div className="font-mono text-xs">{r.previousTenderNumber || '—'}</div>
                    <div className="truncate text-xs text-slate-600">
                      {r.previousTenderTitle || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {r.similarity != null ? r.similarity.toFixed(2) : '—'}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-slate-600">
                    {(r.reasons || []).join('; ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold">{r.status || '—'}</td>
                  <td className="space-x-2 px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={busy || r.status === 'REJECTED'}
                      className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-40"
                      onClick={() => runAction('approve', { id: r.id })}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-40"
                      onClick={() => runAction('reject', { id: r.id })}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    No recommendation candidates yet. Classify compulsory briefings, then run
                    matching.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  )
}
