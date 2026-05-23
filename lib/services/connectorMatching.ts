import { googleMapsService } from './googleMaps';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../auth';

export interface ConnectorMatch {
  connectorId: string;
  connectorProfile: UserProfile;
  distance: number;
  rating: number;
  availability: boolean;
  skills: string[];
  matchScore: number;
}

export interface TenderLocation {
  address: string;
  city: string;
  province: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface MatchingRequest {
  tenderId: string;
  tenderTitle: string;
  briefingDate: Date;
  briefingTime: string;
  location: TenderLocation;
  requiredSkills?: string[];
  maxDistance: number; // in kilometers, default 30
}

class ConnectorMatchingService {
  private maxDistance: number = 30; // 30km default radius

  /**
   * Find connectors within the specified radius of a tender location
   */
  async findConnectorsInRadius(request: MatchingRequest): Promise<ConnectorMatch[]> {
    try {
      // Get all connectors from the database
      const connectorsRef = collection(db, 'users');
      const connectorsQuery = query(
        connectorsRef,
        where('userType', '==', 'connector'),
        where('isActive', '==', true)
      );
      
      const connectorsSnapshot = await getDocs(connectorsQuery);
      const connectors: UserProfile[] = [];
      
      connectorsSnapshot.forEach((doc) => {
        connectors.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });

      // Get coordinates for the tender location
      const tenderCoords = await this.getLocationCoordinates(request.location);
      if (!tenderCoords) {
        throw new Error('Could not get coordinates for tender location');
      }

      // Calculate distances and filter connectors within radius
      const matches: ConnectorMatch[] = [];
      
      for (const connector of connectors) {
        if (!connector.location) continue;

        try {
          // Get connector's coordinates
          const connectorCoords = await this.getLocationCoordinates({
            address: connector.location,
            city: connector.location,
            province: 'South Africa'
          });

          if (!connectorCoords) continue;

          // Calculate distance using Haversine formula
          const distance = this.calculateDistance(tenderCoords, connectorCoords);
          
          if (distance <= request.maxDistance) {
            const matchScore = this.calculateMatchScore(connector, request, distance);
            
            matches.push({
              connectorId: connector.uid,
              connectorProfile: connector,
              distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
              rating: connector.rating || 0,
              availability: await this.checkAvailability(connector.uid, request.briefingDate),
              skills: connector.skills || [],
              matchScore
            });
          }
        } catch (error) {
          console.error(`Error processing connector ${connector.uid}:`, error);
          continue;
        }
      }

      // Sort by match score (highest first)
      return matches.sort((a, b) => b.matchScore - a.matchScore);

    } catch (error) {
      console.error('Error finding connectors in radius:', error);
      throw error;
    }
  }

  /**
   * Send notifications to matched connectors
   */
  async notifyConnectors(matches: ConnectorMatch[], request: MatchingRequest): Promise<void> {
    try {
      const notifications = matches.map(match => ({
        userId: match.connectorId,
        type: 'tender_opportunity',
        title: 'New Tender Briefing Opportunity',
        message: `A new tender briefing opportunity is available: ${request.tenderTitle}`,
        data: {
          tenderId: request.tenderId,
          briefingDate: request.briefingDate,
          briefingTime: request.briefingTime,
          location: request.location,
          distance: match.distance,
          matchScore: match.matchScore
        },
        read: false,
        createdAt: serverTimestamp()
      }));

      // Add notifications to Firestore
      const notificationsRef = collection(db, 'notifications');
      for (const notification of notifications) {
        await addDoc(notificationsRef, notification);
      }

      // TODO: Send email/SMS notifications using Gmail API
      console.log(`Sent notifications to ${matches.length} connectors`);

    } catch (error) {
      console.error('Error notifying connectors:', error);
      throw error;
    }
  }

  /**
   * Process connector interest responses and select the best match
   */
  async processConnectorResponses(tenderId: string, responses: any[]): Promise<string | null> {
    try {
      if (responses.length === 0) {
        return null;
      }

      // Sort responses by rating, availability, and response quality
      const sortedResponses = responses.sort((a, b) => {
        // Primary: Rating (higher is better)
        if (a.connectorProfile.rating !== b.connectorProfile.rating) {
          return (b.connectorProfile.rating || 0) - (a.connectorProfile.rating || 0);
        }
        
        // Secondary: Response quality score
        if (a.responseScore !== b.responseScore) {
          return b.responseScore - a.responseScore;
        }
        
        // Tertiary: Distance (closer is better)
        return a.distance - b.distance;
      });

      const selectedConnector = sortedResponses[0];
      
      // Update the booking with the selected connector
      const bookingRef = doc(db, 'bookings', selectedConnector.bookingId);
      await updateDoc(bookingRef, {
        connectorId: selectedConnector.connectorId,
        status: 'assigned',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Notify other connectors that they weren't selected
      const otherConnectors = sortedResponses.slice(1);
      for (const connector of otherConnectors) {
        await addDoc(collection(db, 'notifications'), {
          userId: connector.connectorId,
          type: 'booking_not_selected',
          title: 'Tender Briefing Not Selected',
          message: 'You were not selected for this tender briefing opportunity.',
          data: {
            tenderId,
            selectedConnector: selectedConnector.connectorId
          },
          read: false,
          createdAt: serverTimestamp()
        });
      }

      return selectedConnector.connectorId;

    } catch (error) {
      console.error('Error processing connector responses:', error);
      throw error;
    }
  }

  /**
   * Get coordinates for a location using Google Maps Geocoding API
   */
  private async getLocationCoordinates(location: TenderLocation): Promise<{ lat: number; lng: number } | null> {
    try {
      if (location.coordinates) {
        return location.coordinates;
      }

      const address = `${location.address}, ${location.city}, ${location.province}, South Africa`;
      const result = await googleMapsService.geocodeAddress(address);
      
      if (result) {
        return {
          lat: result.lat,
          lng: result.lng
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting location coordinates:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates using Google Maps Distance Matrix API
   */
  private calculateDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): number {
    try {
      // Use the Haversine formula from Google Maps service
      return googleMapsService.calculateDistance(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      );
    } catch (error) {
      console.error('Error calculating distance:', error);
      // Fallback to our own Haversine formula
      return this.haversineDistance(origin, destination);
    }
  }

  /**
   * Haversine formula for calculating distance between two coordinates
   */
  private haversineDistance(
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLng = this.toRadians(coord2.lng - coord1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate match score based on various factors
   */
  private calculateMatchScore(
    connector: UserProfile,
    request: MatchingRequest,
    distance: number
  ): number {
    let score = 0;

    // Rating factor (0-5 stars = 0-50 points)
    score += (connector.rating || 0) * 10;

    // Distance factor (closer is better, max 30 points)
    score += Math.max(0, 30 - distance);

    // Skills match factor (0-20 points)
    if (request.requiredSkills && connector.skills) {
      const matchingSkills = request.requiredSkills.filter(skill =>
        connector.skills!.some(connectorSkill =>
          connectorSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
      score += (matchingSkills.length / request.requiredSkills.length) * 20;
    }

    // Experience factor (total jobs completed, max 20 points)
    const totalJobs = connector.totalJobs || 0;
    score += Math.min(20, totalJobs * 2);

    return Math.round(score);
  }

  /**
   * Check if connector is available on the specified date
   */
  private async checkAvailability(connectorId: string, date: Date): Promise<boolean> {
    try {
      // Check for existing bookings on the same date
      const bookingsRef = collection(db, 'bookings');
      const bookingsQuery = query(
        bookingsRef,
        where('connectorId', '==', connectorId),
        where('status', 'in', ['pending', 'assigned', 'confirmed']),
        where('briefingDate', '==', date)
      );

      const bookingsSnapshot = await getDocs(bookingsQuery);
      return bookingsSnapshot.empty; // Available if no conflicting bookings

    } catch (error) {
      console.error('Error checking availability:', error);
      return false; // Assume not available if we can't check
    }
  }
}

export const connectorMatchingService = new ConnectorMatchingService();
