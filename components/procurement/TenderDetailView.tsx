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
import StatusBadge from '@/components/tenders/StatusBadge'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'

import CountdownBadge from './CountdownBadge'

import { ProcurementDisclaimer } from './TrustDisclaimer'

import { Copy, Printer, Share2 } from 'lucide-react'

import TenderDocumentsSection from './TenderDocumentsSection'

import TenderProcurementChecklist from './TenderProcurementChecklist'

import TenderWorkspaceActions from './TenderWorkspaceActions'

import { toast } from 'react-hot-toast'



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



  const tenderType =

    tender.procurementMethod ||

    (tender.briefingCompulsory ? 'Compulsory briefing tender' : 'Open tender')



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



  const copyLink = async () => {

    try {

      await navigator.clipboard.writeText(window.location.href)

      toast.success('Tender link copied')

    } catch {

      toast.error('Could not copy link')

    }

  }



  return (

    <div className="procurement-print-detail print:bg-white">

      <div className="print-only-header mb-6 hidden border-b-2 border-brand-700 pb-4 print:block">

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">

          TenderBriefing — procurement notice

        </p>

        <p className="mt-2 font-mono text-sm font-bold text-slate-900">{tender.tenderNumber}</p>

        <h1 className="mt-1 text-xl font-bold text-slate-900">{tender.title}</h1>

        <p className="mt-1 text-sm text-slate-700">{tender.department}</p>

      </div>



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

          <div className="mt-3">
            <StatusBadge status={getTenderDisplayStatus(tender)} />
          </div>

          <p className="mt-3 text-xs font-medium text-slate-500">

            Source: Official eTenders data · Last synced{' '}

            {formatProcurementDate(tender.lastSyncedAt) || 'recently'}

          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <button

            type="button"

            onClick={() => void copyLink()}

            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"

          >

            <Copy className="h-4 w-4" aria-hidden />

            Copy link

          </button>

          <button

            type="button"

            onClick={() => window.print()}

            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"

          >

            <Printer className="h-4 w-4" aria-hidden />

            Print

          </button>

          {'share' in navigator && typeof navigator.share === 'function' && (

            <button

              type="button"

              onClick={() => {

                void navigator.share({

                  title: tender.title,

                  text: `Tender ${tender.tenderNumber || ''} — ${tender.department || 'Government'}`,

                  url: window.location.href,

                })

              }}

              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"

            >

              <Share2 className="h-4 w-4" aria-hidden />

              Share

            </button>

          )}

          {tender.detailUrl && (

            <a

              href={tender.detailUrl}

              target="_blank"

              rel="noopener noreferrer"

              className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"

            >

              Official tender notice

            </a>

          )}

        </div>

      </div>



      <section className="mb-6 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">

        <div className="flex flex-wrap items-center gap-3">

          {tender.briefingCompulsory && <CompulsoryBriefingBadge />}

          <CountdownBadge

            targetDate={tender.briefingDate}

            variant="briefing"

            prefix="Briefing in"

          />

        </div>

        <h2 className="mt-4 text-xl font-bold text-slate-900">Compulsory Briefing Session</h2>

        <BriefingSessionBlock tender={tender} />

        {isClosingSoon(tender.closingDate) && (

          <p className="mt-3 text-sm font-semibold text-red-700">

            Closing soon — {countdownLabel(tender.closingDate)} remaining

          </p>

        )}

        <button

          type="button"

          onClick={handleRequestAttendance}

          className="mt-5 w-full rounded-lg bg-brand-600 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 sm:w-auto sm:px-8"

        >

          Request Youth Agent Attendance

        </button>

        {!user && (

          <p className="mt-2 text-xs text-slate-600">SME sign-in required to request attendance</p>

        )}

      </section>



      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        <div className="lg:col-span-2 space-y-6">

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-bold text-slate-900 mb-4">Tender Summary</h2>

            <dl>

              <DetailRow label="Tender Number" value={tender.tenderNumber} />

              <DetailRow label="Title" value={tender.title} />

              <DetailRow

                label="Description"

                value={tender.summary || tender.description || 'No description available.'}

              />

              <DetailRow label="Department" value={tender.department} />

              <DetailRow label="Province" value={tender.province} />

              <DetailRow label="Category" value={tender.industrySector || tender.category} />

              <DetailRow label="Tender Type" value={tenderType} />

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

              <DetailRow label="Source" value="Official eTenders data (synced to TenderBriefing)" />

            </dl>

          </section>



          <TenderProcurementChecklist />

          <TenderDocumentsSection tender={tender} />



          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">

            <h2 className="text-lg font-bold text-slate-900 px-6 pt-6 pb-2">Additional Details</h2>

            <dl className="px-6 pb-4">

              <DetailRow label="Procurement method" value={tender.procurementMethod} />

              <DetailRow label="Published" value={formatProcurementDate(tender.publishedDate)} />

              <DetailRow

                label="Briefing Session"

                value={formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}

              />

              <DetailRow label="Briefing Venue" value={tender.briefingVenue} />

              <DetailRow
                label="Compulsory briefing"
                value={tender.briefingCompulsory ? 'Yes — attendance required' : 'No'}
              />

              {tender.meetingLink && (
                <DetailRow label="Meeting link" value={tender.meetingLink} />
              )}

              <DetailRow label="Contact person" value={tender.contactPerson} />

              <DetailRow label="Email" value={tender.contactEmail} />

              <DetailRow label="Telephone" value={tender.contactPhone} />

              {tender.detailUrl && (
                <DetailRow label="Official source" value={tender.detailUrl} />
              )}
            </dl>

          </section>

        </div>



        <aside className="space-y-4 print:hidden">

          <TenderWorkspaceActions tender={tender} />

          <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">

            <h2 className="font-bold text-slate-900">Attendance Support</h2>

            <p className="mt-2 text-sm text-slate-700">

              Request a verified Youth Agent to attend this briefing on behalf of your company

              and submit a structured Briefing Report with proof of attendance.

            </p>

            <button

              type="button"

              onClick={handleRequestAttendance}

              className="mt-4 w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"

            >

              Request Youth Agent Attendance

            </button>

          </section>

        </aside>

      </div>



      <div className="mt-10">

        <ProcurementDisclaimer />

      </div>

    </div>

  )

}

