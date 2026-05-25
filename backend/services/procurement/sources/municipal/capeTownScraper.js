const { getSourceById } = require('../../../../config/procurementSources')
const base = require('../_sourceScraperBase')

async function scrape() {
  const source = getSourceById('cape_town')
  return base.runGenericSourceScraper(source, ['/', '/tenders', '/business-and-trade/tenders'])
}

module.exports = { scrape, sourceId: 'cape_town' }
