'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import RequestStatusBadge from '@/components/operations/RequestStatusBadge'
import OperationalTimeline from '@/components/operations/OperationalTimeline'
import { CompulsoryBriefingBadge } from '@/components/procurement/CompulsoryBriefingBadge'
import { formatProcurementDateTime, countdownLabel } from '@/lib/procurement/dates'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { BriefingReport } from '@/lib/tenderBriefing/types'
import { ExternalLink } from 'lucide-react'

export default function SmeRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [request, setRequest] = useState<EnrichedAttendanceRequest | null>(null)
  const [reports, setReports] = useState<BriefingReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'sme') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    if (!id || !user) return
    authFetch(`/api/attendance-requests/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setRequest(j.data.request)
          setReports(j.data.reports || [])
        }
      })
      .finally(() => setLoading(false))
  }, [id, user])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-lg mx-auto py-16 text-center px-4">
          <p className="text-slate-600">Attendance request not found.</p>
          <Link href="/sme/requests" className="mt-4 inline-block text-brand-700 font-semibold">
            Back to My Attendance Requests
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const tender = request.tender
  const hasReport = reports.length > 0
  const briefingCountdown = countdownLabel(tender?.briefingDate || request.briefingDate)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/sme/requests"
          className="text-sm font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus-visible:underline"
        >
          ← My Attendance Requests
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={request.status} />
          {tender?.briefingCompulsory && <CompulsoryBriefingBadge pulse={false} />}
          {hasReport && (
            <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-900">
              Briefing Report Available
            </span>
          )}
        </div>

        <p className="mt-2 font-mono text-sm font-bold text-slate-800">
          {tender?.tenderNumber || 'Tender Number'}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {tender?.title || request.tenderTitle}
        </h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Operational timeline
            </h2>
            <div className="mt-4">
              <OperationalTimeline request={request} reports={reports} />
            </div>
          </section>

          <div className="lg:col-span-3 space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Tender Summary</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Tender Number</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {tender?.tenderNumber || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Department</dt>
                  <dd className="font-medium text-slate-900">{tender?.department || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Province</dt>
                  <dd className="font-medium text-slate-900">
                    {tender?.province || request.province || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Category</dt>
                  <dd className="font-medium text-slate-900">{tender?.category || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Closing Date</dt>
                  <dd className="font-medium text-slate-900">{tender?.closingDate || '—'}</dd>
                </div>
                <div>
                  <Link
                    href={`/tenders/${request.tenderId}`}
                    className="inline-flex items-center gap-1 text-brand-700 font-semibold hover:underline"
                  >
                    View tender details <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
              <h2 className="text-lg font-bold text-slate-900">Briefing Session</h2>
              {briefingCountdown && (
                <p className="mt-1 text-sm font-semibold text-amber-800">
                  Briefing in {briefingCountdown}
                </p>
              )}
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-slate-600">Briefing Date</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatProcurementDateTime(
                      tender?.briefingDate || request.briefingDate,
                      request.briefingTime
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Briefing Venue</dt>
                  <dd className="font-semibold text-slate-900">
                    {tender?.briefingVenue || request.briefingVenue || 'Briefing details to be confirmed'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
              <h2 className="text-lg font-bold text-slate-900">Assigned Youth Agent</h2>
              <p className="mt-2 text-sm text-slate-700">
                {request.agentName ? (
                  <span className="font-semibold text-slate-900">{request.agentName}</span>
                ) : (
                  'Pending assignment — a verified Youth Agent will be matched to this briefing.'
                )}
              </p>
            </section>

            {hasReport && (
              <section className="rounded-xl border border-green-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Briefing Report</h2>
                {reports.map((report) => (
                  <div key={report.id} className="mt-4 border-t border-slate-100 pt-4 first:mt-0 first:border-0 first:pt-0">
                    <p className="text-xs text-slate-500">
                      Submitted {new Date(report.createdAt).toLocaleString('en-ZA')}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-slate-800">{report.summary}</p>
                    {report.attendanceProofUrl && (
                      <a
                        href={report.attendanceProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-sm font-semibold text-brand-700 underline"
                      >
                        View Attendance Proof
                      </a>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
