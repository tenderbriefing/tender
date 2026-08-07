'use client'

import { Suspense, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  Calendar,
  MapPin,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTenderBriefings } from '@/hooks/useTenderBriefingsPolling'
import { sortTenders } from '@/lib/procurement/filters'
import {
  countdownLabel,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'
import { BOOK_AGENT_CTA, BOOK_AGENT_CTA_WITH_FEE } from '@/lib/booking/labels'
import {
  requestAgentPath,
  smeBookAgentSignInHref,
} from '@/lib/booking/sharePath'
import { dashboardPathForRole } from '@/lib/auth/redirects'
import { ATTENDANCE_PRICING_HIGHLIGHTS } from '@/lib/booking/copy'

function BookAgentFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <LoadingSpinner size="lg" />
    </div>
  )
}

function SmeBookAgentContent() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tenderIdParam = searchParams?.get('tenderId')?.trim() || null
  const inviteParam = searchParams?.get('invite')?.trim() || null

  const isSme = userProfile?.userType === 'sme'
  const wrongRole =
    Boolean(user) && Boolean(userProfile) && userProfile!.userType !== 'sme'

  const { tenders, loading: tendersLoading, error } = useTenderBriefings({
    compulsoryOnly: true,
    enabled: isSme && !tenderIdParam,
  })

  const upcoming = useMemo(
    () => sortTenders(tenders, 'briefingDate', 'asc'),
    [tenders]
  )

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace(smeBookAgentSignInHref(tenderIdParam, { invite: inviteParam }))
      return
    }
    if (!userProfile) return
    if (userProfile.userType !== 'sme') return
    if (tenderIdParam) {
      router.replace(requestAgentPath(tenderIdParam, { invite: inviteParam }))
    }
  }, [authLoading, user, userProfile, router, tenderIdParam, inviteParam])

  if (authLoading || (user && !userProfile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (wrongRole) {
    const roleLabel =
      userProfile?.userType === 'youth-agent'
        ? 'Youth Agent'
        : userProfile?.userType === 'admin'
          ? 'Admin'
          : 'this account type'
    const homeHref = dashboardPathForRole(userProfile?.userType)

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
          <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
              <ShieldAlert className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-5 text-2xl font-bold text-brand-900">
              SME account required
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              This link is for SMEs booking Youth Agent briefing attendance (
              {ATTENDANCE_FEE_LABEL}). You are signed in as a {roleLabel}, so
              checkout is not available on this account.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={homeHref}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Go to my dashboard
              </Link>
              <Link
                href="/tenders"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-slate-50"
              >
                Browse tenders
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (tenderIdParam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white">
        <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-900">
            <Sparkles className="h-3.5 w-3.5" />
            {BOOK_AGENT_CTA}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            Choose a compulsory briefing
          </h1>
          <p className="mt-3 max-w-xl text-sm text-brand-100/85 sm:text-base">
            Select an upcoming tender, then continue to secure PayFast checkout
            for {ATTENDANCE_FEE_LABEL}. One fee per briefing — no subscription.
          </p>
          <ul className="mt-5 hidden gap-x-4 gap-y-1 text-xs text-brand-100/75 sm:flex sm:flex-wrap">
            {ATTENDANCE_PRICING_HIGHLIGHTS.slice(0, 2).map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
        {tendersLoading ? (
          <div className="flex justify-center py-16" role="status" aria-label="Loading briefings">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState
            icon={Calendar}
            title="Could not load briefings"
            description={error}
            action={{ label: 'Browse tenders', href: '/tenders' }}
          />
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No upcoming compulsory briefings"
            description="There are no bookable compulsory briefings right now. Check back after the next eTenders sync, or browse the full catalogue."
            action={{ label: 'Browse tenders', href: '/tenders' }}
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((tender) => {
              const href = requestAgentPath(tender.id)
              const briefingAway = countdownLabel(tender.briefingDate)
              return (
                <li key={tender.id}>
                  <Link
                    href={href}
                    className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-bold text-brand-800">
                          {tender.tenderNumber || 'Tender'}
                        </p>
                        <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-brand-900 group-hover:text-accent-700">
                          {tender.title}
                        </h2>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-accent-500 px-3 py-2 text-xs font-bold text-brand-900 opacity-95 group-hover:bg-accent-400">
                        {BOOK_AGENT_CTA}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                      {tender.department && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1">
                          <Building2 className="h-3 w-3 text-brand-700" aria-hidden />
                          <span className="line-clamp-1">{tender.department}</span>
                        </span>
                      )}
                      {tender.province && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1">
                          <MapPin className="h-3 w-3 text-brand-700" aria-hidden />
                          {tender.province}
                        </span>
                      )}
                      {tender.briefingDate && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-accent-50 px-2.5 py-1 text-accent-900">
                          <Calendar className="h-3 w-3" aria-hidden />
                          {formatProcurementDateTime(
                            tender.briefingDate,
                            tender.briefingTime
                          )}
                          {briefingAway ? ` · ${briefingAway}` : ''}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-slate-500 sm:hidden">
                      Continues to {BOOK_AGENT_CTA_WITH_FEE}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          Payment uses the same secure PayFast checkout as{' '}
          <span className="font-medium text-slate-600">Book an agent</span> on
          each tender. Track bookings in{' '}
          <Link
            href="/sme/requests"
            className="font-semibold text-brand-800 hover:text-accent-600"
          >
            My requests
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  )
}

export default function SmeBookAgentPage() {
  return (
    <Suspense fallback={<BookAgentFallback />}>
      <SmeBookAgentContent />
    </Suspense>
  )
}
