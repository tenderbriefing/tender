import { db } from '@/lib/database'
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { googleMapsService } from './googleMaps'
import { connectorAvailabilityService, ConnectorAvailability } from './connectorAvailabilityService'
import { notificationService } from './notificationService'
import { bookingService, Booking } from './bookingService'
import { UserProfile } from '@/lib/auth'
import { ScrapedTender } from '@/lib/scrapers/types'

export interface MatchingCriteria {
  maxDistance: number // in kilometers
  maxConnectorsToNotify: number
  responseTimeout: number // in minutes
  preferredCategories: string[]
  minRating?: number
  maxCurrentJobs?: number
}

export interface ConnectorMatch {
  connectorId: string
  connectorName: string
  connectorEmail: string
  distance: number
  duration: number
  matchScore: number
  availability: ConnectorAvailability
  userProfile: UserProfile
}

export interface MatchingResult {
  success: boolean
  matches: ConnectorMatch[]
  totalConnectorsFound: number
  connectorsNotified: number
  error?: string
}

class AutomatedMatchingService {
  private defaultCriteria: MatchingCriteria = {
    maxDistance: 30,
    maxConnectorsToNotify: 10,
    responseTimeout: 30,
    preferredCategories: [],
    minRating: 0,
    maxCurrentJobs: 5
  }

  /**
   * Find and match connectors for a booking
   */
  async findAndMatchConnectors(
    bookingId: string,
    criteria?: Partial<MatchingCriteria>
  ): Promise<MatchingResult> {
    try {
      // Get booking details
      const booking = await bookingService.getBookingById(bookingId)
      if (!booking) {
        return {
          success: false,
          matches: [],
          totalConnectorsFound: 0,
          connectorsNotified: 0,
          error: 'Booking not found'
        }
      }

      // Get tender details
      const tender = await this.getTenderById(booking.tenderId)
      if (!tender) {
        return {
          success: false,
          matches: [],
          totalConnectorsFound: 0,
          connectorsNotified: 0,
          error: 'Tender not found'
        }
      }

      // Merge criteria with defaults
      const matchingCriteria = { ...this.defaultCriteria, ...criteria }

      // Step 1: Get job location coordinates
      const jobLocation = await this.getJobLocation(tender)
      if (!jobLocation) {
        return {
          success: false,
          matches: [],
          totalConnectorsFound: 0,
          connectorsNotified: 0,
          error: 'Could not determine job location'
        }
      }

      // Step 2: Find available connectors
      const availableConnectors = await connectorAvailabilityService.getAvailableConnectors()
      
      // Step 3: Filter connectors by basic criteria
      const filteredConnectors = await this.filterConnectorsByCriteria(
        availableConnectors,
        matchingCriteria,
        tender,
        booking
      )

      // Step 4: Calculate distances and match scores
      const connectorMatches = await this.calculateMatches(
        filteredConnectors,
        jobLocation,
        matchingCriteria,
        tender,
        booking
      )

      // Step 5: Sort by match score and select top candidates
      const topMatches = connectorMatches
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, matchingCriteria.maxConnectorsToNotify)

      // Step 6: Send notifications to selected connectors
      const notificationResult = await this.notifySelectedConnectors(
        topMatches,
        booking,
        tender
      )

      // Step 7: Update booking with matching results
      await this.updateBookingWithMatches(bookingId, topMatches)

      return {
        success: true,
        matches: topMatches,
        totalConnectorsFound: connectorMatches.length,
        connectorsNotified: notificationResult ? topMatches.length : 0
      }

    } catch (error) {
      console.error('Error in automated matching:', error)
      return {
        success: false,
        matches: [],
        totalConnectorsFound: 0,
        connectorsNotified: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get job location coordinates
   */
  private async getJobLocation(tender: ScrapedTender): Promise<{ lat: number; lng: number } | null> {
    try {
      // Try to geocode the briefing venue first
      if (tender.briefingVenue) {
        const venueLocation = await googleMapsService.geocodeAddress(tender.briefingVenue)
        if (venueLocation) {
          return { lat: venueLocation.lat, lng: venueLocation.lng }
        }
      }

      // Fallback to general location
      const locationString = `${tender.location}, South Africa`
      const location = await googleMapsService.geocodeAddress(locationString)
      
      if (location) {
        return { lat: location.lat, lng: location.lng }
      }

      return null
    } catch (error) {
      console.error('Error getting job location:', error)
      return null
    }
  }

  /**
   * Filter connectors by basic criteria
   */
  private async filterConnectorsByCriteria(
    connectors: ConnectorAvailability[],
    criteria: MatchingCriteria,
    tender: ScrapedTender,
    booking: Booking
  ): Promise<ConnectorAvailability[]> {
    return connectors.filter(connector => {
      // Check if connector is available for the job date
      if (!connector.isAvailable) return false

      // Check current job count
      if (connector.currentJobs >= (criteria.maxCurrentJobs || connector.maxJobs)) return false

      // Check distance preference
      if (connector.maxDistance < criteria.maxDistance) return false

      // Check category preferences
      if (criteria.preferredCategories.length > 0) {
        const hasMatchingCategory = criteria.preferredCategories.some(category =>
          connector.preferredCategories.includes(category)
        )
        if (!hasMatchingCategory) return false
      }

      // Check tender category match
      if (connector.preferredCategories.length > 0) {
        const hasTenderCategory = connector.preferredCategories.includes(tender.category)
        if (!hasTenderCategory) return false
      }

      return true
    })
  }

  /**
   * Calculate matches with distances and scores
   */
  private async calculateMatches(
    connectors: ConnectorAvailability[],
    jobLocation: { lat: number; lng: number },
    criteria: MatchingCriteria,
    tender: ScrapedTender,
    booking: Booking
  ): Promise<ConnectorMatch[]> {
    const matches: ConnectorMatch[] = []

    for (const connector of connectors) {
      try {
        // Get connector location coordinates
        const connectorLocation = await this.getConnectorLocation(connector)
        if (!connectorLocation) continue

        // Calculate distance and duration
        const distanceResult = await googleMapsService.getDistanceAndDuration(
          jobLocation,
          connectorLocation
        )

        if (!distanceResult) continue

        const distanceKm = distanceResult.distance / 1000

        // Skip if too far
        if (distanceKm > criteria.maxDistance) continue

        // Get connector user profile
        const userProfile = await this.getConnectorProfile(connector.connectorId)
        if (!userProfile) continue

        // Calculate match score
        const matchScore = this.calculateMatchScore(
          connector,
          userProfile,
          distanceKm,
          distanceResult.duration,
          tender,
          criteria
        )

        matches.push({
          connectorId: connector.connectorId,
          connectorName: userProfile.displayName,
          connectorEmail: userProfile.email,
          distance: distanceKm,
          duration: distanceResult.duration,
          matchScore,
          availability: connector,
          userProfile
        })

      } catch (error) {
        console.error(`Error calculating match for connector ${connector.connectorId}:`, error)
        continue
      }
    }

    return matches
  }

  /**
   * Get connector location coordinates
   */
  private async getConnectorLocation(connector: ConnectorAvailability): Promise<{ lat: number; lng: number } | null> {
    try {
      // Use cached coordinates if available
      if (connector.location.coordinates) {
        return connector.location.coordinates
      }

      // Geocode the location
      const locationString = `${connector.location.address}, ${connector.location.city}, ${connector.location.province}, South Africa`
      const location = await googleMapsService.geocodeAddress(locationString)
      
      if (location) {
        // Cache the coordinates
        await connectorAvailabilityService.setAvailability(connector.connectorId, {
          location: {
            ...connector.location,
            coordinates: { lat: location.lat, lng: location.lng }
          }
        })
        
        return { lat: location.lat, lng: location.lng }
      }

      return null
    } catch (error) {
      console.error('Error getting connector location:', error)
      return null
    }
  }

  /**
   * Get connector user profile
   */
  private async getConnectorProfile(connectorId: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', connectorId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile
      }
      
      return null
    } catch (error) {
      console.error('Error getting connector profile:', error)
      return null
    }
  }

  /**
   * Calculate match score for a connector
   */
  private calculateMatchScore(
    connector: ConnectorAvailability,
    userProfile: UserProfile,
    distanceKm: number,
    durationSeconds: number,
    tender: ScrapedTender,
    criteria: MatchingCriteria
  ): number {
    let score = 100 // Base score

    // Distance factor (closer is better)
    const distanceScore = Math.max(0, 50 - (distanceKm * 2))
    score += distanceScore

    // Duration factor (shorter is better)
    const durationMinutes = durationSeconds / 60
    const durationScore = Math.max(0, 30 - (durationMinutes * 0.5))
    score += durationScore

    // Category match factor
    if (connector.preferredCategories.includes(tender.category)) {
      score += 20
    }

    // Rating factor
    if (userProfile.rating && userProfile.rating >= (criteria.minRating || 0)) {
      score += userProfile.rating * 5
    }

    // Job capacity factor (less busy is better)
    const capacityRatio = connector.currentJobs / connector.maxJobs
    const capacityScore = (1 - capacityRatio) * 20
    score += capacityScore

    // Experience factor (more jobs completed is better)
    if (userProfile.totalJobs) {
      const experienceScore = Math.min(15, userProfile.totalJobs * 0.5)
      score += experienceScore
    }

    // Availability window factor
    if (connector.availableFrom && connector.availableUntil) {
      const now = new Date()
      const jobDate = tender.briefingDate || new Date()
      
      if (jobDate >= connector.availableFrom && jobDate <= connector.availableUntil) {
        score += 10
      }
    }

    return Math.round(score)
  }

  /**
   * Notify selected connectors
   */
  private async notifySelectedConnectors(
    matches: ConnectorMatch[],
    booking: Booking,
    tender: ScrapedTender
  ): Promise<boolean> {
    try {
      const connectorIds = matches.map(match => match.connectorId)
      
      const result = await notificationService.notifyConnectorsOfJobOpportunity(
        connectorIds,
        {
          bookingId: booking.id,
          tenderId: booking.tenderId,
          tenderTitle: booking.tenderTitle,
          organization: booking.organization,
          location: booking.location,
          briefingDate: booking.briefingDate,
          briefingTime: booking.briefingTime,
          briefingVenue: booking.briefingVenue,
          amount: 200 // Connector earnings
        }
      )

      return result
    } catch (error) {
      console.error('Error notifying selected connectors:', error)
      return false
    }
  }

  /**
   * Update booking with matching results
   */
  private async updateBookingWithMatches(
    bookingId: string,
    matches: ConnectorMatch[]
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        matchingResults: {
          totalMatches: matches.length,
          topMatches: matches.map(match => ({
            connectorId: match.connectorId,
            connectorName: match.connectorName,
            distance: match.distance,
            matchScore: match.matchScore
          })),
          matchedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('Error updating booking with matches:', error)
    }
  }

  /**
   * Get tender by ID (mock implementation)
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
   * Process connector response to job opportunity
   */
  async processConnectorResponse(
    connectorId: string,
    bookingId: string,
    response: 'accept' | 'decline',
    notes?: string
  ): Promise<boolean> {
    try {
      const booking = await bookingService.getBookingById(bookingId)
      if (!booking) {
        return false
      }

      if (response === 'accept') {
        // Assign the connector to the booking
        await bookingService.updateBookingStatus(
          bookingId,
          'assigned',
          connectorId,
          // Get connector name from user profile
          (await this.getConnectorProfile(connectorId))?.displayName || 'Unknown'
        )

        // Update connector availability
        await connectorAvailabilityService.updateJobCount(connectorId, 1)
        await connectorAvailabilityService.setConnectorBusy(connectorId)

        // Notify entrepreneur
        await notificationService.sendNotification(
          booking.smeId,
          'job_assigned',
          {
            bookingId,
            connectorId,
            connectorName: (await this.getConnectorProfile(connectorId))?.displayName || 'Unknown'
          }
        )

        return true
      } else {
        // Log the decline (could be used for analytics)
        console.log(`Connector ${connectorId} declined booking ${bookingId}: ${notes}`)
        return true
      }
    } catch (error) {
      console.error('Error processing connector response:', error)
      return false
    }
  }

  /**
   * Auto-assign connector if only one responds positively
   */
  async autoAssignConnector(bookingId: string): Promise<boolean> {
    try {
      // This would be called after the response timeout period
      // For now, we'll implement a simple auto-assignment logic
      
      const booking = await bookingService.getBookingById(bookingId)
      if (!booking || booking.status !== 'pending') {
        return false
      }

      // Get the top match and auto-assign
      const matchingResult = await this.findAndMatchConnectors(bookingId, {
        maxConnectorsToNotify: 1
      })

      if (matchingResult.success && matchingResult.matches.length > 0) {
        const topMatch = matchingResult.matches[0]
        return await this.processConnectorResponse(topMatch.connectorId, bookingId, 'accept')
      }

      return false
    } catch (error) {
      console.error('Error in auto-assignment:', error)
      return false
    }
  }
}

export const automatedMatchingService = new AutomatedMatchingService()
