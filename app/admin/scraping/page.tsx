'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { 
  PlayIcon, 
  StopIcon, 
  ClockIcon, 
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface ScrapingStats {
  totalTenders: number
  briefingsTenders: number
  lastScrapeTime: string | null
  isRunning: boolean
  recentJobs: Array<{
    id: string
    source: string
    status: string
    totalFound: number
    newTenders: number
    updatedTenders: number
    errors: string[]
    completedAt: string
  }>
}

const AdminScrapingPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<ScrapingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || userProfile?.userType !== 'admin')) {
      router.push('/dashboard')
      return
    }

    if (user && userProfile?.userType === 'admin') {
      fetchStats()
    }
  }, [user, userProfile, authLoading, router])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/scrape?action=stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const startScraping = async () => {
    setScraping(true)
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh stats after a delay
        setTimeout(() => {
          fetchStats()
        }, 5000)
      }
    } catch (error) {
      console.error('Error starting scraping:', error)
    } finally {
      setScraping(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user || userProfile?.userType !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Scraping Management</h1>
          <p className="text-gray-600 mt-2">
            Manage automatic tender scraping from eTenders and other sources
          </p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-lg p-3 mr-4">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tenders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTenders}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-3 mr-4">
                  <ExclamationTriangleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">With Briefings</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.briefingsTenders}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-center">
                <div className="bg-purple-100 rounded-lg p-3 mr-4">
                  <ClockIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Last Scrape</p>
                  <p className="text-sm font-bold text-gray-900">
                    {stats.lastScrapeTime 
                      ? new Date(stats.lastScrapeTime).toLocaleString()
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-center">
                <div className="bg-orange-100 rounded-lg p-3 mr-4">
                  <CheckCircleIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <p className="text-sm font-bold text-gray-900">
                    {stats.isRunning ? 'Running' : 'Idle'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scraping Controls */}
        <div className="card mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Manual Scraping</h3>
              <p className="text-gray-600">
                Start an immediate scraping job to collect the latest tenders
              </p>
            </div>
            <button
              onClick={startScraping}
              disabled={scraping || stats?.isRunning}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scraping ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5 mr-2" />
                  Start Scraping
                </>
              )}
            </button>
          </div>
        </div>

        {/* Recent Scraping Jobs */}
        {stats && stats.recentJobs.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Scraping Jobs</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Results
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {job.source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : job.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {job.status === 'completed' && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                          {job.status === 'failed' && <XCircleIcon className="h-3 w-3 mr-1" />}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          <div>Total: {job.totalFound}</div>
                          <div>New: {job.newTenders}</div>
                          <div>Updated: {job.updatedTenders}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(job.completedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.errors.length > 0 ? (
                          <span className="text-red-600">{job.errors.length} errors</span>
                        ) : (
                          <span className="text-green-600">No errors</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Scraping Configuration */}
        <div className="card mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Scraping Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Update Interval</label>
              <select className="form-input">
                <option value="30">Every 30 minutes</option>
                <option value="60" selected>Every hour</option>
                <option value="120">Every 2 hours</option>
                <option value="240">Every 4 hours</option>
                <option value="480">Every 8 hours</option>
                <option value="1440">Daily</option>
              </select>
            </div>
            
            <div>
              <label className="form-label">Max Retries</label>
              <input
                type="number"
                min="1"
                max="10"
                defaultValue="3"
                className="form-input"
              />
            </div>
            
            <div>
              <label className="form-label">Timeout (seconds)</label>
              <input
                type="number"
                min="10"
                max="300"
                defaultValue="30"
                className="form-input"
              />
            </div>
            
            <div>
              <label className="form-label">Sources</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="mr-2" />
                  eTenders.gov.za
                </label>
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="mr-2" />
                  National Treasury
                </label>
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="mr-2" />
                  Provincial Portals
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  Municipal Tenders
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  Private Sector
                </label>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <button className="btn-primary">
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default AdminScrapingPage
