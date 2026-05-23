'use client'

import { useState } from 'react'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const MapsTestPage = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [query, setQuery] = useState('')
  const [placeId, setPlaceId] = useState('')

  const testGeocode = async () => {
    if (!address.trim()) {
      setResult({ success: false, error: 'Please enter an address' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/maps?action=geocode&address=${encodeURIComponent(address)}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testReverseGeocode = async () => {
    if (!lat.trim() || !lng.trim()) {
      setResult({ success: false, error: 'Please enter latitude and longitude' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/maps?action=reverse-geocode&lat=${lat}&lng=${lng}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testSearchPlaces = async () => {
    if (!query.trim()) {
      setResult({ success: false, error: 'Please enter a search query' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/maps?action=search-places&query=${encodeURIComponent(query)}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testPlaceDetails = async () => {
    if (!placeId.trim()) {
      setResult({ success: false, error: 'Please enter a place ID' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/maps?action=place-details&place_id=${placeId}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testDistance = async () => {
    if (!lat.trim() || !lng.trim()) {
      setResult({ success: false, error: 'Please enter coordinates for both locations' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      // Using Cape Town as the second location for testing
      const response = await fetch(`/api/maps?action=distance&lat1=${lat}&lng1=${lng}&lat2=-33.9249&lng2=18.4241`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const checkStatus = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/maps?action=status')
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
        <h1 className="text-3xl font-bold mb-6 text-center">Google Maps API Test</h1>
        <p className="text-center text-gray-600 mb-8">
          Test Google Maps integration for location services and geocoding.
        </p>

        <div className="max-w-4xl mx-auto">
          {/* Status Check */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Service Status</h2>
            <button
              onClick={checkStatus}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </div>

          {/* Geocoding */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Geocoding (Address → Coordinates)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., Cape Town, South Africa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={testGeocode}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Geocoding...' : 'Geocode Address'}
              </button>
            </div>
          </div>

          {/* Reverse Geocoding */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Reverse Geocoding (Coordinates → Address)</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="e.g., -33.9249"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="e.g., 18.4241"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={testReverseGeocode}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Reverse Geocoding...' : 'Get Address'}
              </button>
            </div>
          </div>

          {/* Places Search */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Places Search</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Query
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., restaurants in Cape Town"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={testSearchPlaces}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search Places'}
              </button>
            </div>
          </div>

          {/* Place Details */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Place Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Place ID
                </label>
                <input
                  type="text"
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  placeholder="e.g., ChIJ... (from places search results)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={testPlaceDetails}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Getting Details...' : 'Get Place Details'}
              </button>
            </div>
          </div>

          {/* Distance Calculation */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Distance Calculation</h2>
            <p className="text-sm text-gray-600 mb-4">
              Calculate distance from your coordinates to Cape Town
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="e.g., -26.2041"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="e.g., 28.0473"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={testDistance}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Calculating...' : 'Calculate Distance'}
              </button>
            </div>
          </div>

          {/* Results */}
          {loading && (
            <div className="text-center py-8">
              <LoadingSpinner />
              <p className="mt-4 text-lg text-gray-700">Processing request...</p>
            </div>
          )}

          {result && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Results</h2>
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center mb-2">
                  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${result.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">{result.success ? 'Success' : 'Error'}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.message}</p>
                {result.data && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Data:</h3>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
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

          {/* Quick Test Examples */}
          <div className="mt-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Quick Test Examples</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-2">South African Cities:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• Cape Town, South Africa</li>
                  <li>• Johannesburg, South Africa</li>
                  <li>• Durban, South Africa</li>
                  <li>• Pretoria, South Africa</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">Search Queries:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• restaurants in Cape Town</li>
                  <li>• government buildings</li>
                  <li>• conference centers</li>
                  <li>• tender offices</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default MapsTestPage
