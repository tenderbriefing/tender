const { getSourceById } = require('../../../../config/procurementSources')
const base = require('../_sourceScraperBase')

async function scrape() {
  const source = getSourceById('sanral')
  return base.runGenericSourceScraper(source, ['/', '/tenders', '/procurement'])
}

module.exports = { scrape, sourceId: 'sanral' }
