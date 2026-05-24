'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/components/providers/AuthProvider'

interface RecentActivityProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
}

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  createdAt: string
  href?: string
  status: string
}

type ActivityDisplay = ActivityItem & {
  time: string
  icon: typeof DocumentTextIcon
}

function formatActivityTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function iconForType(type: string) {
  switch (type) {
    case 'briefing_report_submitted':
    case 'report_submitted':
    case 'briefing_accepted':
    case 'briefing_assigned':
    case 'tender_saved':
    case 'tender_tracked':
    case 'sync_completed':
      return CheckCircleIcon
    case 'briefing_declined':
    case 'agent_declined_briefing':
      return ExclamationTriangleIcon
    default:
      return DocumentTextIcon
  }
}

const RecentActivity = ({ userType }: RecentActivityProps) => {
  const { user } = useAuth()
  const [activities, setActivities] = useState<ActivityDisplay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(true)
      return
    }

    let cancelled = false

    const fetchActivities = async () => {
      setLoading(true)
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/dashboard/activities', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        })
        const contentType = response.headers.get('content-type') || ''

        if (!response.ok || !contentType.includes('application/json')) {
          if (!cancelled) setActivities([])
          return
        }

        const payload = await response.json()
        const rows: ActivityItem[] =
          payload?.success && Array.isArray(payload.data)
            ? payload.data
            : Array.isArray(payload.activities)
              ? payload.activities
              : []

        if (!cancelled) {
          setActivities(
            rows.map((row) => ({
              ...row,
              time: formatActivityTime(row.createdAt),
              icon: iconForType(row.type),
            }))
          )
        }
      } catch {
        if (!cancelled) setActivities([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchActivities()
    return () => {
      cancelled = true
    }
  }, [userType, user])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'saved':
      case 'tracked':
        return 'text-green-600 bg-green-100'
      case 'pending':
      case 'available':
        return 'text-yellow-600 bg-yellow-100'
      case 'in_progress':
      case 'assigned':
      case 'accepted':
        return 'text-blue-600 bg-blue-100'
      case 'declined':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
      <div className="card">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-start space-x-4 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0 animate-pulse"
              >
                <div className="flex-shrink-0">
                  <div className="bg-gray-200 rounded-full p-2 h-9 w-9" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <ClockIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-gray-500">
              No recent activity. Activity will appear here as you use the platform.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activity.icon
              const titleNode = activity.href ? (
                <Link
                  href={activity.href}
                  className="text-sm font-medium text-gray-900 hover:text-brand-700"
                >
                  {activity.title}
                </Link>
              ) : (
                <h3 className="text-sm font-medium text-gray-900">{activity.title}</h3>
              )

              return (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0"
                >
                  <div className="flex-shrink-0">
                    <div className="bg-primary-100 rounded-full p-2">
                      <Icon className="h-5 w-5 text-primary-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      {titleNode}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusColor(activity.status)}`}
                      >
                        {activity.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default RecentActivity
