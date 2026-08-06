'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet } from '@/lib/agent/workspace/clientApi'
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

export default function WorkspaceProfilePage() {
  const [data, setData] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await workspaceGet<Profile>('/api/agent/workspace/profile')
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
            <p className="mt-1 text-xs text-slate-400">
              Role: youth-agent (founder/SME/admin surfaces are not exposed here)
            </p>
          </section>
          <div className="flex flex-col gap-2">
            <Link
              href="/agent/mobile/dispatch"
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800"
            >
              Classic field app
            </Link>
            <Link
              href="/settings"
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800"
            >
              Account settings
            </Link>
            <Link
              href="/agent/dashboard"
              className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Web dashboard
            </Link>
          </div>
        </div>
      )}
    </WorkspaceShell>
  )
}
