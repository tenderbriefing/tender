// Simple eTenders scraper
import { ScrapingResult, ScrapedTender } from './types'
import { simpleETendersScraper } from './simpleETendersScraper'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '../firebase'

export class ScrapingService {
  private isRunning = false
  private lastScrapeTime: Date | null = null

  async startScraping(): Promise<void> {
    if (this.isRunning) {
      console.log('Scraping already in progress...')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting tender scraping service...')

    try {
      // Use the simple eTenders scraper
      console.log('🚀 Starting simple eTenders scraping...')
      const etendersResult = await simpleETendersScraper.scrapeTenders()
      
      if (etendersResult.success) {
        await this.saveScrapedTenders(etendersResult.tenders)
        console.log(`✅ Saved ${etendersResult.tenders.length} tenders from eTenders`)
      } else {
        console.error('❌ eTenders scraping failed:', etendersResult.errors)
      }

      // Update last scrape time
      this.lastScrapeTime = new Date()
      
      // Log scraping job
      await this.logScrapingJob('eTenders', etendersResult)

    } catch (error) {
      console.error('❌ Scraping service error:', error)
    } finally {
      this.isRunning = false
    }
  }

  private async saveScrapedTenders(tenders: ScrapedTender[]): Promise<void> {
    const batch = []
    
    for (const tender of tenders) {
      try {
        // Check if tender already exists
        const existingTender = await this.findExistingTender(tender.sourceUrl)
        
        if (existingTender) {
          // Update existing tender
          await this.updateExistingTender(existingTender.id, tender)
        } else {
          // Create new tender
          await this.createNewTender(tender)
        }
      } catch (error) {
        console.error(`Error saving tender ${tender.id}:`, error)
      }
    }
  }

  private async findExistingTender(sourceUrl: string): Promise<any> {
    const q = query(
      collection(db, 'tenders'),
      where('sourceUrl', '==', sourceUrl)
    )
    
    const querySnapshot = await getDocs(q)
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    }
    
    return null
  }

  private async createNewTender(tender: ScrapedTender): Promise<void> {
    const tenderData = {
      title: tender.title,
      description: tender.description,
      organization: tender.organization,
      location: tender.location,
      briefingDate: tender.briefingDate,
      briefingTime: tender.briefingTime,
      briefingVenue: tender.briefingVenue,
      submissionDeadline: tender.submissionDeadline,
      estimatedValue: tender.estimatedValue,
      category: tender.category,
      requirements: tender.requirements,
      contactPerson: tender.contactPerson,
      contactEmail: tender.contactEmail,
      contactPhone: tender.contactPhone,
      source: tender.source,
      sourceUrl: tender.sourceUrl,
      isCompulsoryBriefing: tender.isCompulsoryBriefing,
      briefingType: tender.briefingType,
      status: tender.status,
      scrapedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    await addDoc(collection(db, 'tenders'), tenderData)
  }

  private async updateExistingTender(tenderId: string, tender: ScrapedTender): Promise<void> {
    const tenderRef = doc(db, 'tenders', tenderId)
    
    const updateData = {
      title: tender.title,
      description: tender.description,
      organization: tender.organization,
      location: tender.location,
      briefingDate: tender.briefingDate,
      briefingTime: tender.briefingTime,
      briefingVenue: tender.briefingVenue,
      submissionDeadline: tender.submissionDeadline,
      estimatedValue: tender.estimatedValue,
      category: tender.category,
      requirements: tender.requirements,
      contactPerson: tender.contactPerson,
      contactEmail: tender.contactEmail,
      contactPhone: tender.contactPhone,
      isCompulsoryBriefing: tender.isCompulsoryBriefing,
      briefingType: tender.briefingType,
      status: tender.status,
      scrapedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    await updateDoc(tenderRef, updateData)
  }

  private async logScrapingJob(source: string, result: ScrapingResult): Promise<void> {
    const jobData = {
      source,
      status: result.success ? 'completed' : 'failed',
      startedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      totalFound: result.totalFound,
      newTenders: result.newTenders,
      updatedTenders: result.updatedTenders,
      errors: result.errors,
      result: result
    }

    await addDoc(collection(db, 'scraping_jobs'), jobData)
  }

  async getScrapingStats(): Promise<any> {
    try {
      // Get total tenders
      const tendersQuery = query(collection(db, 'tenders'))
      const tendersSnapshot = await getDocs(tendersQuery)
      const totalTenders = tendersSnapshot.size

      // Get tenders with compulsory briefings
      const briefingsQuery = query(
        collection(db, 'tenders'),
        where('isCompulsoryBriefing', '==', true)
      )
      const briefingsSnapshot = await getDocs(briefingsQuery)
      const briefingsTenders = briefingsSnapshot.size

      // Get recent scraping jobs
      const jobsQuery = query(
        collection(db, 'scraping_jobs'),
        orderBy('completedAt', 'desc'),
        limit(10)
      )
      const jobsSnapshot = await getDocs(jobsQuery)
      const recentJobs = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      return {
        totalTenders,
        briefingsTenders,
        lastScrapeTime: this.lastScrapeTime,
        isRunning: this.isRunning,
        recentJobs
      }
    } catch (error) {
      console.error('Error getting scraping stats:', error)
      return {
        totalTenders: 0,
        briefingsTenders: 0,
        lastScrapeTime: null,
        isRunning: false,
        recentJobs: []
      }
    }
  }

  async getTendersWithBriefings(): Promise<ScrapedTender[]> {
    try {
      const q = query(
        collection(db, 'tenders'),
        where('isCompulsoryBriefing', '==', true),
        where('status', '==', 'active'),
        orderBy('briefingDate', 'asc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScrapedTender[]
    } catch (error) {
      console.error('Error getting tenders with briefings:', error)
      return []
    }
  }

  async getTendersByCategory(category: string): Promise<ScrapedTender[]> {
    try {
      const q = query(
        collection(db, 'tenders'),
        where('category', '==', category),
        where('isCompulsoryBriefing', '==', true),
        where('status', '==', 'active'),
        orderBy('briefingDate', 'asc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScrapedTender[]
    } catch (error) {
      console.error('Error getting tenders by category:', error)
      return []
    }
  }

  async getTendersByLocation(location: string): Promise<ScrapedTender[]> {
    try {
      const q = query(
        collection(db, 'tenders'),
        where('location', '==', location),
        where('isCompulsoryBriefing', '==', true),
        where('status', '==', 'active'),
        orderBy('briefingDate', 'asc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScrapedTender[]
    } catch (error) {
      console.error('Error getting tenders by location:', error)
      return []
    }
  }

  async searchTenders(searchTerm: string): Promise<ScrapedTender[]> {
    try {
      // Note: Firestore doesn't support full-text search natively
      // This is a basic implementation - consider using Algolia for production
      const q = query(
        collection(db, 'tenders'),
        where('isCompulsoryBriefing', '==', true),
        where('status', '==', 'active')
      )
      
      const querySnapshot = await getDocs(q)
      const allTenders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScrapedTender[]
      
      // Filter by search term
      return allTenders.filter(tender => 
        tender.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tender.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tender.organization.toLowerCase().includes(searchTerm.toLowerCase())
      )
    } catch (error) {
      console.error('Error searching tenders:', error)
      return []
    }
  }
}

// Export singleton instance
export const scrapingService = new ScrapingService()
