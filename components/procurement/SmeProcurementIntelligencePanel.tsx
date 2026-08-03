'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Info,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { auth } from '@/lib/firebase'
import { isProcurementIntelligenceUiEnabled } from '@/lib/procurement/intelligence/featureFlag'
import type { ProcurementIntelligenceResult } from '@/lib/procurement/intelligence/types'

interface Props {
  tenderId: string
}

const CLASS_LABEL: Record<string, string> = {
  likely_eligible: 'Likely eligible',
  potentially_eligible: 'Potentially eligible',
  eligibility_uncertain: 'Eligibility uncertain',
  likely_ineligible: 'Likely ineligible',
  insufficient_information: 'Insufficient information',
}

export default function SmeProcurementIntelligencePanel({ tenderId }: Props) {
  const [data, setData] = useState<ProcurementIntelligenceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  /** Public env is advisory only; pilots discover UI via authenticated API 200. */
  const publicEnabled = isProcurementIntelligenceUiEnabled()
  const [serverVisible, setServerVisible] = useState(publicEnabled)

  useEffect(() => {
    if (!tenderId) return
    let active = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const user = auth.currentUser
        if (!user) {
          if (publicEnabled) {
            setServerVisible(true)
            setError('Sign in as an SME to view opportunity intelligence.')
          } else {
            setServerVisible(false)
          }
          setData(null)
          return
        }
        const token = await user.getIdToken()
        const res = await fetch(`/api/procurement/intelligence/${encodeURIComponent(tenderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))
        if (!active) return
        if (res.ok) {
          setServerVisible(true)
          setData(json.data)
          return
        }
        // Fail-closed for non-pilots when public flag is false: hide panel entirely.
        if (!publicEnabled && (res.status === 401 || res.status === 403 || res.status === 503)) {
          setServerVisible(false)
          setData(null)
          setError(null)
          return
        }
        setServerVisible(publicEnabled)
        setError(json?.error?.message || json?.error || 'Intelligence unavailable')
        setData(null)
      } catch {
        if (active) {
          if (publicEnabled) {
            setServerVisible(true)
            setError('Failed to load procurement intelligence')
          } else {
            setServerVisible(false)
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [publicEnabled, tenderId])

  if (!serverVisible) return null

  return (
    <section
      className="rounded-3xl border border-brand-100 bg-gradient-to-br from-white via-brand-50/40 to-accent-50/30 p-6 shadow-sm sm:p-7"
      aria-labelledby="pi-heading"
    >
      <div className="mb-5">
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
          <Sparkles className="h-3.5 w-3.5 text-accent-500" aria-hidden />
          Machine-assisted
        </span>
        <h2 id="pi-heading" className="mt-2 text-lg font-bold text-brand-900">
          Opportunity intelligence
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Decision support from listing fields and your profile — not a guarantee of eligibility or
          award.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-500" role="status" aria-live="polite">
          Building opportunity intelligence…
        </p>
      )}

      {error && !loading && (
        <div
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Eligibility
              </p>
              <p className="mt-1 text-base font-bold text-brand-900">
                {CLASS_LABEL[data.eligibility.classification] || data.eligibility.classification}
              </p>
              <p className="mt-2 text-xs text-slate-500">Never treated as definitive eligibility.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Opportunity Fit
              </p>
              <p className="mt-1 text-3xl font-bold text-brand-900" aria-label={`Score ${data.opportunityFit.score} out of 100`}>
                {data.opportunityFit.score}
                <span className="text-base font-medium text-slate-500">/100</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Rules {data.opportunityFit.rulesVersion} — not win probability.
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-900">
              <Info className="h-4 w-4 text-accent-500" aria-hidden />
              Summary
            </h3>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>
                <strong>What:</strong> {data.summary.whatIsProcured}
              </li>
              <li>
                <strong>Who may qualify:</strong> {data.summary.whoMayQualify}
              </li>
              {data.summary.keyDates.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>

          {data.recommendedActions.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-900">
                <ListChecks className="h-4 w-4 text-accent-500" aria-hidden />
                Recommended next actions
              </h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                {data.recommendedActions.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">{a.title}</span>
                    <span className="text-slate-500"> — {a.rationale}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-900">
              <ClipboardList className="h-4 w-4 text-accent-500" aria-hidden />
              Compliance checklist
            </h3>
            <ul className="space-y-2">
              {data.checklist.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm"
                >
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      c.status === 'available' ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium text-brand-900">{c.label}</span>
                    <span className="text-slate-500"> · {c.status.replace(/_/g, ' ')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {data.opportunityFit.factors.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-brand-900">
                Score factors
              </summary>
              <ul className="mt-3 space-y-1 text-slate-600">
                {data.opportunityFit.factors.map((f) => (
                  <li key={f.id}>
                    {f.label}: {f.delta > 0 ? '+' : ''}
                    {f.delta}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
