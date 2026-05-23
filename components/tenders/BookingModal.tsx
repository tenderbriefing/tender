'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { 
  XMarkIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { ScrapedTender } from '@/lib/scrapers/types'

interface BookingModalProps {
  tender: ScrapedTender
  isOpen: boolean
  onClose: () => void
  onBookingSuccess?: (bookingId: string) => void
}

const BookingModal = ({ tender, isOpen, onClose, onBookingSuccess }: BookingModalProps) => {
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'confirm' | 'processing' | 'success'>('confirm')

  if (!isOpen) return null

  const handleBooking = async () => {
    if (!user || !userProfile || userProfile.userType !== 'sme') {
      toast.error('You must be logged in as an SME to make bookings')
      return
    }

    setLoading(true)
    setStep('processing')

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          tenderId: tender.id,
          entrepreneurId: user.uid
        })
      })

      const result = await response.json()

      if (result.success) {
        setStep('success')
        toast.success('Booking created successfully!')
        
        // Call success callback if provided
        if (onBookingSuccess && result.booking) {
          onBookingSuccess(result.booking.id)
        }
        
        // Close modal after 2 seconds
        setTimeout(() => {
          onClose()
          setStep('confirm')
        }, 2000)
      } else {
        toast.error(result.error || 'Failed to create booking')
        setStep('confirm')
      }
    } catch (error) {
      console.error('Booking error:', error)
      toast.error('An error occurred while creating the booking')
      setStep('confirm')
    } finally {
      setLoading(false)
    }
  }

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
          <CalendarIcon className="h-6 w-6 text-primary-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Book Connector Service
        </h3>
        <p className="text-sm text-gray-600">
          Confirm your booking for this tender briefing
        </p>
      </div>

      {/* Tender Details */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-gray-900">{tender.title}</h4>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center">
            <MapPinIcon className="h-4 w-4 mr-2" />
            <span>{tender.organization} - {tender.location}</span>
          </div>
          {tender.briefingDate && (
            <div className="flex items-center">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <span>{tender.briefingDate.toLocaleDateString()}</span>
            </div>
          )}
          {tender.briefingTime && (
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-2" />
              <span>{tender.briefingTime}</span>
            </div>
          )}
          {tender.briefingVenue && (
            <div className="flex items-center">
              <MapPinIcon className="h-4 w-4 mr-2" />
              <span>{tender.briefingVenue}</span>
            </div>
          )}
        </div>
      </div>

      {/* Service Details */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Service Includes:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Professional attendance at compulsory briefing</li>
          <li>• Audio recording of the entire session</li>
          <li>• Detailed summary notes and key points</li>
          <li>• Attendance proof documentation</li>
          <li>• Quality control review</li>
          <li>• Email delivery of all materials</li>
        </ul>
      </div>

      {/* Pricing */}
      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-green-900">Total Cost</h4>
            <p className="text-sm text-green-700">Fixed rate - no hidden fees</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-900">R250.00</div>
            <p className="text-xs text-green-600">per briefing</p>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Payment is required upfront</p>
        <p>• Connector will be assigned within 24 hours</p>
        <p>• Full refund if no connector is available</p>
        <p>• Materials delivered within 48 hours after briefing</p>
      </div>
    </div>
  )

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
        <LoadingSpinner size="lg" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Processing Your Booking
        </h3>
        <p className="text-sm text-gray-600">
          Please wait while we create your booking and process payment...
        </p>
      </div>
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center text-sm text-blue-800">
          <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
          <span>Connector matching will begin after payment confirmation</span>
        </div>
      </div>
    </div>
  )

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
        <CheckCircleIcon className="h-6 w-6 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Booking Successful!
        </h3>
        <p className="text-sm text-gray-600">
          Your booking has been created and payment processed successfully.
        </p>
      </div>
      <div className="bg-green-50 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-2">What happens next?</h4>
        <ul className="text-sm text-green-800 space-y-1 text-left">
          <li>• We'll find a qualified connector within 30km</li>
          <li>• You'll receive an email with connector details</li>
          <li>• Connector will attend the briefing on your behalf</li>
          <li>• You'll receive all materials within 48 hours</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="absolute right-0 top-0 pr-4 pt-4">
              <button
                type="button"
                className="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {step === 'confirm' && renderConfirmStep()}
            {step === 'processing' && renderProcessingStep()}
            {step === 'success' && renderSuccessStep()}
          </div>

          {step === 'confirm' && (
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto"
                onClick={handleBooking}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                    Pay R250.00 & Book
                  </>
                )}
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:w-auto"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookingModal
