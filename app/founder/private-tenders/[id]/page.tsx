'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FounderShell } from '@/components/founder/FounderShell'
import { FounderV2Gate } from '@/components/founder/v2/FounderV2Gate'
import { ErrorState, LoadingState } from '@/components/founder/v2/ui'
import { authFetch } from '@/lib/api/authenticatedFetch'

type Submission = {
  id: string
  status: string
  organisationId?: string | null
  companyName: string
  registrationNumber?: string
  website?: string
  contactPersonName: string
  contactEmail: string
  contactPhone?: string
  title: string
  tenderReference: string
  description: string
  category: string
  province: string
  municipality?: string
  closingDate: string
  closingTime?: string
  briefingDate: string
  briefingTime: string
  briefingVenue: string
  briefingInstructions?: string
  eligibilityRequirements?: string
  submissionInstructions?: string
  procurementContactName?: string
  procurementContactEmail?: string
  procurementContactPhone?: string
  tenderDocument?: { fileName: string; storagePath: string }
  duplicateFlags?: string[]
  publishedTenderId?: string | null
  submittedAt: string
  changesRequestedNote?: string | null
  changesRequestedCategory?: string | null
  audit?: Array<{ at: string; action: string; note?: string | null }>
}

export default function FounderPrivateTenderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [issueCategory, setIssueCategory] = useState('other')
  const [submission, setSubmission] = useState<Submission | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/founder/private-tenders/${params.id}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Not found')
      setSubmission(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  async function openDocument() {
    const res = await authFetch(`/api/founder/private-tenders/${params.id}/document`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      setError(json.error || 'Unable to open document')
      return
    }
    window.open(json.data.url, '_blank', 'noopener,noreferrer')
  }

  async function review(action: 'approve' | 'reject' | 'request_changes' | 'under_review') {
    if ((action === 'reject' || action === 'request_changes') && !note.trim()) {
      setError('A note is required for this action')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch(`/api/founder/private-tenders/${params.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note,
          issueCategory: action === 'request_changes' ? issueCategory : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Action failed')
      if (action === 'approve' && json.data?.publishedTenderId) {
        router.push(`/tenders/${json.data.publishedTenderId}`)
        return
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FounderV2Gate>
      <FounderShell
        title="Review private tender"
        subtitle={submission?.tenderReference || params.id}
        actions={
          <Link href="/founder/private-tenders" className="text-sm font-semibold text-brand-800">
            ← Queue
          </Link>
        }
      >
        {loading && !submission ? (
          <LoadingState label="Loading submission…" />
        ) : error && !submission ? (
          <ErrorState message={error} onRetry={load} />
        ) : submission ? (
          <div className="space-y-6">
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            {!!submission.duplicateFlags?.length && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Possible duplicate flags: {submission.duplicateFlags.join(', ')}
              </div>
            )}

            <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 sm:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Company
                </h2>
                <p className="mt-1 text-lg font-semibold text-brand-950">{submission.companyName}</p>
                <p className="text-sm text-slate-600">{submission.contactPersonName}</p>
                <p className="text-sm text-slate-600">{submission.contactEmail}</p>
                {submission.website && (
                  <a
                    href={submission.website}
                    className="text-sm font-medium text-brand-800 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {submission.website}
                  </a>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Tender
                </h2>
                <p className="mt-1 text-lg font-semibold text-brand-950">{submission.title}</p>
                <p className="font-mono text-sm text-slate-600">{submission.tenderReference}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {submission.province}
                  {submission.municipality ? ` · ${submission.municipality}` : ''}
                </p>
                <p className="text-sm capitalize text-slate-700">
                  Status: {String(submission.status).replace(/_/g, ' ')}
                </p>
                {submission.organisationId && (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    Org: {submission.organisationId}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Compulsory briefing
              </h2>
              <p className="mt-2 text-sm text-slate-800">
                {submission.briefingDate} {submission.briefingTime} · {submission.briefingVenue}
              </p>
              {submission.briefingInstructions && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {submission.briefingInstructions}
                </p>
              )}
              <p className="mt-3 text-sm text-slate-700">
                Closing: {submission.closingDate} {submission.closingTime || ''}
              </p>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Description & eligibility
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{submission.description}</p>
              {submission.eligibilityRequirements && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  <strong>Eligibility:</strong> {submission.eligibilityRequirements}
                </p>
              )}
              {submission.submissionInstructions && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  <strong>Submission:</strong> {submission.submissionInstructions}
                </p>
              )}
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Document
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {submission.tenderDocument?.fileName || 'No document'}
              </p>
              <button
                type="button"
                onClick={() => void openDocument()}
                className="mt-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-slate-50"
              >
                Open tender document
              </button>
              {submission.publishedTenderId && (
                <Link
                  href={`/tenders/${submission.publishedTenderId}`}
                  className="ml-3 text-sm font-semibold text-brand-800 hover:underline"
                >
                  View published tender
                </Link>
              )}
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Founder actions
              </h2>
              <label className="mt-3 block text-sm">
                <span className="font-semibold text-slate-700">Change-request category</span>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="missing_document">Missing document</option>
                  <option value="incorrect_closing_date">Incorrect closing date</option>
                  <option value="tender_reference_issue">Tender reference issue</option>
                  <option value="briefing_details_incomplete">Briefing details incomplete</option>
                  <option value="contact_details_incomplete">Contact details incomplete</option>
                  <option value="formatting_data_quality">Formatting / data quality</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Rejection / changes note (required for reject or request changes)"
                className="mt-3 min-h-[90px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void review('under_review')}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold"
                >
                  Mark under review
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void review('request_changes')}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
                >
                  Request changes
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void review('reject')}
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void review('approve')}
                  className="rounded-md bg-brand-800 px-3 py-2 text-sm font-semibold text-white"
                >
                  Approve & Publish
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </FounderShell>
    </FounderV2Gate>
  )
}
