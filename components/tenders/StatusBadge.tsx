'use client'

import type { TenderDisplayStatus } from '@/lib/procurement/tenderStatus'

const STYLES: Record<
  TenderDisplayStatus,
  { label: string; className: string }
> = {
  open: {
    label: 'Open',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  closing_soon: {
    label: 'Closing Soon',
    className: 'bg-orange-50 text-orange-800 ring-orange-200',
  },
  closed: {
    label: 'Closed',
    className: 'bg-red-50 text-red-800 ring-red-200',
  },
  briefing_available: {
    label: 'Briefing Available',
    className: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  compulsory_briefing: {
    label: 'Compulsory Briefing',
    className: 'bg-violet-50 text-violet-800 ring-violet-200',
  },
}

export default function StatusBadge({ status }: { status: TenderDisplayStatus }) {
  const cfg = STYLES[status]
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight ring-1 ring-inset ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}
