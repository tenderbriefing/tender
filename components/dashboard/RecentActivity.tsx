import { useState, useEffect } from 'react'
import { 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface RecentActivityProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
}

interface Activity {
  id: string
  type: string
  title: string
  description: string
  time: string
  status: string
  icon: any
}

const RecentActivity = ({ userType }: RecentActivityProps) => {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        // Fetch real activities from API
        const response = await fetch('/api/dashboard/activities')
        const data = await response.json()
        
        if (data.success) {
          setActivities(data.activities)
        } else {
          setActivities([])
        }
      } catch (error) {
        console.error('Error fetching activities:', error)
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [userType])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-green-600 bg-green-100'
      case 'pending':
      case 'available':
        return 'text-yellow-600 bg-yellow-100'
      case 'in_progress':
        return 'text-blue-600 bg-blue-100'
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
              <div key={i} className="flex items-start space-x-4 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0 animate-pulse">
                <div className="flex-shrink-0">
                  <div className="bg-gray-200 rounded-full p-2 h-9 w-9"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activity. Activity will appear here as you use the platform.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                <div className="flex-shrink-0">
                  <div className="bg-primary-100 rounded-full p-2">
                    <activity.icon className="h-5 w-5 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">
                      {activity.title}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                      {activity.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && activities.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all activity →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecentActivity
