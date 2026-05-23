export interface ScrapedTender {
  id: string
  title: string
  description: string
  organization: string
  location: string
  briefingDate?: Date
  briefingTime?: string
  briefingVenue?: string
  submissionDeadline: Date
  estimatedValue?: number
  category: string
  requirements: string[]
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
  source: string
  sourceUrl: string
  isCompulsoryBriefing: boolean
  briefingType: 'compulsory' | 'optional' | 'information'
  scrapedAt: Date
  status: 'active' | 'closed' | 'cancelled'
}

export interface ScrapingConfig {
  sources: TenderSource[]
  updateInterval: number // in minutes
  maxRetries: number
  timeout: number // in milliseconds
}

export interface TenderSource {
  name: string
  baseUrl: string
  searchUrl: string
  selectors: {
    tenderList: string
    tenderTitle: string
    tenderDescription: string
    tenderOrganization: string
    tenderLocation: string
    tenderDeadline: string
    tenderValue?: string
    tenderCategory?: string
    tenderContact?: string
    briefingInfo?: string
  }
  filters: {
    keywords: string[]
    excludeKeywords: string[]
    minValue?: number
    maxValue?: number
    categories?: string[]
  }
  pagination?: {
    type: 'infinite' | 'numbered' | 'next'
    selector?: string
    maxPages?: number
  }
}

export interface ScrapingResult {
  success: boolean
  tenders: ScrapedTender[]
  errors: string[]
  source: string
  scrapedAt: Date
  totalFound: number
  newTenders: number
  updatedTenders: number
}

export interface ScrapingJob {
  id: string
  source: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  result?: ScrapingResult
  error?: string
}
