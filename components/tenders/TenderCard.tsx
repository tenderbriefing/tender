'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import { Tender } from '@/lib/types'
import { ScrapedTender } from '@/lib/scrapers/types'
import BookingModal from './BookingModal'
import { 
  MapPinIcon, 
  CalendarIcon, 
  ClockIcon,
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface TenderCardProps {
  tender: Tender | ScrapedTender
}

// Type guards
const isScrapedTender = (tender: Tender | ScrapedTender): tender is ScrapedTender => {
  return 'isCompulsoryBriefing' in tender;
};

const TenderCard = ({ tender }: TenderCardProps) => {
  const { user, userProfile } = useAuth()
  const [showDetails, setShowDetails] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)

  const handleBookConnector = () => {
    if (!user) {
      // Redirect to sign in
      window.location.href = '/auth/signin'
      return
    }
    
    if (userProfile?.userType !== 'sme') {
      alert('Only SMEs can book youth agent services')
      return
    }

    // Show booking modal
    setShowBookingModal(true)
  }

  const handleBookingSuccess = (bookingId: string) => {
    console.log('Booking created successfully:', bookingId)
    // Could redirect to bookings page or show success message
  }

  return (
    <div className="card hover:shadow-lg transition-shadow duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {tender.title}
          </h3>
          <p className="text-gray-600 mb-4 line-clamp-2">
            {tender.description}
          </p>
        </div>
        <div className="ml-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            (isScrapedTender(tender) ? 'active' : tender.status) === 'active' 
              ? 'bg-green-100 text-green-800' 
              : (isScrapedTender(tender) ? 'active' : tender.status) === 'closed'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isScrapedTender(tender) ? 'active' : tender.status}
          </span>
        </div>
      </div>

      {/* Key Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center text-gray-600">
          <BuildingOfficeIcon className="h-5 w-5 mr-2" />
          <span className="text-sm">{tender.organization}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <MapPinIcon className="h-5 w-5 mr-2" />
          <span className="text-sm">{tender.location}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <CalendarIcon className="h-5 w-5 mr-2" />
          <span className="text-sm">
            {isScrapedTender(tender) 
              ? (tender.briefingDate ? format(tender.briefingDate, 'MMM dd, yyyy') : 'TBD')
              : format(tender.briefingDate, 'MMM dd, yyyy')
            }
          </span>
        </div>
        <div className="flex items-center text-gray-600">
          <ClockIcon className="h-5 w-5 mr-2" />
          <span className="text-sm">{tender.briefingTime}</span>
        </div>
      </div>

      {/* Estimated Value */}
      {tender.estimatedValue && (
        <div className="flex items-center text-gray-600 mb-4">
          <CurrencyDollarIcon className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">
            Estimated Value: R{tender.estimatedValue.toLocaleString()}
          </span>
        </div>
      )}

      {/* Category */}
      <div className="mb-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
          {tender.category}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="btn-outline flex-1"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>
        
        {userProfile?.userType === 'sme' && (isScrapedTender(tender) ? tender.status === 'active' : tender.status === 'active') && (
          <button
            onClick={handleBookConnector}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <ShoppingCartIcon className="h-4 w-4" />
            Book Connector
          </button>
        )}
        
        {!user && (
          <Link href="/auth/signup?type=entrepreneur" className="btn-primary flex-1 text-center">
            Sign Up to Book
          </Link>
        )}
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Briefing Details */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Briefing Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span>Date: {
                    isScrapedTender(tender) 
                      ? (tender.briefingDate ? format(tender.briefingDate, 'EEEE, MMMM dd, yyyy') : 'TBD')
                      : format(tender.briefingDate, 'EEEE, MMMM dd, yyyy')
                  }</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  <span>Time: {tender.briefingTime}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPinIcon className="h-4 w-4 mr-2" />
                  <span>Venue: {tender.briefingVenue}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span>Deadline: {format(tender.submissionDeadline, 'MMM dd, yyyy')}</span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Contact Information</h4>
              <div className="space-y-2 text-sm">
                {tender.contactPerson && (
                  <div className="flex items-center text-gray-600">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <span>{tender.contactPerson}</span>
                  </div>
                )}
                {tender.contactEmail && (
                  <div className="flex items-center text-gray-600">
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    <span>{tender.contactEmail}</span>
                  </div>
                )}
                {tender.contactPhone && (
                  <div className="flex items-center text-gray-600">
                    <PhoneIcon className="h-4 w-4 mr-2" />
                    <span>{tender.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Requirements */}
          {tender.requirements && tender.requirements.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Requirements</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {tender.requirements.map((requirement, index) => (
                  <li key={index}>{requirement}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      {isScrapedTender(tender) && (
        <BookingModal
          tender={tender}
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          onBookingSuccess={handleBookingSuccess}
        />
      )}
    </div>
  )
}

export default TenderCard
