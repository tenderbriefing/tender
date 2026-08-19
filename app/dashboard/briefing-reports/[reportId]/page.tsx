'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Download, Printer } from 'lucide-react'
import ReportContentRenderer from '@/components/briefing/ReportContentRenderer'
import ReportStatusBadge from '@/components/briefing/ReportStatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { BriefingReport } from '@/lib/briefing-intelligence/types'
import Image from 'next/image'
import Link from 'next/link'

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' })
}

export default function SmeBriefingReportViewPage() {
  const params = useParams<{ reportId: string }>()
  const reportId = String(params.reportId || '')
  const router = useRouter()

  const { user, userProfile, loading: authLoading } = useAuth()

  const [report, setReport] = useState<BriefingReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'sme' && userProfile?.userType !== 'admin')
        router.push('/dashboard')
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
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [reportId, user])

  async function downloadPdf() {
    try {
      const res = await authFetch(`/api/briefing-intelligence/reports/${reportId}/pdf?download=1`)
      if (!res.ok) throw new Error('PDF download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TenderBriefing-Report-${reportId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF download failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold text-slate-800">Report not found</p>
          <Link href="/dashboard/briefing-reports" className="mt-3 inline-flex text-sm font-semibold text-brand-700">
            ← Back to reports
          </Link>
        </main>
      </div>
    )
  }

  const reportContent = report.content
  const status = String(report.status || 'draft_report')
  const tenderTitle = report.tenderTitle || reportContent?.coverHeader.tenderTitle || ''
  const dateLabel = formatDate(reportContent?.coverHeader.reportDate || report.date || report.createdAt)

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-start justify-between gap-4 print:items-start">
          <div className="flex items-center gap-3">
            <Image src="/brand/logo.png" alt="TenderBriefing" width={40} height={40} className="h-10 w-10" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
                TenderBriefing
              </p>
              <h1 className="text-xl font-bold text-slate-900">Briefing Intelligence Report</h1>
              <p className="mt-1 text-sm text-slate-600">
                {tenderTitle ? (
                  <>
                    <span className="font-semibold text-slate-800">{tenderTitle}</span> ·{' '}
                  </>
                ) : null}
                {dateLabel}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <ReportStatusBadge status={status} />
              <span className="hidden text-xs font-mono text-slate-500 sm:inline">#{reportId}</span>
            </div>
            <div className="mt-2 flex items-center justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => void downloadPdf()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 print:mt-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:border-none print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Report ID</span>
                <span className="font-mono text-sm font-semibold text-slate-900">{reportId}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/briefing-reports"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Back to list
                </Link>
              </div>
            </div>

            <div className="mt-4">
              {reportContent ? (
                <ReportContentRenderer content={reportContent} variant="sme" />
              ) : (
                <p className="text-sm text-slate-600">Report content not available yet.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

