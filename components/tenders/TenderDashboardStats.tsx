'use client'

import {
  BriefcaseIcon,
  CalendarDaysIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface TenderDashboardStatsProps {
  total: number
  open: number
  closingSoon: number
  compulsory: number
}

const cards = [
  {
    key: 'total',
    label: 'Total Opportunities',
    icon: BriefcaseIcon,
    accent: 'from-brand-700 to-brand-800',
    ring: 'ring-brand-100',
  },
  {
    key: 'open',
    label: 'Open Tenders',
    icon: CalendarDaysIcon,
    accent: 'from-brand-600 to-brand-700',
    ring: 'ring-brand-100',
  },
  {
    key: 'closingSoon',
    label: 'Closing Soon',
    icon: ClockIcon,
    accent: 'from-orange-500 to-amber-500',
    ring: 'ring-orange-100',
  },
  {
    key: 'compulsory',
    label: 'Compulsory Briefings',
    icon: ExclamationTriangleIcon,
    accent: 'from-accent-500 to-accent-600',
    ring: 'ring-accent-100',
  },
] as const

export default function TenderDashboardStats({
  total,
  open,
  closingSoon,
  compulsory,
}: TenderDashboardStatsProps) {
  const values = { total, open, closingSoon, compulsory }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {cards.map(({ key, label, icon: Icon, accent, ring }) => (
        <article
          key={key}
          className={`rounded-2xl border border-white/80 bg-white p-4 shadow-sm ring-1 ${ring} transition-shadow hover:shadow-md`}
        >
          <div className="flex items-start justify-between gap-2">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {values[key].toLocaleString('en-ZA')}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">{label}</p>
        </article>
      ))}
    </div>
  )
}
