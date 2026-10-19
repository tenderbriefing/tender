'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'

type MirrorRow = {
  id: string
  tenderNumber?: string
  title?: string
  department?: string
  status?: string
  publishedDate?: string
  closingDate?: string
  briefingDate?: string
  sourceBriefingCompulsory?: boolean | null
  derivedBriefingStatus?: string | null
  briefingCompulsory?: boolean
  documentCount?: number
}

export default function AdminEtendersMirrorPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<MirrorRow[]>([])
  const [totalMatched, setTotalMatched] = useState(0)

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  async function onSearch(e?: FormEvent) {
    e?.preventDefault()
    if (!q.trim()) {
      toast.error('Enter a tender number, title, or institution')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch(
        `/api/admin/etenders-mirror?q=${encodeURIComponent(q.trim())}&limit=50`
      )
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Search failed')
        return
      }
      setRows(json.data || [])
      setTotalMatched(json.totalMatched || 0)
      if (!(json.data || []).length) toast('No mirror matches')
    } catch {
      toast.error('Search failed')
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
        title="eTenders mirror"
        description="Search the full OCDS mirror — including tenders without compulsory briefings. Public /tenders stays compulsory + upcoming only."
        breadcrumb={{ label: 'Admin dashboard', href: '/admin/dashboard' }}
      />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={onSearch} className="flex flex-wrap gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tender / RFQ number, title, institution…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Search mirror
          </button>
          <Link
            href="/admin/dashboard"
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </form>

        <p className="text-xs text-slate-500">
          Showing {rows.length} of {totalMatched} match(es). Source vs derived briefing flags are
          listed separately.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Tender #</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Institution</th>
                <th className="px-3 py-2">Source compulsory</th>
                <th className="px-3 py-2">Derived</th>
                <th className="px-3 py-2">Catalogue</th>
                <th className="px-3 py-2">Docs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/tenders/${r.id}`}
                      className="text-brand-700 underline-offset-2 hover:underline"
                    >
                      {r.tenderNumber || r.id}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2">{r.title || '—'}</td>
                  <td className="px-3 py-2">{r.department || '—'}</td>
                  <td className="px-3 py-2">
                    {r.sourceBriefingCompulsory == null
                      ? 'null'
                      : String(r.sourceBriefingCompulsory)}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.derivedBriefingStatus || '—'}</td>
                  <td className="px-3 py-2">{r.briefingCompulsory ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2">{r.documentCount ?? 0}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    Search by a reference you saw on eTenders to verify the local mirror.
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
