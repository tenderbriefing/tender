'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import ReportStatusBadge from '@/components/briefing/ReportStatusBadge'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { BriefingReport } from '@/lib/briefing-intelligence/types'
import { FileText } from 'lucide-react'

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

export default function SmeBriefingReportsListPage() {
  const router = useRouter()
  const { user, userProfile, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<BriefingReport[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const query = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('scope', 'sme')
    if (statusFilter !== 'all') qs.set('status', statusFilter)
    return qs.toString()
  }, [statusFilter])

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'sme') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    authFetch(`/api/briefing-intelligence/reports?${query}`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok || json.success === false) throw new Error(json.error || 'Failed to load reports')
        setReports((json.data || []) as BriefingReport[])
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [query, user])

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              Briefing intelligence
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">My reports</h1>
            <p className="mt-1 text-sm text-slate-600">
              View the intelligence reports generated from youth-agent evidence submissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="hidden text-sm font-semibold text-slate-800 sm:block">Filter</label>
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
              title="No reports found"
              description="Once evidence is submitted and verified, your Briefing Intelligence Reports will appear here."
              action={{ label: 'View dashboard', href: '/dashboard' }}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reports.map((r) => {
                const report = r as any
                const id = String(report.reportId || report.id || r.reportId || '')
                const status = String(report.status || 'awaiting_evidence')
                const tenderTitle = report.tenderTitle || report.tender?.title || 'Tender briefing'
                const createdAt = report.date ? new Date(String(report.date)) : null
                const submittedLabel = createdAt ? createdAt.toLocaleString('en-ZA') : null

                return (
                  <Link
                    key={id}
                    href={`/dashboard/briefing-reports/${id}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ReportStatusBadge status={status} />
                      {submittedLabel ? (
                        <p className="text-xs font-semibold text-slate-500">{submittedLabel}</p>
                      ) : (
                        <p className="text-xs font-semibold text-slate-500">—</p>
                      )}
                    </div>
                    <h2 className="mt-3 truncate text-base font-bold text-slate-900">{tenderTitle}</h2>
                    <p className="mt-1 text-xs font-mono text-slate-500">#{id}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-700 hover:text-brand-800">View report →</p>
                      <span className="inline-flex items-center rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                        {status.split('_').join(' ')}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

