'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'

type DraftSection = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  details?: Array<{ label: string; value: string }>
  imageRefs?: Array<{ evidenceId: string; caption?: string; fileName?: string }>
  humanEdited?: boolean
  source?: string
}

type ReportDraft = {
  cover?: Record<string, string>
  sections?: DraftSection[]
  sourceConflicts?: Array<{ message: string; field?: string }>
  evidenceIndex?: Array<{ id: string; category: string; fileName: string; included: boolean }>
  voice?: string
}

type ReportPayload = {
  id?: string
  version?: number
  status?: string
  approvalStatus?: string
  draft?: ReportDraft
  pdfFileName?: string | null
  docxFileName?: string | null
  approvedAt?: string | null
}

export default function AdminReportReviewPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const requestId = String(params?.id || '')

  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [rowLabel, setRowLabel] = useState('')
  const [sections, setSections] = useState<DraftSection[]>([])
  const [cover, setCover] = useState<Record<string, string>>({})
  const [conflicts, setConflicts] = useState<Array<{ message: string }>>([])

  const load = useCallback(async () => {
    if (!requestId) return
    const res = await authFetch(`/api/admin/ops/${requestId}/report`)
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || 'Failed to load report')
      return
    }
    const r = json.data.report as ReportPayload | null
    setReport(r)
    setRowLabel(
      `${json.data.row?.companyName || ''} · ${json.data.row?.tenderNumber || requestId}`
    )
    setSections(r?.draft?.sections || [])
    setCover((r?.draft?.cover as Record<string, string>) || {})
    setConflicts(r?.draft?.sourceConflicts || [])
  }, [requestId])

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (user && userProfile?.userType === 'admin') load()
  }, [user, userProfile, load])

  async function runReportAction(action: string, body: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await authFetch(`/api/admin/ops/${requestId}/report`, {
        method: 'POST',
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Action failed')
        return
      }
      if (action === 'approve') {
        toast.success(
          json.data?.emailSent === false
            ? 'Final report approved — PDF & DOCX ready (no email sent)'
            : 'Final report approved'
        )
      } else {
        toast.success(`${action.replace(/_/g, ' ')} OK`)
      }
      await load()
    } catch {
      toast.error('Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdits(e: FormEvent) {
    e.preventDefault()
    await runReportAction('edit', {
      edits: {
        cover,
        sections: sections.map((s) => ({
          id: s.id,
          title: s.title,
          paragraphs: s.paragraphs,
          bullets: s.bullets,
          details: s.details,
          imageRefs: s.imageRefs,
        })),
      },
    })
  }

  async function download(format: 'pdf' | 'docx') {
    setBusy(true)
    try {
      const res = await authFetch(
        `/api/admin/ops/${requestId}/report/download?format=${format}`
      )
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const json = await res.json()
        if (!json.success) {
          toast.error(json.error || 'Download failed')
          return
        }
        if (json.data?.url) {
          window.open(json.data.url, '_blank', 'noopener,noreferrer')
          return
        }
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        format === 'pdf'
          ? report?.pdfFileName || `report-${requestId}.pdf`
          : report?.docxFileName || `report-${requestId}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user || userProfile?.userType !== 'admin') return null

  const approved = report?.approvalStatus === 'approved'

  return (
    <div className="procurement-shell">
      <Header />
      <ProcurementPageHeader
        kicker="Operations"
        title="Report review"
        description="Review the draft, edit sections, then Approve Final Report. Client email stays manual."
        breadcrumb={{ label: 'Operations board', href: '/admin/operations' }}
      />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{rowLabel}</p>
            <p className="text-xs text-slate-500">
              {report
                ? `v${report.version} · ${report.approvalStatus || report.status}`
                : 'No draft yet'}
              {report?.draft?.voice ? ` · voice: ${report.draft.voice}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/operations"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Back to board
            </Link>
            {!report ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => runReportAction('generate')}
              >
                Generate draft
              </button>
            ) : null}
            {approved ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => download('pdf')}
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
                  onClick={() => download('docx')}
                >
                  Download DOCX
                </button>
              </>
            ) : null}
          </div>
        </div>

        {conflicts.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Source conflicts — resolve before approval</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {conflicts.map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!report ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            No report draft on this request. Generate a draft from evidence and metadata.
          </p>
        ) : (
          <form onSubmit={onSaveEdits} className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Cover
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['tenderNumber', 'Tender / RFQ'],
                    ['tenderDescription', 'Description'],
                    ['issuingInstitution', 'Issuing institution'],
                    ['preparedFor', 'Prepared for'],
                    ['briefingDate', 'Briefing date'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    {label}
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={cover[key] || ''}
                      disabled={approved || busy}
                      onChange={(e) =>
                        setCover((c) => ({ ...c, [key]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            {sections.map((section, sIdx) => (
              <section
                key={section.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    className="w-full max-w-md rounded border border-slate-300 px-3 py-2 text-base font-semibold"
                    value={section.title}
                    disabled={approved || busy}
                    onChange={(e) => {
                      const next = [...sections]
                      next[sIdx] = { ...section, title: e.target.value }
                      setSections(next)
                    }}
                  />
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {section.humanEdited ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                        Human edited
                      </span>
                    ) : null}
                    <span>{section.source || '—'}</span>
                    {!approved ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                        onClick={() =>
                          runReportAction('regenerate_section', {
                            sectionId: section.id,
                            force: false,
                          })
                        }
                      >
                        Regenerate
                      </button>
                    ) : null}
                  </div>
                </div>

                {(section.paragraphs || []).map((p, pIdx) => (
                  <textarea
                    key={pIdx}
                    rows={3}
                    className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={p}
                    disabled={approved || busy}
                    onChange={(e) => {
                      const next = [...sections]
                      const paras = [...(section.paragraphs || [])]
                      paras[pIdx] = e.target.value
                      next[sIdx] = { ...section, paragraphs: paras }
                      setSections(next)
                    }}
                  />
                ))}

                {(section.bullets || []).length > 0 ? (
                  <textarea
                    rows={Math.max(3, (section.bullets || []).length + 1)}
                    className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={(section.bullets || []).join('\n')}
                    disabled={approved || busy}
                    onChange={(e) => {
                      const next = [...sections]
                      next[sIdx] = {
                        ...section,
                        bullets: e.target.value.split('\n').filter((l) => l.length > 0),
                      }
                      setSections(next)
                    }}
                  />
                ) : null}

                {(section.details || []).length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-slate-700">
                    {(section.details || []).map((d, i) => (
                      <li key={i}>
                        <strong>{d.label}:</strong> {d.value}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {(section.imageRefs || []).map((img, iIdx) => (
                  <label key={iIdx} className="mt-3 block text-sm">
                    Image caption ({img.fileName || img.evidenceId})
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={img.caption || ''}
                      disabled={approved || busy}
                      onChange={(e) => {
                        const next = [...sections]
                        const refs = [...(section.imageRefs || [])]
                        refs[iIdx] = { ...img, caption: e.target.value }
                        next[sIdx] = { ...section, imageRefs: refs }
                        setSections(next)
                      }}
                    />
                  </label>
                ))}
              </section>
            ))}

            {!approved ? (
              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Save edits
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Approve final report? This generates PDF and DOCX and marks Report Ready. No email will be sent.'
                      )
                    ) {
                      return
                    }
                    runReportAction('approve')
                  }}
                >
                  Approve Final Report
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                REPORT READY — approved
                {report.approvedAt ? ` at ${report.approvedAt}` : ''}. Founder emails the client
                manually from the Operations Board.
              </p>
            )}
          </form>
        )}
      </main>
      <Footer />
    </div>
  )
}
