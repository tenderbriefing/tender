const { getSourceById } = require('../../../../config/procurementSources')
const base = require('../_sourceScraperBase')

async function scrape() {
  const source = getSourceById('city_of_johannesburg')
  return base.runGenericSourceScraper(source, [
    '/',
    '/work_with_us/Pages/Tenders.aspx',
    '/tenders',
  ])
}

module.exports = { scrape, sourceId: 'city_of_johannesburg' }
