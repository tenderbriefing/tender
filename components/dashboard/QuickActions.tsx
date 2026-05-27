'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import {
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  UserGroupIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline'

interface QuickActionsProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
}

type Action = {
  icon: typeof MagnifyingGlassIcon
  title: string
  description: string
  href: string
  tone: 'navy' | 'gold' | 'neutral'
}

const QuickActions = ({ userType }: QuickActionsProps) => {
  const smeActions: Action[] = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Tender Opportunities',
      description: 'Browse official government procurement listings',
      href: '/tenders',
      tone: 'gold',
    },
    {
      icon: InboxArrowDownIcon,
      title: 'RFQ Inbox',
      description: 'Forward RFQs to rfq@tenderbriefing.co.za',
      href: '/sme/rfq-inbox',
      tone: 'navy',
    },
    {
      icon: ClipboardDocumentListIcon,
      title: 'Attendance Requests',
      description: 'Track Youth Agent briefing attendance',
      href: '/sme/requests',
      tone: 'neutral',
    },
    {
      icon: DocumentTextIcon,
      title: 'Compulsory Briefings',
      description: 'Filter tenders requiring briefing attendance',
      href: '/tenders?briefing=compulsory',
      tone: 'neutral',
    },
  ]

  const youthAgentActions: Action[] = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Briefing Assignments',
      description: 'Available and assigned briefing sessions',
      href: '/jobs',
      tone: 'gold',
    },
    {
      icon: DocumentTextIcon,
      title: 'Submit Briefing Report',
      description: 'Upload attendance notes and proof',
      href: '/briefing-reports/upload',
      tone: 'navy',
    },
    {
      icon: UserGroupIcon,
      title: 'Agent Dashboard',
      description: 'Reliability and assignment summary',
      href: '/agent/dashboard',
      tone: 'neutral',
    },
    {
      icon: ClipboardDocumentListIcon,
      title: 'Update Profile',
      description: 'Province and service radius for matching',
      href: '/profile',
      tone: 'neutral',
    },
  ]

  const actions = userType === 'sme' ? smeActions : youthAgentActions

  return (
    <section aria-labelledby="quick-actions-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
            <span className="h-1.5 w-6 rounded-full bg-accent-500" />
            Shortcuts
          </span>
          <h2 id="quick-actions-heading" className="mt-1 text-xl font-bold text-brand-900">
            Quick actions
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => {
          const toneStyles = {
            navy: {
              card: 'border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white',
              icon: 'bg-brand-900 text-accent-400 ring-brand-800',
              title: 'group-hover:text-accent-600',
            },
            gold: {
              card: 'border-accent-200 bg-gradient-to-br from-accent-50/60 to-white',
              icon: 'bg-accent-500 text-brand-900 ring-accent-300',
              title: 'group-hover:text-accent-700',
            },
            neutral: {
              card: 'border-slate-200 bg-white',
              icon: 'bg-brand-50 text-brand-800 ring-brand-100',
              title: 'group-hover:text-brand-800',
            },
          }[action.tone]

          return (
            <Link
              key={action.title}
              href={action.href}
              className={`group relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${toneStyles.card}`}
            >
              <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-brand-800 to-accent-500 transition-transform duration-300 group-hover:scale-x-100" />
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${toneStyles.icon}`}
                >
                  <action.icon className="h-5 w-5" aria-hidden />
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-800" />
              </div>
              <div className="min-w-0">
                <h3
                  className={`text-sm font-bold text-brand-900 transition ${toneStyles.title}`}
                >
                  {action.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {action.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default QuickActions
