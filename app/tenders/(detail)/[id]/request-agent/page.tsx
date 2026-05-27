'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import {
  countdownLabel,
  formatProcurementDate,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'
import { toast } from 'react-hot-toast'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'

const HIGHLIGHTS = [
  'Verified Youth Agent attends briefing on your behalf',
  'Structured briefing report within 24 hours',
  'WhatsApp + in-app status updates',
  'SLA-tracked dispatch with attendance proof',
]

export default function RequestYouthAgentPage() {
  const { id } = useParams<{ id: string }>()
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tender, setTender] = useState<TenderBriefing | null>(null)
  const [tenderLoading, setTenderLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push(`/auth/signin?redirect=/tenders/${id}/request-agent`)
      } else if (userProfile?.userType !== 'sme') {
        router.push('/dashboard')
      }
    }
  }, [authLoading, user, userProfile, router, id])

  useEffect(() => {
    if (!id) return
    setTenderLoading(true)
    fetch(`/api/tender-briefings/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setTender(j.data)
      })
      .finally(() => setTenderLoading(false))
  }, [id])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !tender) return
    if (!acknowledged) {
      toast.error('Please confirm your submission responsibility')
      return
    }

    setSubmitting(true)
    try {
      const res = await authFetch('/api/attendance-requests', {
        method: 'POST',
        body: JSON.stringify({
          tenderId: tender.id,
          notes,
          responsibilityAcknowledged: true,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        if (json.code === 'YOCO_NOT_CONFIGURED' && json.data?.request?.id) {
          toast.error(
            json.error ||
              'Your request was saved. Online payment is not active yet — you can pay from My Attendance Requests when Yoco is enabled.'
          )
          router.push(`/sme/requests/${json.data.request.id}`)
          return
        }
        throw new Error(json.error)
      }

      const payment = json.data?.payment
      if (payment?.code === 'YOCO_NOT_CONFIGURED') {
        const requestId = json.data?.request?.id
        toast.error(
          payment.message ||
            'Your request was saved. Online payment is not active yet — use Pay with Yoco on the request when available.'
        )
        router.push(requestId ? `/sme/requests/${requestId}` : '/sme/requests')
        return
      }

      const redirectUrl = payment?.redirectUrl
      if (redirectUrl) {
        toast.success('Redirecting to secure Yoco checkout…')
        window.location.href = redirectUrl
        return
      }

      const requestId = json.data?.request?.id
      toast.success('Attendance request submitted')
      router.push(
        requestId
          ? `/sme/requests/confirmation?requestId=${requestId}&tenderId=${tender.id}`
          : '/sme/requests/confirmation'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || tenderLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!tender) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <EmptyState
            icon={FileText}
            title="Tender not found"
            description="We could not load this opportunity. It may have been removed from the official feed."
            action={{ label: 'Browse opportunities', href: '/tenders' }}
          />
        </main>
        <Footer />
      </div>
    )
  }

  const briefingCountdown = countdownLabel(tender.briefingDate)
  const closingCountdown = countdownLabel(tender.closingDate)
  const contactPerson = userProfile?.displayName || user?.displayName || 'On profile'
  const companyName = userProfile?.companyName || 'Company name on profile'
  const userPhone =
    userProfile?.whatsAppNumber || userProfile?.phoneNumber || null

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white">
        <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]">
          <defs>
            <pattern id="req-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M0 32V0h32" fill="none" stroke="#D4AF37" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#req-grid)" />
        </svg>

        <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <Link
            href={`/tenders/${tender.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-100/80 hover:text-accent-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tender
          </Link>

          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-900">
            <Sparkles className="h-3.5 w-3.5" />
            Request Youth Agent attendance
          </span>

          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            Confirm briefing attendance for{' '}
            <span className="text-accent-400">{ATTENDANCE_FEE_LABEL}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-brand-100/80">
            Send a verified Youth Agent to attend this compulsory briefing on your behalf and
            receive a structured Briefing Report within 24 hours.
          </p>

          <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
            <span className="font-mono text-xs font-bold text-accent-300">
              {tender.tenderNumber || 'Tender'}
            </span>
            <span className="text-white/30">·</span>
            <span className="text-sm text-white">{tender.title}</span>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr,340px]">
          <form onSubmit={onSubmit} className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                <span className="h-1.5 w-6 rounded-full bg-accent-500" />
                Step 1 — Briefing details
              </span>
              <h2 className="mt-2 text-lg font-bold text-brand-900">Tender & briefing</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    <Building2 className="h-3.5 w-3.5" />
                    Department
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-brand-900">
                    {tender.department || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    <MapPin className="h-3.5 w-3.5" />
                    Province
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-brand-900">
                    {tender.province || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-accent-200 bg-accent-50/50 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-accent-700">
                    <Calendar className="h-3.5 w-3.5" />
                    Briefing
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-brand-900">
                    {formatProcurementDateTime(tender.briefingDate, tender.briefingTime) || 'TBC'}
                  </p>
                  {briefingCountdown && (
                    <p className="text-xs font-semibold text-accent-700">{briefingCountdown} away</p>
                  )}
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    <Calendar className="h-3.5 w-3.5" />
                    Closing
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-brand-900">
                    {formatProcurementDate(tender.closingDate)}
                  </p>
                  {closingCountdown && (
                    <p className="text-xs font-semibold text-brand-700">{closingCountdown} remaining</p>
                  )}
                </div>
              </div>

              {tender.briefingVenue && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-800" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Briefing venue
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-brand-900">
                      {tender.briefingVenue}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                <span className="h-1.5 w-6 rounded-full bg-accent-500" />
                Step 2 — Your details
              </span>
              <h2 className="mt-2 text-lg font-bold text-brand-900">Confirm contact info</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50/60 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100">
                    <User className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Contact person
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-brand-900">
                      {contactPerson}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50/60 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Company
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-brand-900">
                      {companyName}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50/60 p-4 sm:col-span-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Email · WhatsApp
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-brand-900">
                      {user?.email}
                      {userPhone && (
                        <>
                          <span className="text-slate-400"> · </span>
                          <span>{userPhone}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Need to update these?{' '}
                <Link
                  href="/sme/onboarding"
                  className="font-semibold text-brand-800 hover:text-accent-600"
                >
                  Edit SME profile
                </Link>
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                <span className="h-1.5 w-6 rounded-full bg-accent-500" />
                Step 3 — Brief the agent
              </span>
              <h2 className="mt-2 text-lg font-bold text-brand-900">Notes for the agent (optional)</h2>

              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Register name, access instructions, PPE requirements, parking info, things to ask, etc."
                className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
              <p className="mt-2 text-xs text-slate-500">
                Anything you want included in the briefing report. Keep it short — the agent will
                capture all standard procurement intelligence.
              </p>
            </section>

            <section className="rounded-3xl border border-accent-200 bg-gradient-to-br from-accent-50/60 to-white p-6 shadow-sm sm:p-7">
              <label className="flex items-start gap-3 text-sm leading-relaxed text-brand-900">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-brand-300 text-brand-800 focus:ring-brand-700"
                />
                <span>
                  I understand TenderBriefing provides briefing attendance and intelligence
                  only. <strong>Final tender submission remains my responsibility</strong> through
                  the official government procurement portal.
                </span>
              </label>
            </section>

            <button
              type="submit"
              disabled={submitting || !acknowledged}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 py-4 text-base font-bold text-brand-900 shadow-gold transition hover:bg-accent-400 disabled:opacity-50 sm:text-lg"
            >
              <Sparkles className="h-5 w-5" />
              {submitting ? 'Submitting…' : `Continue to pay ${ATTENDANCE_FEE_LABEL}`}
            </button>
            <p className="text-center text-xs text-slate-500">
              <Lock className="mr-1 inline h-3 w-3" />
              Secure Yoco checkout when enabled. Your request is saved either way.
            </p>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-6 text-white shadow-card">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-500/20 blur-3xl" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
                  <span className="h-1.5 w-6 rounded-full bg-accent-500" />
                  Order summary
                </span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-accent-400">
                    {ATTENDANCE_FEE_LABEL}
                  </span>
                  <span className="text-sm text-brand-100/70">/ briefing</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-brand-100/80">
                  One-time fee. Only pay when you request agent attendance.
                </p>
              </div>

              <ul className="relative mt-6 space-y-2.5 border-t border-white/10 pt-5">
                {HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-brand-100/85">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-500" />
                Trust & safety
              </span>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>· Background-checked Youth Agents</li>
                <li>· Code-of-conduct enforced</li>
                <li>· Reliability scored every assignment</li>
                <li>· No subscriptions or hidden fees</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
