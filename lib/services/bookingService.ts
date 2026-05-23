import { db } from '@/lib/database'
import { UserProfile } from '@/lib/auth'
import { ScrapedTender } from '@/lib/scrapers/types'
import { doc, setDoc, getDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { automatedMatchingService } from './automatedMatchingService'
import { connectorAvailabilityService } from './connectorAvailabilityService'

export interface Booking {
  id: string
  tenderId: string
  tenderTitle: string
  organization: string
  location: string
  briefingDate: Date
  briefingTime: string
  briefingVenue: string
  smeId: string
  smeName: string
  smeCompany: string
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
  submittedAt?: Date
}

export interface BookingRequest {
  tenderId: string
  smeId: string
  amount: number
}

export interface BookingResult {
  success: boolean
  booking?: Booking
  error?: string
}

class BookingService {
  private readonly FIXED_RATE = 250.00 // R250 fixed rate for all bookings

  /**
   * Create a new booking for a tender briefing
   */
  async createBooking(request: BookingRequest): Promise<BookingResult> {
    try {
      // Validate the request
      if (!request.tenderId || !request.smeId) {
        return {
          success: false,
          error: 'Missing required fields: tenderId and smeId'
        }
      }

      // Get tender details
      const tender = await this.getTenderById(request.tenderId)
      if (!tender) {
        return {
          success: false,
          error: 'Tender not found'
        }
      }

      // Get sme details
      const sme = await this.getUserById(request.smeId)
      if (!sme || sme.userType !== 'sme') {
        return {
          success: false,
          error: 'Invalid sme'
        }
      }

      // Validate tender has compulsory briefing
      if (!tender.isCompulsoryBriefing) {
        return {
          success: false,
          error: 'This tender does not have a compulsory briefing'
        }
      }

      // Check if tender is still active
      if (tender.status !== 'active') {
        return {
          success: false,
          error: 'This tender is no longer active'
        }
      }

      // Check if briefing date is in the future
      if (tender.briefingDate && tender.briefingDate < new Date()) {
        return {
          success: false,
          error: 'Briefing date has already passed'
        }
      }

      // Create booking document
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const booking: Booking = {
        id: bookingId,
        tenderId: request.tenderId,
        tenderTitle: tender.title,
        organization: tender.organization,
        location: tender.location,
        briefingDate: tender.briefingDate || new Date(),
        briefingTime: tender.briefingTime || 'TBD',
        briefingVenue: tender.briefingVenue || 'TBD',
        smeId: request.smeId,
        smeName: sme.displayName,
        smeCompany: sme.companyName || '',
        status: 'pending',
        amount: this.FIXED_RATE,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Save to Firestore
      await setDoc(doc(db, 'bookings', bookingId), booking)

      // TODO: Process payment (Stripe integration)
      // For now, we'll assume payment is successful

      // TODO: Trigger connector matching process
      await this.triggerConnectorMatching(booking)

      return {
        success: true,
        booking
      }

    } catch (error) {
      console.error('Error creating booking:', error)
      return {
        success: false,
        error: 'Failed to create booking'
      }
    }
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<Booking | null> {
    try {
      const docRef = doc(db, 'bookings', bookingId)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data() as Booking
    } catch (error) {
      console.error('Error getting booking:', error)
      return null
    }
  }

  /**
   * Get bookings for an sme
   */
  async getBookingsByEntrepreneur(smeId: string): Promise<Booking[]> {
    try {
      const q = query(
        collection(db, 'bookings'),
        where('smeId', '==', smeId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => doc.data() as Booking)
    } catch (error) {
      console.error('Error getting sme bookings:', error)
      return []
    }
  }

  /**
   * Get bookings for a connector
   */
  async getBookingsByConnector(connectorId: string): Promise<Booking[]> {
    try {
      const q = query(
        collection(db, 'bookings'),
        where('connectorId', '==', connectorId),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => doc.data() as Booking)
    } catch (error) {
      console.error('Error getting connector bookings:', error)
      return []
    }
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(
    bookingId: string, 
    status: Booking['status'],
    connectorId?: string,
    connectorName?: string
  ): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      }

      if (connectorId) {
        updateData.connectorId = connectorId
      }
      if (connectorName) {
        updateData.connectorName = connectorName
      }

      await updateDoc(doc(db, 'bookings', bookingId), updateData)
      return true
    } catch (error) {
      console.error('Error updating booking status:', error)
      return false
    }
  }

  /**
   * Submit work for a booking
   */
  async submitWork(
    bookingId: string,
    workData: {
      attendanceProof?: string
      audioRecording?: string
      summaryNotes?: string
      notes?: string
    }
  ): Promise<boolean> {
    try {
      const updateData = {
        ...workData,
        status: 'completed' as const,
        submittedAt: new Date(),
        updatedAt: new Date()
      }

      await updateDoc(doc(db, 'bookings', bookingId), updateData)
      return true
    } catch (error) {
      console.error('Error submitting work:', error)
      return false
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<boolean> {
    try {
      const updateData = {
        status: 'cancelled' as const,
        notes: reason,
        updatedAt: new Date()
      }

      await updateDoc(doc(db, 'bookings', bookingId), updateData)
      return true
    } catch (error) {
      console.error('Error cancelling booking:', error)
      return false
    }
  }

  /**
   * Get tender by ID (mock implementation - replace with real data source)
   */
  private async getTenderById(tenderId: string): Promise<ScrapedTender | null> {
    try {
      // For now, return mock data
      // TODO: Replace with actual tender data from Firestore or API
      const mockTender: ScrapedTender = {
        id: tenderId,
        title: 'Supply of Office Equipment and Furniture',
        description: 'Supply of office equipment and furniture for government buildings',
        organization: 'Department of Public Works',
        location: 'Pretoria, Gauteng',
        briefingDate: new Date('2024-02-15'),
        briefingTime: '10:00 AM',
        briefingVenue: 'Government Buildings, Pretoria',
        submissionDeadline: new Date('2024-03-01'),
        status: 'active',
        isCompulsoryBriefing: true,
        category: 'supplies',
        estimatedValue: 500000,
        contactPerson: 'John Smith',
        contactEmail: 'john.smith@publicworks.gov.za',
        contactPhone: '+27 12 345 6789',
        source: 'eTenders.gov.za',
        sourceUrl: 'https://www.etenders.gov.za',
        briefingType: 'compulsory',
        requirements: ['Valid tax clearance', 'CIDB registration'],
        scrapedAt: new Date()
      }
      return mockTender
    } catch (error) {
      console.error('Error getting tender:', error)
      return null
    }
  }

  /**
   * Get user by ID
   */
  private async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', userId)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        return null
      }
      return docSnap.data() as UserProfile
    } catch (error) {
      console.error('Error getting user:', error)
      return null
    }
  }

  /**
   * Trigger connector matching process
   */
  private async triggerConnectorMatching(booking: Booking): Promise<void> {
    try {
      console.log('Triggering automated connector matching for booking:', booking.id)
      
      // Use the automated matching service
      const matchingResult = await automatedMatchingService.findAndMatchConnectors(booking.id)
      
      if (matchingResult.success) {
        console.log(`Found ${matchingResult.totalConnectorsFound} connectors, notified ${matchingResult.connectorsNotified}`)
        
        // Set up auto-assignment after timeout if no manual response
        setTimeout(async () => {
          const currentBooking = await this.getBookingById(booking.id)
          if (currentBooking && currentBooking.status === 'pending') {
            console.log('Auto-assigning connector due to timeout')
            await automatedMatchingService.autoAssignConnector(booking.id)
          }
        }, 30 * 60 * 1000) // 30 minutes timeout
        
      } else {
        console.error('Connector matching failed:', matchingResult.error)
        
        // Fallback: try to find any available connector
        const availableConnectors = await connectorAvailabilityService.getAvailableConnectors()
        if (availableConnectors.length > 0) {
          const fallbackConnector = availableConnectors[0]
          await this.updateBookingStatus(
            booking.id,
            'assigned',
            fallbackConnector.connectorId,
            'Available Connector'
          )
          console.log('Fallback connector assigned to booking:', booking.id)
        }
      }
      
    } catch (error) {
      console.error('Error triggering connector matching:', error)
    }
  }

  /**
   * Get booking statistics for an sme
   */
  async getBookingStats(smeId: string): Promise<{
    total: number
    pending: number
    assigned: number
    inProgress: number
    completed: number
    cancelled: number
  }> {
    try {
      const bookings = await this.getBookingsByEntrepreneur(smeId)
      
      return {
        total: bookings.length,
        pending: bookings.filter(b => b.status === 'pending').length,
        assigned: bookings.filter(b => b.status === 'assigned').length,
        inProgress: bookings.filter(b => b.status === 'in_progress').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length
      }
    } catch (error) {
      console.error('Error getting booking stats:', error)
      return {
        total: 0,
        pending: 0,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0
      }
    }
  }

  /**
   * Get job statistics for a connector
   */
  async getJobStats(connectorId: string): Promise<{
    total: number
    assigned: number
    inProgress: number
    completed: number
    cancelled: number
    totalEarnings: number
  }> {
    try {
      const jobs = await this.getBookingsByConnector(connectorId)
      
      const completedJobs = jobs.filter(j => j.status === 'completed')
      const totalEarnings = completedJobs.reduce((sum, job) => sum + 200, 0) // R200 per completed job
      
      return {
        total: jobs.length,
        assigned: jobs.filter(j => j.status === 'assigned').length,
        inProgress: jobs.filter(j => j.status === 'in_progress').length,
        completed: completedJobs.length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
        totalEarnings
      }
    } catch (error) {
      console.error('Error getting job stats:', error)
      return {
        total: 0,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        totalEarnings: 0
      }
    }
  }
}

export const bookingService = new BookingService()
