const { getSourceById } = require('../../../../config/procurementSources')
const base = require('../_sourceScraperBase')

async function scrape() {
  const source = getSourceById('eskom')
  return base.runGenericSourceScraper(source, ['/', '/tenders', '/business/tenders'])
}

module.exports = { scrape, sourceId: 'eskom' }
