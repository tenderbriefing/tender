'use client'

import { useState, useEffect } from 'react'
import { CalendarIcon, ClockIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline'

interface BriefingEvent {
  id: string
  summary: string
  description: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees: Array<{
    email: string
    displayName?: string
    responseStatus?: string
  }>
  location?: string
}

interface CalendarIntegrationProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
  userEmail?: string
}

const CalendarIntegration = ({ userType, userEmail }: CalendarIntegrationProps) => {
  const [events, setEvents] = useState<BriefingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    fetchEvents()
  }, [selectedDate])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const startDate = new Date(selectedDate)
      startDate.setDate(1) // First day of month
      
      const endDate = new Date(selectedDate)
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0) // Last day of month

      const response = await fetch(
        `/api/calendar?action=events&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )
      
      const data = await response.json()
      
      if (data.success) {
        setEvents(data.data)
      } else {
        setError(data.message)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createBriefingEvent = async (tenderData: any) => {
    try {
      const briefingEvent = {
        tenderId: tenderData.id,
        tenderTitle: tenderData.title,
        organization: tenderData.organization,
        location: tenderData.location,
        briefingDate: tenderData.briefingDate,
        briefingTime: tenderData.briefingTime,
        connectorEmail: 'connector@example.com', // This would come from connector selection
        connectorName: 'John Connector', // This would come from connector selection
        entrepreneurEmail: userEmail || 'entrepreneur@example.com',
        entrepreneurName: 'Jane Entrepreneur' // This would come from user profile
      }

      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-briefing',
          ...briefingEvent
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Refresh events
        fetchEvents()
        return { success: true, eventId: data.data.id }
      } else {
        throw new Error(data.message)
      }
    } catch (err: any) {
      console.error('Failed to create briefing event:', err)
      return { success: false, error: err.message }
    }
  }

  const formatEventTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-ZA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getUpcomingEvents = () => {
    const now = new Date()
    return events
      .filter(event => new Date(event.start.dateTime) > now)
      .sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
      .slice(0, 5)
  }

  const getTodaysEvents = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return events.filter(event => {
      const eventDate = new Date(event.start.dateTime)
      return eventDate >= today && eventDate < tomorrow
    })
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <CalendarIcon className="h-5 w-5 mr-2" />
          Calendar Integration
        </h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <CalendarIcon className="h-5 w-5 mr-2" />
          Calendar Integration
        </h3>
        <div className="text-red-600 bg-red-50 p-3 rounded">
          <p className="text-sm">Calendar integration unavailable</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </div>
    )
  }

  const upcomingEvents = getUpcomingEvents()
  const todaysEvents = getTodaysEvents()

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <CalendarIcon className="h-5 w-5 mr-2" />
        Calendar Integration
      </h3>

      {/* Today's Events */}
      {todaysEvents.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-700 mb-3">Today's Briefings</h4>
          <div className="space-y-3">
            {todaysEvents.map((event) => (
              <div key={event.id} className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{event.summary}</h5>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {formatEventTime(event.start.dateTime)}
                    </div>
                    {event.location && (
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-3">Upcoming Briefings</h4>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{event.summary}</h5>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {formatEventTime(event.start.dateTime)}
                    </div>
                    {event.location && (
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        {event.location}
                      </div>
                    )}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <UserIcon className="h-4 w-4 mr-1" />
                        {event.attendees.length} attendee(s)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming briefings scheduled</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {userType === 'sme' && (
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-md font-medium text-gray-700 mb-3">Quick Actions</h4>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                // This would open a modal to create a new briefing
                console.log('Create briefing clicked')
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Schedule Briefing
            </button>
            <button
              onClick={fetchEvents}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors"
            >
              Refresh Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarIntegration
