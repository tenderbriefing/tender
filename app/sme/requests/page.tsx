'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AttendanceRequestCard from '@/components/operations/AttendanceRequestCard'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { AttendanceRequestStatusBadge } from '@/components/procurement/StatusBadges'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
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
    <div className="procurement-shell">
      <Header />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
          <TrustStrip />
        </div>
      </div>
      <ProcurementPageHeader
        maxWidthClass="max-w-5xl"
        kicker="SME operations"
        title="My attendance requests"
        description="Track Youth Agent attendance for compulsory briefing sessions and access Briefing Reports when submitted."
        breadcrumb={{ label: 'SME dashboard', href: '/sme/dashboard' }}
        actions={
          <Link
            href="/tenders"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Browse tender opportunities
          </Link>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {!loading && requests.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <span className="text-xs font-semibold uppercase text-slate-500">Status summary</span>
            <div className="flex items-center gap-1.5">
              <AttendanceRequestStatusBadge status="pending" />
              <span className="text-xs font-medium text-slate-600">{counts.pending}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AttendanceRequestStatusBadge status="assigned" />
              <span className="text-xs font-medium text-slate-600">{counts.assigned}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AttendanceRequestStatusBadge status="completed" />
              <span className="text-xs font-medium text-slate-600">{counts.completed}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16" role="status" aria-label="Loading requests">
            <LoadingSpinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <ProcurementEmptyState
            icon={ClipboardList}
            title="No attendance requests yet"
            description="Browse tender opportunities and request Youth Agent attendance for a compulsory briefing session."
            actionLabel="View tender opportunities"
            actionHref="/tenders"
          />
        ) : (
          <div className="space-y-4">
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
