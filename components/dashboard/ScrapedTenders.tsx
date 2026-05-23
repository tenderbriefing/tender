'use client'

import { useState, useEffect } from 'react'
import { ScrapedTender } from '@/lib/scrapers/types'
import { 
  BriefcaseIcon, 
  CalendarIcon, 
  MapPinIcon,
  BuildingOfficeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const ScrapedTenders = () => {
  const [tenders, setTenders] = useState<ScrapedTender[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalTenders: 0,
    briefingsTenders: 0,
    lastScrapeTime: null,
    isRunning: false
  })

  useEffect(() => {
    fetchTenders()
    fetchStats()
  }, [])

  const fetchTenders = async () => {
    try {
      const response = await fetch('/api/scrape?action=tenders')
      const data = await response.json()
      
      if (data.success) {
        setTenders(data.data)
      }
    } catch (error) {
      console.error('Error fetching tenders:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/scrape?action=stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const startScraping = async () => {
    try {
      setStats(prev => ({ ...prev, isRunning: true }))
      
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh data after scraping
        setTimeout(() => {
          fetchTenders()
          fetchStats()
        }, 5000)
      }
    } catch (error) {
      console.error('Error starting scraping:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Scraping Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-lg p-3 mr-4">
              <BriefcaseIcon className="h-6 w-6 text-blue-600" />
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
                  ? format(new Date(stats.lastScrapeTime), 'MMM dd, HH:mm')
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

      {/* Scraping Controls */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tender Scraping</h3>
            <p className="text-gray-600">
              Automatically scrape eTenders and other sources for tenders with compulsory briefings
            </p>
          </div>
          <button
            onClick={startScraping}
            disabled={stats.isRunning}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stats.isRunning ? 'Scraping...' : 'Start Scraping'}
          </button>
        </div>
      </div>

      {/* Tenders List */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Tenders with Compulsory Briefings
          </h3>
          <span className="text-sm text-gray-500">
            {tenders.length} tenders found
          </span>
        </div>

        {tenders.length === 0 ? (
          <div className="text-center py-8">
            <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No tenders with compulsory briefings found</p>
            <p className="text-sm text-gray-400 mt-2">
              Start scraping to find tenders from eTenders and other sources
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tenders.slice(0, 10).map((tender) => (
              <div key={tender.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {tender.title}
                  </h4>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Compulsory Briefing
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {tender.description}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center text-gray-600">
                    <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                    <span className="text-sm">{tender.organization}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-600">
                    <MapPinIcon className="h-4 w-4 mr-2" />
                    <span className="text-sm">{tender.location}</span>
                  </div>
                  
                  {tender.briefingDate && (
                    <div className="flex items-center text-gray-600">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      <span className="text-sm">
                        {format(new Date(tender.briefingDate), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}
                  
                  {tender.briefingTime && (
                    <div className="flex items-center text-gray-600">
                      <ClockIcon className="h-4 w-4 mr-2" />
                      <span className="text-sm">{tender.briefingTime}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {tender.category}
                    </span>
                    <span className="text-sm text-gray-500">
                      Source: {tender.source}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                      View Details
                    </button>
                    <button className="btn-primary text-sm px-3 py-1">
                      Book Connector
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {tenders.length > 10 && (
              <div className="text-center pt-4">
                <button className="text-primary-600 hover:text-primary-700 font-medium">
                  View All {tenders.length} Tenders →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ScrapedTenders
