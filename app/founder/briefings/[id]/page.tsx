'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FounderShell } from '@/components/founder/FounderShell'
import { FounderV2Gate } from '@/components/founder/v2/FounderV2Gate'
import { useFounderDashboard } from '@/components/founder/v2/useFounderDashboard'
import { ErrorState, LifecycleBadge, LoadingState, Money } from '@/components/founder/v2/ui'
import { formatJoined } from '@/lib/founder/dashboard'

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-brand-900">{value}</dd>
    </div>
  )
}

export default function FounderBriefingDetailPage() {
  const params = useParams<{ id: string }>()
  const { loading, error, data, reload } = useFounderDashboard({
    view: 'detail',
    kind: 'briefing',
    id: params.id,
  })
  const detail = data?.detail as
    | {
        request?: Record<string, unknown>
        report?: Record<string, unknown> | null
        lifecycle?: { key: string; label: string }
      }
    | null
    | undefined
  const request = detail?.request || {}

  return (
    <FounderV2Gate>
      <FounderShell
        title={String(request.tenderTitle || request.tenderNumber || 'Briefing')}
        subtitle="Production payment and workflow state remain authoritative"
      >
        {loading && !detail ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !detail?.request ? (
          <ErrorState message="Briefing not found" />
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              {detail.lifecycle ? (
                <LifecycleBadge
                  lifecycle={detail.lifecycle.key}
                  label={detail.lifecycle.label}
                />
              ) : null}
              <span className="text-xs text-slate-500">
                Workflow status: {String(request.status || '—')} · Payment:{' '}
                {String(request.paymentStatus || '—')}
              </span>
            </div>
            <dl className="grid gap-5 rounded-md border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="SME"
                value={
                  request.smeId ? (
                    <Link href={`/founder/smes/${request.smeId}`} className="hover:underline">
                      {String(request.smeCompany || request.smeName || request.smeId)}
                    </Link>
                  ) : (
                    String(request.smeCompany || '')
                  )
                }
              />
              <Field label="Tender" value={String(request.tenderTitle || request.tenderNumber || '')} />
              <Field label="Briefing date" value={formatJoined(String(request.briefingDate || ''))} />
              <Field
                label="Amount"
                value={
                  <Money
                    cents={
                      typeof request.paymentAmount === 'number'
                        ? request.paymentAmount
                        : typeof request.quotedFee === 'number'
                          ? request.quotedFee
                          : null
                    }
                  />
                }
              />
              <Field
                label="Youth Agent"
                value={
                  request.assignedAgentId || request.agentId ? (
                    <Link
                      href={`/founder/agents/${request.assignedAgentId || request.agentId}`}
                      className="hover:underline"
                    >
                      {String(request.agentName || request.assignedAgentId || request.agentId)}
                    </Link>
                  ) : (
                    'Unassigned'
                  )
                }
              />
              <Field label="Paid at" value={formatJoined(String(request.paidAt || ''))} />
              <Field label="Report due" value={formatJoined(String(request.reportDueAt || ''))} />
              <Field label="Report SLA" value={String(request.reportSlaStatus || '')} />
            </dl>
            {detail.report ? (
              <section className="rounded-md border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-brand-900">Report</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {String(detail.report.summary || 'Report on file.')}
                </p>
              </section>
            ) : null}
            <p>
              <Link href="/admin/operations" className="text-sm font-semibold text-brand-800 hover:underline">
                Open in operations console
              </Link>
            </p>
          </div>
        )}
      </FounderShell>
    </FounderV2Gate>
  )
}
