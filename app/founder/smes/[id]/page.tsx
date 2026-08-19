'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FounderShell } from '@/components/founder/FounderShell'
import { FounderV2Gate } from '@/components/founder/v2/FounderV2Gate'
import { useFounderDashboard } from '@/components/founder/v2/useFounderDashboard'
import { ErrorState, LoadingState, Money } from '@/components/founder/v2/ui'
import { formatJoined } from '@/lib/founder/dashboard'

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-brand-900">{value}</dd>
    </div>
  )
}

export default function FounderSmeDetailPage() {
  const params = useParams<{ id: string }>()
  const { loading, error, data, reload } = useFounderDashboard({
    view: 'detail',
    kind: 'sme',
    id: params.id,
  })
  const detail = data?.detail as
    | {
        user?: Record<string, unknown>
        summary?: Record<string, unknown> | null
        attendanceRequests?: Array<Record<string, unknown>>
      }
    | null
    | undefined

  const user = detail?.user || {}
  const requests = detail?.attendanceRequests || []

  return (
    <FounderV2Gate>
      <FounderShell
        title={String(user.companyName || user.displayName || 'SME')}
        subtitle="Company profile and paid briefing history"
      >
        {loading && !detail ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !detail ? (
          <ErrorState message="SME not found" />
        ) : (
          <div className="space-y-8">
            <dl className="grid gap-5 rounded-md border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Company" value={String(user.companyName || '—')} />
              <Field label="Contact" value={String(user.displayName || user.contactPerson || '—')} />
              <Field label="Email" value={String(user.email || '—')} />
              <Field label="Province" value={String(user.province || user.location || '')} />
              <Field label="City" value={String(user.city || '')} />
              <Field
                label="Joined"
                value={formatJoined(String(user.createdAt || user.onboardingCompletedAt || ''))}
              />
              <Field
                label="Last active"
                value={formatJoined(
                  String(detail.summary?.lastMeaningfulAt || detail.summary?.lastSeenAt || '')
                )}
              />
            </dl>

            <section>
              <h2 className="text-sm font-semibold text-brand-900">Bookings</h2>
              {requests.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No briefing requests in the recent cohort.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
                  {requests.map((r) => (
                    <li key={String(r.id)} className="flex items-center justify-between gap-4 px-4 py-3">
                      <Link
                        href={`/founder/briefings/${r.id}`}
                        className="text-sm font-medium text-brand-900 hover:underline"
                      >
                        {String(r.tenderTitle || r.tenderNumber || r.id)}
                      </Link>
                      <span className="text-sm text-slate-500">
                        <Money
                          cents={
                            typeof r.paymentAmount === 'number'
                              ? r.paymentAmount
                              : typeof r.quotedFee === 'number'
                                ? r.quotedFee
                                : null
                          }
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </FounderShell>
    </FounderV2Gate>
  )
}
