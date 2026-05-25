const { getSourceById } = require('../../../../config/procurementSources')
const base = require('../_sourceScraperBase')

async function scrape() {
  const source = getSourceById('ekurhuleni')
  return base.runGenericSourceScraper(source, ['/', '/business/tenders', '/tenders'])
}

module.exports = { scrape, sourceId: 'ekurhuleni' }
