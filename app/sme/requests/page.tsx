'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AttendanceRequestCard from '@/components/operations/AttendanceRequestCard'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'
import { ClipboardList } from 'lucide-react'

export default function SmeRequestsPage() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [requests, setRequests] = useState<EnrichedAttendanceRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'sme') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    if (!user || userProfile?.userType !== 'sme') return
    authFetch('/api/attendance-requests')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRequests(j.data || [])
      })
      .finally(() => setLoading(false))
  }, [user, userProfile])

  const counts = useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === 'pending').length,
      assigned: requests.filter(
        (r) => r.status === 'assigned' || r.status === 'accepted'
      ).length,
      completed: requests.filter((r) => r.status === 'completed').length,
    }
  }, [requests])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-2 sm:px-6">
          <TrustStrip />
        </div>
      </div>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              My Attendance Requests
            </h1>
            <p className="mt-1 text-slate-600">
              Track Youth Agent attendance for compulsory briefing sessions and access Briefing
              Reports when available.
            </p>
          </div>
          <Link
            href="/tenders"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Browse Tender Opportunities
          </Link>
        </div>

        {!loading && requests.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              Pending: {counts.pending}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
              Agent Assigned: {counts.assigned}
            </span>
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-900">
              Completed: {counts.completed}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-10">
            <ProcurementEmptyState
              icon={ClipboardList}
              title="No attendance requests yet"
              description="You have not requested attendance support yet. Browse Tender Opportunities to request a Youth Agent for a compulsory briefing session."
              actionLabel="View Tender Opportunities"
              actionHref="/tenders"
            />
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {requests.map((req) => (
              <AttendanceRequestCard
                key={req.id}
                request={req}
                detailHref={`/sme/requests/${req.id}`}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
