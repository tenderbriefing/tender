/**
 * Offline eTenders scraper smoke (no Firestore). Requires network access to etenders.gov.za.
 * Run: npm run test:scraper-offline
 */
import { ETendersScraper } from '../lib/scrapers/etenders'

async function testScraperOffline() {
  try {
    console.log('Testing eTenders scraper (offline mode)...')

    const scraper = new ETendersScraper()
    console.log('Testing tender scraping...')
    const result = await scraper.scrapeTenders()

    console.log('Scraping test completed.')
    console.log('\nResults:')
    console.log(`- Success: ${result.success}`)
    console.log(`- Total found: ${result.totalFound}`)
    console.log(`- Tenders with briefings: ${result.tenders.length}`)
    console.log(`- Errors: ${result.errors.length}`)

    if (result.tenders.length > 0) {
      console.log('\nSample tenders:')
      result.tenders.slice(0, 3).forEach((tender, index) => {
        console.log(`\n${index + 1}. ${tender.title}`)
        console.log(`   Organization: ${tender.organization}`)
        console.log(`   Location: ${tender.location}`)
        console.log(
          `   Briefing Date: ${tender.briefingDate ? tender.briefingDate.toDateString() : 'N/A'}`
        )
        console.log(`   Estimated Value: R${tender.estimatedValue?.toLocaleString() || 'N/A'}`)
        console.log(`   Source: ${tender.source}`)
      })
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:')
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
    }

    if (!result.success) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error('Error testing scraper:', error)
    process.exit(1)
  }
}

testScraperOffline()
