'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  countdownLabel,
  formatProcurementDate,
  formatProcurementDateTime,
  isClosingSoon,
} from '@/lib/procurement/dates'
import { BriefingSessionBlock, CompulsoryBriefingBadge } from './CompulsoryBriefingBadge'
import { ProcurementDisclaimer } from './TrustDisclaimer'
import { Printer } from 'lucide-react'
import TenderDocumentsSection from './TenderDocumentsSection'

interface TenderDetailViewProps {
  tender: TenderBriefing
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-slate-100 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900 sm:col-span-2 sm:mt-0 font-medium">
        {value || '—'}
      </dd>
    </div>
  )
}

export default function TenderDetailView({ tender }: TenderDetailViewProps) {
  const { user, userProfile } = useAuth()
  const router = useRouter()

  const handleRequestAttendance = () => {
    if (!user) {
      router.push(`/auth/signin?redirect=/tenders/${tender.id}/request-agent`)
      return
    }
    if (userProfile?.userType !== 'sme') {
      router.push('/auth/signin')
      return
    }
    router.push(`/tenders/${tender.id}/request-agent`)
  }

  return (
    <div className="print:bg-white">
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/tenders"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← Tender Opportunities
          </Link>
          <p className="mt-3 font-mono text-sm font-bold text-slate-800">
            {tender.tenderNumber || 'Tender Number pending'}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{tender.title}</h1>
          <p className="mt-2 text-slate-600">{tender.department}</p>
          {tender.briefingCompulsory && (
            <div className="mt-3">
              <CompulsoryBriefingBadge />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* Briefing prominence */}
      <section className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Briefing Session Details</h2>
        <BriefingSessionBlock tender={tender} />
        {isClosingSoon(tender.closingDate) && (
          <p className="mt-3 text-sm font-semibold text-red-700">
            Closing soon — {countdownLabel(tender.closingDate)} remaining
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tender Summary</h2>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
              {tender.summary || tender.description || 'No summary available.'}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 px-6 pt-6 pb-2">
              Procurement Details
            </h2>
            <dl className="px-6 pb-4">
              <DetailRow label="Tender Number" value={tender.tenderNumber} />
              <DetailRow label="Department" value={tender.department} />
              <DetailRow label="Province" value={tender.province} />
              <DetailRow
                label="Category"
                value={tender.industrySector || tender.category}
              />
              <DetailRow label="Procurement method" value={tender.procurementMethod} />
              <DetailRow
                label="Closing Date"
                value={
                  tender.closingDate
                    ? `${formatProcurementDate(tender.closingDate)}${
                        countdownLabel(tender.closingDate)
                          ? ` (${countdownLabel(tender.closingDate)} left)`
                          : ''
                      }`
                    : undefined
                }
              />
              <DetailRow
                label="Published"
                value={formatProcurementDate(tender.publishedDate)}
              />
              <DetailRow
                label="Briefing Session"
                value={formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
              />
              <DetailRow label="Briefing Venue" value={tender.briefingVenue} />
              <DetailRow label="Site Meeting" value={tender.meetingLink ? 'Online / link provided' : undefined} />
              {tender.meetingLink && (
                <DetailRow label="Meeting link" value={tender.meetingLink} />
              )}
            </dl>
          </section>

          {tender.requirements && tender.requirements.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Requirements</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                {tender.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          <TenderDocumentsSection tender={tender} />
        </div>

        <aside className="space-y-4 print:hidden">
          <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
            <h2 className="font-bold text-slate-900">Attendance Support</h2>
            <p className="mt-2 text-sm text-slate-700">
              Request a verified Youth Agent to attend this briefing session on behalf of your
              company and submit a Briefing Report.
            </p>
            <button
              type="button"
              onClick={handleRequestAttendance}
              className="mt-4 w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Request Youth Agent Attendance
            </button>
            {!user && (
              <p className="mt-2 text-xs text-slate-600 text-center">
                SME sign-in required to request attendance
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <h3 className="font-semibold text-slate-900">Contact Information</h3>
            <p className="mt-2 text-slate-600">
              Contact details are listed on the official tender notice. Use the link below for
              enquiry contacts from the issuing department.
            </p>
          </section>
        </aside>
      </div>

      <div className="mt-10">
        <ProcurementDisclaimer />
      </div>
    </div>
  )
}
