'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import ReportContentRenderer from '@/components/briefing/ReportContentRenderer'
import ReportStatusBadge from '@/components/briefing/ReportStatusBadge'
import type { BriefingReport } from '@/lib/briefing-intelligence/types'

export default function AgentBriefingReportReviewPage() {
  const params = useParams<{ reportId: string }>()
  const reportId = String(params.reportId || '')
  const router = useRouter()

  const { user, userProfile, loading: authLoading } = useAuth()

  const [report, setReport] = useState<BriefingReport | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'youth-agent') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    if (!reportId) return
    if (!user) return
    setLoading(true)
    authFetch(`/api/briefing-intelligence/reports/${reportId}`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok || json.success === false) throw new Error(json.error || 'Failed to load report')
        setReport(json.data as BriefingReport)
        setNotes(String((json.data as BriefingReport)?.reviewNotes || ''))
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [reportId, user])

  async function approveAndFinalize() {
    if (!reportId) return
    setApproving(true)
    try {
      const res = await authFetch(`/api/briefing-intelligence/reports/${reportId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: notes.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Approve failed')

      toast.success('Report finalized')
      router.push('/agent/workspace/assignments')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <WorkspaceShell title="Report review">
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      </WorkspaceShell>
    )
  }

  if (!report) {
    return (
      <WorkspaceShell title="Report review">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">Report not found</p>
          <Link href="/agent/workspace/assignments" className="mt-3 inline-flex text-sm font-semibold text-brand-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to assignments
          </Link>
        </div>
      </WorkspaceShell>
    )
  }

  const status = String((report as any).status || 'draft_report')
  const createdAt = (report as any).createdAt ? String((report as any).createdAt) : ''

  return (
    <WorkspaceShell title="Report review">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/agent/workspace/assignments"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to assignments
              </Link>
              <h2 className="mt-3 text-lg font-bold text-slate-900">Briefing intelligence report</h2>
              <p className="mt-1 text-xs text-slate-500">
                Report ID · <span className="font-mono">{reportId}</span>
                {createdAt ? ` · ${new Date(createdAt).toLocaleString('en-ZA')}` : null}
              </p>
            </div>
            <ReportStatusBadge status={status} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900">Draft report content</h3>
          <p className="mt-1 text-sm text-slate-600">
            Review the full 14-section submission before final approval.
          </p>
          <div className="mt-4">
            {report.content ? (
              <ReportContentRenderer content={report.content} variant="agent" />
            ) : (
              <p className="text-sm text-slate-600">Report content not available yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-700" />
              <h3 className="text-sm font-bold text-slate-900">Add review notes</h3>
            </div>
            <span className="text-xs text-slate-500">{notes.trim().length}/8000</span>
          </div>
          <textarea
            className="mt-3 min-h-[120px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
            value={notes}
            maxLength={8000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Confirm facts, note anything for the SME, or add operational comments…"
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void approveAndFinalize()}
              disabled={approving}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {approving ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Approving…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & Finalize
                </span>
              )}
            </button>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  )
}

