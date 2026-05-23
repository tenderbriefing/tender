'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { 
  ClockIcon,
  MapPinIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { ConnectorAvailability } from '@/lib/services/connectorAvailabilityService'

interface AvailabilityManagerProps {
  onAvailabilityUpdate?: (availability: ConnectorAvailability) => void
}

const AvailabilityManager = ({ onAvailabilityUpdate }: AvailabilityManagerProps) => {
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [availability, setAvailability] = useState<ConnectorAvailability | null>(null)
  const [formData, setFormData] = useState({
    isAvailable: true,
    maxDistance: 30,
    maxJobs: 5,
    workingHours: {
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5] as number[]
    },
    status: 'active' as 'active' | 'busy' | 'unavailable' | 'inactive'
  })

  useEffect(() => {
    if (user?.uid) {
      fetchAvailability()
    }
  }, [user])

  const fetchAvailability = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const response = await fetch(`/api/youth-agent-response?action=getAvailability&youth-agentId=${user.uid}`)
      const result = await response.json()

      if (result.success) {
        setAvailability(result.availability)
        setFormData({
          isAvailable: result.availability.isAvailable,
          maxDistance: result.availability.maxDistance,
          maxJobs: result.availability.maxJobs,
          workingHours: result.availability.workingHours,
          status: result.availability.status
        })
      } else if (result.error === 'Availability not found') {
        // Initialize availability for new youth-agent
        await initializeAvailability()
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      toast.error('Failed to load availability settings')
    } finally {
      setLoading(false)
    }
  }

  const initializeAvailability = async () => {
    if (!userProfile) return

    try {
      const response = await fetch('/api/youth-agent-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'initializeAvailability',
          userProfile
        })
      })

      const result = await response.json()
      if (result.success) {
        await fetchAvailability()
        toast.success('Availability settings initialized')
      } else {
        toast.error('Failed to initialize availability')
      }
    } catch (error) {
      console.error('Error initializing availability:', error)
      toast.error('Failed to initialize availability')
    }
  }

  const handleSave = async () => {
    if (!user?.uid) return

    try {
      setSaving(true)
      const response = await fetch('/api/youth-agent-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateAvailability',
          userId: user.uid,
          availability: formData
        })
      })

      const result = await response.json()
      if (result.success) {
        await fetchAvailability()
        toast.success('Availability updated successfully')
        if (onAvailabilityUpdate && availability) {
          onAvailabilityUpdate({ ...availability, ...formData })
        }
      } else {
        toast.error('Failed to update availability')
      }
    } catch (error) {
      console.error('Error updating availability:', error)
      toast.error('Failed to update availability')
    } finally {
      setSaving(false)
    }
  }

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        days: prev.workingHours.days.includes(day)
          ? prev.workingHours.days.filter(d => d !== day)
          : [...prev.workingHours.days, day]
      }
    }))
  }

  const getDayName = (day: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days[day]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!userProfile || userProfile.userType !== 'youth-agent') {
    return (
      <div className="text-center p-8">
        <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">This feature is only available for youth-agents.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Availability Settings</h3>
        
        <div className="space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Status
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={formData.status === 'active'}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value="busy"
                  checked={formData.status === 'busy'}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Busy</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value="unavailable"
                  checked={formData.status === 'unavailable'}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Unavailable</span>
              </label>
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isAvailable"
              checked={formData.isAvailable}
              onChange={(e) => setFormData(prev => ({ ...prev, isAvailable: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isAvailable" className="ml-2 text-sm text-gray-700">
              Available for new jobs
            </label>
          </div>

          {/* Max Distance */}
          <div>
            <label htmlFor="maxDistance" className="block text-sm font-medium text-gray-700 mb-2">
              <MapPinIcon className="h-4 w-4 inline mr-1" />
              Maximum Distance (km)
            </label>
            <input
              type="number"
              id="maxDistance"
              min="5"
              max="100"
              value={formData.maxDistance}
              onChange={(e) => setFormData(prev => ({ ...prev, maxDistance: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum distance you're willing to travel for jobs
            </p>
          </div>

          {/* Max Jobs */}
          <div>
            <label htmlFor="maxJobs" className="block text-sm font-medium text-gray-700 mb-2">
              <CheckCircleIcon className="h-4 w-4 inline mr-1" />
              Maximum Concurrent Jobs
            </label>
            <input
              type="number"
              id="maxJobs"
              min="1"
              max="10"
              value={formData.maxJobs}
              onChange={(e) => setFormData(prev => ({ ...prev, maxJobs: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of jobs you can handle simultaneously
            </p>
          </div>

          {/* Working Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Working Hours
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-xs text-gray-500 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  id="startTime"
                  value={formData.workingHours.start}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, start: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-xs text-gray-500 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  id="endTime"
                  value={formData.workingHours.end}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, end: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Working Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="h-4 w-4 inline mr-1" />
              Working Days
            </label>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayToggle(day)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    formData.workingHours.days.includes(day)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {getDayName(day)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Status Display */}
        {availability && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Current Jobs:</span>
                <span className="ml-2 font-medium">{availability.currentJobs}/{availability.maxJobs}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  availability.status === 'active' ? 'bg-green-100 text-green-800' :
                  availability.status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                  availability.status === 'unavailable' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {availability.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvailabilityManager
