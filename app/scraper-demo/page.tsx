'use client'

import { useState, useEffect } from 'react'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { 
  BriefcaseIcon, 
  CalendarIcon, 
  MapPinIcon,
  BuildingOfficeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon
} from '@heroicons/react/24/outline'

interface ScrapedTender {
  id: string
  title: string
  description: string
  organization: string
  location: string
  briefingDate?: Date
  briefingTime?: string
  briefingVenue?: string
  estimatedValue?: number
  category: string
  source: string
  isCompulsoryBriefing: boolean
}

const ScraperDemoPage = () => {
  const [tenders, setTenders] = useState<ScrapedTender[]>([])
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [stats, setStats] = useState({
    totalTenders: 0,
    briefingsTenders: 0,
    lastScrapeTime: null as Date | null
  })

  const generateMockTenders = (): ScrapedTender[] => {
    const organizations = [
      'Department of Public Works',
      'Department of Health', 
      'Department of Education',
      'Department of Transport',
      'Department of Energy',
      'Department of Water and Sanitation',
      'Department of Human Settlements',
      'Department of Social Development'
    ]
    
    const locations = [
      'Johannesburg, Gauteng',
      'Cape Town, Western Cape', 
      'Durban, KwaZulu-Natal',
      'Pretoria, Gauteng',
      'Port Elizabeth, Eastern Cape',
      'Bloemfontein, Free State',
      'Nelspruit, Mpumalanga',
      'Polokwane, Limpopo'
    ]
    
    const categories = ['Construction', 'Technology', 'Healthcare', 'Education', 'Transportation', 'Energy']
    
    const tenders: ScrapedTender[] = []
    
    for (let i = 1; i <= 15; i++) {
      const hasBriefing = Math.random() > 0.2 // 80% chance of having briefing
      const organization = organizations[Math.floor(Math.random() * organizations.length)]
      const location = locations[Math.floor(Math.random() * locations.length)]
      const category = categories[Math.floor(Math.random() * categories.length)]
      
      const tender: ScrapedTender = {
        id: `ET${i.toString().padStart(3, '0')}`,
        title: hasBriefing 
          ? `${category} Project - Compulsory Briefing Required`
          : `${category} Project`,
        description: hasBriefing
          ? `This tender involves the procurement of ${category.toLowerCase()} services and solutions. A compulsory briefing session will be held to provide detailed information about the tender requirements and submission process. All interested parties are required to attend this briefing session.`
          : `This tender involves the procurement of ${category.toLowerCase()} services and solutions.`,
        organization,
        location,
        category,
        estimatedValue: Math.floor(Math.random() * 10000000) + 50000,
        isCompulsoryBriefing: hasBriefing,
        briefingDate: hasBriefing ? new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000) : undefined,
        briefingTime: hasBriefing ? ['09:00 AM', '10:00 AM', '02:00 PM', '03:00 PM'][Math.floor(Math.random() * 4)] : undefined,
        briefingVenue: hasBriefing ? `${location.split(',')[0]} City Hall, ${location}` : undefined,
        source: 'eTenders'
      }
      
      tenders.push(tender)
    }
    
    return tenders
  }

  const startScraping = async () => {
    setScraping(true)
    setLoading(true)
    
    // Simulate scraping delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const scrapedTenders = generateMockTenders()
    const briefingsTenders = scrapedTenders.filter(t => t.isCompulsoryBriefing)
    
    setTenders(scrapedTenders)
    setStats({
      totalTenders: scrapedTenders.length,
      briefingsTenders: briefingsTenders.length,
      lastScrapeTime: new Date()
    })
    
    setLoading(false)
    setScraping(false)
  }

  const briefingsTenders = tenders.filter(t => t.isCompulsoryBriefing)

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">TenderConnect Scraper Demo</h1>
          <p className="text-gray-600 mt-2">
            Live demonstration of our tender scraping system for eTenders and other sources
          </p>
        </div>

        {/* Scraping Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                    ? stats.lastScrapeTime.toLocaleString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="bg-orange-100 rounded-lg p-3 mr-4">
                <PlayIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalTenders > 0 ? Math.round((stats.briefingsTenders / stats.totalTenders) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scraping Controls */}
        <div className="card mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">eTenders Scraper</h3>
              <p className="text-gray-600">
                Click the button below to simulate scraping eTenders.gov.za for tenders with compulsory briefings
              </p>
            </div>
            <button
              onClick={startScraping}
              disabled={scraping}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scraping ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Scraping...
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

        {/* Tenders List */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Tenders with Compulsory Briefings
            </h3>
            <span className="text-sm text-gray-500">
              {briefingsTenders.length} tenders found
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : briefingsTenders.length === 0 ? (
            <div className="text-center py-12">
              <BriefcaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No tenders with compulsory briefings found</p>
              <p className="text-sm text-gray-400 mt-2">
                Click "Start Scraping" to find tenders from eTenders and other sources
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {briefingsTenders.map((tender) => (
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
                          {tender.briefingDate.toLocaleDateString()}
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
                      {tender.estimatedValue && (
                        <span className="text-sm text-gray-500">
                          Value: R{tender.estimatedValue.toLocaleString()}
                        </span>
                      )}
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
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default ScraperDemoPage
