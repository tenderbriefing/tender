import { NextRequest, NextResponse } from 'next/server'

// Simple scraping function to get real data from eTenders
async function scrapeRealTenders() {
  try {
    console.log('🚀 Starting real eTenders scraping...')
    
    // Try to fetch from eTenders directly
    const response = await fetch('https://www.etenders.gov.za/Home/opportunities', {
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
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    console.log(`📄 Fetched HTML content: ${html.length} characters`)

    // Parse HTML for tender data
    const tenders = parseHTMLForTenders(html)
    console.log(`📊 Found ${tenders.length} tenders`)

    return tenders
  } catch (error) {
    console.error('❌ Scraping error:', error)
    return []
  }
}

// Debug function to scrape all tenders without filtering
async function scrapeAllTenders() {
  try {
    console.log('🔍 Starting debug scraping (no filtering)...')
    
    // Try to fetch from eTenders directly
    const response = await fetch('https://www.etenders.gov.za/Home/opportunities', {
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
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    console.log(`📄 Fetched HTML content: ${html.length} characters`)

    // Parse HTML for all tender data (no filtering)
    const allTenders = parseHTMLForAllTenders(html)
    console.log(`📊 Found ${allTenders.length} total tenders (no filtering)`)

    return allTenders
  } catch (error) {
    console.error('❌ Debug scraping error:', error)
    return []
  }
}

function parseHTMLForTenders(html: string) {
  const tenders: any[] = []
  
  try {
    // Look for table rows with tender data
    const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
    const rows = html.match(tableRowRegex) || []
    
    console.log(`🔍 Found ${rows.length} table rows`)
    
    for (const row of rows) {
      const tender = extractTenderFromRow(row)
      if (tender && isActualTender(tender)) {
        tenders.push(tender)
      }
    }
    
    // Filter for RFP/RFQ/RFI with compulsory briefings
    const filteredTenders = tenders.filter(tender => 
      isRFP_RFQ_RFI(tender) && hasCompulsoryBriefing(tender)
    )
    
    console.log(`🎯 Filtered to ${filteredTenders.length} RFP/RFQ/RFI tenders with compulsory briefings`)
    
    return filteredTenders
  } catch (error) {
    console.error('❌ HTML parsing error:', error)
    return []
  }
}

function parseHTMLForAllTenders(html: string) {
  const tenders: any[] = []
  
  try {
    // Look for multiple table structures
    const tableSelectors = [
      /<tr[^>]*>[\s\S]*?<\/tr>/gi, // Standard table rows
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
    
    console.log(`🔍 Found ${allRows.length} potential tender rows`)
    
    // Log some sample rows for debugging
    if (allRows.length > 0) {
      console.log(`📋 Sample rows (first 3):`)
      allRows.slice(0, 3).forEach((row, index) => {
        const cleanRow = row.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        console.log(`${index + 1}. ${cleanRow.substring(0, 100)}...`)
      })
    }
    
    for (const row of allRows) {
      const tender = extractTenderFromRow(row)
      if (tender && isActualTender(tender)) {
        tenders.push(tender)
      }
    }
    
    console.log(`📊 Found ${tenders.length} total tenders (no filtering applied)`)
    
    return tenders
  } catch (error) {
    console.error('❌ HTML parsing error:', error)
    return []
  }
}

function extractTenderFromRow(row: string) {
  try {
    // More comprehensive cell extraction
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
    const cells: string[] = []
    let match
    
    while ((match = cellRegex.exec(row)) !== null) {
      // Clean up the cell content
      let cellContent = match[1]
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
        .replace(/&amp;/g, '&') // Replace &amp; with &
        .replace(/&lt;/g, '<') // Replace &lt; with <
        .replace(/&gt;/g, '>') // Replace &gt; with >
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim()
      
      cells.push(cellContent)
    }
    
    if (cells.length < 2) return null
    
    // Try different cell positions for title and organization
    let title = ''
    let organization = ''
    
    // Look for the most likely title (longest meaningful text)
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].length > title.length && cells[i].length > 10) {
        title = cells[i]
      }
    }
    
    // Organization is usually in the first cell or a shorter cell
    organization = cells[0] || cells.find(cell => cell.length < 50 && cell.length > 5) || 'Government Department'
    
    if (!title || title.length < 10) return null
    
    // Skip rows that look like headers or navigation
    const headerKeywords = ['tender', 'title', 'organization', 'category', 'closing', 'advertised', 'esubmission']
    if (headerKeywords.some(keyword => title.toLowerCase().includes(keyword) && title.length < 50)) {
      return null
    }
    
    return {
      id: `tender-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title,
      description: title,
      organization: organization,
      location: 'South Africa',
      category: extractCategoryFromTitle(title),
      status: 'active',
      sourceUrl: 'https://www.etenders.gov.za/Home/opportunities',
      scrapedAt: new Date().toISOString(),
      hasCompulsoryBriefing: hasCompulsoryBriefing({ title, description: title })
    }
  } catch (error) {
    return null
  }
}

function isActualTender(tender: any): boolean {
  const title = tender.title.toLowerCase()
  const excludeKeywords = [
    'home', 'login', 'register', 'search', 'filter', 'sort',
    'navigation', 'menu', 'header', 'footer', 'sidebar',
    'javascript', 'function', 'var ', 'script', 'style',
    'bootstrap', 'jquery', 'css', 'html', 'meta'
  ]
  
  return !excludeKeywords.some(keyword => title.includes(keyword)) && 
         title.length > 10 && 
         title.length < 200
}

function isRFP_RFQ_RFI(tender: any): boolean {
  const title = tender.title.toUpperCase()
  const description = tender.description.toUpperCase()
  
  const rfpRfqRfiKeywords = [
    'RFP', 'REQUEST FOR PROPOSAL', 'REQUEST FOR PROPOSALS',
    'RFQ', 'REQUEST FOR QUOTATION', 'REQUEST FOR QUOTATIONS',
    'RFI', 'REQUEST FOR INFORMATION', 'REQUEST FOR INFO'
  ]
  
  return rfpRfqRfiKeywords.some(keyword => 
    title.includes(keyword) || description.includes(keyword)
  )
}

function hasCompulsoryBriefing(tender: any): boolean {
  const title = (tender.title || '').toLowerCase()
  const description = (tender.description || '').toLowerCase()
  
  const compulsoryMeetingKeywords = [
    'compulsory briefing', 'mandatory briefing',
    'compulsory meeting', 'mandatory meeting',
    'briefing session', 'information session',
    'pre-bid meeting', 'pre-proposal meeting',
    'attendance is compulsory', 'must attend briefing',
    'required to attend', 'obligatory briefing'
  ]
  
  return compulsoryMeetingKeywords.some(keyword => 
    title.includes(keyword) || description.includes(keyword)
  )
}

function extractCategoryFromTitle(title: string): string {
  const titleLower = title.toLowerCase()
  
  if (titleLower.includes('construction') || titleLower.includes('building')) return 'Construction'
  if (titleLower.includes('it') || titleLower.includes('software')) return 'Information Technology'
  if (titleLower.includes('consulting') || titleLower.includes('services')) return 'Consulting Services'
  if (titleLower.includes('supply') || titleLower.includes('goods')) return 'Supply of Goods'
  if (titleLower.includes('maintenance') || titleLower.includes('repair')) return 'Maintenance'
  if (titleLower.includes('cleaning') || titleLower.includes('sanitation')) return 'Cleaning Services'
  if (titleLower.includes('security') || titleLower.includes('guard')) return 'Security Services'
  if (titleLower.includes('transport') || titleLower.includes('logistics')) return 'Transport & Logistics'
  if (titleLower.includes('medical') || titleLower.includes('health')) return 'Healthcare'
  if (titleLower.includes('education') || titleLower.includes('training')) return 'Education'
  
  return 'General'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'status') {
      return NextResponse.json({
        success: true,
        stats: {
          totalTenders: 0,
          briefingsTenders: 0,
          lastScrapeTime: null,
          isRunning: false,
          recentJobs: []
        }
      })
    }
    
    if (action === 'tenders') {
      // Get real scraped tenders
      const tenders = await scrapeRealTenders()
      
      return NextResponse.json({
        success: true,
        tenders: tenders,
        count: tenders.length
      })
    }
    
    if (action === 'debug') {
      // Debug mode - show all scraped data without filtering
      const allTenders = await scrapeAllTenders()
      
      return NextResponse.json({
        success: true,
        allTenders: allTenders,
        count: allTenders.length,
        message: 'Debug mode - showing all scraped tenders without filtering'
      })
    }
    
    if (action === 'html') {
      // Debug mode - return raw HTML for analysis
      try {
        const response = await fetch('https://www.etenders.gov.za/Home/opportunities', {
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
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const html = await response.text()
        
        return NextResponse.json({
          success: true,
          htmlLength: html.length,
          htmlPreview: html.substring(0, 2000) + '...',
          message: 'Raw HTML content for analysis'
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      success: false,
      message: 'Invalid action'
    }, { status: 400 })
    
  } catch (error) {
    console.error('❌ API Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch (e) {
      // If no JSON body, assume it's a start action
      body = { action: 'start' }
    }
    
    const { action } = body
    
    if (action === 'start') {
      // Trigger real scraping
      const tenders = await scrapeRealTenders()
      
      return NextResponse.json({
        success: true,
        message: `Scraping completed. Found ${tenders.length} tenders with compulsory briefings.`,
        timestamp: new Date().toISOString(),
        tendersFound: tenders.length
      })
    }
    
    return NextResponse.json({
      success: false,
      message: 'Invalid action'
    }, { status: 400 })
    
  } catch (error) {
    console.error('❌ API Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}