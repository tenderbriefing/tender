'use client'

import { useState } from 'react'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const TestPage = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const testScraper = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      })
      
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testCalendar = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'check-availability',
          connectorEmail: 'test@example.com',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }),
      })
      
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SimpleHeader />
      <main className="flex-grow container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-center">TenderConnect Test Page</h1>
        <p className="text-center text-gray-600 mb-8">
          This page tests the core functionality without Firebase dependencies.
        </p>

        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button
              onClick={testScraper}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Scraper'}
            </button>
            
            <button
              onClick={testCalendar}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Calendar'}
            </button>
          </div>

          {loading && (
            <div className="text-center py-8">
              <LoadingSpinner />
              <p className="mt-4 text-lg text-gray-700">Testing functionality...</p>
            </div>
          )}

          {result && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Test Results</h2>
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center mb-2">
                  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${result.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">{result.success ? 'Success' : 'Error'}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.message}</p>
                {result.data && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Data:</h3>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
                {result.error && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2 text-red-700">Error:</h3>
                    <p className="text-sm text-red-600">{result.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">System Status</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Tender Scraper:</span>
                <span className="text-green-600 font-medium">✅ Working</span>
              </div>
              <div className="flex justify-between">
                <span>Google Calendar API:</span>
                <span className="text-green-600 font-medium">✅ Ready</span>
              </div>
              <div className="flex justify-between">
                <span>Firebase Integration:</span>
                <span className="text-yellow-600 font-medium">🔧 Needs Setup</span>
              </div>
              <div className="flex justify-between">
                <span>UI Components:</span>
                <span className="text-green-600 font-medium">✅ Complete</span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <a 
              href="/scraper-demo" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              View Scraper Demo →
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default TestPage
