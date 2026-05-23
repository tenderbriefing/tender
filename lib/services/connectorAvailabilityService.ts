import { db } from '@/lib/database'
import { UserProfile } from '@/lib/auth'
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'

export interface ConnectorAvailability {
  connectorId: string
  isAvailable: boolean
  availableFrom?: Date
  availableUntil?: Date
  maxDistance: number // in kilometers
  preferredCategories: string[]
  currentJobs: number
  maxJobs: number
  location: {
    address: string
    city: string
    province: string
    coordinates?: {
      lat: number
      lng: number
    }
  }
  workingHours: {
    start: string // "09:00"
    end: string // "17:00"
    days: number[] // [1,2,3,4,5] for Monday-Friday
  }
  lastUpdated: Date
  status: 'active' | 'busy' | 'unavailable' | 'inactive'
}

export interface AvailabilityUpdate {
  isAvailable?: boolean
  availableFrom?: Date
  availableUntil?: Date
  maxDistance?: number
  preferredCategories?: string[]
  maxJobs?: number
  workingHours?: ConnectorAvailability['workingHours']
  status?: ConnectorAvailability['status']
  location?: ConnectorAvailability['location']
}

class ConnectorAvailabilityService {
  /**
   * Set or update connector availability
   */
  async setAvailability(connectorId: string, availability: AvailabilityUpdate): Promise<boolean> {
    try {
      const updateData = {
        ...availability,
        lastUpdated: serverTimestamp()
      }

      await setDoc(doc(db, 'connectorAvailability', connectorId), updateData, { merge: true })
      return true
    } catch (error) {
      console.error('Error setting connector availability:', error)
      return false
    }
  }

  /**
   * Get connector availability
   */
  async getAvailability(connectorId: string): Promise<ConnectorAvailability | null> {
    try {
      const docRef = doc(db, 'connectorAvailability', connectorId)
      const docSnap = await getDoc(docRef)
      
      if (!docSnap.exists()) {
        return null
      }
      
      const data = docSnap.data()
      return {
        connectorId,
        isAvailable: data.isAvailable || false,
        availableFrom: data.availableFrom?.toDate(),
        availableUntil: data.availableUntil?.toDate(),
        maxDistance: data.maxDistance || 30,
        preferredCategories: data.preferredCategories || [],
        currentJobs: data.currentJobs || 0,
        maxJobs: data.maxJobs || 5,
        location: data.location || {
          address: '',
          city: '',
          province: ''
        },
        workingHours: data.workingHours || {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5]
        },
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        status: data.status || 'inactive'
      }
    } catch (error) {
      console.error('Error getting connector availability:', error)
      return null
    }
  }

  /**
   * Get all available connectors
   */
  async getAvailableConnectors(): Promise<ConnectorAvailability[]> {
    try {
      const q = query(
        collection(db, 'connectorAvailability'),
        where('isAvailable', '==', true),
        where('status', '==', 'active')
      )
      
      const querySnapshot = await getDocs(q)
      const availabilities: ConnectorAvailability[] = []
      
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        availabilities.push({
          connectorId: doc.id,
          isAvailable: data.isAvailable,
          availableFrom: data.availableFrom?.toDate(),
          availableUntil: data.availableUntil?.toDate(),
          maxDistance: data.maxDistance || 30,
          preferredCategories: data.preferredCategories || [],
          currentJobs: data.currentJobs || 0,
          maxJobs: data.maxJobs || 5,
          location: data.location || {
            address: '',
            city: '',
            province: ''
          },
          workingHours: data.workingHours || {
            start: '09:00',
            end: '17:00',
            days: [1, 2, 3, 4, 5]
          },
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          status: data.status || 'inactive'
        })
      })
      
      return availabilities
    } catch (error) {
      console.error('Error getting available connectors:', error)
      return []
    }
  }

  /**
   * Check if connector is available for a specific job
   */
  async isConnectorAvailable(
    connectorId: string, 
    jobDate: Date, 
    jobLocation: string,
    jobCategory: string
  ): Promise<boolean> {
    try {
      const availability = await this.getAvailability(connectorId)
      if (!availability || !availability.isAvailable) {
        return false
      }

      // Check if connector has reached max jobs
      if (availability.currentJobs >= availability.maxJobs) {
        return false
      }

      // Check availability window
      const now = new Date()
      if (availability.availableFrom && jobDate < availability.availableFrom) {
        return false
      }
      if (availability.availableUntil && jobDate > availability.availableUntil) {
        return false
      }

      // Check working hours
      const jobDay = jobDate.getDay() // 0 = Sunday, 1 = Monday, etc.
      if (!availability.workingHours.days.includes(jobDay)) {
        return false
      }

      // Check preferred categories
      if (availability.preferredCategories.length > 0 && 
          !availability.preferredCategories.includes(jobCategory)) {
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking connector availability:', error)
      return false
    }
  }

  /**
   * Update connector's current job count
   */
  async updateJobCount(connectorId: string, increment: number): Promise<boolean> {
    try {
      const availability = await this.getAvailability(connectorId)
      if (!availability) {
        return false
      }

      const newJobCount = Math.max(0, availability.currentJobs + increment)
      
      await updateDoc(doc(db, 'connectorAvailability', connectorId), {
        currentJobs: newJobCount,
        lastUpdated: serverTimestamp()
      })

      return true
    } catch (error) {
      console.error('Error updating job count:', error)
      return false
    }
  }

  /**
   * Initialize availability for a new connector
   */
  async initializeAvailability(connectorProfile: UserProfile): Promise<boolean> {
    try {
      const availability: ConnectorAvailability = {
        connectorId: connectorProfile.uid,
        isAvailable: true,
        maxDistance: 30,
        preferredCategories: connectorProfile.skills || [],
        currentJobs: 0,
        maxJobs: 5,
        location: {
          address: connectorProfile.location || '',
          city: connectorProfile.location || '',
          province: connectorProfile.location || ''
        },
        workingHours: {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5] // Monday to Friday
        },
        lastUpdated: new Date(),
        status: 'active'
      }

      await setDoc(doc(db, 'connectorAvailability', connectorProfile.uid), availability)
      return true
    } catch (error) {
      console.error('Error initializing connector availability:', error)
      return false
    }
  }

  /**
   * Get connectors by location and category
   */
  async getConnectorsByLocationAndCategory(
    location: string,
    category: string,
    maxDistance: number = 30
  ): Promise<ConnectorAvailability[]> {
    try {
      const availableConnectors = await this.getAvailableConnectors()
      
      return availableConnectors.filter(connector => {
        // Check category preference
        if (connector.preferredCategories.length > 0 && 
            !connector.preferredCategories.includes(category)) {
          return false
        }

        // Check distance (this would be enhanced with real distance calculation)
        if (connector.maxDistance < maxDistance) {
          return false
        }

        // Check if connector has capacity
        if (connector.currentJobs >= connector.maxJobs) {
          return false
        }

        return true
      })
    } catch (error) {
      console.error('Error getting connectors by location and category:', error)
      return []
    }
  }

  /**
   * Set connector as busy
   */
  async setConnectorBusy(connectorId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'connectorAvailability', connectorId), {
        status: 'busy',
        lastUpdated: serverTimestamp()
      })
      return true
    } catch (error) {
      console.error('Error setting connector as busy:', error)
      return false
    }
  }

  /**
   * Set connector as available
   */
  async setConnectorAvailable(connectorId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'connectorAvailability', connectorId), {
        status: 'active',
        isAvailable: true,
        lastUpdated: serverTimestamp()
      })
      return true
    } catch (error) {
      console.error('Error setting connector as available:', error)
      return false
    }
  }
}

export const connectorAvailabilityService = new ConnectorAvailabilityService()
