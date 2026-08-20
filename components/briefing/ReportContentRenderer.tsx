'use client'

import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { BriefingReportContent } from '@/lib/briefing-intelligence/types'

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—'
  if (typeof value === 'string') return value.trim() ? value : '—'
  return String(value)
}

function SeverityPill({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const cfg: Record<string, string> = {
    high: 'bg-red-50 text-red-900 ring-red-200',
    medium: 'bg-amber-50 text-amber-900 ring-amber-200',
    low: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ring-1 ring-inset ${cfg[severity]}`}>
      {severity}
    </span>
  )
}

function PriorityPill({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const cfg: Record<string, string> = {
    high: 'bg-red-50 text-red-900 ring-red-200',
    medium: 'bg-amber-50 text-amber-900 ring-amber-200',
    low: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ring-1 ring-inset ${cfg[priority]}`}>
      {priority}
    </span>
  )
}

export default function ReportContentRenderer({
  content,
  variant = 'default',
}: {
  content: BriefingReportContent
  variant?: 'agent' | 'sme' | 'default'
}) {
  const sections: Array<{ title: string; icon?: ReactNode; value?: ReactNode }> = [
    {
      title: 'Tender overview',
      icon: <Building2 className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Report code
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                {content.coverHeader.reportId}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Tender reference
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                {content.coverHeader.tenderReference}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{content.coverHeader.tenderTitle}</p>
            <p className="mt-1 text-sm text-slate-700">
              {content.coverHeader.issuingEntity} · {content.coverHeader.briefingVenue}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Briefing date
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatValue(content.coverHeader.briefingDate)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Report date
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatValue(content.coverHeader.reportDate)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Province
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatValue(content.tenderDetails.province)}
              </p>
            </div>
          </div>

          {content.tenderDetails.description ? (
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Tender description
              </p>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                {content.tenderDetails.description}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {content.tenderDetails.category ? (
              <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-200">
                Category: {content.tenderDetails.category}
              </span>
            ) : null}
            {content.tenderDetails.closingDate ? (
              <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-800 ring-1 ring-slate-200">
                Closing: {content.tenderDetails.closingDate}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: 'Executive summary',
      icon: <ClipboardList className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{content.executiveSummary.summary}</p>
          <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
              Key takeaway
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              {content.executiveSummary.keyTakeaway}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Key requirements',
      icon: <FileText className="h-4 w-4 text-brand-700" />,
      value: (
        <ul className="space-y-2">
          {content.keyRequirements.length === 0 ? <li className="text-sm text-slate-500">—</li> : null}
          {content.keyRequirements.map((r, idx) => (
            <li key={`${r.requirement}-${idx}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">{r.requirement}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Source: {r.source}
              </p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: 'Clarifications',
      icon: <FileText className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          {content.clarifications.length === 0 ? (
            <p className="text-sm text-slate-500">—</p>
          ) : null}
          {content.clarifications.map((q, idx) => (
            <div key={`${q.question}-${idx}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">
                Q: {q.question}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">A: {q.answer}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Source: {q.source}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Questions & answers',
      icon: <FileText className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          {content.questionsAndAnswers.length === 0 ? (
            <p className="text-sm text-slate-500">—</p>
          ) : null}
          {content.questionsAndAnswers.map((q, idx) => (
            <div key={`${q.question}-${idx}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">
                {q.askedBy ? `${q.askedBy}: ` : null}Q: {q.question}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">A: {q.answer}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Changes & addenda',
      icon: <FileText className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          {content.changesAndAddenda.length === 0 ? <p className="text-sm text-slate-500">—</p> : null}
          {content.changesAndAddenda.map((c, idx) => (
            <div key={`${c.change}-${idx}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">{c.change}</p>
              {c.impact ? <p className="mt-2 text-sm text-slate-800">Impact: {c.impact}</p> : null}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Compliance risks',
      icon: <ShieldCheck className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          {content.complianceRisks.length === 0 ? <p className="text-sm text-slate-500">—</p> : null}
          {content.complianceRisks.map((r, idx) => (
            <div key={`${r.risk}-${idx}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Risk: {r.risk}</p>
                <SeverityPill severity={r.severity} />
              </div>
              {r.mitigation ? <p className="mt-2 text-sm text-slate-800">Mitigation: {r.mitigation}</p> : null}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Key dates',
      icon: <CalendarDays className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          {content.keyDates.length === 0 ? <p className="text-sm text-slate-500">—</p> : null}
          {content.keyDates.map((d, idx) => (
            <div key={`${d.date}-${idx}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">{d.date}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{d.description}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Recommended actions',
      icon: <AlertTriangle className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          {content.recommendedActions.length === 0 ? <p className="text-sm text-slate-500">—</p> : null}
          {content.recommendedActions.map((a, idx) => (
            <div key={`${a.action}-${idx}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{a.action}</p>
                <PriorityPill priority={a.priority} />
              </div>
              {a.deadline ? (
                <p className="mt-2 text-sm text-slate-800">
                  Deadline: <span className="font-semibold">{a.deadline}</span>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Attendance information',
      icon: <CheckCircle2 className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Estimated attendees</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatValue(content.attendanceInfo.estimatedAttendees)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Arrival time</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatValue(content.attendanceInfo.agentArrivalTime)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Briefing duration</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatValue(content.attendanceInfo.briefingDuration)}</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Attendance verification',
      icon: <CheckCircle2 className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ring-1 ring-inset ${content.attendanceVerification.verified ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
              {content.attendanceVerification.verified ? 'Verified' : 'Not verified'}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
              Method: {content.attendanceVerification.method}
            </span>
          </div>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">
            Notes: {content.attendanceVerification.notes || '—'}
          </p>
          <p className="text-sm text-slate-600">
            Attendees (redacted):{' '}
            <span className="font-semibold text-slate-800">{formatValue(content.attendanceVerification.redactedAttendeeCount)}</span>
          </p>
        </div>
      ),
    },
    {
      title: 'Field observations',
      icon: <ClipboardList className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Site inspection</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{content.agentFieldObservations.siteInspection === null ? '—' : content.agentFieldObservations.siteInspection ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Docs distributed</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{content.agentFieldObservations.docsDistributed === null ? '—' : content.agentFieldObservations.docsDistributed ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Important announcement</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{content.agentFieldObservations.importantAnnouncement === null ? '—' : content.agentFieldObservations.importantAnnouncement ? 'Yes' : 'No'}</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">General notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{content.agentFieldObservations.generalNotes || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Source & verification',
      icon: <FileText className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Audio recorded</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {content.sourceAndVerification.audioRecorded ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Transcription provider</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{content.sourceAndVerification.transcriptionProvider || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Processing confidence</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatValue(content.sourceAndVerification.confidenceScore)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">AI model</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{content.sourceAndVerification.aiModel || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Processing date</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{content.sourceAndVerification.processingDate || '—'}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Important notice & certification',
      icon: <ShieldCheck className="h-4 w-4 text-brand-700" />,
      value: (
        <div className="space-y-3">
          {content.importantNotice ? (
            <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900">Important notice</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-amber-950">
                {content.importantNotice}
              </p>
            </div>
          ) : null}

          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Certified by</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{content.reportCertification.certifiedBy}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Certification date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{content.reportCertification.certificationDate}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Version</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {content.reportCertification.reportVersion}
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  const sectionClass =
    variant === 'sme'
      ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
      : 'rounded-xl border border-slate-200 bg-white p-4'

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <section key={s.title} className={sectionClass}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {s.icon ? <span className="inline-flex">{s.icon}</span> : null}
                <span className="truncate">{s.title}</span>
              </h3>
              <div className="mt-2 text-sm text-slate-700">{s.value}</div>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

