'use client'

import Link from 'next/link'
import {
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

interface QuickActionsProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
}

const QuickActions = ({ userType }: QuickActionsProps) => {
  const smeActions = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Tender Opportunities',
      description: 'Browse official government procurement listings',
      href: '/tenders',
    },
    {
      icon: ClipboardDocumentListIcon,
      title: 'Attendance Requests',
      description: 'Track Youth Agent briefing attendance',
      href: '/sme/requests',
    },
    {
      icon: DocumentTextIcon,
      title: 'Compulsory Briefings',
      description: 'Filter tenders requiring briefing attendance',
      href: '/tenders',
    },
    {
      icon: UserGroupIcon,
      title: 'Procurement Dashboard',
      description: 'SME overview and briefing alerts',
      href: '/sme/dashboard',
    },
  ]

  const youthAgentActions = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Briefing Assignments',
      description: 'Available and assigned briefing sessions',
      href: '/jobs',
    },
    {
      icon: DocumentTextIcon,
      title: 'Submit Briefing Report',
      description: 'Upload attendance notes and proof',
      href: '/briefing-reports/upload',
    },
    {
      icon: UserGroupIcon,
      title: 'Agent Dashboard',
      description: 'Reliability and assignment summary',
      href: '/agent/dashboard',
    },
    {
      icon: ClipboardDocumentListIcon,
      title: 'Update Profile',
      description: 'Province and service radius for matching',
      href: '/profile',
    },
  ]

  const actions = userType === 'sme' ? smeActions : youthAgentActions

  return (
    <section aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="mb-4 text-lg font-bold text-slate-900">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="group flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-100">
              <action.icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                {action.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default QuickActions
