import { ScrapedTender, ScrapingResult, TenderSource } from './types'
import { BRIEFING_KEYWORDS, CATEGORY_MAPPING } from './config'

export class ETendersScraper {
  private baseUrl = 'https://www.etenders.gov.za'
  private searchUrl = 'https://www.etenders.gov.za/Home/opportunities'
  
  async scrapeTenders(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      tenders: [],
      errors: [],
      source: 'eTenders',
      scrapedAt: new Date(),
      totalFound: 0,
      newTenders: 0,
      updatedTenders: 0
    }

    try {
      console.log('🔍 Starting eTenders scraping...')
      
      // Scrape multiple pages
      const allTenders: ScrapedTender[] = []
      let page = 1
      const maxPages = 20 // Scrape first 20 pages
      
      while (page <= maxPages) {
        console.log(`📄 Scraping page ${page}...`)
        
        const pageTenders = await this.scrapePage(page)
        if (pageTenders.length === 0) {
          console.log('No more tenders found, stopping...')
          break
        }
        
        allTenders.push(...pageTenders)
        page++
        
        // Add delay between requests to be respectful
        await this.delay(2000)
      }
      
      // Filter for tenders with compulsory briefings
      const briefingsTenders = allTenders.filter(tender => 
        this.hasCompulsoryBriefing(tender)
      )
      
      result.tenders = briefingsTenders
      result.totalFound = allTenders.length
      result.newTenders = briefingsTenders.length
      result.success = true
      
      console.log(`✅ Scraping completed: ${briefingsTenders.length} tenders with compulsory briefings found`)
      
    } catch (error) {
      console.error('❌ Error scraping eTenders:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }
    
    return result
  }

  private async scrapePage(page: number): Promise<ScrapedTender[]> {
    try {
      // For demo purposes, we'll simulate the scraping
      // In production, you would use a headless browser or HTTP requests
      const mockTenders = this.generateMockETendersData(page)
      return mockTenders
    } catch (error) {
      console.error(`Error scraping page ${page}:`, error)
      return []
    }
  }

  private hasCompulsoryBriefing(tender: ScrapedTender): boolean {
    const text = `${tender.title} ${tender.description}`.toLowerCase()
    
    // Check for briefing keywords
    const hasBriefingKeyword = BRIEFING_KEYWORDS.some(keyword => 
      text.includes(keyword.toLowerCase())
    )
    
    // Check for compulsory/mandatory indicators
    const hasCompulsoryIndicator = [
      'compulsory',
      'mandatory',
      'must attend',
      'required to attend',
      'obligatory'
    ].some(indicator => text.includes(indicator))
    
    return hasBriefingKeyword && hasCompulsoryIndicator
  }

  private generateMockETendersData(page: number): ScrapedTender[] {
    // This simulates real eTenders data structure
    const mockTenders: ScrapedTender[] = []
    
    const organizations = [
      'Department of Public Works',
      'Department of Health',
      'Department of Education',
      'Department of Transport',
      'Department of Energy',
      'Department of Water and Sanitation',
      'Department of Human Settlements',
      'Department of Social Development',
      'Department of Agriculture',
      'Department of Tourism'
    ]
    
    const locations = [
      'Johannesburg, Gauteng',
      'Cape Town, Western Cape',
      'Durban, KwaZulu-Natal',
      'Pretoria, Gauteng',
      'Port Elizabeth, Eastern Cape',
      'Bloemfontein, Free State',
      'Nelspruit, Mpumalanga',
      'Polokwane, Limpopo',
      'Kimberley, Northern Cape',
      'Bisho, Eastern Cape'
    ]
    
    const categories = Object.keys(CATEGORY_MAPPING)
    
    // Generate 10-15 tenders per page
    const tendersPerPage = Math.floor(Math.random() * 6) + 10
    
    for (let i = 0; i < tendersPerPage; i++) {
      const tenderId = `ET${page.toString().padStart(3, '0')}${i.toString().padStart(2, '0')}`
      const organization = organizations[Math.floor(Math.random() * organizations.length)]
      const location = locations[Math.floor(Math.random() * locations.length)]
      const category = categories[Math.floor(Math.random() * categories.length)]
      
      // 70% chance of having a compulsory briefing
      const hasBriefing = Math.random() > 0.3
      
      const tender: ScrapedTender = {
        id: tenderId,
        title: this.generateTenderTitle(category, hasBriefing),
        description: this.generateTenderDescription(category, hasBriefing),
        organization,
        location,
        briefingDate: hasBriefing ? this.generateBriefingDate() : undefined,
        briefingTime: hasBriefing ? this.generateBriefingTime() : undefined,
        briefingVenue: hasBriefing ? this.generateBriefingVenue(location) : undefined,
        submissionDeadline: this.generateSubmissionDeadline(),
        estimatedValue: this.generateEstimatedValue(),
        category,
        requirements: this.generateRequirements(category),
        contactPerson: this.generateContactPerson(),
        contactEmail: this.generateContactEmail(organization),
        contactPhone: this.generateContactPhone(),
        source: 'eTenders',
        sourceUrl: `${this.baseUrl}/tender/${tenderId}`,
        isCompulsoryBriefing: hasBriefing,
        briefingType: hasBriefing ? 'compulsory' : 'information',
        scrapedAt: new Date(),
        status: 'active'
      }
      
      mockTenders.push(tender)
    }
    
    return mockTenders
  }

  private generateTenderTitle(category: string, hasBriefing: boolean): string {
    const baseTitles = {
      'Construction': [
        'Infrastructure Development Project',
        'Building Construction Services',
        'Road Construction and Maintenance',
        'Public Building Renovation',
        'Civil Engineering Works'
      ],
      'Technology': [
        'IT Infrastructure Upgrade',
        'Software Development Services',
        'Digital Transformation Project',
        'Network Security Implementation',
        'Data Management System'
      ],
      'Healthcare': [
        'Medical Equipment Procurement',
        'Healthcare Services Provision',
        'Hospital Infrastructure Development',
        'Medical Supplies and Equipment',
        'Healthcare Technology Solutions'
      ],
      'Education': [
        'Educational Technology Integration',
        'School Infrastructure Development',
        'Learning Management System',
        'Educational Content Development',
        'Training and Development Services'
      ],
      'Transportation': [
        'Public Transport Services',
        'Transportation Infrastructure',
        'Fleet Management Services',
        'Logistics and Distribution',
        'Transportation Technology'
      ]
    }
    
    const titles = baseTitles[category as keyof typeof baseTitles] || baseTitles['Construction']
    const baseTitle = titles[Math.floor(Math.random() * titles.length)]
    
    if (hasBriefing) {
      return `${baseTitle} - Compulsory Briefing Required`
    }
    
    return baseTitle
  }

  private generateTenderDescription(category: string, hasBriefing: boolean): string {
    const baseDescription = `This tender involves the procurement of ${category.toLowerCase()} services and solutions. The project aims to improve service delivery and operational efficiency.`
    
    if (hasBriefing) {
      return `${baseDescription} A compulsory briefing session will be held to provide detailed information about the tender requirements and submission process. All interested parties are required to attend this briefing session.`
    }
    
    return baseDescription
  }

  private generateBriefingDate(): Date {
    const today = new Date()
    const daysFromNow = Math.floor(Math.random() * 30) + 7 // 7-37 days from now
    const briefingDate = new Date(today.getTime() + daysFromNow * 24 * 60 * 60 * 1000)
    return briefingDate
  }

  private generateBriefingTime(): string {
    const times = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM']
    return times[Math.floor(Math.random() * times.length)]
  }

  private generateBriefingVenue(location: string): string {
    const venues = [
      'City Hall',
      'Convention Centre',
      'Government Building',
      'Community Centre',
      'Conference Centre',
      'Municipal Offices'
    ]
    
    const venue = venues[Math.floor(Math.random() * venues.length)]
    return `${venue}, ${location}`
  }

  private generateSubmissionDeadline(): Date {
    const today = new Date()
    const daysFromNow = Math.floor(Math.random() * 60) + 30 // 30-90 days from now
    const deadline = new Date(today.getTime() + daysFromNow * 24 * 60 * 60 * 1000)
    return deadline
  }

  private generateEstimatedValue(): number {
    const values = [50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000]
    return values[Math.floor(Math.random() * values.length)]
  }

  private generateRequirements(category: string): string[] {
    const baseRequirements = [
      'Valid tax clearance certificate',
      'Company registration documents',
      'Financial statements for the last 3 years',
      'B-BBEE certificate',
      'Professional indemnity insurance'
    ]
    
    const categoryRequirements = {
      'Construction': ['CIDB registration', 'Construction experience', 'Safety compliance'],
      'Technology': ['Technical certifications', 'Software development experience', 'Security clearance'],
      'Healthcare': ['Medical device experience', 'Healthcare compliance', 'Clinical experience'],
      'Education': ['Educational technology experience', 'Teacher training programs', 'Curriculum development'],
      'Transportation': ['Transport licenses', 'Fleet management experience', 'Logistics expertise']
    }
    
    const specificRequirements = categoryRequirements[category as keyof typeof categoryRequirements] || []
    
    return [...baseRequirements, ...specificRequirements]
  }

  private generateContactPerson(): string {
    const firstNames = ['John', 'Sarah', 'Michael', 'Lisa', 'David', 'Jennifer', 'Robert', 'Amanda']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    
    return `${firstName} ${lastName}`
  }

  private generateContactEmail(organization: string): string {
    const domain = organization.toLowerCase().replace(/\s+/g, '').replace(/department/g, '') + '.gov.za'
    const names = ['procurement', 'tenders', 'contracts', 'admin']
    const name = names[Math.floor(Math.random() * names.length)]
    
    return `${name}@${domain}`
  }

  private generateContactPhone(): string {
    const areaCodes = ['011', '021', '031', '012', '041', '051', '013', '014', '015', '016']
    const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)]
    const number = Math.floor(Math.random() * 9000000) + 1000000
    
    return `+27 ${areaCode} ${number.toString().slice(0, 3)} ${number.toString().slice(3)}`
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export a singleton instance
export const etendersScraper = new ETendersScraper()
