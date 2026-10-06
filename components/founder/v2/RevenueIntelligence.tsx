'use client'

import {
  formatZarFromCents,
  type FounderRevenueIntelligence,
  type FunnelStageMetric,
  type LeakageRow,
  type TenderIntelRow,
} from '@/lib/founder/dashboard'

function AvailabilityBadge({
  label,
  availability,
}: {
  label: string
  availability: FunnelStageMetric['availability'] | string
}) {
  const tone =
    availability === 'unavailable'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : availability === 'prospective_partial' || availability === 'partial'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900'
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  )
}

function ScorecardMetric({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: string
  hint?: string
  warn?: boolean
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-2 text-[1.35rem] font-semibold tabular-nums tracking-tight ${
          warn ? 'text-amber-800' : 'text-brand-900'
        }`}
      >
        {value}
      </dd>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  )
}

function FunnelRow({
  stage,
  conversionToNext,
}: {
  stage: FunnelStageMetric
  conversionToNext?: LeakageRow | null
}) {
  return (
    <li className="grid gap-2 border-t border-slate-100 py-3 first:border-t-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-brand-900">{stage.label}</p>
          <AvailabilityBadge
            label={stage.availabilityLabel}
            availability={stage.availability}
          />
        </div>
        {stage.note ? <p className="mt-1 text-[11px] text-slate-500">{stage.note}</p> : null}
      </div>
      <p className="text-lg font-semibold tabular-nums text-brand-900">{stage.displayVolume}</p>
      {conversionToNext ? (
        <p className="text-xs text-slate-600 sm:text-right">
          → next:{' '}
          <span className="font-semibold text-brand-800">{conversionToNext.pctLabel}</span>
          {conversionToNext.kind === 'measurement_limitation' ? (
            <span className="mt-0.5 block text-[10px] text-amber-700">Measurement limitation</span>
          ) : conversionToNext.absoluteDrop != null ? (
            <span className="mt-0.5 block text-[10px] text-slate-500">
              Drop {conversionToNext.absoluteDrop.toLocaleString('en-ZA')}
            </span>
          ) : null}
        </p>
      ) : (
        <span className="hidden sm:block" />
      )}
    </li>
  )
}

function TenderTable({
  title,
  rows,
  empty,
  columns,
}: {
  title: string
  rows: TenderIntelRow[]
  empty: string
  columns: Array<{ key: keyof TenderIntelRow | 'name'; label: string; format?: (r: TenderIntelRow) => string }>
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                {columns.map((c) => (
                  <th key={c.label} className="px-2 py-2 font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tenderId} className="border-b border-slate-50">
                  {columns.map((c) => (
                    <td key={c.label} className="px-2 py-2 tabular-nums text-brand-900">
                      {c.format
                        ? c.format(r)
                        : c.key === 'name'
                          ? r.title || r.tenderId
                          : String(r[c.key as keyof TenderIntelRow] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function RevenueIntelligencePanel({ data }: { data: FounderRevenueIntelligence }) {
  const sc = data.scorecard
  const leakageByFrom = Object.fromEntries(data.leakage.stages.map((l) => [l.from, l]))
  const largest = data.leakage.largest

  return (
    <section className="space-y-6" aria-labelledby="revenue-intelligence-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="revenue-intelligence-heading" className="text-sm font-semibold text-brand-900">
            Revenue Intelligence
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Commercial funnel · {data.instrumentationVersion} · boundary{' '}
            {data.instrumentationBoundarySast} SAST
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white lg:grid-cols-4">
        <ScorecardMetric
          label="Revenue collected"
          value={formatZarFromCents(sc.revenueCollectedCents)}
          hint="Trustworthy stored amounts only"
        />
        <ScorecardMetric
          label="Paid bookings"
          value={sc.paidBookings.toLocaleString('en-ZA')}
        />
        <ScorecardMetric
          label="Avg resolved / paid"
          value={
            sc.averageResolvedRevenueCents != null
              ? formatZarFromCents(sc.averageResolvedRevenueCents)
              : '—'
          }
          hint="Excludes amount-unresolved rows"
        />
        <ScorecardMetric
          label="Paid — amount unresolved"
          value={sc.paidAmountUnresolved.toLocaleString('en-ZA')}
          hint="Counted as paid · revenue R0"
          warn={sc.paidAmountUnresolved > 0}
        />
        <ScorecardMetric
          label="Unique checkout bookings"
          value={
            data.funnel.stages.find((s) => s.id === 'checkout')?.displayVolume ??
            String(sc.uniqueBookingsReachingCheckout)
          }
          hint="Distinct requestId"
        />
        <ScorecardMetric
          label="Checkout attempts"
          value={sc.checkoutAttempts.toLocaleString('en-ZA')}
          hint="Raw checkout_started events"
        />
        <ScorecardMetric
          label="Payment conversion"
          value={sc.paymentConversionPctLabel}
          hint={
            sc.paymentConversionReason === 'measured'
              ? 'Unique checkout → paid'
              : sc.paymentConversionReason === 'zero_denominator'
                ? 'Insufficient data'
                : 'Unavailable until checkout is measured'
          }
        />
        <ScorecardMetric
          label="Report delivery"
          value={`${sc.reportDelivered.toLocaleString('en-ZA')} delivered`}
          hint={
            sc.reportDeliveredQuality === 'partial'
              ? `Partially reconstructible · ${sc.paidAwaitingReport} awaiting · ${sc.reportDeliveredLegacyProxyCount} legacy proxy`
              : undefined
          }
          warn={sc.paidAwaitingReport > 0 || sc.reportDeliveredQuality === 'partial'}
        />
      </dl>

      {largest ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            largest.kind === 'measured_drop'
              ? 'border-rose-200 bg-rose-50 text-rose-950'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
          role="status"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
            {largest.kind === 'measured_drop' ? 'Largest measured leakage' : 'Measurement limitation'}
          </p>
          <p className="mt-1 font-semibold">
            {largest.label}
            {largest.kind === 'measured_drop' && largest.absoluteDrop != null
              ? ` · drop ${largest.absoluteDrop.toLocaleString('en-ZA')} · ${largest.pctLabel} convert`
              : ` · ${largest.pctLabel}`}
          </p>
          {largest.kind === 'measurement_limitation' ? (
            <p className="mt-1 text-xs opacity-90">
              Not labelled as poor conversion — data quality prevents a measured rate.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-brand-900">Commercial funnel</h3>
        <p className="mt-1 text-xs text-slate-500">
          Discovery → Tender detail → Booking intent → Checkout → Paid → Report delivered
        </p>
        <ol className="mt-2">
          {data.funnel.stages.map((stage, i) => (
            <FunnelRow
              key={stage.id}
              stage={stage}
              conversionToNext={
                i < data.funnel.stages.length - 1 ? leakageByFrom[stage.id] || null : null
              }
            />
          ))}
        </ol>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-brand-900">Leakage by stage</h3>
        <ul className="mt-3 divide-y divide-slate-100">
          {data.leakage.stages.map((row) => (
            <li
              key={row.label}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium text-brand-900">{row.label}</p>
                <p className="text-[11px] text-slate-500">
                  {row.kind === 'measured_drop' ? 'Measured drop' : 'Measurement limitation'}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold text-brand-900">{row.pctLabel}</p>
                {row.absoluteDrop != null && row.kind === 'measured_drop' ? (
                  <p className="text-[11px] text-slate-500">
                    Lost {row.absoluteDrop.toLocaleString('en-ZA')}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-6 rounded-md border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-brand-900">Tender commercial intelligence</h3>
        <div className="grid gap-8 lg:grid-cols-2">
          <TenderTable
            title="Top by paid bookings"
            rows={data.tenders.topByPaid}
            empty="No paid bookings in this period."
            columns={[
              { key: 'name', label: 'Tender' },
              { key: 'paidBookings', label: 'Paid' },
              {
                key: 'revenueCents',
                label: 'Revenue',
                format: (r) => formatZarFromCents(r.revenueCents),
              },
            ]}
          />
          <TenderTable
            title="Top by trustworthy revenue"
            rows={data.tenders.topByRevenue}
            empty="No resolved revenue in this period."
            columns={[
              { key: 'name', label: 'Tender' },
              {
                key: 'revenueCents',
                label: 'Revenue',
                format: (r) => formatZarFromCents(r.revenueCents),
              },
              { key: 'paidBookings', label: 'Paid' },
            ]}
          />
          <TenderTable
            title="High view / low intent"
            rows={data.tenders.highViewLowIntent}
            empty="No high-view / zero-intent tenders (needs post-boundary events)."
            columns={[
              { key: 'name', label: 'Tender' },
              { key: 'detailViews', label: 'Views' },
              { key: 'bookingIntent', label: 'Intent' },
            ]}
          />
          <TenderTable
            title="High intent / low checkout"
            rows={data.tenders.highIntentLowCheckout}
            empty="No high-intent / zero-checkout tenders (needs post-boundary events)."
            columns={[
              { key: 'name', label: 'Tender' },
              { key: 'bookingIntent', label: 'Intent' },
              { key: 'checkoutUnique', label: 'Checkout' },
            ]}
          />
          <TenderTable
            title="Checkout / low payment"
            rows={data.tenders.checkoutLowPayment || []}
            empty="No checkout-without-payment tenders in this window."
            columns={[
              { key: 'name', label: 'Tender' },
              { key: 'checkoutUnique', label: 'Checkout' },
              { key: 'paidBookings', label: 'Paid' },
            ]}
          />
          <TenderTable
            title="Paid awaiting report"
            rows={data.tenders.paidAwaitingReport || []}
            empty="No paid bookings awaiting report in this cohort."
            columns={[
              { key: 'name', label: 'Tender' },
              { key: 'paidAwaitingReport', label: 'Awaiting' },
              { key: 'paidBookings', label: 'Paid' },
            ]}
          />
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
        <p className="font-semibold uppercase tracking-[0.12em]">Data quality</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {data.trustNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
