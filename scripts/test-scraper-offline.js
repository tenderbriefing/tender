// Offline test for the scraper functionality
const { ETendersScraper } = require('../lib/scrapers/etenders');

async function testScraperOffline() {
  try {
    console.log('🧪 Testing eTenders scraper (offline mode)...');

    // Create scraper instance
    const scraper = new ETendersScraper();
    
    // Test the scraping functionality
    console.log('📋 Testing tender scraping...');
    const result = await scraper.scrapeTenders();
    
    console.log('✅ Scraping test completed!');
    console.log('\n📊 Results:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Total found: ${result.totalFound}`);
    console.log(`- Tenders with briefings: ${result.tenders.length}`);
    console.log(`- Errors: ${result.errors.length}`);
    
    if (result.tenders.length > 0) {
      console.log('\n📋 Sample tenders:');
      result.tenders.slice(0, 3).forEach((tender, index) => {
        console.log(`\n${index + 1}. ${tender.title}`);
        console.log(`   Organization: ${tender.organization}`);
        console.log(`   Location: ${tender.location}`);
        console.log(`   Briefing Date: ${tender.briefingDate ? tender.briefingDate.toDateString() : 'N/A'}`);
        console.log(`   Estimated Value: R${tender.estimatedValue?.toLocaleString() || 'N/A'}`);
        console.log(`   Source: ${tender.source}`);
      });
    }
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎉 Scraper test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Set up Firebase configuration in .env.local');
    console.log('2. Run the full test with database integration');
    console.log('3. Start the development server to see the dashboard');

  } catch (error) {
    console.error('❌ Error testing scraper:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testScraperOffline();
