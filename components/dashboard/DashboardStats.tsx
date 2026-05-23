import { useState, useEffect } from 'react'
import { 
  BriefcaseIcon, 
  CurrencyDollarIcon, 
  ClockIcon,
  StarIcon
} from '@heroicons/react/24/outline'

interface DashboardStatsProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
}

interface StatData {
  icon: any
  label: string
  value: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
}

const DashboardStats = ({ userType }: DashboardStatsProps) => {
  const [stats, setStats] = useState<StatData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch real stats from API
        const response = await fetch('/api/dashboard/stats')
        const data = await response.json()
        
        if (data.success) {
          setStats(data.stats)
        } else {
          // If no real data available, show empty state
          setStats([])
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        setStats([])
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [userType])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="flex items-center">
              <div className="bg-gray-200 rounded-lg p-3 mr-4 h-12 w-12"></div>
              <div>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (stats.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No statistics available. Data will appear once you start using the platform.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <div key={index} className="card">
          <div className="flex items-center">
            <div className="bg-primary-100 rounded-lg p-3 mr-4">
              <stat.icon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className={`text-sm ${
              stat.changeType === 'positive' ? 'text-green-600' :        
              stat.changeType === 'negative' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {stat.change}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default DashboardStats
