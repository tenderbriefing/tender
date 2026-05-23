'use client'

import Link from 'next/link'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  DocumentTextIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'

interface QuickActionsProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
}

const QuickActions = ({ userType }: QuickActionsProps) => {
  const smeActions = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Tender Opportunities',
      description: 'Browse official procurement listings',
      href: '/tenders',
      color: 'bg-blue-500'
    },
    {
      icon: PlusIcon,
      title: 'My Requests',
      description: 'Track Youth Agent attendance requests',
      href: '/sme/requests',
      color: 'bg-green-500'
    },
    {
      icon: DocumentTextIcon,
      title: 'Compulsory Briefings',
      description: 'Filter tenders requiring briefing attendance',
      href: '/tenders',
      color: 'bg-purple-500'
    },
    {
      icon: UserGroupIcon,
      title: 'Dashboard',
      description: 'SME overview and alerts',
      href: '/sme/dashboard',
      color: 'bg-orange-500'
    }
  ]

  const youthAgentActions = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Available Jobs',
      description: 'Browse available briefing jobs',
      href: '/jobs',
      color: 'bg-blue-500'
    },
    {
      icon: DocumentTextIcon,
      title: 'Submit Report',
      description: 'Upload briefing notes and proof',
      href: '/briefing-reports/upload',
      color: 'bg-green-500'
    },
    {
      icon: UserGroupIcon,
      title: 'Agent Dashboard',
      description: 'Reliability and opportunity summary',
      href: '/agent/dashboard',
      color: 'bg-purple-500'
    },
    {
      icon: PlusIcon,
      title: 'Update Profile',
      description: 'Location and availability for matching',
      href: '/profile',
      color: 'bg-orange-500'
    }
  ]

  const actions = userType === 'sme' ? smeActions : youthAgentActions

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className="card hover:shadow-lg transition-shadow duration-200 group"
          >
            <div className="flex items-center mb-3">
              <div className={`${action.color} rounded-lg p-3 mr-4 group-hover:scale-110 transition-transform duration-200`}>
                <action.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {action.title}
              </h3>
            </div>
            <p className="text-gray-600 text-sm">
              {action.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default QuickActions
