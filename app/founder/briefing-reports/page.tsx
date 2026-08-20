'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { AlertTriangle, Clock, FileText } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import ReportStatusBadge from '@/components/briefing/ReportStatusBadge'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { BriefingReport } from '@/lib/briefing-intelligence/types'

const STATUS_OPTIONS = [
  'awaiting_evidence',
  'evidence_uploaded',
  'processing',
  'draft_report',
  'agent_review',
  'final',
  'delivered',
  'processing_failed',
] as const

function formatSlaDue(dateValue?: string | null) {
  if (!dateValue) return null
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' })
}

function getSlaTone(report: any): 'green' | 'amber' | 'red' {
  if (report?.status === 'processing_failed') return 'red'
  if (report?.slaBreached === true) return 'red'

  const dueRaw = report?.slaDueAt || report?.slaDeadlineAt || report?.dueAt
  if (!dueRaw) return 'green'
  const due = new Date(String(dueRaw))
  if (Number.isNaN(due.getTime())) return 'green'

  const now = Date.now()
  const dueMs = due.getTime()
  if (now > dueMs) return 'red'
  const amberWindowMs = 24 * 60 * 60 * 1000
  if (now > dueMs - amberWindowMs) return 'amber'
  return 'green'
}

function SlaPill({ tone, label }: { tone: 'green' | 'amber' | 'red'; label: string }) {
  const cfg: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
    red: 'bg-red-50 text-red-900 ring-red-200',
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ring-1 ring-inset ${cfg[tone]}`}>
      <Clock className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export default function FounderBriefingReportsPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<BriefingReport[]>([])

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [slaFilter, setSlaFilter] = useState<'all' | 'breached' | 'not_breached'>('all')

  const query = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('scope', 'ops')
    if (statusFilter !== 'all') qs.set('status', statusFilter)
    if (slaFilter !== 'all') qs.set('slaBreached', slaFilter === 'breached' ? 'true' : 'false')
    return qs.toString()
  }, [slaFilter, statusFilter])

  useEffect(() => {
    setLoading(true)
    authFetch(`/api/briefing-intelligence/reports?${query}`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok || json.success === false) throw new Error(json.error || 'Failed to load reports')
        setReports((json.data || []) as BriefingReport[])
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [query])

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              Ops intelligence
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Briefing reports</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track status, SLA health, and overdue items across all agents and SMEs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {String(s).split('_').join(' ')}
                </option>
              ))}
            </select>
            <select
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value as any)}
            >
              <option value="all">All SLA</option>
              <option value="breached">SLA breached</option>
              <option value="not_breached">Not breached</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No briefing reports"
              description="Reports appear here as youth-agent evidence is submitted, reviewed, and delivered."
              action={{ label: 'Go to overview', href: '/founder' }}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[920px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">SLA</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Tender</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const report = r as any
                    const id = String(report.reportId || report.id || '')
                    const status = String(report.status || 'awaiting_evidence')
                    const agentName = report.agentName || report.youthAgentName || '—'
                    const tenderTitle = report.tenderTitle || report.tender?.title || '—'
                    const createdAt = report.createdAt ? new Date(String(report.createdAt)) : null
                    const updatedAt = report.updatedAt ? new Date(String(report.updatedAt)) : null
                    const createdLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString('en-ZA') : '—'
                    const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toLocaleString('en-ZA') : null
                    const dueLabel = formatSlaDue(report.slaDueAt || report.slaDeadlineAt || report.dueAt)

                    const tone = getSlaTone(report)
                    const needsAttention = tone === 'red' || report.status === 'processing_failed'

                    return (
                      <tr
                        key={id}
                        className={needsAttention ? 'bg-red-50/40' : undefined}
                      >
                        <td className="border-t border-slate-200 px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <ReportStatusBadge status={status} />
                            {needsAttention ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-1 text-[11px] font-bold text-red-900">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Needs attention
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 align-top">
                          <SlaPill
                            tone={tone}
                            label={tone === 'green' ? 'On track' : tone === 'amber' ? 'Approaching' : 'Breached'}
                          />
                          {dueLabel ? (
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              Due: {dueLabel}
                            </p>
                          ) : null}
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 align-top">
                          <p className="font-semibold text-slate-900">{agentName}</p>
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 align-top">
                          <p className="font-semibold text-slate-900">{tenderTitle}</p>
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 align-top">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-800">{createdLabel}</p>
                            {updatedLabel ? (
                              <p className="text-xs font-semibold text-slate-500">Updated {updatedLabel}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 align-top">
                          <Link
                            href={`/dashboard/briefing-reports/${id}`}
                            className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold ${
                              needsAttention ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-600 text-white hover:bg-brand-700'
                            }`}
                          >
                            View detail
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

