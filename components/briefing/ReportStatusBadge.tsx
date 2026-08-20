'use client'

import type { ReportStatus } from '@/lib/briefing-intelligence/types'

const STYLE_BY_STATUS: Record<
  string,
  {
    label: string
    className: string
  }
> = {
  awaiting_evidence: {
    label: 'Awaiting evidence',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  evidence_uploaded: {
    label: 'Evidence uploaded',
    className: 'bg-blue-50 text-blue-900 ring-blue-200',
  },
  processing: {
    label: 'Processing',
    className: 'bg-amber-50 text-amber-900 ring-amber-200',
  },
  draft_report: {
    label: 'Draft report',
    className: 'bg-purple-50 text-purple-900 ring-purple-200',
  },
  agent_review: {
    label: 'Agent review',
    className: 'bg-orange-50 text-orange-900 ring-orange-200',
  },
  final: {
    label: 'Final',
    className: 'bg-green-50 text-green-900 ring-green-200',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  },
  processing_failed: {
    label: 'Processing failed',
    className: 'bg-red-50 text-red-900 ring-red-200',
  },
}

export default function ReportStatusBadge({
  status,
  mode = 'internal',
}: {
  status: ReportStatus | string
  mode?: 'internal' | 'youth-agent'
}) {
  const youthCfg = {
    awaiting_evidence: {
      label: 'Upcoming',
      className: 'bg-slate-100 text-slate-700 ring-slate-200',
    },
    evidence_uploaded: {
      label: 'Submit Report',
      className: 'bg-blue-50 text-blue-900 ring-blue-200',
    },
    processing: {
      label: 'Processing',
      className: 'bg-amber-50 text-amber-900 ring-amber-200',
    },
    draft_report: {
      label: 'Processing',
      className: 'bg-amber-50 text-amber-900 ring-amber-200',
    },
    agent_review: {
      label: 'Processing',
      className: 'bg-amber-50 text-amber-900 ring-amber-200',
    },
    processing_failed: {
      label: 'Submit Report',
      className: 'bg-blue-50 text-blue-900 ring-blue-200',
    },
    final: {
      label: 'Completed',
      className: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    },
    delivered: {
      label: 'Completed',
      className: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    },
  } as const

  const cfg =
    mode === 'youth-agent'
      ? (youthCfg as any)[String(status)] || { label: 'Processing', className: 'bg-amber-50 text-amber-900 ring-amber-200' }
      : STYLE_BY_STATUS[String(status)] || {
          label: String(status),
          className: 'bg-slate-100 text-slate-700 ring-slate-200',
        }

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-tight ring-1 ring-inset ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

