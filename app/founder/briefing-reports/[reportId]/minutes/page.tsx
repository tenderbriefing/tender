'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'

type MinutesPayload = {
  reportId: string
  briefingRunId?: string
  requestId: string
  tenderId: string
  agentId: string
  smeId?: string
  evidenceSubmittedAt?: string | null
  reportStatus: string
  reportGenerationStatus: string | null
  lastError?: string | null
  pipelineDiagnostics?: {
    briefingRunId: string
    currentStage: string
    lastSuccessfulStage: string | null
    failureStage: string | null
    retryEligible: boolean
    lastErrorCategory: string | null
    attemptCount: number
    evidenceIntact: boolean
    transcriptIntact: boolean
    draftAvailable: boolean
    currentVersion: number | null
    approvedVersion: number | null
    qualityWarnings: string[]
    updatedAt: string
  } | null
  transcriptionJob: {
    id: string
    status: string
    attempts?: number
    maxAttempts?: number
    completedAt: string | null
    errorCode?: string | null
  } | null
  reportJob: {
    id: string
    status: string
    attempts: number
    maxAttempts: number
    errorMessage: string | null
    promptVersion: string
    completedAt: string | null
  } | null
  version: {
    id: string
    version: number
    status: string
    promptVersion: string
    model: string | null
    createdAt: string
    approvedAt: string | null
    approvedBy?: string | null
    structuredContent: any
    pdfStoragePath: string | null
  } | null
  meetingMinutes: any
  pdfSignedUrl: string | null
  attendanceSignedUrls: string[]
  attendanceEvidenceCount?: number
  transcriptId: string | null
  audioPresent?: boolean
}

export default function FounderBriefingMinutesPage() {
  const params = useParams()
  const reportId = String(params?.reportId || '')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<MinutesPayload | null>(null)

  const load = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/briefing-intelligence/reports/${reportId}/minutes`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load')
      setData(json.data as MinutesPayload)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    void load()
  }, [load])

  async function postAction(action: 'approve' | 'regenerate') {
    setBusy(true)
    try {
      const res = await authFetch(`/api/briefing-intelligence/reports/${reportId}/minutes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Action failed')
      if (action === 'approve' && json.data?.alreadyApproved) {
        toast.success('Already approved (idempotent)')
      } else {
        toast.success(action === 'approve' ? 'Report approved' : 'Regeneration queued')
      }
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-slate-600">Report not available.</p>
        <Link href="/founder/briefing-reports" className="mt-4 inline-block text-sm underline">
          Back
        </Link>
      </div>
    )
  }

  const m = data.meetingMinutes || data.version?.structuredContent

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/founder/briefing-reports" className="text-sm text-slate-500 hover:text-slate-800">
            ← Briefing reports
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Briefing Report · {data.reportId}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.requestId} · {data.tenderId} · YA {data.agentId}
          </p>
          {data.briefingRunId ? (
            <p className="mt-1 font-mono text-xs text-slate-500">briefingRunId: {data.briefingRunId}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/founder/briefing-reports/${data.reportId}/transcript`}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            Transcript
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void postAction('regenerate')}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
          >
            Regenerate
          </button>
          <button
            type="button"
            disabled={busy || !m}
            onClick={() => void postAction('approve')}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Approve
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
        <div>Report status: <strong>{data.reportStatus}</strong></div>
        <div>Submitted: <strong>{data.evidenceSubmittedAt || '—'}</strong></div>
        <div>
          Evidence: audio <strong>{data.audioPresent ? 'yes' : 'no'}</strong> · attendance files{' '}
          <strong>{data.attendanceEvidenceCount ?? data.attendanceSignedUrls.length}</strong>
        </div>
        <div>
          Transcription: <strong>{data.transcriptionJob?.status || '—'}</strong>
          {data.transcriptionJob?.attempts != null
            ? ` · attempt ${data.transcriptionJob.attempts}/${data.transcriptionJob.maxAttempts ?? '—'}`
            : ''}
        </div>
        <div>
          Report generation: <strong>{data.reportGenerationStatus || data.reportJob?.status || '—'}</strong>
          {data.reportJob
            ? ` · attempt ${data.reportJob.attempts}/${data.reportJob.maxAttempts}`
            : ''}
        </div>
        {data.version ? (
          <div>
            Version {data.version.version} · prompt {data.version.promptVersion} · {data.version.status}
            {data.version.approvedAt ? ` · approved ${data.version.approvedAt}` : ''}
          </div>
        ) : null}
        {data.pipelineDiagnostics ? (
          <div className="mt-3 space-y-1 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">
            <div className="font-semibold text-slate-900">Pipeline diagnostics</div>
            <div>Stage: {data.pipelineDiagnostics.currentStage}</div>
            <div>Last success: {data.pipelineDiagnostics.lastSuccessfulStage || '—'}</div>
            <div>Failure stage: {data.pipelineDiagnostics.failureStage || '—'}</div>
            <div>Error category: {data.pipelineDiagnostics.lastErrorCategory || '—'}</div>
            <div>Retry eligible: {data.pipelineDiagnostics.retryEligible ? 'yes' : 'no'}</div>
            <div>
              Intact — evidence: {data.pipelineDiagnostics.evidenceIntact ? 'yes' : 'no'} · transcript:{' '}
              {data.pipelineDiagnostics.transcriptIntact ? 'yes' : 'no'} · draft:{' '}
              {data.pipelineDiagnostics.draftAvailable ? 'yes' : 'no'}
            </div>
            {(data.pipelineDiagnostics.qualityWarnings || []).length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-amber-900">
                {data.pipelineDiagnostics.qualityWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {data.lastError ? (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
            {data.lastError}
          </div>
        ) : null}
        {data.reportJob?.errorMessage ? (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
            {data.reportJob.errorMessage}
          </div>
        ) : null}
        {data.pdfSignedUrl ? (
          <a
            href={data.pdfSignedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 font-medium text-slate-900 underline"
          >
            Download PDF
          </a>
        ) : null}
      </div>

      {data.attendanceSignedUrls.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Attendance evidence</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {data.attendanceSignedUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="Attendance proof" className="max-h-48 rounded border border-slate-200" />
            ))}
          </div>
        </div>
      ) : null}

      {m ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">
          <h2 className="text-lg font-semibold text-slate-900">Generated minutes</h2>
          <p className="text-xs text-slate-500">
            Structured summary of the completed transcript. Review the transcript link before approving delivery.
          </p>
          <section>
            <h3 className="font-semibold text-slate-900">Executive summary</h3>
            <p className="mt-1">{m.purposeOfBriefing}</p>
          </section>
          {(m.whatDepartmentExplained || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">What the Department Explained</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {m.whatDepartmentExplained.map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {(m.keyRequirementsDiscussed || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">Key requirements discussed</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {m.keyRequirementsDiscussed.map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {(m.submissionRequirements || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">Submission requirements</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {m.submissionRequirements.map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {(m.questionsAndAnswers || m.questionsAndClarifications || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">Questions and answers</h3>
              <div className="mt-2 space-y-3">
                {(m.questionsAndAnswers?.length
                  ? m.questionsAndAnswers
                  : m.questionsAndClarifications
                ).map((q: any, i: number) => (
                  <div key={i} className="rounded border border-slate-100 p-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question</div>
                    <div className="font-medium">{q.question || q.heading}</div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Answer</div>
                    <p className="mt-0.5">{q.answer || q.summary}</p>
                    {q.unresolved ? (
                      <p className="mt-1 text-xs text-amber-800">No definitive answer was recorded.</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {(m.amendments || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">Clarifications and changes</h3>
              <ul className="mt-2 space-y-2">
                {m.amendments.map((a: any, i: number) => (
                  <li key={i} className="rounded border border-slate-100 p-2">
                    {a.kind ? (
                      <div className="text-xs font-medium text-slate-500">{String(a.kind).replace(/_/g, ' ')}</div>
                    ) : null}
                    <div>{a.briefingChange}</div>
                    {a.bidderImplication ? (
                      <div className="mt-1 text-xs text-slate-600">Implication: {a.bidderImplication}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {(m.importantDates || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">Important dates</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {m.importantDates.map((d: any, i: number) => (
                  <li key={i}>
                    <strong>{d.date}</strong> — {d.description}
                    {d.uncertain ? ' (uncertain — verify)' : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {(m.verificationItems || []).length > 0 ? (
            <section className="rounded border border-amber-200 bg-amber-50 p-3">
              <h3 className="font-semibold text-amber-950">Items requiring verification</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1 text-amber-950">
                {m.verificationItems.map((v: any, i: number) => (
                  <li key={i}>
                    <strong>{v.item}</strong> — {v.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {(m.actionsForSme || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">Actions for the SME</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {m.actionsForSme.map((a: any, i: number) => (
                  <li key={i}>
                    {a.action}
                    {a.deadline ? ` (by ${a.deadline})` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {(m.mainPoints || []).length > 0 ? (
            <section>
              <h3 className="font-semibold text-slate-900">Main Points</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1 pr-3 font-medium">Matter</th>
                    <th className="py-1 font-medium">What Was Said</th>
                  </tr>
                </thead>
                <tbody>
                  {m.mainPoints.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3">{row.matter}</td>
                      <td className="py-2">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-600">No meeting minutes draft yet.</p>
      )}
    </div>
  )
}
