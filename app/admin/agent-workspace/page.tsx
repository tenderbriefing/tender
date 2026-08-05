'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'

type Overview = {
  recentAudit: Array<Record<string, unknown>>
  pendingVerification: Array<Record<string, unknown>>
  recentAnalytics: Array<Record<string, unknown>>
}

export default function AdminAgentWorkspacePage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth/signin')
      return
    }
    if (userProfile && userProfile.userType !== 'admin') {
      router.push('/')
      return
    }
    ;(async () => {
      try {
        const res = await authFetch('/api/agent/workspace/admin')
        const json = await res.json()
        if (!res.ok || !json.success) {
          setError(json.error || 'Workspace admin unavailable (flag may be off)')
          return
        }
        setData(json.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed')
      }
    })()
  }, [user, userProfile, loading, router])

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
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Agent Workspace oversight</h1>
        <p className="mt-2 text-sm text-slate-600">
          Minimal admin view of audit events, pending verification, and analytics. Fail-closed
          behind <code className="text-xs">youth_agent_workspace_v1</code>.
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
        )}
        {!data && !error && (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        )}
        {data && (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold text-slate-900">Pending verification</h2>
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
                {data.pendingVerification.map((d) => (
                  <li key={String(d.id)} className="rounded bg-slate-50 px-2 py-2">
                    {String(d.requestId)} · {String(d.status)}
                  </li>
                ))}
                {data.pendingVerification.length === 0 && (
                  <li className="text-slate-500">None</li>
                )}
              </ul>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
              <h2 className="font-bold text-slate-900">Recent audit</h2>
              <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto text-xs text-slate-600">
                {data.recentAudit.map((e) => (
                  <li key={String(e.id)}>
                    {String(e.type)} · {String(e.actorUid || '').slice(0, 8)} ·{' '}
                    {String(e.createdAt || '').slice(0, 19)}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
