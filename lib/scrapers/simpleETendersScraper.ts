import { ScrapedTender } from './types'

export class SimpleETendersScraper {
  private baseUrl = 'https://www.etenders.gov.za'

  async scrapeTenders(): Promise<{ success: boolean; tenders: ScrapedTender[]; errors: string[]; source: string; scrapedAt: Date; totalFound: number; newTenders: number; updatedTenders: number }> {
    try {
      console.log('🚀 Starting comprehensive API-based eTenders scraping...')
      
      // Step 1: Get tender IDs from the API
      const tenderIds = await this.getTenderIdsFromAPI()
      console.log(`📊 Found ${tenderIds.length} tender IDs from API`)
      
      if (tenderIds.length === 0) {
        console.log('⚠️ No tender IDs found, returning empty result')
        return {
          success: true,
          tenders: [],
          errors: [],
          source: 'eTenders.gov.za API',
          scrapedAt: new Date(),
          totalFound: 0,
          newTenders: 0,
          updatedTenders: 0
        }
      }
      
      // Step 2: Fetch detailed information for each tender
      const tenders: ScrapedTender[] = []
      const errors: string[] = []
      
      console.log(`🔍 Fetching detailed information for ${tenderIds.length} tenders...`)
      
      for (let i = 0; i < Math.min(tenderIds.length, 50); i++) { // Limit to 50 for performance
        const tenderId = tenderIds[i]
        try {
          console.log(`📄 Processing tender ${i + 1}/${Math.min(tenderIds.length, 50)}: ${tenderId}`)
          
          const tender = await this.fetchTenderDetails(tenderId)
          if (tender && this.isValidTender(tender)) {
            // Filter for RFP/RFQ/RFI with compulsory briefings
            if (this.isRFP_RFQ_RFI(tender) && this.hasCompulsoryBriefing(tender)) {
              tenders.push(tender)
              console.log(`✅ Added tender: ${tender.title.substring(0, 50)}...`)
            }
          }
        } catch (error) {
          const errorMsg = `Failed to fetch tender ${tenderId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
        
        // Add small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      console.log(`🎯 Successfully processed ${tenders.length} RFP/RFQ/RFI tenders with compulsory briefings`)
      
      return {
        success: true,
        tenders: tenders,
        errors: errors,
        source: 'eTenders.gov.za API + Individual Pages',
        scrapedAt: new Date(),
        totalFound: tenders.length,
        newTenders: tenders.length,
        updatedTenders: 0
      }

    } catch (error) {
      console.error('❌ Comprehensive scraping error:', error)
      return {
        success: false,
        tenders: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        source: 'eTenders.gov.za API',
        scrapedAt: new Date(),
        totalFound: 0,
        newTenders: 0,
        updatedTenders: 0
      }
    }
  }

  private async getTenderIdsFromAPI(): Promise<string[]> {
    try {
      console.log('📡 Fetching tender IDs from API...')
      
      const apiUrl = `${this.baseUrl}/Home/PaginatedTenderOpportunities`
      
      // Prepare the request body exactly like the website does
      const requestBody = {
        start: 0,
        length: 100, // Get up to 100 tenders
        status: 1, // Currently advertised tenders
        category: '',
        department: '',
        province: '',
        cluster: '',
        types: '',
        esubmission: '',
        tenderNumber: '',
        bidders: '',
        maaNumber: ''
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${this.baseUrl}/Home/opportunities`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`)
      }

      const apiData = await response.json()
      console.log('📊 API Response received:', {
        draw: apiData.draw,
        recordsTotal: apiData.recordsTotal,
        recordsFiltered: apiData.recordsFiltered,
        dataLength: apiData.data?.length || 0
      })

      // Extract tender IDs from the API response
      const tenderIds: string[] = []
      
      if (apiData.data && Array.isArray(apiData.data)) {
        for (const tenderData of apiData.data) {
          // Look for tender ID in various possible locations
          const tenderId = tenderData.tender_Id || tenderData.id || tenderData.tenderId || tenderData[0]
          if (tenderId && typeof tenderId === 'string') {
            tenderIds.push(tenderId)
          }
        }
      }
      
      console.log(`📊 Extracted ${tenderIds.length} tender IDs`)
      return tenderIds
      
    } catch (error) {
      console.error('❌ Error fetching tender IDs from API:', error)
      return []
    }
  }

  private async fetchTenderDetails(tenderId: string): Promise<ScrapedTender | null> {
    try {
      // Construct the individual tender URL
      const tenderUrl = `${this.baseUrl}/Home/opportunity?id=${tenderId}`
      console.log(`🔍 Fetching tender details from: ${tenderUrl}`)
      
      const response = await fetch(tenderUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch tender details: ${response.status}`)
      }

      const html = await response.text()
      console.log(`📄 Fetched tender page: ${html.length} characters`)
      
      // Parse the individual tender page to extract detailed information
      return this.parseTenderDetailPage(html, tenderId)
      
    } catch (error) {
      console.error(`❌ Error fetching tender details for ${tenderId}:`, error)
      return null
    }
  }

  private parseTenderDetailPage(html: string, tenderId: string): ScrapedTender | null {
    try {
      console.log(`🔍 Parsing tender detail page for ID: ${tenderId}`)
      
      // Extract title from the page
      const titleMatch = html.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) || 
                        html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                        html.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/div>/i)
      
      const title = titleMatch ? titleMatch[1].trim() : `Tender ${tenderId}`
      
      // Extract description
      const descriptionMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                               html.match(/<p[^>]*>([^<]+)<\/p>/i)
      
      const description = descriptionMatch ? descriptionMatch[1].trim() : title
      
      // Extract organization
      const orgMatch = html.match(/<div[^>]*class="[^"]*organization[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                       html.match(/<span[^>]*class="[^"]*org[^"]*"[^>]*>([^<]+)<\/span>/i)
      
      const organization = orgMatch ? orgMatch[1].trim() : this.extractOrganizationFromTitle(title)
      
      // Extract category
      const categoryMatch = html.match(/<div[^>]*class="[^"]*category[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                            html.match(/<span[^>]*class="[^"]*cat[^"]*"[^>]*>([^<]+)<\/span>/i)
      
      const category = categoryMatch ? categoryMatch[1].trim() : 'General'
      
      // Extract closing date
      const closingMatch = html.match(/<div[^>]*class="[^"]*closing[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                           html.match(/<span[^>]*class="[^"]*deadline[^"]*"[^>]*>([^<]+)<\/span>/i)
      
      const closingDate = closingMatch ? closingMatch[1].trim() : ''
      
      // Extract document links
      const documentLinks = this.extractDocumentLinks(html)
      
      return {
        id: `tender-${tenderId}`,
        title: title,
        description: description,
        organization: organization,
        location: 'South Africa',
        category: category,
        status: 'active',
        sourceUrl: `${this.baseUrl}/Home/opportunity?id=${tenderId}`,
        scrapedAt: new Date(),
        isCompulsoryBriefing: this.hasCompulsoryBriefing({
          id: `temp-${Date.now()}`,
          title,
          description,
          organization: 'Government Department',
          location: 'South Africa',
          category: 'General',
          status: 'active',
          sourceUrl: `${this.baseUrl}/Home/opportunity?id=${tenderId}`,
          scrapedAt: new Date(),
          submissionDeadline: new Date(),
          requirements: [],
          source: 'eTenders.gov.za',
          briefingType: 'compulsory' as const,
          isCompulsoryBriefing: false
        }),
        submissionDeadline: this.parseDate(closingDate) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        requirements: ['Valid business registration', 'Tax clearance certificate'],
        source: 'eTenders.gov.za',
        briefingType: 'compulsory' as const
      }
      
    } catch (error) {
      console.error(`❌ Error parsing tender detail page for ${tenderId}:`, error)
      return null
    }
  }

  private extractDocumentLinks(html: string): string[] {
    const documentLinks: string[] = []
    
    try {
      // Look for various document link patterns
      const linkPatterns = [
        /<a[^>]*href="([^"]*\.pdf[^"]*)"[^>]*>/gi,
        /<a[^>]*href="([^"]*\.docx?[^"]*)"[^>]*>/gi,
        /<a[^>]*href="([^"]*\.xlsx?[^"]*)"[^>]*>/gi,
        /<a[^>]*href="([^"]*\.zip[^"]*)"[^>]*>/gi,
        /<a[^>]*href="([^"]*download[^"]*)"[^>]*>/gi
      ]
      
      for (const pattern of linkPatterns) {
        let match
        while ((match = pattern.exec(html)) !== null) {
          const link = match[1]
          if (link && !documentLinks.includes(link)) {
            documentLinks.push(link)
          }
        }
      }
      
      console.log(`📄 Found ${documentLinks.length} document links`)
      return documentLinks
      
    } catch (error) {
      console.error('❌ Error extracting document links:', error)
      return []
    }
  }

  private parseAPIResponse(apiData: any): ScrapedTender[] {
    const tenders: ScrapedTender[] = []
    
    try {
      console.log('🔍 Parsing API response for tender data...')
      
      if (!apiData.data || !Array.isArray(apiData.data)) {
        console.log('⚠️ No data array found in API response')
        return tenders
      }
      
      console.log(`📊 Processing ${apiData.data.length} tender records from API`)
      
      for (const tenderData of apiData.data) {
        const tender = this.extractTenderFromAPIData(tenderData)
        if (tender && this.isValidTender(tender)) {
          // Filter for RFP/RFQ/RFI with compulsory briefings
          if (this.isRFP_RFQ_RFI(tender) && this.hasCompulsoryBriefing(tender)) {
            tenders.push(tender)
          }
        }
      }
      
      console.log(`🎯 Filtered to ${tenders.length} RFP/RFQ/RFI tenders with compulsory briefings`)
      
      return tenders
    } catch (error) {
      console.error('❌ API response parsing error:', error)
      return []
    }
  }

  private extractTenderFromAPIData(tenderData: any): ScrapedTender | null {
    try {
      // The API data structure should contain the tender information
      // We need to map the API fields to our ScrapedTender interface
      const title = tenderData[1] || tenderData.title || tenderData.description || '' // Usually in second column
      const category = tenderData[0] || tenderData.category || 'General' // Usually in first column
      const eSubmission = tenderData[2] || tenderData.esubmission || ''
      const advertised = tenderData[3] || tenderData.advertised || tenderData.published || ''
      const closing = tenderData[4] || tenderData.closing || tenderData.deadline || ''
      
      if (!title || title.length < 10) return null
      
      // Skip header rows
      if (title.toLowerCase().includes('tender description') || 
          title.toLowerCase().includes('category') ||
          title.toLowerCase().includes('currently advertised')) {
        return null
      }
      
      return {
        id: `tender-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: title,
        description: title,
        organization: this.extractOrganizationFromTitle(title),
        location: 'South Africa',
        category: category,
        status: 'active',
        sourceUrl: `${this.baseUrl}/Home/opportunities`,
        scrapedAt: new Date(),
        isCompulsoryBriefing: this.hasCompulsoryBriefing({
          id: `temp-${Date.now()}`,
          title,
          description: title,
          organization: 'Government Department',
          location: 'South Africa',
          category: 'General',
          status: 'active',
          sourceUrl: `${this.baseUrl}/Home/opportunities`,
          scrapedAt: new Date(),
          submissionDeadline: new Date(),
          requirements: [],
          source: 'eTenders.gov.za',
          briefingType: 'compulsory' as const,
          isCompulsoryBriefing: false
        }),
        submissionDeadline: this.parseDate(closing) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        requirements: ['Valid business registration', 'Tax clearance certificate'],
        source: 'eTenders.gov.za',
        briefingType: 'compulsory' as const
      }
      
    } catch (error) {
      console.error('❌ Error extracting tender from API data:', error)
      return null
    }
  }

  private parseHTMLForTenders(html: string): ScrapedTender[] {
    const tenders: ScrapedTender[] = []
    
    try {
      console.log('🔍 Analyzing HTML structure for tender data...')
      
      // Check if we have popup content that needs to be handled
      const hasPopups = html.includes('modal') || html.includes('popup') || html.includes('TempPopupModal') || html.includes('educationalPopup')
      if (hasPopups) {
        console.log('⚠️ Detected popup content in HTML - attempting to extract data anyway...')
      }
      
      // Look for multiple table structures that might contain tender data
      const tableSelectors = [
        /<table[^>]*id="tendeList"[^>]*>[\s\S]*?<\/table>/gi, // Main tender table
        /<table[^>]*class="[^"]*display[^"]*"[^>]*>[\s\S]*?<\/table>/gi, // DataTable
        /<table[^>]*>[\s\S]*?<\/table>/gi, // Any table
        /<tr[^>]*>[\s\S]*?<\/tr>/gi, // Table rows
        /<div[^>]*class="[^"]*tender[^"]*"[^>]*>[\s\S]*?<\/div>/gi, // Tender divs
        /<div[^>]*class="[^"]*row[^"]*"[^>]*>[\s\S]*?<\/div>/gi, // Row divs
        /<li[^>]*>[\s\S]*?<\/li>/gi, // List items
        /<div[^>]*class="[^"]*item[^"]*"[^>]*>[\s\S]*?<\/div>/gi // Item divs
      ]
      
      let allRows: string[] = []
      
      for (const selector of tableSelectors) {
        const matches = html.match(selector) || []
        allRows.push(...matches)
      }
      
      // Remove duplicates
      allRows = Array.from(new Set(allRows))
      
      console.log(`🔍 Found ${allRows.length} potential tender rows/items`)
      
      // Log some sample rows for debugging
      if (allRows.length > 0) {
        console.log(`📋 Sample rows (first 3):`)
        allRows.slice(0, 3).forEach((row, index) => {
          const cleanRow = row.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
          console.log(`${index + 1}. ${cleanRow.substring(0, 100)}...`)
        })
      }
      
      for (const row of allRows) {
        const tender = this.extractTenderFromRow(row)
        if (tender && this.isValidTender(tender)) {
          // Filter for RFP/RFQ/RFI with compulsory briefings
          if (this.isRFP_RFQ_RFI(tender) && this.hasCompulsoryBriefing(tender)) {
            tenders.push(tender)
          }
        }
      }
      
      console.log(`🎯 Filtered to ${tenders.length} RFP/RFQ/RFI tenders with compulsory briefings`)
      
      return tenders
    } catch (error) {
      console.error('❌ HTML parsing error:', error)
      return []
    }
  }

  private extractTenderFromRow(row: string): ScrapedTender | null {
    try {
      // Extract text content from various HTML structures
      const cellSelectors = [
        /<td[^>]*>([\s\S]*?)<\/td>/g, // Table cells
        /<div[^>]*class="[^"]*cell[^"]*"[^>]*>([\s\S]*?)<\/div>/g, // Div cells
        /<span[^>]*class="[^"]*cell[^"]*"[^>]*>([\s\S]*?)<\/span>/g, // Span cells
        /<div[^>]*>([\s\S]*?)<\/div>/g, // Any divs
        /<span[^>]*>([\s\S]*?)<\/span>/g, // Any spans
        /<p[^>]*>([\s\S]*?)<\/p>/g, // Paragraphs
        /<li[^>]*>([\s\S]*?)<\/li>/g // List items
      ]
      
      const cells: string[] = []
      
      for (const selector of cellSelectors) {
        let match
        while ((match = selector.exec(row)) !== null) {
          // Clean up the cell content
          let cellContent = match[1]
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
            .replace(/&amp;/g, '&') // Replace &amp; with &
            .replace(/&lt;/g, '<') // Replace &lt; with <
            .replace(/&gt;/g, '>') // Replace &gt; with >
            .replace(/&quot;/g, '"') // Replace &quot; with "
            .replace(/&#39;/g, "'") // Replace &#39; with '
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim()
          
          if (cellContent && cellContent.length > 0) {
            cells.push(cellContent)
          }
        }
      }
      
      if (cells.length < 2) return null // Not enough cells for a valid tender
      
      // Try to identify the most likely title (longest meaningful text)
      let title = ''
      let category = 'General'
      let eSubmission = ''
      let advertised = ''
      let closing = ''
      
      // Look for the most likely title (longest meaningful text)
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].length > title.length && cells[i].length > 10) {
          title = cells[i]
        }
      }
      
      // Try to identify other fields
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i].toLowerCase()
        if (cell.includes('category') || cell.includes('type')) {
          category = cells[i]
        } else if (cell.includes('esubmission') || cell.includes('electronic')) {
          eSubmission = cells[i]
        } else if (cell.includes('advertised') || cell.includes('published')) {
          advertised = cells[i]
        } else if (cell.includes('closing') || cell.includes('deadline')) {
          closing = cells[i]
        }
      }
      
      if (!title || title.length < 10) return null // Title too short or missing
      
      // Skip header rows and popup content
      if (title.toLowerCase().includes('tender description') || 
          title.toLowerCase().includes('category') ||
          title.toLowerCase().includes('currently advertised') ||
          title.toLowerCase().includes('modal') ||
          title.toLowerCase().includes('popup') ||
          title.toLowerCase().includes('login required') ||
          title.toLowerCase().includes('bookmark') ||
          title.toLowerCase().includes('educational')) {
        return null
      }
      
      return {
        id: `tender-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: title,
        description: title, // Use title as description for simplicity
        organization: this.extractOrganizationFromTitle(title),
        location: 'South Africa',
        category: category,
        status: 'active',
        sourceUrl: `${this.baseUrl}/Home/opportunities`,
        scrapedAt: new Date(),
        isCompulsoryBriefing: this.hasCompulsoryBriefing({
          id: `temp-${Date.now()}`,
          title,
          description: title,
          organization: 'Government Department',
          location: 'South Africa',
          category: 'General',
          status: 'active',
          sourceUrl: `${this.baseUrl}/Home/opportunities`,
          scrapedAt: new Date(),
          submissionDeadline: new Date(),
          requirements: [],
          source: 'eTenders.gov.za',
          briefingType: 'compulsory' as const,
          isCompulsoryBriefing: false
        }),
        submissionDeadline: this.parseDate(closing) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        requirements: ['Valid business registration', 'Tax clearance certificate'],
        source: 'eTenders.gov.za',
        briefingType: 'compulsory' as const
      }
      
    } catch (error) {
      console.error('❌ Error extracting tender from row:', error)
      return null
    }
  }

  private extractOrganizationFromTitle(title: string): string {
    // Try to extract organization from title patterns
    const orgPatterns = [
      /(?:Department of|Ministry of|Province of|Municipality of|City of)\s+([^,]+)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Department|Ministry|Province|Municipality)/i
    ]
    
    for (const pattern of orgPatterns) {
      const match = title.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return 'Government Department'
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.trim() === '') return null
    
    try {
      // Try different date formats
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
        /(\d{1,2})-(\d{1,2})-(\d{4})/   // DD-MM-YYYY
      ]
      
      for (const format of formats) {
        const match = dateStr.match(format)
        if (match) {
          if (format === formats[0]) { // DD/MM/YYYY
            return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]))
          } else if (format === formats[1]) { // YYYY-MM-DD
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
          } else if (format === formats[2]) { // DD-MM-YYYY
            return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]))
          }
        }
      }
      
      // Fallback to Date constructor
      return new Date(dateStr)
    } catch (error) {
      console.error('❌ Date parsing error:', error)
      return null
    }
  }

  private isValidTender(tender: ScrapedTender): boolean {
    const title = tender.title.toLowerCase()
    const excludeKeywords = [
      'home', 'login', 'register', 'search', 'filter', 'sort',
      'navigation', 'menu', 'header', 'footer', 'sidebar',
      'javascript', 'function', 'var ', 'script', 'style',
      'bootstrap', 'jquery', 'css', 'html', 'meta', 'advertised',
      'category', 'title', 'e-submission', 'advertised date', 'closing date',
      'tender description', 'currently advertised', 'tenders'
    ]
    
    return !excludeKeywords.some(keyword => title.includes(keyword)) && 
           title.length > 10 && 
           title.length < 200
  }

  private isRFP_RFQ_RFI(tender: ScrapedTender): boolean {
    const title = (tender.title || '').toUpperCase()
    const description = (tender.description || '').toUpperCase()
    
    const rfpRfqRfiKeywords = [
      'RFP', 'REQUEST FOR PROPOSAL', 'REQUEST FOR PROPOSALS',
      'RFQ', 'REQUEST FOR QUOTATION', 'REQUEST FOR QUOTATIONS',
      'RFI', 'REQUEST FOR INFORMATION', 'REQUEST FOR INFO'
    ]
    
    return rfpRfqRfiKeywords.some(keyword => 
      title.includes(keyword) || description.includes(keyword)
    )
  }

  private hasCompulsoryBriefing(tender: ScrapedTender): boolean {
    const title = (tender.title || '').toLowerCase()
    const description = (tender.description || '').toLowerCase()
    const fullText = JSON.stringify(tender).toLowerCase()
    
    const compulsoryMeetingKeywords = [
      'compulsory briefing', 'mandatory briefing',
      'compulsory meeting', 'mandatory meeting',
      'briefing session', 'information session',
      'pre-bid meeting', 'pre-proposal meeting',
      'attendance is compulsory', 'must attend briefing',
      'required to attend', 'obligatory briefing'
    ]
    
    return compulsoryMeetingKeywords.some(keyword => 
      title.includes(keyword) || 
      description.includes(keyword) || 
      fullText.includes(keyword)
    )
  }
}

export const simpleETendersScraper = new SimpleETendersScraper()
