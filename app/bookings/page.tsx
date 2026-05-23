'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon, 
  UserIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface Booking {
  id: string
  tenderId: string
  tenderTitle: string
  organization: string
  location: string
  briefingDate: Date
  briefingTime: string
  briefingVenue: string
  connectorId?: string
  connectorName?: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  amount: number
  createdAt: Date
  updatedAt: Date
  notes?: string
  attendanceProof?: string
  audioRecording?: string
  summaryNotes?: string
}

const BookingsPage = () => {
  const { user, userProfile, loading } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'>('all')

  useEffect(() => {
    if (user && userProfile?.userType === 'sme') {
      fetchBookings()
    }
  }, [user, userProfile])

  const fetchBookings = async () => {
    if (!user?.uid) return

    try {
      setBookingsLoading(true)
      
      const response = await fetch(`/api/bookings?action=getByUser&userId=${user.uid}&userType=sme`)
      const result = await response.json()
      
      if (result.success) {
        // Convert date strings back to Date objects
        const bookingsWithDates = result.bookings.map((booking: any) => ({
          ...booking,
          briefingDate: new Date(booking.briefingDate),
          createdAt: new Date(booking.createdAt),
          updatedAt: new Date(booking.updatedAt),
          submittedAt: booking.submittedAt ? new Date(booking.submittedAt) : undefined
        }))
        setBookings(bookingsWithDates)
      } else {
        console.error('Error fetching bookings:', result.error)
        // Fallback to mock data if API fails
        setBookings([])
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
      // Fallback to mock data if API fails
      setBookings([])
    } finally {
      setBookingsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'assigned':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4" />
      case 'assigned':
        return <UserIcon className="h-4 w-4" />
      case 'in_progress':
        return <ExclamationTriangleIcon className="h-4 w-4" />
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4" />
      case 'cancelled':
        return <XCircleIcon className="h-4 w-4" />
      default:
        return <ClockIcon className="h-4 w-4" />
    }
  }

  const filteredBookings = bookings.filter(booking => 
    filter === 'all' || booking.status === filter
  )

  if (loading || bookingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user || userProfile?.userType !== 'sme') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">This page is only accessible to SMEs.</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600 mt-2">
            Manage your tender briefing bookings and track their progress
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Assigned</p>
                <p className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === 'assigned').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Bookings' },
                { key: 'pending', label: 'Pending' },
                { key: 'assigned', label: 'Assigned' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === key
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-6">
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-600 mb-6">
                {filter === 'all' 
                  ? "You haven't made any bookings yet. Start by browsing available tenders."
                  : `No bookings with status "${filter}" found.`
                }
              </p>
              <a
                href="/tenders"
                className="btn-primary"
              >
                Browse Tenders
              </a>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {booking.tenderTitle}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          {booking.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{booking.organization}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPinIcon className="h-4 w-4 mr-2" />
                          {booking.location}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {booking.briefingDate.toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <ClockIcon className="h-4 w-4 mr-2" />
                          {booking.briefingTime}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPinIcon className="h-4 w-4 mr-2" />
                          {booking.briefingVenue}
                        </div>
                      </div>
                      
                      {booking.connectorName && (
                        <div className="flex items-center text-sm text-gray-600 mb-4">
                          <UserIcon className="h-4 w-4 mr-2" />
                          Assigned to: <span className="font-medium ml-1">{booking.connectorName}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold text-gray-900">
                          R{booking.amount.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Booked on {booking.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {booking.status === 'completed' && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3">Briefing Results</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {booking.attendanceProof && (
                          <div className="flex items-center text-sm text-gray-600">
                            <DocumentTextIcon className="h-4 w-4 mr-2" />
                            <span>Attendance Proof: {booking.attendanceProof}</span>
                          </div>
                        )}
                        {booking.audioRecording && (
                          <div className="flex items-center text-sm text-gray-600">
                            <DocumentTextIcon className="h-4 w-4 mr-2" />
                            <span>Audio Recording: {booking.audioRecording}</span>
                          </div>
                        )}
                        {booking.summaryNotes && (
                          <div className="flex items-center text-sm text-gray-600">
                            <DocumentTextIcon className="h-4 w-4 mr-2" />
                            <span>Summary Notes Available</span>
                          </div>
                        )}
                      </div>
                      {booking.summaryNotes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">{booking.summaryNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  )
}

export default BookingsPage
