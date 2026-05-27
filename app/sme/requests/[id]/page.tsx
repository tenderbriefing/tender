'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPin,
  ShieldCheck,
  User,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import RequestStatusBadge from '@/components/operations/RequestStatusBadge'
import OperationalTimeline from '@/components/operations/OperationalTimeline'
import {
  countdownLabel,
  formatProcurementDate,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { BriefingReport } from '@/lib/tenderBriefing/types'
import AttendancePaymentSummary from '@/components/payments/AttendancePaymentSummary'

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <EmptyState
            icon={FileText}
            title="Attendance request not found"
            description="The request may have been removed or the link may be incorrect."
            action={{ label: 'My attendance requests', href: '/sme/requests' }}
          />
        </main>
        <Footer />
      </div>
    )
  }

  const tender = request.tender
  const hasReport = reports.length > 0
  const briefingCountdown = countdownLabel(tender?.briefingDate || request.briefingDate)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white">
        <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
        >
          <defs>
            <pattern id="req-detail-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M0 32V0h32" fill="none" stroke="#D4AF37" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#req-detail-grid)" />
        </svg>

        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <Link
            href="/sme/requests"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-100/80 transition hover:text-accent-400"
          >
            <ArrowLeft className="h-4 w-4" />
            My attendance requests
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <RequestStatusBadge status={request.status} />
            {tender?.briefingCompulsory && (
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-900">
                <ShieldCheck className="h-3.5 w-3.5" />
                Compulsory briefing
              </span>
            )}
            {hasReport && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-inset ring-emerald-400/40">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Briefing report available
              </span>
            )}
          </div>

          <p className="mt-6 font-mono text-sm font-bold text-accent-300">
            {tender?.tenderNumber || 'Tender'}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
            {tender?.title || request.tenderTitle || 'Attendance request'}
          </h1>

          {briefingCountdown && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-accent-300 ring-1 ring-inset ring-white/10">
              <Calendar className="h-4 w-4" />
              Briefing {briefingCountdown}
            </p>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8">
          <AttendancePaymentSummary request={request} showRetry />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                <span className="h-1.5 w-6 rounded-full bg-accent-500" />
                Briefing session
              </span>
              <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-brand-900">
                <Calendar className="h-5 w-5 text-accent-500" />
                Where & when
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent-700">
                    Briefing date
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-brand-900">
                    {formatProcurementDateTime(
                      tender?.briefingDate || request.briefingDate,
                      request.briefingTime
                    ) || 'TBC'}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    Venue
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-brand-900">
                    {tender?.briefingVenue ||
                      request.briefingVenue ||
                      'Briefing details to be confirmed'}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    <MapPin className="h-3.5 w-3.5" />
                    Province
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-brand-900">
                    {tender?.province || request.province || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    <Building2 className="h-3.5 w-3.5" />
                    Department
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-brand-900 line-clamp-2">
                    {tender?.department || '—'}
                  </p>
                </div>
              </div>

              <Link
                href={`/tenders/${request.tenderId}`}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-800 hover:text-accent-600"
              >
                View full tender details
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                <span className="h-1.5 w-6 rounded-full bg-accent-500" />
                Dispatch
              </span>
              <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-brand-900">
                <User className="h-5 w-5 text-accent-500" />
                Assigned Youth Agent
              </h2>

              {request.agentName ? (
                <div className="mt-5 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-50 to-white p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-900 text-lg font-bold text-accent-400">
                    {request.agentName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-brand-900">{request.agentName}</p>
                    <p className="text-xs text-slate-500">Verified Youth Agent</p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-5 text-sm text-brand-900">
                  <p className="font-semibold">Pending dispatch</p>
                  <p className="mt-1 text-slate-600">
                    A verified Youth Agent will be matched to this briefing based on province,
                    availability, and reliability score.
                  </p>
                </div>
              )}
            </section>

            {hasReport && (
              <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-6 shadow-sm sm:p-7">
                <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  <span className="h-1.5 w-6 rounded-full bg-emerald-500" />
                  Intelligence
                </span>
                <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-brand-900">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  Briefing report
                </h2>

                <div className="mt-5 space-y-5">
                  {reports.map((report) => (
                    <article
                      key={report.id}
                      className="rounded-2xl border border-emerald-100 bg-white p-5"
                    >
                      <p className="text-xs text-slate-500">
                        Submitted {new Date(report.createdAt).toLocaleString('en-ZA')}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-900">
                        {report.summary}
                      </p>
                      {report.attendanceProofUrl && (
                        <a
                          href={report.attendanceProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View attendance proof
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {!hasReport && (
              <section className="rounded-3xl border border-dashed border-brand-200 bg-brand-50/30 p-6 text-center shadow-sm sm:p-7">
                <FileText className="mx-auto h-10 w-10 text-brand-700" />
                <h3 className="mt-3 text-base font-bold text-brand-900">
                  Briefing report not yet uploaded
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                  The assigned Youth Agent will upload a structured Briefing Report after attending
                  the session — typically within 24 hours.
                </p>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                <span className="h-1.5 w-6 rounded-full bg-accent-500" />
                Timeline
              </span>
              <h3 className="mt-2 text-base font-bold text-brand-900">Operational status</h3>
              <div className="mt-4">
                <OperationalTimeline request={request} reports={reports} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                Closing date
              </span>
              <p className="mt-2 text-lg font-bold text-brand-900">
                {formatProcurementDate(tender?.closingDate)}
              </p>
              {countdownLabel(tender?.closingDate) && (
                <p className="mt-1 text-sm font-semibold text-accent-700">
                  {countdownLabel(tender?.closingDate)} remaining
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Final tender submission remains your responsibility through the official
                government procurement portal.
              </p>
            </section>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
